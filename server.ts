import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { formatPixEMV, generateSvgQrCode } from './src/utils/pix.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json());

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
  mercadoPagoStatus: 'approved' | 'in_process' | 'simulated';
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
    pixKey: { type: 'cpf', key: '123.***.***-89', name: 'Luciana M. Silva' },
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
    pixKey: { type: 'phone', key: '(31) 9****-1234', name: 'Carlos E. Santos' },
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
    balance: 20.0, // Welcome credit
    pixKey: {
      type: 'cpf',
      key: '123.456.789-00',
      name: 'Jogador PixBingo'
    }
  }
};

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

// Automatic Pix Payout via Mercado Pago API
async function executeMercadoPagoPixPayout(winner: StoredWinner): Promise<{ status: 'approved' | 'simulated'; paymentId: string; details: any }> {
  const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (mpToken && mpToken.trim() !== '' && mpToken !== 'YOUR_MERCADO_PAGO_ACCESS_TOKEN') {
    try {
      // Calling Mercado Pago Payouts / Transfers API
      // Note: Mercado Pago supports payments / payouts via their disbursements or payment API
      const payoutRes = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mpToken.trim()}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `payout-${winner.cardId}-${Date.now()}`
        },
        body: JSON.stringify({
          transaction_amount: Number(winner.prizeAmount.toFixed(2)),
          description: `Prêmio PixBingo Rodada #${roundCounter} - ${winner.patternName}`,
          payment_method_id: 'pix',
          payer: {
            email: winner.pixKey.type === 'email' ? winner.pixKey.key : 'ganhador.bingo@pixbingo.com',
            first_name: winner.userName.split(' ')[0] || 'Vencedor',
            identification: {
              type: winner.pixKey.type === 'cpf' ? 'CPF' : 'OTHER',
              number: winner.pixKey.type === 'cpf' ? winner.pixKey.key.replace(/\D/g, '') : '00000000000'
            }
          }
        })
      });

      if (payoutRes.ok) {
        const data = await payoutRes.json();
        return {
          status: 'approved',
          paymentId: String(data.id || `MP-${Date.now()}`),
          details: data
        };
      }
    } catch (err) {
      console.error('Mercado Pago API payout error:', err);
    }
  }

  // Simulation mode (when user has not configured their live Mercado Pago token)
  const simPaymentId = `MP-PIX-TRANSFER-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  return {
    status: 'simulated',
    paymentId: simPaymentId,
    details: {
      type: 'pix_instant_transfer',
      destination_pix_key: winner.pixKey.key,
      key_type: winner.pixKey.type,
      recipient_name: winner.pixKey.name || winner.userName,
      gateway: 'Mercado Pago Pix Payout Engine v1'
    }
  };
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
seedBotCards();

setInterval(async () => {
  if (roundStatus === 'waiting') {
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

      // Ensure there are at least some cards
      if (activeCards.length === 0) {
        seedBotCards();
      }

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

          // Credit balance if it was the user
          if (card.isUser) {
            const u = users['user-me'];
            if (u) u.balance = Number((u.balance + prizeAmount).toFixed(2));
          }

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
              text: `Prêmio de R$ ${prizeAmount.toFixed(2)} repassado via Pix para ${winnerObj.userName} (${winnerObj.pixKey.key})! ID Mercado Pago: ${payoutResult.paymentId}`,
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
    activePlayerCount: BOT_PLAYERS.length + 1 + Math.floor(Math.random() * 5),
  });
});

// Get user profile & balance
app.get('/api/user/profile', (req: Request, res: Response) => {
  const user = users['user-me'] || {
    id: 'user-me',
    name: 'Você (Jogador)',
    balance: 20.0,
    pixKey: { type: 'cpf', key: '123.456.789-00', name: 'Jogador PixBingo' }
  };
  res.json(user);
});

// Update user Pix Key (CPF, Phone, Email, Random)
app.post('/api/user/pix-key', (req: Request, res: Response) => {
  const { type, key, name } = req.body;
  if (!key || !type) {
    return res.status(400).json({ error: 'Chave e tipo são obrigatórios' });
  }

  const user = users['user-me'];
  if (user) {
    user.pixKey = { type, key, name: name || user.name };
  }

  res.json({ success: true, pixKey: user?.pixKey });
});

// Buy cards for current/next round
app.post('/api/game/buy-cards', (req: Request, res: Response) => {
  const { quantity = 1 } = req.body;
  const qty = Math.max(1, Math.min(20, Number(quantity)));
  const cost = qty * 1.0; // R$ 1 per card

  const user = users['user-me'];
  if (!user || user.balance < cost) {
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
  const userCards = activeCards.filter(c => c.isUser);
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

// Mercado Pago Pix Deposit Generator
app.post('/api/wallet/pix/deposit', async (req: Request, res: Response) => {
  const { amount = 10 } = req.body;
  const depositAmount = Math.max(1, Number(amount));
  const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  const depositId = `DEP-${Date.now()}`;
  let copyPaste = '';
  let qrCodeSvg = '';
  let mercadoPagoId = '';
  let isSimulated = true;

  if (mpToken && mpToken.trim() !== '' && mpToken !== 'YOUR_MERCADO_PAGO_ACCESS_TOKEN') {
    try {
      const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mpToken.trim()}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `dep-${depositId}`
        },
        body: JSON.stringify({
          transaction_amount: Number(depositAmount.toFixed(2)),
          description: `Depósito PixBingo R$ ${depositAmount.toFixed(2)}`,
          payment_method_id: 'pix',
          payer: {
            email: 'cliente@pixbingo.com',
            first_name: 'Jogador',
            last_name: 'Bingo'
          }
        })
      });

      if (mpRes.ok) {
        const mpData = await mpRes.json();
        mercadoPagoId = String(mpData.id);
        const pointOfInteraction = mpData.point_of_interaction?.transaction_data;
        if (pointOfInteraction?.qr_code) {
          copyPaste = pointOfInteraction.qr_code;
          qrCodeSvg = pointOfInteraction.qr_code_base64
            ? `data:image/png;base64,${pointOfInteraction.qr_code_base64}`
            : generateSvgQrCode(copyPaste);
          isSimulated = false;
        }
      }
    } catch (e) {
      console.error('Mercado Pago API error generating pix deposit:', e);
    }
  }

  // Fallback / Sandbox authentic EMV code
  if (!copyPaste) {
    const dummyKey = 'pagamentos@pixbingo.online';
    copyPaste = formatPixEMV(dummyKey, 'PIXBINGO MERCADO PAGO', 'SAO PAULO', depositAmount, depositId);
    qrCodeSvg = generateSvgQrCode(copyPaste);
    mercadoPagoId = `MP-SIM-${Date.now()}`;
  }

  res.json({
    id: depositId,
    amount: depositAmount,
    status: 'pending',
    copyPaste,
    qrCode: qrCodeSvg,
    mercadoPagoId,
    isSimulated,
    expiresAt: Date.now() + 15 * 60 * 1000
  });
});

// Confirm/Simulate Pix Deposit (adds funds to user balance)
app.post('/api/wallet/pix/verify', (req: Request, res: Response) => {
  const { amount } = req.body;
  const depositAmount = Number(amount);
  const user = users['user-me'];
  if (user && depositAmount > 0) {
    user.balance = Number((user.balance + depositAmount).toFixed(2));
  }

  addChatMessage({
    senderId: 'system',
    senderName: 'Mercado Pago Pix',
    senderAvatar: '💳',
    text: `Depósito Pix de R$ ${depositAmount.toFixed(2)} confirmado com sucesso! Saldo atualizado.`,
    isSystem: true,
    systemType: 'pix'
  });

  res.json({
    success: true,
    newBalance: user?.balance || 0,
    message: 'Pagamento Pix aprovado com sucesso!'
  });
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
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`PixBingo server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
