import express, { Request, Response } from 'express';
import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { generateSvgQrCode } from './src/utils/pix.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT || 3000);

function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value.trim().replace(/\/$/, '');
  }
}

const allowedOrigins = new Set(
  (process.env.FRONTEND_URL || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean),
);

app.use((req: Request, res: Response, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(normalizeOrigin(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'bingoupix-backend' });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'bingoupix-backend' });
});

// In-Memory Database & State
interface StoredUser {
  id: string;
  name: string;
  balance: number;
  pixKey?: {
    type: 'cpf' | 'phone' | 'email' | 'random';
    key: string;
    name: string;
  };
}

interface StoredCard {
  id: string;
  roundId: number;
  userId: string;
  userName: string;
  isUser: boolean;
  numbers: number[][]; // 5x5
  marked: boolean[][];  // 5x5
  hasWon: boolean;
  winningPattern?: {
    type: 'row' | 'column' | 'diagonal' | 'full';
    index?: number;
    cells: [number, number][];
  };
}

interface StoredWinner {
  userId: string;
  userName: string;
  isUser: boolean;
  cardId: string;
  patternType: 'row' | 'column' | 'diagonal' | 'full';
  patternName: string;
  prizeAmount: number;
  totalPot: number;
  pixKey: {
    type: 'cpf' | 'phone' | 'email' | 'random';
    key: string;
    name: string;
  };
  mercadoPagoPaymentId: string;
  mercadoPagoStatus: 'approved' | 'in_process' | 'failed';
  timestamp: number;
}

interface StoredMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  isSystem?: boolean;
  systemType?: 'ball' | 'round' | 'winner' | 'pix' | 'join';
  timestamp: number;
}

// Bot players to keep the room lively and ensure real competitive pots
const BOT_PLAYERS = [
  { id: 'bot-1', name: 'Luciana_SP', avatar: '👩' },
  { id: 'bot-2', name: 'MarcosBingo', avatar: '👨' },
  { id: 'bot-3', name: 'Patricia_RJ', avatar: '👩‍🦰' },
  { id: 'bot-4', name: 'Carlos_MG', avatar: '🧔' },
  { id: 'bot-5', name: 'Bruna_RS', avatar: '👱‍♀️' },
  { id: 'bot-6', name: 'Rafael_BA', avatar: '👨‍🦱' },
  { id: 'bot-7', name: 'Fernanda_PR', avatar: '👧' },
  { id: 'bot-8', name: 'Diego_GO', avatar: '🧑' },
];

let roundCounter = 101;
let roundStatus: 'waiting' | 'in_progress' | 'finished' = 'waiting';
let roundStartTime = Date.now();
let waitingSecondsRemaining = 60; // 1 minute between rounds
let ballDrawIntervalRemaining = 10; // 10 seconds per ball
let drawnNumbers: number[] = [];
let currentDrawnNumber: number | null = null;
let activeCards: StoredCard[] = [];
let currentWinner: StoredWinner | null = null;
const winnerHistory: StoredWinner[] = [
  {
    userId: 'bot-1',
    userName: 'Luciana_SP',
    isUser: false,
    cardId: 'card-prev-1',
    patternType: 'row',
    patternName: 'Linha Horizontal #3',
    prizeAmount: 32.0,
    totalPot: 40.0,
    pixKey: { type: 'email', key: 'luciana.sp.mp@exemplo.com', name: 'Luciana M. Silva' },
    mercadoPagoPaymentId: 'MP-PIX-9823481239',
    mercadoPagoStatus: 'approved',
    timestamp: Date.now() - 180000,
  },
  {
    userId: 'bot-4',
    userName: 'Carlos_MG',
    isUser: false,
    cardId: 'card-prev-2',
    patternType: 'column',
    patternName: 'Coluna Vertical #2',
    prizeAmount: 48.0,
    totalPot: 60.0,
    pixKey: { type: 'email', key: 'carlos.mg.mp@exemplo.com', name: 'Carlos E. Santos' },
    mercadoPagoPaymentId: 'MP-PIX-9823489110',
    mercadoPagoStatus: 'approved',
    timestamp: Date.now() - 360000,
  }
];

const chatMessages: StoredMessage[] = [
  {
    id: 'msg-init-1',
    senderId: 'system',
    senderName: 'Sistema PixBingo',
    senderAvatar: '🎱',
    text: 'Bem-vindo ao PixBingo! Cartelas a R$ 1,00 e prêmio de 80% repassado via Pix Mercado Pago.',
    isSystem: true,
    systemType: 'round',
    timestamp: Date.now() - 50000,
  },
  {
    id: 'msg-init-2',
    senderId: 'bot-2',
    senderName: 'MarcosBingo',
    senderAvatar: '👨',
    text: 'Boa sorte a todos na próxima rodada! 🤞',
    timestamp: Date.now() - 30000,
  }
];

// In-memory users map (primary user + bots)
const users: Record<string, StoredUser> = {
  'user-me': {
    id: 'user-me',
    name: 'Você (Jogador)',
    balance: 0,
  }
};

function playerIdFromRequest(req: Request): string {
  const raw = String(req.body?.userId || req.query.userId || 'user-me').trim();
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'user-me';
}

function ensurePlayer(id: string, name?: string): StoredUser {
  if (!users[id]) {
    users[id] = {
      id,
      name: name?.trim() || `Jogador ${id.slice(-5)}`,
      balance: 0,
    };
  } else if (name?.trim() && users[id].name.startsWith('Jogador ')) {
    users[id].name = name.trim();
  }
  return users[id];
}

interface DepositRecord {
  id: string;
  paymentId: string;
  userId: string;
  amount: number;
  credited: boolean;
}

const deposits = new Map<string, DepositRecord>();
const payouts = new Map<string, { status: 'approved' | 'in_process' | 'failed'; paymentId: string }>();

const stateDirectory = process.env.BINGO_DATA_DIR || path.join(__dirname, 'data');
const stateFile = path.join(stateDirectory, 'state.json');

interface PersistedState {
  roundCounter: number;
  roundStatus: 'waiting' | 'in_progress' | 'finished';
  roundStartTime: number;
  waitingSecondsRemaining: number;
  ballDrawIntervalRemaining: number;
  drawnNumbers: number[];
  currentDrawnNumber: number | null;
  activeCards: StoredCard[];
  currentWinner: StoredWinner | null;
  winnerHistory: StoredWinner[];
  chatMessages: StoredMessage[];
  users: Record<string, StoredUser>;
  deposits: DepositRecord[];
  payouts: Array<[string, { status: 'approved' | 'in_process' | 'failed', paymentId: string }] >;
}

function persistState() {
  try {
    fs.mkdirSync(stateDirectory, { recursive: true });
    const state: PersistedState = {
      roundCounter, roundStatus, roundStartTime, waitingSecondsRemaining,
      ballDrawIntervalRemaining, drawnNumbers, currentDrawnNumber, activeCards,
      currentWinner, winnerHistory, chatMessages, users,
      deposits: [...deposits.values()], payouts: [...payouts.entries()],
    };
    const temporaryFile = `${stateFile}.tmp`;
    fs.writeFileSync(temporaryFile, JSON.stringify(state), 'utf8');
    fs.renameSync(temporaryFile, stateFile);
  } catch (error) {
    console.warn('Não foi possível persistir o estado do bingo:', error);
  }
}

function loadPersistedState() {
  try {
    if (!fs.existsSync(stateFile)) return;
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8')) as Partial<PersistedState>;
    if (typeof state.roundCounter === 'number') roundCounter = state.roundCounter;
    if (state.roundStatus) roundStatus = state.roundStatus;
    if (typeof state.roundStartTime === 'number') roundStartTime = state.roundStartTime;
    if (typeof state.waitingSecondsRemaining === 'number') waitingSecondsRemaining = state.waitingSecondsRemaining;
    if (typeof state.ballDrawIntervalRemaining === 'number') ballDrawIntervalRemaining = state.ballDrawIntervalRemaining;
    if (Array.isArray(state.drawnNumbers)) drawnNumbers = state.drawnNumbers;
    if (state.currentDrawnNumber !== undefined) currentDrawnNumber = state.currentDrawnNumber;
    if (Array.isArray(state.activeCards)) activeCards = state.activeCards;
    if (state.currentWinner !== undefined) currentWinner = state.currentWinner;
    if (Array.isArray(state.winnerHistory)) winnerHistory.splice(0, winnerHistory.length, ...state.winnerHistory);
    if (Array.isArray(state.chatMessages)) chatMessages.splice(0, chatMessages.length, ...state.chatMessages);
    if (state.users) Object.assign(users, state.users);
    if (Array.isArray(state.deposits)) state.deposits.forEach((deposit) => deposits.set(deposit.id, deposit));
    if (Array.isArray(state.payouts)) state.payouts.forEach(([key, value]) => payouts.set(key, value));
    console.log(`Estado do BingouPix restaurado de ${stateFile}`);
  } catch (error) {
    console.warn('Estado persistido inválido; iniciando estado limpo:', error);
  }
}

loadPersistedState();
setInterval(persistState, 2000);

function mercadoPagoToken(): string {
  return (process.env.MERCADO_PAGO_ACCESS_TOKEN || '').trim();
}

function isProductionTokenConfigured(): boolean {
  return /^APP_USR-/.test(mercadoPagoToken());
}

async function mercadoPagoRequest(pathname: string, init: RequestInit = {}) {
  const token = mercadoPagoToken();
  if (!token) throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado no servidor.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  return fetch(`https://api.mercadopago.com${pathname}`, { ...init, headers });
}

async function creditApprovedDeposit(paymentId: string): Promise<{ status: 'approved' | 'pending' | 'rejected'; balance: number }> {
  const response = await mercadoPagoRequest(`/v1/payments/${encodeURIComponent(paymentId)}`);
  const payment = await response.json();
  if (!response.ok) return { status: 'pending', balance: users['user-me']?.balance || 0 };

  let deposit = [...deposits.values()].find((item) => item.paymentId === String(payment.id));
  // Recupera a referência após um reinício do processo; o pagamento foi criado
  // com external_reference e o valor é revalidado diretamente na API do MP.
  if (!deposit && typeof payment.external_reference === 'string' && payment.external_reference.startsWith('DEP-')) {
    deposit = {
      id: payment.external_reference,
      paymentId: String(payment.id),
      userId: 'user-me',
      amount: Number(payment.transaction_amount),
      credited: false,
    };
    if (Number.isFinite(deposit.amount) && deposit.amount > 0) deposits.set(deposit.id, deposit);
  }
  if (!deposit || !Number.isFinite(deposit.amount) || deposit.amount <= 0) {
    return { status: 'rejected', balance: users['user-me']?.balance || 0 };
  }

  if (payment.status === 'approved' && !deposit.credited) {
    const user = users[deposit.userId];
    if (user) {
      user.balance = Number((user.balance + deposit.amount).toFixed(2));
      deposit.credited = true;
      addChatMessage({
        senderId: 'system', senderName: 'Mercado Pago Pix', senderAvatar: '💳',
        text: `Depósito Pix de R$ ${deposit.amount.toFixed(2)} confirmado. Saldo atualizado.`,
        isSystem: true, systemType: 'pix'
      });
    }
  }

  const status = payment.status === 'approved' ? 'approved' : payment.status === 'rejected' || payment.status === 'cancelled' ? 'rejected' : 'pending';
  return { status, balance: users[deposit.userId]?.balance || 0 };
}

function validateWebhookSignature(req: Request): boolean {
  const secret = (process.env.MERCADO_PAGO_WEBHOOK_SECRET || '').trim();
  if (!secret) return false;
  const signature = req.header('x-signature') || '';
  const requestId = req.header('x-request-id') || '';
  const dataId = String(req.query['data.id'] || req.body?.data?.id || '').toLowerCase();
  const ts = signature.match(/(?:^|,)ts=([^,]+)/)?.[1];
  const v1 = signature.match(/(?:^|,)v1=([^,]+)/)?.[1];
  if (!ts || !v1 || !requestId || !dataId) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return v1.length === expected.length && crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}

// Generates a 5x5 card with numbers 1 to 60
// Col 0: 1-12, Col 1: 13-24, Col 2: 25-36, Col 3: 37-48, Col 4: 49-60
function generate5x5BingoCard(userId: string, userName: string, isUser: boolean, roundId: number): StoredCard {
  const cardNumbers: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
  const marked: boolean[][] = Array.from({ length: 5 }, () => Array(5).fill(false));

  const ranges = [
    { min: 1, max: 12 },
    { min: 13, max: 24 },
    { min: 25, max: 36 },
    { min: 37, max: 48 },
    { min: 49, max: 60 },
  ];

  for (let col = 0; col < 5; col++) {
    const { min, max } = ranges[col];
    const available = [];
    for (let n = min; n <= max; n++) available.push(n);

    // Shuffle and pick 5
    for (let row = 0; row < 5; row++) {
      const idx = Math.floor(Math.random() * available.length);
      cardNumbers[row][col] = available.splice(idx, 1)[0];
    }
  }

  // Pre-mark any numbers that might have already been drawn in this round
  drawnNumbers.forEach(drawn => {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (cardNumbers[r][c] === drawn) {
          marked[r][c] = true;
        }
      }
    }
  });

  return {
    id: `card-${roundId}-${Math.random().toString(36).substring(2, 9)}`,
    roundId,
    userId,
    userName,
    isUser,
    numbers: cardNumbers,
    marked,
    hasWon: false,
  };
}

// Bot card auto-purchaser during waiting state to keep pot between R$ 15 and R$ 50
function seedBotCards() {
  const numBots = 4 + Math.floor(Math.random() * 4); // 4 to 7 bots
  for (let i = 0; i < numBots; i++) {
    const bot = BOT_PLAYERS[i % BOT_PLAYERS.length];
    const cardsToBuy = 1 + Math.floor(Math.random() * 3); // 1 to 3 cards
    for (let c = 0; c < cardsToBuy; c++) {
      activeCards.push(generate5x5BingoCard(bot.id, bot.name, false, roundCounter));
    }
  }
}

// Check card win conditions:
// 1. Horizontal line (5 in a row)
// 2. Vertical line (5 in a column)
// 3. Diagonal line (5 diagonal)
// 4. Cartela cheia (full card)
function checkCardWin(card: StoredCard): { won: boolean; type?: 'row' | 'column' | 'diagonal' | 'full'; name?: string; cells?: [number, number][] } {
  // Check rows
  for (let r = 0; r < 5; r++) {
    if (card.marked[r].every(v => v === true)) {
      return {
        won: true,
        type: 'row',
        name: `Linha Horizontal #${r + 1}`,
        cells: [[r, 0], [r, 1], [r, 2], [r, 3], [r, 4]],
      };
    }
  }

  // Check columns
  for (let c = 0; c < 5; c++) {
    let colFull = true;
    for (let r = 0; r < 5; r++) {
      if (!card.marked[r][c]) {
        colFull = false;
        break;
      }
    }
    if (colFull) {
      return {
        won: true,
        type: 'column',
        name: `Coluna Vertical #${c + 1}`,
        cells: [[0, c], [1, c], [2, c], [3, c], [4, c]],
      };
    }
  }

  // Check diagonal 1
  let diag1Full = true;
  for (let i = 0; i < 5; i++) {
    if (!card.marked[i][i]) {
      diag1Full = false;
      break;
    }
  }
  if (diag1Full) {
    return {
      won: true,
      type: 'diagonal',
      name: 'Diagonal Principal',
      cells: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]],
    };
  }

  // Check diagonal 2
  let diag2Full = true;
  for (let i = 0; i < 5; i++) {
    if (!card.marked[i][4 - i]) {
      diag2Full = false;
      break;
    }
  }
  if (diag2Full) {
    return {
      won: true,
      type: 'diagonal',
      name: 'Diagonal Secundária',
      cells: [[0, 4], [1, 3], [2, 2], [3, 1], [4, 0]],
    };
  }

  // Check full card
  const full = card.marked.every(row => row.every(val => val === true));
  if (full) {
    const allCells: [number, number][] = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) allCells.push([r, c]);
    }
    return {
      won: true,
      type: 'full',
      name: 'Cartela Cheia!',
      cells: allCells,
    };
  }

  return { won: false };
}

// Automatic Pix payout through Mercado Pago Payouts API.
// The documented API accepts a Mercado Pago account email or bank account data.
// We do not invent a payment ID when the API rejects the operation.
async function executeMercadoPagoPixPayout(winner: StoredWinner): Promise<{ status: 'approved' | 'in_process' | 'failed'; paymentId: string; details?: any; error?: string }> {
  if (winner.pixKey.type !== 'email') {
    return { status: 'failed', paymentId: '', error: 'Para repasse automático via Mercado Pago, cadastre uma chave Pix do tipo e-mail vinculada à conta Mercado Pago do vencedor.' };
  }
  const externalReference = `round-${roundCounter}-card-${winner.cardId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
  const existing = payouts.get(externalReference);
  if (existing) return existing;

  try {
    const response = await mercadoPagoRequest('/v1/payouts', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': externalReference },
      body: JSON.stringify({
        external_reference: externalReference,
        description: `Premio BingouPix rodada ${roundCounter}`,
        transactions: [{
          external_reference: externalReference,
          type: 'account',
          account: { email: winner.pixKey.key },
          amount: { currency: 'BRL', value: Number(winner.prizeAmount.toFixed(2)) },
          description: `Premio BingouPix para ${winner.userName}`,
        }],
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const result = { status: 'failed' as const, paymentId: '', error: data.message || data.error || `Mercado Pago recusou o payout (${response.status}).` };
      payouts.set(externalReference, result);
      return result;
    }
    const status: 'approved' | 'in_process' = data.status === 'approved' ? 'approved' : 'in_process';
    const result = { status, paymentId: String(data.id || data.transactions?.[0]?.id || ''), details: data };
    payouts.set(externalReference, result);
    return result;
  } catch (error) {
    return { status: 'failed', paymentId: '', error: error instanceof Error ? error.message : 'Falha ao chamar o Mercado Pago.' };
  }
}

// Broadcast chat message
function addChatMessage(msg: Omit<StoredMessage, 'id' | 'timestamp'>) {
  const newMsg: StoredMessage = {
    ...msg,
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now()
  };
  chatMessages.push(newMsg);
  if (chatMessages.length > 80) chatMessages.shift();
  return newMsg;
}

// ----------------------------------------------------
// Central Bingo Engine Timer Tick (Runs every 1 second)
// ----------------------------------------------------
setInterval(async () => {
  if (roundStatus === 'waiting') {
    const realPlayerCount = new Set(activeCards.map((card) => card.userId)).size;
    if (realPlayerCount < 2) {
      waitingSecondsRemaining = 60;
      return;
    }
    waitingSecondsRemaining--;

    // Periodically post bot chat chatter during waiting period
    if (waitingSecondsRemaining === 45) {
      const bot = BOT_PLAYERS[Math.floor(Math.random() * BOT_PLAYERS.length)];
      addChatMessage({
        senderId: bot.id,
        senderName: bot.name,
        senderAvatar: bot.avatar,
        text: 'Vamos lá, rodada começando em breve! 🍀'
      });
    } else if (waitingSecondsRemaining === 20) {
      const bot = BOT_PLAYERS[Math.floor(Math.random() * BOT_PLAYERS.length)];
      addChatMessage({
        senderId: bot.id,
        senderName: bot.name,
        senderAvatar: bot.avatar,
        text: 'Comprei mais 2 cartelas. Esse prêmio de 80% vai ser meu! 🤑'
      });
    }

    if (waitingSecondsRemaining <= 0) {
      // Transition to IN_PROGRESS
      roundStatus = 'in_progress';
      ballDrawIntervalRemaining = 10;
      drawnNumbers = [];
      currentDrawnNumber = null;
      currentWinner = null;

      const totalPot = activeCards.length * 1.0;
      const prizePot = Number((totalPot * 0.8).toFixed(2));

      addChatMessage({
        senderId: 'system',
        senderName: 'Sistema PixBingo',
        senderAvatar: '🎲',
        text: `Rodada #${roundCounter} INICIADA! ${activeCards.length} cartelas em jogo. Prêmio total: R$ ${prizePot.toFixed(2)} (80% da arrecadação via Pix).`,
        isSystem: true,
        systemType: 'round'
      });
    }
  } else if (roundStatus === 'in_progress') {
    ballDrawIntervalRemaining--;

    if (ballDrawIntervalRemaining <= 0) {
      // Draw next ball from 1 to 60 that has not been drawn
      const availableNumbers: number[] = [];
      for (let n = 1; n <= 60; n++) {
        if (!drawnNumbers.includes(n)) availableNumbers.push(n);
      }

      if (availableNumbers.length === 0) {
        // Fallback: all 60 balls drawn without winner
        roundStatus = 'finished';
        waitingSecondsRemaining = 8;
        return;
      }

      const drawn = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
      drawnNumbers.push(drawn);
      currentDrawnNumber = drawn;
      ballDrawIntervalRemaining = 10; // Reset 10-second countdown for next ball

      // Broadcast ball message
      addChatMessage({
        senderId: 'system',
        senderName: 'Globo do Bingo',
        senderAvatar: '🎱',
        text: `Bola número ${drawn} sorteada!`,
        isSystem: true,
        systemType: 'ball'
      });

      // Mark all cards
      for (const card of activeCards) {
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < 5; c++) {
            if (card.numbers[r][c] === drawn) {
              card.marked[r][c] = true;
            }
          }
        }
      }

      // Check for winner
      for (const card of activeCards) {
        const win = checkCardWin(card);
        if (win.won) {
          card.hasWon = true;
          card.winningPattern = {
            type: win.type!,
            cells: win.cells || []
          };

          const totalPot = activeCards.length * 1.0;
          const prizeAmount = Number((totalPot * 0.8).toFixed(2));

          // Get winner Pix Key
          const userObj = users[card.userId];
          const pixKey = userObj?.pixKey || {
            type: 'cpf',
            key: '123.456.789-00',
            name: card.userName
          };

          const winnerObj: StoredWinner = {
            userId: card.userId,
            userName: card.userName,
            isUser: card.isUser,
            cardId: card.id,
            patternType: win.type!,
            patternName: win.name || 'Linha Premiada',
            prizeAmount,
            totalPot,
            pixKey,
            mercadoPagoPaymentId: 'PROCESSANDO...',
            mercadoPagoStatus: 'in_process',
            timestamp: Date.now()
          };

          currentWinner = winnerObj;
          roundStatus = 'finished';
          waitingSecondsRemaining = 10; // Display winner screen for 10s

          // Trigger Pix Transfer via Mercado Pago
          executeMercadoPagoPixPayout(winnerObj).then(payoutResult => {
            if (currentWinner) {
              currentWinner.mercadoPagoPaymentId = payoutResult.paymentId;
              currentWinner.mercadoPagoStatus = payoutResult.status;
            }
            winnerHistory.unshift({ ...winnerObj, mercadoPagoPaymentId: payoutResult.paymentId, mercadoPagoStatus: payoutResult.status });
            if (winnerHistory.length > 20) winnerHistory.pop();

            addChatMessage({
              senderId: 'system',
              senderName: 'Mercado Pago Pix',
              senderAvatar: '💸',
              text: payoutResult.status === 'failed'
                ? `Prêmio de R$ ${prizeAmount.toFixed(2)} aguardando repasse: ${payoutResult.error || 'Mercado Pago não confirmou a transferência.'}`
                : `Prêmio de R$ ${prizeAmount.toFixed(2)} enviado ao Mercado Pago para repasse via Pix a ${winnerObj.userName}. ID: ${payoutResult.paymentId}`,
              isSystem: true,
              systemType: 'pix'
            });
          });

          addChatMessage({
            senderId: 'system',
            senderName: 'BINGO!',
            senderAvatar: '🏆',
            text: `BINGO! ${card.userName} completou ${win.name} e GANHOU R$ ${prizeAmount.toFixed(2)}!`,
            isSystem: true,
            systemType: 'winner'
          });

          break; // Stop after first winner found
        }
      }
    }
  } else if (roundStatus === 'finished') {
    waitingSecondsRemaining--;
    if (waitingSecondsRemaining <= 0) {
      // Reset for next round
      roundCounter++;
      roundStatus = 'waiting';
      waitingSecondsRemaining = 60; // 1 minute interval between rounds!
      ballDrawIntervalRemaining = 10;
      drawnNumbers = [];
      currentDrawnNumber = null;
      activeCards = [];
      currentWinner = null;

      // Seed next bots
      seedBotCards();

      addChatMessage({
        senderId: 'system',
        senderName: 'Sistema PixBingo',
        senderAvatar: '⏳',
        text: `Rodada #${roundCounter} aberta! 1 minuto para compra de cartelas a R$ 1,00.`,
        isSystem: true,
        systemType: 'round'
      });
    }
  }
}, 1000);

// ----------------------------------------------------
// REST API ENDPOINTS
// ----------------------------------------------------

// Get full round state
app.get('/api/game/state', (req: Request, res: Response) => {
  const totalCards = activeCards.length;
  const potTotal = totalCards * 1.0;
  const prizePot = Number((potTotal * 0.8).toFixed(2));

  res.json({
    id: roundCounter,
    status: roundStatus,
    roundStartTime,
    waitingSecondsRemaining,
    ballDrawIntervalRemaining,
    drawnNumbers,
    currentNumber: currentDrawnNumber,
    totalCards,
    potTotal,
    prizePot,
    winner: currentWinner,
    historyRounds: winnerHistory.slice(0, 10),
    activePlayerCount: new Set(activeCards.map((card) => card.userId)).size,
  });
});

// Get user profile & balance
app.get('/api/user/profile', (req: Request, res: Response) => {
  const user = ensurePlayer(playerIdFromRequest(req), String(req.query.userName || ''));
  res.json(user);
});

// Update user Pix Key (Mercado Pago account E-mail strictly)
app.post('/api/user/pix-key', (req: Request, res: Response) => {
  const { type = 'email', key, name } = req.body;
  if (!key || typeof key !== 'string' || !key.includes('@')) {
    return res.status(400).json({ error: 'Informe um e-mail válido cadastrado na sua conta Mercado Pago.' });
  }

  const user = ensurePlayer(playerIdFromRequest(req), String(req.body?.userName || ''));
  user.pixKey = { type: 'email', key: key.trim().toLowerCase(), name: name || user.name };

  res.json({ success: true, pixKey: user?.pixKey });
});

// Buy cards for current/next round
app.post('/api/game/buy-cards', (req: Request, res: Response) => {
  const { quantity = 1, userId, userName } = req.body;
  const qty = Math.max(1, Math.min(20, Number(quantity)));
  const cost = qty * 1.0; // R$ 1 per card

  const user = ensurePlayer(String(userId || 'user-me'), String(userName || ''));
  if (user.balance < cost) {
    return res.status(400).json({
      error: `Saldo insuficiente. Cada cartela custa R$ 1,00. Seu saldo atual é R$ ${(user?.balance || 0).toFixed(2)}.`
    });
  }

  // Deduct balance
  user.balance = Number((user.balance - cost).toFixed(2));

  const newCards: StoredCard[] = [];
  for (let i = 0; i < qty; i++) {
    const card = generate5x5BingoCard(user.id, user.name, true, roundCounter);
    activeCards.push(card);
    newCards.push(card);
  }

  addChatMessage({
    senderId: user.id,
    senderName: user.name,
    senderAvatar: '🎟️',
    text: `Comprou ${qty} cartela(s) para a Rodada #${roundCounter}! Boa sorte!`
  });

  res.json({
    success: true,
    boughtCards: newCards,
    newBalance: user.balance,
    roundId: roundCounter
  });
});

// Get user cards for current round
app.get('/api/game/my-cards', (req: Request, res: Response) => {
  const userCards = activeCards.filter(c => c.userId === playerIdFromRequest(req));
  res.json({ cards: userCards });
});

// Chat messages
app.get('/api/chat/messages', (req: Request, res: Response) => {
  res.json({ messages: chatMessages });
});

app.post('/api/chat/send', (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({ error: 'Mensagem vazia' });
  }

  const user = users['user-me'];
  const msg = addChatMessage({
    senderId: user?.id || 'user-me',
    senderName: user?.name || 'Você',
    senderAvatar: '😎',
    text: text.trim().substring(0, 140)
  });

  res.json({ success: true, message: msg });
});

// Mercado Pago Pix deposit generator. Production always uses the server-side token.
app.post('/api/wallet/pix/deposit', async (req: Request, res: Response) => {
  const amount = Number(req.body?.amount);
  const playerId = playerIdFromRequest(req);
  ensurePlayer(playerId, String(req.body?.userName || ''));
  if (!Number.isFinite(amount) || amount < 1 || amount > 10000) return res.status(400).json({ error: 'Valor inválido. Informe um valor entre R$ 1,00 e R$ 10.000,00.' });
  if (!isProductionTokenConfigured()) return res.status(503).json({ error: 'Mercado Pago não está configurado com credencial de produção no servidor.' });

  const depositId = `DEP-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  try {
    const mpRes = await mercadoPagoRequest('/v1/payments', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': depositId },
      body: JSON.stringify({
        transaction_amount: Number(amount.toFixed(2)),
        description: `Recarga BingouPix R$ ${amount.toFixed(2)}`,
        payment_method_id: 'pix',
        external_reference: depositId,
        // O Mercado Pago exige validade entre 30 minutos e 30 dias.
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        payer: {
          email: String(req.body?.payerEmail || 'jogador@bingoupix.com'),
          first_name: String(req.body?.payerName || 'Jogador').split(' ')[0],
        },
      }),
    });
    const data = await mpRes.json().catch(() => ({}));
    if (!mpRes.ok || !data.id || !data.point_of_interaction?.transaction_data?.qr_code) {
      return res.status(502).json({ error: data.message || 'Mercado Pago não criou o Pix.' });
    }
    deposits.set(depositId, { id: depositId, paymentId: String(data.id), userId: playerId, amount: Number(amount.toFixed(2)), credited: false });
    const tx = data.point_of_interaction.transaction_data;
    const qrCode = tx.qr_code_base64 ? `data:image/png;base64,${tx.qr_code_base64}` : '';
    return res.json({ id: depositId, amount: Number(amount.toFixed(2)), status: data.status || 'pending', copyPaste: tx.qr_code, qrCode, qrCodeBase64: qrCode, mercadoPagoId: String(data.id), isSimulated: false, expiresAt: Date.now() + 30 * 60 * 1000 });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Falha ao criar o Pix no Mercado Pago.' });
  }
});

app.get('/api/wallet/pix/status/:paymentId', async (req: Request, res: Response) => {
  try {
    const result = await creditApprovedDeposit(String(req.params.paymentId));
    return res.json({ status: result.status, balance: result.balance });
  } catch {
    return res.status(502).json({ status: 'pending' });
  }
});

// Mercado Pago webhook. Configure this HTTPS URL in the Mercado Pago dashboard.
app.post('/api/webhooks/mercado-pago', async (req: Request, res: Response) => {
  if (!validateWebhookSignature(req)) return res.status(401).json({ error: 'Assinatura inválida.' });
  const paymentId = String(req.body?.data?.id || req.query['data.id'] || '');
  if (req.body?.type === 'payment' && paymentId) {
    try { await creditApprovedDeposit(paymentId); } catch { /* MP retries if processing fails */ }
  }
  return res.sendStatus(200);
});

app.post('/api/wallet/pix/payout', async (req: Request, res: Response) => {
  const { winnerName, pixKey, prizeAmount, roundId } = req.body || {};
  if (!winnerName || !pixKey?.key || !Number.isFinite(Number(prizeAmount)) || Number(prizeAmount) <= 0) {
    return res.status(400).json({ error: 'Dados do prêmio incompletos.' });
  }
  if (pixKey.type !== 'email' || typeof pixKey.key !== 'string' || !pixKey.key.includes('@')) {
    return res.status(400).json({ error: 'Somente chave Pix do tipo e-mail cadastrada no Mercado Pago é aceita para pagamento do prêmio.' });
  }

  const result = await executeMercadoPagoPixPayout({
    userId: 'user-me',
    userName: String(winnerName),
    isUser: true,
    cardId: `api-${roundId}`,
    patternType: 'full',
    patternName: 'Prêmio BingouPix',
    prizeAmount: Number(prizeAmount),
    totalPot: Number(prizeAmount),
    pixKey: { type: 'email', key: pixKey.key.trim().toLowerCase(), name: pixKey.name || winnerName },
    mercadoPagoPaymentId: '',
    mercadoPagoStatus: 'in_process',
    timestamp: Date.now()
  });

  if (result.status === 'failed') return res.status(502).json(result);
  return res.json({ paymentId: result.paymentId, status: result.status, timestamp: Date.now(), transactionHash: result.paymentId });
});

app.get('/api/wallet/pix/payout/status/:paymentId', async (req: Request, res: Response) => {
  const paymentId = String(req.params.paymentId || '');
  if (!paymentId) return res.status(400).json({ error: 'ID do pagamento não informado.' });

  // Check locally cached payouts
  for (const [_, record] of payouts.entries()) {
    if (record.paymentId === paymentId) {
      if (record.status !== 'in_process') {
        return res.json({ status: record.status, paymentId });
      }
    }
  }

  // Attempt to query Mercado Pago API if configured
  try {
    const mpRes = await mercadoPagoRequest(`/v1/payouts/${encodeURIComponent(paymentId)}`);
    const data = await mpRes.json().catch(() => ({}));
    if (mpRes.ok && data) {
      const status: 'approved' | 'in_process' | 'failed' =
        data.status === 'approved' ? 'approved' : data.status === 'rejected' || data.status === 'failed' ? 'failed' : 'in_process';
      for (const [k, v] of payouts.entries()) {
        if (v.paymentId === paymentId) {
          payouts.set(k, { ...v, status });
        }
      }
      return res.json({ status, paymentId });
    }
  } catch {
    // fallback
  }

  return res.json({ status: 'in_process', paymentId });
});

// System info / Mercado Pago status
app.get('/api/system/status', (req: Request, res: Response) => {
  const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  const isConfigured = Boolean(mpToken && mpToken.trim() !== '' && mpToken !== 'YOUR_MERCADO_PAGO_ACCESS_TOKEN');
  res.json({
    mercadoPagoConfigured: isConfigured,
    tokenPrefix: isConfigured ? mpToken!.substring(0, 10) + '...' : null,
    serverTime: Date.now(),
    roundIntervalSec: 60,
    ballDrawIntervalSec: 10,
    cardPrice: 1.0,
    prizeCutPercent: 80,
  });
});

// Setup Vite Dev Server middlewares or static files
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const staticRoot = fs.existsSync(path.join(__dirname, 'dist'))
      ? path.join(__dirname, 'dist')
      : path.join(__dirname, 'docs');
    app.use(express.static(staticRoot));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(staticRoot, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`PixBingo server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
