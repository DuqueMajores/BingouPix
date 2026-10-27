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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
  balanceVersion?: number;
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
  payoutAttempt?: number;
  payoutRetryable?: boolean;
  payoutError?: string;
  walletCreditStatus?: 'pending' | 'credited' | 'not_applicable';
  timestamp: number;
}

interface PayoutRecord {
  status: 'approved' | 'in_process' | 'failed';
  paymentId: string;
  attempt: number;
  retryable: boolean;
  error?: string;
}

type PayoutResult = PayoutRecord;
const MAX_PAYOUT_ATTEMPTS = 3;

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

function playerIdFromRequest(req: Request): string | null {
  const authorization = req.header('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const parts = match[1].split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  const expected = crypto.createHmac('sha256', sessionSecret).update(parts[1]).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(parts[2], 'base64url'); } catch { return null; }
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof claims.sub === 'string' && users[claims.sub] ? claims.sub : null;
  } catch { return null; }
}

function requirePlayer(req: Request, res: Response): StoredUser | null {
  if (!storageHealthy) { res.status(503).json({ error: 'Carteira temporariamente bloqueada: armazenamento persistente indisponível.' }); return null; }
  if (!walletRecoveryComplete) { res.status(503).json({ error: 'Carteira inicializando; tente novamente em instantes.' }); return null; }
  const id = playerIdFromRequest(req);
  if (!id) { res.status(401).json({ error: 'Sessão inválida ou expirada. Recarregue a página.' }); return null; }
  return ensurePlayer(id);
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

type WalletTransactionKind = 'prize' | 'deposit' | 'card_purchase' | 'withdrawal_reserve' | 'withdrawal_refund';
interface WalletTransaction {
  referenceId: string;
  userId: string;
  kind: WalletTransactionKind;
  deltaCents: number;
  balanceAfterCents: number;
  version: number;
  createdAt: number;
}

interface WithdrawalRecord {
  id: string;
  clientRequestId: string;
  userId: string;
  amountCents: number;
  pixKey: { type: 'email'; key: string; name: string };
  idempotencyKey: string;
  status: 'preparing' | 'in_process' | 'approved' | 'failed';
  paymentId: string;
  error?: string;
  createdAt: number;
}

interface CardPurchaseOrder {
  id: string;
  clientRequestId: string;
  userId: string;
  quantity: number;
  amountCents: number;
  roundId: number;
  cards: StoredCard[];
  status: 'preparing' | 'completed';
  createdAt: number;
}

type WithdrawalResult = Pick<WithdrawalRecord, 'id' | 'amountCents' | 'status' | 'paymentId' | 'error' | 'createdAt' | 'pixKey'> & { balance: number };

const deposits = new Map<string, DepositRecord>();
const payouts = new Map<string, PayoutRecord>();
// Financial orders are durable and independent of the 20-item display history.
const payoutOrders = new Map<string, StoredWinner>();
const payoutInFlight = new Map<string, Promise<PayoutResult>>();
const withdrawals = new Map<string, WithdrawalRecord>();
const purchaseOrders = new Map<string, CardPurchaseOrder>();
const withdrawalInFlight = new Map<string, Promise<WithdrawalRecord>>();
const walletTransactions = new Map<string, WalletTransaction>();
let storageHealthy = true;
let walletRecoveryComplete = false;

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.BINGO_DATA_DIR) {
  throw new Error('Configure BINGO_DATA_DIR para o mount do Persistent Disk do Render (por exemplo, /var/data).');
}
const stateDirectory = process.env.BINGO_DATA_DIR || path.join(__dirname, 'data');
if (isProduction && !fs.existsSync(stateDirectory)) {
  throw new Error(`BINGO_DATA_DIR não existe. Confirme o mount do Persistent Disk: ${stateDirectory}`);
}
const stateFile = path.join(stateDirectory, 'state.json');
const walletLedgerFile = path.join(stateDirectory, 'wallet-ledger.jsonl');
const sessionSecretFile = path.join(stateDirectory, 'session.secret');
if (isProduction && !fs.existsSync(stateFile) && (fs.existsSync(walletLedgerFile) || fs.existsSync(sessionSecretFile))) {
  throw new Error('O estado da carteira desapareceu, mas o volume contém artefatos persistentes. Inicialização bloqueada para evitar zerar saldos; restaure o snapshot do backup.');
}

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
  payouts: Array<[string, PayoutRecord]>;
  payoutOrders: StoredWinner[];
  withdrawals: WithdrawalRecord[];
  purchaseOrders: CardPurchaseOrder[];
}

function persistState() {
  let fd: number | undefined;
  try {
    fs.mkdirSync(stateDirectory, { recursive: true });
    const state: PersistedState = {
      roundCounter, roundStatus, roundStartTime, waitingSecondsRemaining,
      ballDrawIntervalRemaining, drawnNumbers, currentDrawnNumber, activeCards,
      currentWinner, winnerHistory, chatMessages, users,
      deposits: [...deposits.values()], payouts: [...payouts.entries()],
      payoutOrders: [...payoutOrders.values()], withdrawals: [...withdrawals.values()],
      purchaseOrders: [...purchaseOrders.values()],
    };
    const temporaryFile = `${stateFile}.tmp`;
    fd = fs.openSync(temporaryFile, 'w', 0o600);
    fs.writeFileSync(fd, JSON.stringify(state), 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd); fd = undefined;
    fs.renameSync(temporaryFile, stateFile);
    const dirFd = fs.openSync(stateDirectory, 'r');
    try { fs.fsyncSync(dirFd); } finally { fs.closeSync(dirFd); }
  } catch (error) {
    storageHealthy = false;
    if (fd !== undefined) { try { fs.closeSync(fd); } catch { /* preserve original error */ } }
    throw new Error(`Falha crítica ao persistir BingouPix; operações financeiras bloqueadas: ${error instanceof Error ? error.message : String(error)}`);
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
    if (Array.isArray(state.activeCards)) {
      activeCards = state.activeCards.filter((card) => !card.userId.startsWith('bot-'));
    }
    if (state.currentWinner !== undefined) currentWinner = state.currentWinner;
    if (Array.isArray(state.winnerHistory)) winnerHistory.splice(0, winnerHistory.length, ...state.winnerHistory);
    if (currentWinner && !winnerHistory.some((winner) => winner.cardId === currentWinner!.cardId)) {
      winnerHistory.unshift(currentWinner);
    }
    if (Array.isArray(state.chatMessages)) chatMessages.splice(0, chatMessages.length, ...state.chatMessages);
    if (state.users) Object.assign(users, state.users);
    if (Array.isArray(state.deposits)) state.deposits.forEach((deposit) => deposits.set(deposit.id, deposit));
    if (Array.isArray(state.payouts)) state.payouts.forEach(([key, value]) => payouts.set(key, {
      ...value,
      attempt: Number.isInteger(value.attempt) ? value.attempt : 1,
      retryable: value.retryable === true,
    }));
    if (Array.isArray(state.payoutOrders)) state.payoutOrders.forEach((winner) => payoutOrders.set(winner.cardId, winner));
    if (Array.isArray(state.withdrawals)) state.withdrawals.forEach((withdrawal) => withdrawals.set(withdrawal.id, withdrawal));
    if (Array.isArray(state.purchaseOrders)) state.purchaseOrders.forEach((order) => purchaseOrders.set(`${order.userId}:${order.clientRequestId}`, order));
    for (const user of Object.values(users)) if (!Number.isInteger(user.balanceVersion)) user.balanceVersion = 0;
    // Migrate pending orders persisted by earlier versions into the durable registry.
    for (const winner of [...winnerHistory, ...(currentWinner ? [currentWinner] : [])]) {
      if (winner.mercadoPagoStatus === 'in_process' || (winner.mercadoPagoStatus === 'failed' && winner.payoutRetryable)) {
        if (!payoutOrders.has(winner.cardId)) payoutOrders.set(winner.cardId, winner);
      }
    }
    console.log(`Estado do BingouPix restaurado de ${stateFile}`);
  } catch (error) {
    console.error('Estado financeiro persistido inválido; interrompendo inicialização:', error);
    throw error;
  }
}

loadPersistedState();

function cents(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Valor monetário inválido.');
  return Math.round(value * 100);
}

function loadWalletLedgerAndReplay() {
  if (!fs.existsSync(walletLedgerFile)) {
    const nonzeroVersions = Object.values(users).filter((user) => (user.balanceVersion || 0) > 0);
    if (nonzeroVersions.length) throw new Error('Ledger da carteira ausente apesar de existirem saldos versionados; restaure o volume/backup antes de iniciar.');
    return;
  }
  const ledgerVersions = new Map<string, number>();
  let raw = fs.readFileSync(walletLedgerFile, 'utf8');
  const lastNewline = raw.lastIndexOf('\n');
  if (lastNewline !== raw.length - 1) {
    raw = lastNewline < 0 ? '' : raw.slice(0, lastNewline + 1);
    fs.truncateSync(walletLedgerFile, Buffer.byteLength(raw));
  }
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const tx = JSON.parse(line) as WalletTransaction;
    if (!tx.referenceId || !tx.userId || !Number.isSafeInteger(tx.deltaCents) || !Number.isSafeInteger(tx.balanceAfterCents) || !Number.isInteger(tx.version) || tx.version < 1) {
      throw new Error('Registro inválido no ledger financeiro.');
    }
    const existing = walletTransactions.get(tx.referenceId);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(tx)) throw new Error(`Referência duplicada divergente no ledger: ${tx.referenceId}`);
      continue;
    }
    const expectedLedgerVersion = (ledgerVersions.get(tx.userId) || 0) + 1;
    if (tx.version !== expectedLedgerVersion) throw new Error(`Lacuna ou ordem inválida no ledger da conta ${tx.userId}: esperado ${expectedLedgerVersion}, recebido ${tx.version}.`);
    ledgerVersions.set(tx.userId, tx.version);
    walletTransactions.set(tx.referenceId, tx);
    const user = ensurePlayer(tx.userId);
    const currentVersion = user.balanceVersion || 0;
    if (tx.version > currentVersion) {
      if (tx.version !== currentVersion + 1) throw new Error(`Lacuna no ledger da conta ${tx.userId}.`);
      user.balance = tx.balanceAfterCents / 100;
      user.balanceVersion = tx.version;
    }
  }
  for (const user of Object.values(users)) {
    const snapshotVersion = user.balanceVersion || 0;
    const ledgerVersion = ledgerVersions.get(user.id) || 0;
    if (snapshotVersion > ledgerVersion) throw new Error(`Ledger incompleto para a conta ${user.id}; snapshot=${snapshotVersion}, ledger=${ledgerVersion}.`);
  }
}

function applyWalletTransaction(userId: string, kind: WalletTransactionKind, deltaCents: number, referenceId: string): WalletTransaction {
  if (!Number.isSafeInteger(deltaCents) || deltaCents === 0 || !referenceId) throw new Error('Transação de carteira inválida.');
  const existing = walletTransactions.get(referenceId);
  if (existing) {
    if (existing.userId !== userId || existing.kind !== kind || existing.deltaCents !== deltaCents) throw new Error(`Conflito de idempotência para ${referenceId}.`);
    return existing;
  }
  if (!storageHealthy) throw new Error('Armazenamento financeiro indisponível; tente novamente mais tarde.');
  const user = ensurePlayer(userId);
  const beforeCents = cents(user.balance);
  const afterCents = beforeCents + deltaCents;
  if (afterCents < 0) throw new Error('Saldo disponível insuficiente.');
  const tx: WalletTransaction = {
    referenceId, userId, kind, deltaCents, balanceAfterCents: afterCents,
    version: (user.balanceVersion || 0) + 1, createdAt: Date.now(),
  };
  fs.mkdirSync(stateDirectory, { recursive: true });
  const ledgerExisted = fs.existsSync(walletLedgerFile);
  const originalLedgerSize = ledgerExisted ? fs.statSync(walletLedgerFile).size : 0;
  const fd = fs.openSync(walletLedgerFile, 'a', 0o600);
  try {
    const entry = Buffer.from(`${JSON.stringify(tx)}\n`, 'utf8');
    let written = 0;
    while (written < entry.length) {
      const count = fs.writeSync(fd, entry, written, entry.length - written);
      if (count <= 0) throw new Error('Escrita parcial do ledger sem progresso.');
      written += count;
    }
    fs.fsyncSync(fd);
  } catch (error) {
    storageHealthy = false;
    try { fs.ftruncateSync(fd, originalLedgerSize); fs.fsyncSync(fd); } catch { /* fail closed; startup will validate the journal */ }
    throw new Error(`Falha crítica ao gravar ledger; saque e compras bloqueados: ${error instanceof Error ? error.message : String(error)}`);
  } finally { fs.closeSync(fd); }
  if (!ledgerExisted) {
    try {
      const dirFd = fs.openSync(stateDirectory, 'r');
      try { fs.fsyncSync(dirFd); } finally { fs.closeSync(dirFd); }
    } catch (error) {
      storageHealthy = false;
      throw new Error(`Falha crítica ao sincronizar diretório do ledger; carteira bloqueada: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  walletTransactions.set(referenceId, tx);
  user.balance = afterCents / 100;
  user.balanceVersion = tx.version;
  persistState();
  return tx;
}

loadWalletLedgerAndReplay();

function recoverUncreditedWinnerPrizes() {
  const pending = new Map<string, StoredWinner>();
  for (const winner of winnerHistory) if (winner.walletCreditStatus === 'pending') pending.set(winner.cardId, winner);
  if (currentWinner?.walletCreditStatus === 'pending') pending.set(currentWinner.cardId, currentWinner);
  for (const winner of pending.values()) creditWinnerPrize(winner);
}

function completeCardPurchase(order: CardPurchaseOrder): CardPurchaseOrder {
  if (order.status === 'completed') return order;
  applyWalletTransaction(order.userId, 'card_purchase', -order.amountCents, `cards:${order.id}:debit`);
  for (const card of order.cards) if (!activeCards.some((existing) => existing.id === card.id)) activeCards.push(card);
  addChatMessage({
    senderId: order.userId,
    senderName: users[order.userId]?.name || 'Jogador',
    senderAvatar: '🎟️',
    text: `Comprou ${order.quantity} cartela(s) para a Rodada #${order.roundId}! Boa sorte!`,
  });
  order.status = 'completed';
  persistState();
  return order;
}

function recoverPendingCardPurchases() {
  for (const order of purchaseOrders.values()) if (order.status === 'preparing') completeCardPurchase(order);
}

function loadOrCreateSessionSecret(): Buffer {
  fs.mkdirSync(stateDirectory, { recursive: true });
  const secretPath = sessionSecretFile;
  if (fs.existsSync(secretPath)) {
    const existing = fs.readFileSync(secretPath);
    if (existing.length >= 32) return existing;
    throw new Error('Segredo de sessão inválido no diretório persistente.');
  }
  const secret = crypto.randomBytes(32);
  const fd = fs.openSync(secretPath, 'wx', 0o600);
  try { fs.writeFileSync(fd, secret); } finally { fs.closeSync(fd); }
  return secret;
}

const sessionSecret = loadOrCreateSessionSecret();

function issueSessionToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ sub: userId, version: 1 })).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `v1.${payload}.${signature}`;
}

setInterval(() => {
  if (!storageHealthy) return;
  try { persistState(); } catch (error) { console.error(error); }
}, 2000);

function mercadoPagoToken(): string {
  return (process.env.MERCADO_PAGO_ACCESS_TOKEN || '').trim();
}

function isProductionTokenConfigured(): boolean {
  return /^APP_USR-/.test(mercadoPagoToken());
}

function isPayoutTokenConfigured(): boolean {
  const token = mercadoPagoToken();
  return isProduction ? /^APP_USR-/.test(token) : /^TEST-/.test(token);
}

function isPayoutIntegrationConfigured(): boolean {
  if (!isPayoutTokenConfigured()) return false;
  if (!isProduction) return true;
  const pem = process.env.MERCADO_PAGO_PAYOUT_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  if (!pem) return false;
  try { return crypto.createPrivateKey(pem).asymmetricKeyType === 'ed25519'; }
  catch { return false; }
}

function payoutTransactionStatus(statusValue: unknown, detailValue: unknown): 'approved' | 'failed' | 'in_process' {
  const status = String(statusValue || '').toLowerCase();
  const detail = String(detailValue || '').toLowerCase();
  if (status === 'success') return detail === 'accredited' ? 'approved' : 'in_process';
  if (status === 'processed') return detail === 'partially_refunded' ? 'in_process' : 'approved';
  if (status === 'error' && ['downstream_service_unavailable', 'account_finder_internal_error'].includes(detail)) return 'in_process';
  if (['error', 'rejected', 'refunded', 'canceled', 'cancelled'].includes(status)) return 'failed';
  return 'in_process';
}

function payoutRequestHeaders(body: string, idempotencyKey: string): Record<string, string> {
  const headers: Record<string, string> = { 'X-Idempotency-Key': idempotencyKey };
  if (isProduction) {
    const pem = process.env.MERCADO_PAGO_PAYOUT_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
    if (!pem) throw new Error('MERCADO_PAGO_PAYOUT_PRIVATE_KEY não configurada para assinatura de produção.');
    const privateKey = crypto.createPrivateKey(pem);
    headers['X-signature'] = crypto.sign(null, Buffer.from(body, 'utf8'), privateKey).toString('base64');
    headers['X-enforce-signature'] = 'true';
  } else if (/^TEST-/.test(mercadoPagoToken())) {
    headers['X-enforce-signature'] = 'false';
    headers['X-test-token'] = 'true';
  }
  return headers;
}

async function mercadoPagoRequest(pathname: string, init: RequestInit = {}) {
  const token = mercadoPagoToken();
  if (!token) throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado no servidor.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  return fetch(`https://api.mercadopago.com${pathname}`, { ...init, headers, signal: init.signal || AbortSignal.timeout(15000) });
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
      userId: String(payment.metadata?.bingoupix_user_id || ''),
      amount: Number(payment.transaction_amount),
      credited: false,
    };
    if (deposit.userId && Number.isFinite(deposit.amount) && deposit.amount > 0) {
      ensurePlayer(deposit.userId);
      deposits.set(deposit.id, deposit);
    }
  }
  if (!deposit || !Number.isFinite(deposit.amount) || deposit.amount <= 0) {
    return { status: 'rejected', balance: users['user-me']?.balance || 0 };
  }

  if (payment.status === 'approved' && !deposit.credited) {
    const user = users[deposit.userId];
    if (user) {
      applyWalletTransaction(user.id, 'deposit', cents(deposit.amount), `deposit:${deposit.id}`);
      deposit.credited = true;
      addChatMessage({
        senderId: 'system', senderName: 'Mercado Pago Pix', senderAvatar: '💳',
        text: `Depósito Pix de R$ ${deposit.amount.toFixed(2)} confirmado. Saldo atualizado.`,
        isSystem: true, systemType: 'pix'
      });
      persistState();
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
async function executeMercadoPagoPixPayout(winner: StoredWinner): Promise<PayoutResult> {
  const externalReference = `winner-${winner.cardId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
  const attempt = Math.max(1, winner.payoutAttempt || 1);
  const idempotencyKey = attempt === 1 ? externalReference : `${externalReference}-retry-${attempt}`;
  const cached = payouts.get(idempotencyKey);
  if (cached && (cached.status !== 'in_process' || (cached.paymentId && cached.paymentId !== 'PROCESSANDO...'))) return cached;
  const activeRequest = payoutInFlight.get(idempotencyKey);
  if (activeRequest) return activeRequest;

  const canRetry = attempt < MAX_PAYOUT_ATTEMPTS;
  if (winner.pixKey.type !== 'email' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(winner.pixKey.key)) {
    return { status: 'failed', paymentId: '', attempt, retryable: canRetry, error: 'Cadastre uma chave Pix de e-mail válida vinculada à conta Mercado Pago do vencedor.' };
  }
  if (!isPayoutIntegrationConfigured()) {
    return { status: 'failed', paymentId: '', attempt, retryable: canRetry, error: 'Configure credencial e chave de assinatura Ed25519 do Mercado Pago no servidor.' };
  }

  // If a prior request was interrupted before receiving an ID, repeat the same
  // idempotency key. Mercado Pago can return the already-created request instead
  // of creating a duplicate transfer.
  payouts.set(idempotencyKey, cached || { status: 'in_process', paymentId: 'PROCESSANDO...', attempt, retryable: false });
  winner.payoutAttempt = attempt;
  winner.mercadoPagoPaymentId = 'PROCESSANDO...';
  winner.mercadoPagoStatus = 'in_process';
  winner.payoutRetryable = false;
  persistState();

  const requestPromise = (async (): Promise<PayoutResult> => {
    try {
      const body = JSON.stringify({
        external_reference: externalReference,
        description: `Premio BingouPix ${externalReference}`,
        transactions: [{
          external_reference: externalReference,
          type: 'account',
          account: { email: winner.pixKey.key },
          amount: { currency: 'BRL', value: Number(winner.prizeAmount.toFixed(2)) },
          description: `Premio BingouPix para ${winner.userName}`,
        }],
      });
      const response = await mercadoPagoRequest('/v1/payouts', {
        method: 'POST',
        headers: payoutRequestHeaders(body, idempotencyKey),
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        // Only explicit client-side rejections are safe to retry with a new key.
        // Timeouts, throttling, conflicts and server errors stay in_process and
        // must be reconciled with the original idempotency key.
        const safeRejection = [400, 401, 403, 404, 422].includes(response.status);
        const result: PayoutResult = {
          status: safeRejection ? 'failed' : 'in_process',
          paymentId: safeRejection ? '' : 'PROCESSANDO...',
          attempt,
          retryable: safeRejection && canRetry,
          error: data.message || data.error || `Mercado Pago respondeu ao payout com HTTP ${response.status}.`,
        };
        payouts.set(idempotencyKey, result);
        persistState();
        return result;
      }
      const failed = data.status === 'rejected' || data.status === 'failed';
      const result: PayoutResult = {
        status: data.status === 'approved' ? 'approved' : failed ? 'failed' : 'in_process',
        paymentId: String(data.id || data.transactions?.[0]?.id || 'PROCESSANDO...'),
        attempt,
        retryable: failed && canRetry,
        error: failed ? (data.message || data.error || 'O Mercado Pago rejeitou o repasse.') : undefined,
      };
      payouts.set(idempotencyKey, result);
      persistState();
      return result;
    } catch (error) {
      // The request may have reached Mercado Pago even when the response was
      // lost. Keep the same idempotency key and recover it on the next poll/boot.
      const result: PayoutResult = {
        status: 'in_process', paymentId: 'PROCESSANDO...', attempt, retryable: false,
        error: error instanceof Error ? error.message : 'Resposta do Mercado Pago inconclusiva.',
      };
      payouts.set(idempotencyKey, result);
      persistState();
      return result;
    }
  })();
  payoutInFlight.set(idempotencyKey, requestPromise);
  try { return await requestPromise; }
  finally { payoutInFlight.delete(idempotencyKey); }
}

function applyPayoutResult(cardId: string, result: PayoutResult) {
  const update = (winner: StoredWinner) => {
    winner.mercadoPagoStatus = result.status;
    winner.mercadoPagoPaymentId = result.paymentId;
    winner.payoutAttempt = result.attempt;
    winner.payoutRetryable = result.retryable;
    winner.payoutError = result.error;
  };
  if (currentWinner?.cardId === cardId) update(currentWinner);
  for (const winner of winnerHistory) if (winner.cardId === cardId) update(winner);
  const durableOrder = payoutOrders.get(cardId);
  if (durableOrder) {
    update(durableOrder);
    if (result.status === 'approved' || (result.status === 'failed' && !result.retryable)) payoutOrders.delete(cardId);
  }
  persistState();
}

async function refreshPayoutStatus(paymentId: string): Promise<PayoutRecord | null> {
  if (!paymentId || paymentId === 'PROCESSANDO...' || paymentId.startsWith('PROCESSANDO')) return null;
  const response = await mercadoPagoRequest(`/v1/payouts/${encodeURIComponent(paymentId)}/transactions?limit=100`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data) return null;
  const owner = [...payoutOrders.values(), ...winnerHistory, ...(currentWinner ? [currentWinner] : [])].find((winner) => winner.mercadoPagoPaymentId === paymentId);
  const externalReference = owner ? `winner-${owner.cardId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50) : '';
  const items = Array.isArray(data.transactions) ? data.transactions : [];
  const transaction = items.find((item: any) => item.external_reference === externalReference) || items[0];
  if (!transaction) return null;
  const status = payoutTransactionStatus(transaction.status, transaction.status_detail);
  const matching = [...payouts.entries()].filter(([, value]) => value.paymentId === paymentId);
  let latest: PayoutRecord | null = null;
  for (const [key, value] of matching) {
    latest = { ...value, status, retryable: status === 'failed' && value.attempt < MAX_PAYOUT_ATTEMPTS, error: status === 'failed' ? (transaction.status_detail || transaction.message || 'O Mercado Pago rejeitou o repasse.') : undefined };
    payouts.set(key, latest);
  }
  if (latest) {
    const cardId = [...payoutOrders.values(), ...winnerHistory, ...(currentWinner ? [currentWinner] : [])].find((winner) => winner.mercadoPagoPaymentId === paymentId)?.cardId;
    if (cardId) applyPayoutResult(cardId, latest);
    else persistState();
  }
  return latest;
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

function creditWinnerPrize(winner: StoredWinner) {
  if (winner.walletCreditStatus !== 'pending') return;
  const user = users[winner.userId];
  if (!winner.isUser || !user || winner.userId.startsWith('bot-')) {
    winner.walletCreditStatus = 'not_applicable';
  } else {
    applyWalletTransaction(user.id, 'prize', cents(winner.prizeAmount), `prize:${winner.cardId}`);
    winner.walletCreditStatus = 'credited';
    winner.mercadoPagoPaymentId = 'SALDO';
    winner.mercadoPagoStatus = 'approved';
  }
  if (currentWinner?.cardId === winner.cardId) Object.assign(currentWinner, winner);
  for (const historic of winnerHistory) if (historic.cardId === winner.cardId) Object.assign(historic, winner);
  persistState();
}

// ----------------------------------------------------
// Central Bingo Engine Timer Tick (Runs every 1 second)
// ----------------------------------------------------
setInterval(async () => {
  if (roundStatus === 'waiting') {
    const realPlayerCount = new Set(activeCards.filter((card) => card.isUser && !card.userId.startsWith('bot-')).map((card) => card.userId)).size;
    if (realPlayerCount < 2) {
      waitingSecondsRemaining = 60;
      return;
    }
    waitingSecondsRemaining--;

    if (waitingSecondsRemaining <= 0) {
      // Transition to IN_PROGRESS
      roundStatus = 'in_progress';
      ballDrawIntervalRemaining = 10;
      drawnNumbers = [];
      currentDrawnNumber = null;
      currentWinner = null;

      const paidCardCount = activeCards.filter((card) => card.isUser && !card.userId.startsWith('bot-')).length;
      const totalPot = paidCardCount * 1.0;
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
        if (!card.isUser || card.userId.startsWith('bot-') || !users[card.userId]) continue;
        const win = checkCardWin(card);
        if (win.won) {
          card.hasWon = true;
          card.winningPattern = {
            type: win.type!,
            cells: win.cells || []
          };

          const paidCardCount = activeCards.filter((entry) => entry.isUser && !entry.userId.startsWith('bot-')).length;
          const totalPot = paidCardCount * 1.0;
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
            mercadoPagoPaymentId: 'SALDO',
            mercadoPagoStatus: 'approved',
            walletCreditStatus: card.isUser && !card.userId.startsWith('bot-') ? 'pending' : 'not_applicable',
            timestamp: Date.now()
          };

          currentWinner = winnerObj;
          winnerHistory.unshift(winnerObj);
          if (winnerHistory.length > 20) winnerHistory.pop();
          roundStatus = 'finished';
          waitingSecondsRemaining = 10; // Display winner screen for 10s
          persistState();

          // Credit the authenticated player's server-side wallet exactly once.
          creditWinnerPrize(winnerObj);

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
  const viewer = requirePlayer(req, res);
  if (!viewer) return;
  const visibleWinner = (winner: StoredWinner): StoredWinner => ({
    ...winner,
    isUser: winner.userId === viewer.id,
    pixKey: winner.userId === viewer.id ? winner.pixKey : { type: 'email', key: '', name: '' },
    payoutAttempt: winner.userId === viewer.id ? winner.payoutAttempt : undefined,
    payoutRetryable: winner.userId === viewer.id ? winner.payoutRetryable : false,
    payoutError: winner.userId === viewer.id ? winner.payoutError : undefined,
    walletCreditStatus: winner.walletCreditStatus,
  });
  const totalCards = activeCards.length;
  const paidCardCount = activeCards.filter((card) => card.isUser && !card.userId.startsWith('bot-')).length;
  const potTotal = paidCardCount * 1.0;
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
    winner: currentWinner ? visibleWinner(currentWinner) : null,
    historyRounds: winnerHistory.slice(0, 10).map(visibleWinner),
    activePlayerCount: new Set(activeCards.filter((card) => card.isUser && !card.userId.startsWith('bot-')).map((card) => card.userId)).size,
  });
});

// Anonymous account bootstrap. The client never chooses the account ID.
app.post('/api/session', (req: Request, res: Response) => {
  const authorization = req.header('authorization');
  const existingId = playerIdFromRequest(req);
  if (authorization && !existingId) return res.status(401).json({ error: 'Sessão inválida. Não foi possível recuperar esta conta.' });
  const id = existingId || `player-${crypto.randomUUID()}`;
  const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim().slice(0, 40) : '';
  const user = ensurePlayer(id, existingId ? undefined : displayName);
  if (!existingId) persistState();
  return res.json({ token: issueSessionToken(id), user });
});

// Get user profile & balance from the server only.
app.get('/api/user/profile', (req: Request, res: Response) => {
  const user = requirePlayer(req, res);
  if (!user) return;
  return res.json({ id: user.id, name: user.name, balance: user.balance, pixKey: user.pixKey });
});

// Update the authenticated user's Mercado Pago Pix email.
app.post('/api/user/pix-key', (req: Request, res: Response) => {
  const user = requirePlayer(req, res);
  if (!user) return;
  const key = typeof req.body?.key === 'string' ? req.body.key.trim().toLowerCase() : '';
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().replace(/\s+/g, ' ') : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) {
    return res.status(400).json({ error: 'Informe um e-mail válido cadastrado na sua conta Mercado Pago.' });
  }
  if (name.length < 3 || name.length > 120) return res.status(400).json({ error: 'Informe o nome completo do titular da chave Pix.' });
  const duplicate = Object.values(users).find((candidate) => candidate.id !== user.id && candidate.pixKey?.key.trim().toLowerCase() === key);
  if (duplicate) return res.status(409).json({ error: 'Esta chave Pix já está cadastrada em outra conta.' });
  user.pixKey = { type: 'email', key, name };
  persistState();
  const pendingWinners = [...payoutOrders.values()].filter((winner) =>
    winner.userId === user.id && winner.mercadoPagoStatus === 'failed' && winner.payoutRetryable &&
    (winner.payoutAttempt || 1) < MAX_PAYOUT_ATTEMPTS,
  );
  for (const pendingWinner of pendingWinners) {
    pendingWinner.pixKey = user.pixKey;
    pendingWinner.payoutAttempt = (pendingWinner.payoutAttempt || 1) + 1;
    pendingWinner.payoutRetryable = false;
    pendingWinner.payoutError = undefined;
    pendingWinner.mercadoPagoPaymentId = 'PROCESSANDO...';
    pendingWinner.mercadoPagoStatus = 'in_process';
  }
  if (pendingWinners.length) {
    persistState();
    for (const pendingWinner of pendingWinners) {
      const winnerCardId = pendingWinner.cardId;
      void executeMercadoPagoPixPayout(pendingWinner).then((result) => {
        applyPayoutResult(winnerCardId, result);
      }).catch((error) => console.warn('Falha ao tentar novamente o repasse do vencedor:', error));
    }
  }
  return res.json({ success: true, pixKey: user.pixKey });
});

// Buy cards with a durable request ID, so retries return the same cards and never charge twice.
app.post('/api/game/buy-cards', (req: Request, res: Response) => {
  const user = requirePlayer(req, res);
  if (!user) return;
  const requestId = typeof req.body?.requestId === 'string' ? req.body.requestId : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return res.status(400).json({ error: 'Identificador de compra inválido.' });
  }
  const key = `${user.id}:${requestId}`;
  const previous = purchaseOrders.get(key);
  if (previous) {
    try {
      const completed = completeCardPurchase(previous);
      return res.json({ success: true, boughtCards: completed.cards, newBalance: user.balance, roundId: completed.roundId });
    } catch (error) {
      return res.status(503).json({ error: error instanceof Error ? error.message : 'A compra está sendo recuperada; tente novamente com a mesma solicitação.' });
    }
  }
  if (roundStatus === 'in_progress') return res.status(409).json({ error: 'A rodada atual já começou. Aguarde a próxima rodada para comprar cartelas.' });
  const quantity = Math.floor(Number(req.body?.quantity));
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return res.status(400).json({ error: 'Quantidade de cartelas inválida.' });
  const amountCents = quantity * 100;
  if (amountCents > cents(user.balance)) {
    return res.status(400).json({ error: `Saldo insuficiente. Cada cartela custa R$ 1,00. Seu saldo atual é R$ ${user.balance.toFixed(2)}.` });
  }

  const order: CardPurchaseOrder = {
    id: crypto.randomUUID(), clientRequestId: requestId, userId: user.id,
    quantity, amountCents, roundId: roundCounter,
    cards: Array.from({ length: quantity }, () => generate5x5BingoCard(user.id, user.name, true, roundCounter)),
    status: 'preparing', createdAt: Date.now(),
  };
  purchaseOrders.set(key, order);
  try {
    // Store the exact cards before debit; restart recovery finishes this same order.
    persistState();
    const completed = completeCardPurchase(order);
    return res.json({ success: true, boughtCards: completed.cards, newBalance: user.balance, roundId: completed.roundId });
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : 'Não foi possível registrar a compra; tente novamente com o mesmo identificador.' });
  }
});

// Get user cards for current round
app.get('/api/game/my-cards', (req: Request, res: Response) => {
  const user = requirePlayer(req, res);
  if (!user) return;
  const userCards = activeCards.filter(c => c.userId === user.id);
  return res.json({ cards: userCards });
});

// Chat messages
app.get('/api/chat/messages', (req: Request, res: Response) => {
  res.json({ messages: chatMessages });
});

app.post('/api/chat/send', (req: Request, res: Response) => {
  const user = requirePlayer(req, res);
  if (!user) return;
  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({ error: 'Mensagem vazia' });
  }

  const msg = addChatMessage({
    senderId: user.id,
    senderName: user.name,
    senderAvatar: '😎',
    text: text.trim().substring(0, 140)
  });

  return res.json({ success: true, message: msg });
});

// Mercado Pago Pix deposit generator. Production always uses the server-side token.
app.post('/api/wallet/pix/deposit', async (req: Request, res: Response) => {
  const amount = Number(req.body?.amount);
  const player = requirePlayer(req, res);
  if (!player) return;
  const playerId = player.id;
  if (!Number.isFinite(amount) || amount < 1 || amount > 10000) return res.status(400).json({ error: 'Valor inválido. Informe um valor entre R$ 1,00 e R$ 10.000,00.' });
  if (!player.pixKey?.key || !player.pixKey.name) return res.status(400).json({ error: 'Cadastre seu e-mail Pix e o nome do titular antes de gerar uma recarga.' });
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
          email: player.pixKey.key,
          first_name: player.pixKey.name.split(' ')[0],
          last_name: player.pixKey.name.split(' ').slice(1).join(' ') || undefined,
        },
        metadata: { bingoupix_user_id: player.id },
      }),
    });
    const data = await mpRes.json().catch(() => ({}));
    if (!mpRes.ok || !data.id || !data.point_of_interaction?.transaction_data?.qr_code) {
      return res.status(502).json({ error: data.message || 'Mercado Pago não criou o Pix.' });
    }
    deposits.set(depositId, { id: depositId, paymentId: String(data.id), userId: playerId, amount: Number(amount.toFixed(2)), credited: false });
    persistState();
    const tx = data.point_of_interaction.transaction_data;
    const qrCode = tx.qr_code_base64 ? `data:image/png;base64,${tx.qr_code_base64}` : '';
    return res.json({ id: depositId, amount: Number(amount.toFixed(2)), status: data.status || 'pending', copyPaste: tx.qr_code, qrCode, qrCodeBase64: qrCode, mercadoPagoId: String(data.id), isSimulated: false, expiresAt: Date.now() + 30 * 60 * 1000 });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Falha ao criar o Pix no Mercado Pago.' });
  }
});

app.get('/api/wallet/pix/status/:paymentId', async (req: Request, res: Response) => {
  const user = requirePlayer(req, res);
  if (!user) return;
  const paymentId = String(req.params.paymentId);
  const deposit = [...deposits.values()].find((item) => item.paymentId === paymentId);
  if (!deposit || deposit.userId !== user.id) return res.status(404).json({ error: 'Recarga não encontrada para esta conta.' });
  try {
    const result = await creditApprovedDeposit(paymentId);
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

app.post('/api/wallet/pix/payout', (_req: Request, res: Response) => {
  return res.status(410).json({ error: 'O repasse só pode ser iniciado pelo motor de partidas do servidor.' });
});


function publicWithdrawal(record: WithdrawalRecord): WithdrawalResult {
  return {
    id: record.id, amountCents: record.amountCents, status: record.status,
    paymentId: record.paymentId, error: record.error, createdAt: record.createdAt,
    pixKey: record.pixKey, balance: users[record.userId]?.balance || 0,
  };
}

function reserveWithdrawal(record: WithdrawalRecord) {
  if (record.status !== 'preparing') return;
  applyWalletTransaction(record.userId, 'withdrawal_reserve', -record.amountCents, `withdrawal:${record.id}:reserve`);
  record.status = 'in_process';
  persistState();
}

function settleWithdrawal(record: WithdrawalRecord, status: 'approved' | 'failed' | 'in_process', paymentId: string, error?: string) {
  record.status = status;
  record.paymentId = paymentId || record.paymentId || 'PROCESSANDO...';
  record.error = error;
  if (status === 'failed') {
    // The original reservation is refunded once only after a definitive rejection.
    applyWalletTransaction(record.userId, 'withdrawal_refund', record.amountCents, `withdrawal:${record.id}:refund`);
  }
  persistState();
  return record;
}

async function submitWithdrawal(record: WithdrawalRecord): Promise<WithdrawalRecord> {
  const active = withdrawalInFlight.get(record.id);
  if (active) return active;
  const task = (async () => {
    try {
      const body = JSON.stringify({
        external_reference: record.id,
        description: 'Saque BingouPix',
        transactions: [{
          external_reference: record.id,
          type: 'pix',
          pix: { type: 'EMAIL', chave: record.pixKey.key },
          amount: { currency: 'BRL', value: record.amountCents / 100 },
          description: 'Saque BingouPix',
        }],
      });
      const response = await mercadoPagoRequest('/v1/payouts', {
        method: 'POST',
        headers: payoutRequestHeaders(body, record.idempotencyKey),
        body,
      });
      const data = await response.json().catch(() => ({}));
      const paymentId = String(data.id || 'PROCESSANDO...');
      if (!response.ok) {
        const definiteRejection = [400, 401, 403, 404, 422].includes(response.status);
        return settleWithdrawal(record, definiteRejection ? 'failed' : 'in_process', definiteRejection ? '' : 'PROCESSANDO...', data.message || data.error || `Mercado Pago respondeu HTTP ${response.status}.`);
      }
      return settleWithdrawal(record, 'in_process', paymentId, undefined);
    } catch (error) {
      // A timeout is ambiguous: keep the reservation and retry using the same key.
      record.status = 'in_process';
      record.paymentId = 'PROCESSANDO...';
      record.error = error instanceof Error ? error.message : 'Resposta inconclusiva do Mercado Pago.';
      persistState();
      return record;
    }
  })();
  withdrawalInFlight.set(record.id, task);
  try { return await task; } finally { withdrawalInFlight.delete(record.id); }
}

async function refreshWithdrawal(record: WithdrawalRecord): Promise<WithdrawalRecord> {
  if (record.status === 'preparing') reserveWithdrawal(record);
  if (record.status !== 'in_process' || !isPayoutIntegrationConfigured()) return record;
  if (!record.paymentId || record.paymentId.startsWith('PROCESSANDO')) return submitWithdrawal(record);
  try {
    const response = await mercadoPagoRequest(`/v1/payouts/${encodeURIComponent(record.paymentId)}/transactions?limit=100`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return record;
    const transactions = Array.isArray(data.transactions) ? data.transactions : [];
    const transaction = transactions.find((item: any) => item.external_reference === record.id) || transactions[0];
    if (!transaction) return record;
    const providerStatus = payoutTransactionStatus(transaction.status, transaction.status_detail);
    if (providerStatus === 'approved') return settleWithdrawal(record, 'approved', record.paymentId);
    if (providerStatus === 'failed') return settleWithdrawal(record, 'failed', record.paymentId, String(transaction.status_detail || transaction.message || 'Mercado Pago não concluiu a transferência Pix.'));
    // created/approved are intermediate API states, not proof of credit.
    return record;
  } catch {
    return record;
  }
}

app.post('/api/wallet/pix/withdraw', async (req: Request, res: Response) => {
  const user = requirePlayer(req, res);
  if (!user) return;
  const requestId = typeof req.body?.requestId === 'string' ? req.body.requestId : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return res.status(400).json({ error: 'Identificador de solicitação inválido.' });
  }
  const previous = [...withdrawals.values()].find((item) => item.userId === user.id && item.clientRequestId === requestId);
  if (previous) return res.json({ withdrawal: publicWithdrawal(previous) });
  const pending = [...withdrawals.values()].find((item) => item.userId === user.id && (item.status === 'preparing' || item.status === 'in_process'));
  if (pending) return res.status(409).json({ error: 'Você já possui um saque em processamento.', withdrawal: publicWithdrawal(pending) });
  const amountCents = Math.round(Number(req.body?.amount) * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents < 100) return res.status(400).json({ error: 'O saque mínimo é R$ 1,00.' });
  if (amountCents > cents(user.balance)) return res.status(400).json({ error: 'Saldo disponível insuficiente para este saque.' });
  if (user.pixKey?.type !== 'email' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.pixKey.key) || !user.pixKey.name) {
    return res.status(400).json({ error: 'Cadastre um e-mail Pix válido da sua conta Mercado Pago antes de sacar.' });
  }
  if (!isPayoutTokenConfigured()) return res.status(503).json({ error: `Credencial de ${isProduction ? 'produção APP_USR' : 'teste TEST'} do Mercado Pago não configurada para saques.` });
  if (isProduction && !isPayoutIntegrationConfigured()) return res.status(503).json({ error: 'Saque Pix não configurado: falta a chave privada Ed25519 do Mercado Pago no servidor.' });

  const id = `WDR-${crypto.randomUUID()}`;
  const record: WithdrawalRecord = {
    id, clientRequestId: requestId, userId: user.id, amountCents,
    pixKey: { type: 'email', key: user.pixKey.key, name: user.pixKey.name },
    idempotencyKey: `bingoupix-${id}`,
    status: 'preparing', paymentId: 'PROCESSANDO...', createdAt: Date.now(),
  };
  withdrawals.set(id, record);
  try {
    persistState();
    reserveWithdrawal(record);
    await submitWithdrawal(record);
    return res.json({ withdrawal: publicWithdrawal(record) });
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : 'Não foi possível registrar o saque.' });
  }
});

app.get('/api/wallet/pix/withdrawals/current', async (req: Request, res: Response) => {
  const user = requirePlayer(req, res);
  if (!user) return;
  const record = [...withdrawals.values()]
    .filter((item) => item.userId === user.id && (item.status === 'preparing' || item.status === 'in_process'))
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!record) return res.json({ withdrawal: null });
  try { await refreshWithdrawal(record); }
  catch { /* preserve and return pending state */ }
  return res.json({ withdrawal: publicWithdrawal(record) });
});

app.get('/api/wallet/pix/withdraw/:withdrawalId', async (req: Request, res: Response) => {
  const user = requirePlayer(req, res);
  if (!user) return;
  const record = withdrawals.get(String(req.params.withdrawalId));
  if (!record || record.userId !== user.id) return res.status(404).json({ error: 'Saque não encontrado para esta conta.' });
  try { await refreshWithdrawal(record); }
  catch { /* preserve and return pending state */ }
  return res.json({ withdrawal: publicWithdrawal(record) });
});

async function recoverPendingWithdrawals() {
  if (!isPayoutIntegrationConfigured()) return;
  for (const record of withdrawals.values()) {
    if (record.status === 'preparing' || record.status === 'in_process') {
      try { await refreshWithdrawal(record); } catch { /* retry on next pass */ }
    }
  }
}

app.get('/api/wallet/pix/payout/status/:paymentId', async (req: Request, res: Response) => {
  const user = requirePlayer(req, res);
  if (!user) return;
  const paymentId = String(req.params.paymentId || '');
  const ownsPayout = (currentWinner?.userId === user.id && currentWinner.mercadoPagoPaymentId === paymentId) || winnerHistory.some((winner) => winner.userId === user.id && winner.mercadoPagoPaymentId === paymentId) || [...payoutOrders.values()].some((winner) => winner.userId === user.id && winner.mercadoPagoPaymentId === paymentId);
  if (!ownsPayout) return res.status(404).json({ error: 'Repasse não encontrado para esta conta.' });
  if (!paymentId) return res.status(400).json({ error: 'ID do pagamento não informado.' });
  for (const record of payouts.values()) {
    if (record.paymentId === paymentId && record.status !== 'in_process') return res.json({ status: record.status, paymentId });
  }
  try {
    const result = await refreshPayoutStatus(paymentId);
    return res.json({ status: result?.status || 'in_process', paymentId });
  } catch {
    return res.json({ status: 'in_process', paymentId });
  }
});

// System info / Mercado Pago status
app.get('/api/system/status', (req: Request, res: Response) => {
  const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  const isConfigured = Boolean(mpToken && mpToken.trim() !== '' && mpToken !== 'YOUR_MERCADO_PAGO_ACCESS_TOKEN');
  res.json({
    mercadoPagoConfigured: isConfigured,
    serverTime: Date.now(),
    roundIntervalSec: 60,
    ballDrawIntervalSec: 10,
    cardPrice: 1.0,
    prizeCutPercent: 80,
  });
});

let payoutRecoveryRunning = false;
async function recoverPendingPayouts() {
  if (payoutRecoveryRunning || !isPayoutIntegrationConfigured()) return;
  payoutRecoveryRunning = true;
  try {
    const pending = [...payoutOrders.values()].filter((winner) => winner.mercadoPagoStatus === 'in_process');
    for (const winner of pending) {
      if (winner.mercadoPagoPaymentId && !winner.mercadoPagoPaymentId.startsWith('PROCESSANDO')) {
        try { await refreshPayoutStatus(winner.mercadoPagoPaymentId); } catch { /* retry on next reconciliation */ }
      } else {
        const result = await executeMercadoPagoPixPayout(winner);
        applyPayoutResult(winner.cardId, result);
      }
    }
  } finally {
    payoutRecoveryRunning = false;
  }
}

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
void (async () => {
  try {
    recoverPendingCardPurchases();
    recoverUncreditedWinnerPrizes();
    await recoverPendingWithdrawals();
    await recoverPendingPayouts();
    walletRecoveryComplete = true;
  } catch (error) {
    storageHealthy = false;
    console.error('Recuperação financeira falhou; APIs autenticadas permanecem bloqueadas:', error);
  }
})();
setInterval(() => {
  if (walletRecoveryComplete && storageHealthy) {
    void recoverPendingWithdrawals();
    void recoverPendingPayouts();
  }
}, 30000);
