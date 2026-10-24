/**
 * Bingo WebService Engine
 * Runs fully self-contained as a client-side WebService for GitHub Pages static hosting.
 */

import { BingoRound, BingoCard, ChatMessage, PixKey, WinnerInfo } from '../types/bingo.ts';
import { mercadoPagoService } from './mercadoPagoService.ts';

// Simulated online active players
const BOT_PLAYERS = [
  { id: 'bot-1', name: 'Luciana_SP', avatar: '👩', pixKey: { type: 'cpf' as const, key: '123.***.***-89', name: 'Luciana M. Silva' } },
  { id: 'bot-2', name: 'MarcosBingo', avatar: '👨', pixKey: { type: 'phone' as const, key: '(11) 9****-9922', name: 'Marcos A. Lima' } },
  { id: 'bot-3', name: 'Patricia_RJ', avatar: '👩‍🦰', pixKey: { type: 'email' as const, key: 'patricia***@gmail.com', name: 'Patricia Costa' } },
  { id: 'bot-4', name: 'Carlos_MG', avatar: '🧔', pixKey: { type: 'phone' as const, key: '(31) 9****-1234', name: 'Carlos E. Santos' } },
  { id: 'bot-5', name: 'Bruna_RS', avatar: '👱‍♀️', pixKey: { type: 'cpf' as const, key: '456.***.***-10', name: 'Bruna F. Souza' } },
  { id: 'bot-6', name: 'Rafael_BA', avatar: '👨‍🦱', pixKey: { type: 'cpf' as const, key: '789.***.***-34', name: 'Rafael N. Alves' } },
  { id: 'bot-7', name: 'Fernanda_PR', avatar: '👧', pixKey: { type: 'email' as const, key: 'fernanda***@hotmail.com', name: 'Fernanda Rocha' } },
  { id: 'bot-8', name: 'Diego_GO', avatar: '🧑', pixKey: { type: 'random' as const, key: 'e5b7***-992a', name: 'Diego B. Prado' } },
];

export interface UserProfile {
  id: string;
  name: string;
  balance: number;
  pixKey?: PixKey;
}

type Listener<T> = (data: T) => void;

class BingoWebService {
  private user: UserProfile;
  private round: BingoRound;
  private activeCards: BingoCard[] = [];
  private chatMessages: ChatMessage[] = [];
  private timer: number | null = null;

  private roundListeners: Set<Listener<BingoRound>> = new Set();
  private userListeners: Set<Listener<UserProfile>> = new Set();
  private cardsListeners: Set<Listener<BingoCard[]>> = new Set();
  private chatListeners: Set<Listener<ChatMessage[]>> = new Set();

  constructor() {
    this.user = this.loadUser();
    this.round = this.initRound(101);
    this.initChat();
    this.seedBots();
    this.startEngine();
  }

  private loadUser(): UserProfile {
    try {
      const stored = localStorage.getItem('pixbingo_user');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return {
      id: 'user-me',
      name: 'Você (Jogador)',
      balance: 20.0,
      pixKey: {
        type: 'cpf',
        key: '123.456.789-00',
        name: 'Jogador PixBingo',
      },
    };
  }

  private saveUser() {
    try {
      localStorage.setItem('pixbingo_user', JSON.stringify(this.user));
    } catch {
      // ignore
    }
    this.notifyUser();
  }

  private initRound(id: number): BingoRound {
    return {
      id,
      status: 'waiting',
      roundStartTime: Date.now(),
      waitingSecondsRemaining: 60, // 1 minute interval between rounds
      ballDrawIntervalRemaining: 10, // 10s per ball
      drawnNumbers: [],
      currentNumber: null,
      totalCards: 0,
      potTotal: 0,
      prizePot: 0,
      winner: null,
      historyRounds: [
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
        },
      ],
    };
  }

  private initChat() {
    this.chatMessages = [
      {
        id: 'msg-init-1',
        senderId: 'system',
        senderName: 'Sistema PixBingo',
        senderAvatar: '🎱',
        text: 'Bem-vindo ao PixBingo! Cada cartela custa R$ 1,00 e o prêmio de 80% é transferido automaticamente via Pix Mercado Pago.',
        isSystem: true,
        systemType: 'round',
        timestamp: Date.now() - 40000,
      },
      {
        id: 'msg-init-2',
        senderId: 'bot-2',
        senderName: 'MarcosBingo',
        senderAvatar: '👨',
        text: 'Boa sorte a todos nesta rodada! 🤞',
        timestamp: Date.now() - 25000,
      },
    ];
  }

  // Generate 5x5 card with numbers 1 to 60
  // Col 0: 1-12, Col 1: 13-24, Col 2: 25-36, Col 3: 37-48, Col 4: 49-60
  public generate5x5Card(userId: string, userName: string, isUser: boolean): BingoCard {
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

      for (let row = 0; row < 5; row++) {
        const idx = Math.floor(Math.random() * available.length);
        cardNumbers[row][col] = available.splice(idx, 1)[0];
      }
    }

    // Pre-mark already drawn numbers
    this.round.drawnNumbers.forEach((drawn) => {
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (cardNumbers[r][c] === drawn) marked[r][c] = true;
        }
      }
    });

    return {
      id: `card-${this.round.id}-${Math.random().toString(36).substring(2, 8)}`,
      roundId: this.round.id,
      userId,
      userName,
      isUser,
      numbers: cardNumbers,
      marked,
      hasWon: false,
    };
  }

  private seedBots() {
    const botCount = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < botCount; i++) {
      const bot = BOT_PLAYERS[i % BOT_PLAYERS.length];
      const count = 1 + Math.floor(Math.random() * 3);
      for (let c = 0; c < count; c++) {
        this.activeCards.push(this.generate5x5Card(bot.id, bot.name, false));
      }
    }
    this.updatePot();
  }

  private updatePot() {
    this.round.totalCards = this.activeCards.length;
    this.round.potTotal = this.round.totalCards * 1.0;
    this.round.prizePot = Number((this.round.potTotal * 0.8).toFixed(2));
    this.notifyRound();
  }

  // Check winning patterns
  private checkCardWin(card: BingoCard) {
    // Check horizontal lines
    for (let r = 0; r < 5; r++) {
      if (card.marked[r].every(Boolean)) {
        return {
          won: true,
          type: 'row' as const,
          name: `Linha Horizontal #${r + 1}`,
          cells: [[r, 0], [r, 1], [r, 2], [r, 3], [r, 4]] as [number, number][],
        };
      }
    }

    // Check vertical columns
    for (let c = 0; c < 5; c++) {
      let full = true;
      for (let r = 0; r < 5; r++) {
        if (!card.marked[r][c]) {
          full = false;
          break;
        }
      }
      if (full) {
        return {
          won: true,
          type: 'column' as const,
          name: `Coluna Vertical #${c + 1}`,
          cells: [[0, c], [1, c], [2, c], [3, c], [4, c]] as [number, number][],
        };
      }
    }

    // Check diagonal 1
    let diag1 = true;
    for (let i = 0; i < 5; i++) {
      if (!card.marked[i][i]) {
        diag1 = false;
        break;
      }
    }
    if (diag1) {
      return {
        won: true,
        type: 'diagonal' as const,
        name: 'Diagonal Principal',
        cells: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]] as [number, number][],
      };
    }

    // Check diagonal 2
    let diag2 = true;
    for (let i = 0; i < 5; i++) {
      if (!card.marked[i][4 - i]) {
        diag2 = false;
        break;
      }
    }
    if (diag2) {
      return {
        won: true,
        type: 'diagonal' as const,
        name: 'Diagonal Secundária',
        cells: [[0, 4], [1, 3], [2, 2], [3, 1], [4, 0]] as [number, number][],
      };
    }

    // Check full card
    if (card.marked.every((row) => row.every(Boolean))) {
      const all: [number, number][] = [];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) all.push([r, c]);
      }
      return {
        won: true,
        type: 'full' as const,
        name: 'Cartela Cheia!',
        cells: all,
      };
    }

    return { won: false };
  }

  // Main 1-second tick loop
  private startEngine() {
    if (this.timer) clearInterval(this.timer);

    this.timer = window.setInterval(async () => {
      if (this.round.status === 'waiting') {
        this.round.waitingSecondsRemaining--;

        if (this.round.waitingSecondsRemaining === 45) {
          const bot = BOT_PLAYERS[Math.floor(Math.random() * BOT_PLAYERS.length)];
          this.addChatMessage({
            senderId: bot.id,
            senderName: bot.name,
            senderAvatar: bot.avatar,
            text: 'Comprei mais cartelas! Boa sorte pra nós! 🍀',
          });
        }

        if (this.round.waitingSecondsRemaining <= 0) {
          // Start round
          this.round.status = 'in_progress';
          this.round.ballDrawIntervalRemaining = 10;
          this.round.drawnNumbers = [];
          this.round.currentNumber = null;
          this.round.winner = null;

          if (this.activeCards.length === 0) {
            this.seedBots();
          }

          this.addChatMessage({
            senderId: 'system',
            senderName: 'Sistema PixBingo',
            senderAvatar: '🎲',
            text: `Rodada #${this.round.id} INICIADA! ${this.activeCards.length} cartelas participando. Prêmio: R$ ${this.round.prizePot.toFixed(2)} (80% via Pix).`,
            isSystem: true,
            systemType: 'round',
          });
        }
        this.notifyRound();
      } else if (this.round.status === 'in_progress') {
        this.round.ballDrawIntervalRemaining--;

        if (this.round.ballDrawIntervalRemaining <= 0) {
          // Draw random number 1 to 60 not yet drawn
          const available: number[] = [];
          for (let n = 1; n <= 60; n++) {
            if (!this.round.drawnNumbers.includes(n)) available.push(n);
          }

          if (available.length === 0) {
            this.round.status = 'finished';
            this.round.waitingSecondsRemaining = 8;
            this.notifyRound();
            return;
          }

          const drawn = available[Math.floor(Math.random() * available.length)];
          this.round.drawnNumbers.push(drawn);
          this.round.currentNumber = drawn;
          this.round.ballDrawIntervalRemaining = 10; // 10s for next ball

          this.addChatMessage({
            senderId: 'system',
            senderName: 'Globo do Bingo',
            senderAvatar: '🎱',
            text: `Bola número ${drawn} sorteada!`,
            isSystem: true,
            systemType: 'ball',
          });

          // Daub all active cards
          for (const card of this.activeCards) {
            for (let r = 0; r < 5; r++) {
              for (let c = 0; c < 5; c++) {
                if (card.numbers[r][c] === drawn) {
                  card.marked[r][c] = true;
                }
              }
            }
          }
          this.notifyCards();

          // Check if any card won
          for (const card of this.activeCards) {
            const win = this.checkCardWin(card);
            if (win.won) {
              card.hasWon = true;
              card.winningPattern = {
                type: win.type!,
                cells: win.cells || [],
              };

              const prizeAmount = this.round.prizePot;
              let winnerPixKey = this.user.pixKey;

              if (!card.isUser) {
                const botObj = BOT_PLAYERS.find((b) => b.id === card.userId);
                winnerPixKey = botObj?.pixKey || {
                  type: 'cpf',
                  key: '123.***.***-00',
                  name: card.userName,
                };
              }

              const winnerObj: WinnerInfo = {
                userId: card.userId,
                userName: card.userName,
                isUser: card.isUser,
                cardId: card.id,
                patternType: win.type!,
                patternName: win.name || 'Linha Premiada',
                prizeAmount,
                totalPot: this.round.potTotal,
                pixKey: winnerPixKey || { type: 'cpf', key: '123.456.789-00', name: card.userName },
                mercadoPagoPaymentId: 'PROCESSANDO...',
                mercadoPagoStatus: 'in_process',
                timestamp: Date.now(),
              };

              this.round.winner = winnerObj;
              this.round.status = 'finished';
              this.round.waitingSecondsRemaining = 10;

              // Credit user balance if user won
              if (card.isUser) {
                this.user.balance = Number((this.user.balance + prizeAmount).toFixed(2));
                this.saveUser();
              }

              // Execute Mercado Pago Pix payout
              mercadoPagoService
                .executePixPrizePayout(card.userName, winnerObj.pixKey, prizeAmount, this.round.id)
                .then((payout) => {
                  if (this.round.winner) {
                    this.round.winner.mercadoPagoPaymentId = payout.paymentId;
                    this.round.winner.mercadoPagoStatus = payout.status;
                  }
                  this.round.historyRounds.unshift({
                    ...winnerObj,
                    mercadoPagoPaymentId: payout.paymentId,
                    mercadoPagoStatus: payout.status,
                  });
                  if (this.round.historyRounds.length > 20) this.round.historyRounds.pop();
                  this.notifyRound();

                  this.addChatMessage({
                    senderId: 'system',
                    senderName: 'Mercado Pago Pix',
                    senderAvatar: '💸',
                    text: `Prêmio de R$ ${prizeAmount.toFixed(2)} transferido via Pix Mercado Pago para ${winnerObj.userName}! ID: ${payout.paymentId}`,
                    isSystem: true,
                    systemType: 'pix',
                  });
                });

              this.addChatMessage({
                senderId: 'system',
                senderName: 'BINGO!',
                senderAvatar: '🏆',
                text: `BINGO! ${card.userName} completou ${win.name} e GANHOU R$ ${prizeAmount.toFixed(2)}!`,
                isSystem: true,
                systemType: 'winner',
              });

              break;
            }
          }
        }
        this.notifyRound();
      } else if (this.round.status === 'finished') {
        this.round.waitingSecondsRemaining--;

        if (this.round.waitingSecondsRemaining <= 0) {
          // Reset to next round with 1 minute interval
          const nextId = this.round.id + 1;
          const history = this.round.historyRounds;
          this.round = this.initRound(nextId);
          this.round.historyRounds = history;
          this.activeCards = [];
          this.seedBots();

          this.addChatMessage({
            senderId: 'system',
            senderName: 'Sistema PixBingo',
            senderAvatar: '⏳',
            text: `Rodada #${nextId} aberta! 1 minuto para compra de cartelas a R$ 1,00.`,
            isSystem: true,
            systemType: 'round',
          });

          this.notifyRound();
          this.notifyCards();
        } else {
          this.notifyRound();
        }
      }
    }, 1000);
  }

  // Public Actions
  public buyCards(quantity: number): { success: boolean; error?: string } {
    const cost = quantity * 1.0;
    if (this.user.balance < cost) {
      return { success: false, error: 'Saldo insuficiente. Recarregue via Pix.' };
    }

    this.user.balance = Number((this.user.balance - cost).toFixed(2));
    this.saveUser();

    for (let i = 0; i < quantity; i++) {
      const card = this.generate5x5Card(this.user.id, this.user.name, true);
      this.activeCards.push(card);
    }

    this.updatePot();
    this.notifyCards();

    this.addChatMessage({
      senderId: this.user.id,
      senderName: this.user.name,
      senderAvatar: '🎟️',
      text: `Comprou ${quantity} cartela(s) para a Rodada #${this.round.id}!`,
    });

    return { success: true };
  }

  public registerPixKey(pixKey: PixKey) {
    this.user.pixKey = pixKey;
    this.saveUser();
  }

  public addDeposit(amount: number) {
    this.user.balance = Number((this.user.balance + amount).toFixed(2));
    this.saveUser();

    this.addChatMessage({
      senderId: 'system',
      senderName: 'Mercado Pago Pix',
      senderAvatar: '💳',
      text: `Depósito Pix de R$ ${amount.toFixed(2)} aprovado no Mercado Pago! Saldo atualizado.`,
      isSystem: true,
      systemType: 'pix',
    });
  }

  public addChatMessage(msg: Omit<ChatMessage, 'id' | 'timestamp'>) {
    const newMsg: ChatMessage = {
      ...msg,
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
    };
    this.chatMessages.push(newMsg);
    if (this.chatMessages.length > 80) this.chatMessages.shift();
    this.notifyChat();
    return newMsg;
  }

  // Getters
  public getRound(): BingoRound {
    return { ...this.round };
  }

  public getUser(): UserProfile {
    return { ...this.user };
  }

  public getUserCards(): BingoCard[] {
    return this.activeCards.filter((c) => c.isUser);
  }

  public getChat(): ChatMessage[] {
    return [...this.chatMessages];
  }

  // Subscriptions
  public subscribeRound(cb: Listener<BingoRound>) {
    this.roundListeners.add(cb);
    cb(this.getRound());
    return () => this.roundListeners.delete(cb);
  }

  public subscribeUser(cb: Listener<UserProfile>) {
    this.userListeners.add(cb);
    cb(this.getUser());
    return () => this.userListeners.delete(cb);
  }

  public subscribeCards(cb: Listener<BingoCard[]>) {
    this.cardsListeners.add(cb);
    cb(this.getUserCards());
    return () => this.cardsListeners.delete(cb);
  }

  public subscribeChat(cb: Listener<ChatMessage[]>) {
    this.chatListeners.add(cb);
    cb(this.getChat());
    return () => this.chatListeners.delete(cb);
  }

  private notifyRound() {
    const r = this.getRound();
    this.roundListeners.forEach((cb) => cb(r));
  }

  private notifyUser() {
    const u = this.getUser();
    this.userListeners.forEach((cb) => cb(u));
  }

  private notifyCards() {
    const c = this.getUserCards();
    this.cardsListeners.forEach((cb) => cb(c));
  }

  private notifyChat() {
    const ch = this.getChat();
    this.chatListeners.forEach((cb) => cb(ch));
  }
}

export const bingoWebService = new BingoWebService();
