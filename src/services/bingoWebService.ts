/**
 * BingouPix WebService Engine
 * Real-Time Device-to-Device and Tab Sync for GitHub Pages.
 * Every PC or Mobile Phone counts as 1 unique player.
 * Minimum 2 players with bought cards required to start.
 */

import { BingoRound, BingoCard, ChatMessage, PixKey, WinnerInfo } from '../types/bingo.ts';
import { mercadoPagoService } from './mercadoPagoService.ts';
import { multiplayerSync, SyncMessage } from './multiplayerSync.ts';

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
    try { sessionStorage.setItem('bingoupix_player_name', this.user.name); } catch { /* private mode */ }
    this.round = this.initRound(1);
    this.initChat();
    this.initMultiplayerSync();
    void this.syncBackendState();
    window.setInterval(() => void this.syncBackendState(), 1000);
  }

  private apiUrl(path: string): string {
    const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    return `${base}${path}`;
  }

  private loadUser(): UserProfile {
    const devId = multiplayerSync.playerId;
    const devName = multiplayerSync.playerName;

    let savedKey: PixKey | undefined;
    let savedBalance = 0;
    let savedName = devName;
    try {
      const stored = localStorage.getItem('bingoupix_user_v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.pixKey) {
          const rawKey = typeof parsed.pixKey.key === 'string' ? parsed.pixKey.key.trim().toLowerCase() : '';
          if (rawKey.includes('@')) savedKey = { type: 'email', key: rawKey, name: parsed.pixKey.name || '' };
        }
        if (typeof parsed.balance === 'number') savedBalance = parsed.balance;
        if (typeof parsed.name === 'string' && parsed.name.trim()) savedName = parsed.name;
      }
    } catch {
      // ignore
    }

    return {
      id: devId,
      name: savedName,
      balance: savedBalance,
      pixKey: savedKey,
    };
  }

  private restoreLocalGameState() {
    try {
      const stored = localStorage.getItem('bingoupix_game_v2');
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (parsed.round) this.round = parsed.round as BingoRound;
      if (Array.isArray(parsed.activeCards)) this.activeCards = parsed.activeCards as BingoCard[];
    } catch {
      // ignore corrupt browser state
    }
  }

  private persistLocalGameState() {
    try {
      localStorage.setItem('bingoupix_game_v2', JSON.stringify({
        round: this.round,
        activeCards: this.activeCards,
      }));
    } catch {
      // ignore storage quota/private mode errors
    }
  }

  private async syncBackendState() {
    if (!import.meta.env.VITE_API_BASE_URL) return;
    try {
      const [profileResponse, stateResponse, cardsResponse] = await Promise.all([
        fetch(this.apiUrl(`/api/user/profile?userId=${encodeURIComponent(this.user.id)}&userName=${encodeURIComponent(this.user.name)}`)),
        fetch(this.apiUrl('/api/game/state')),
        fetch(this.apiUrl(`/api/game/my-cards?userId=${encodeURIComponent(this.user.id)}`)),
      ]);
      if (!profileResponse.ok || !stateResponse.ok || !cardsResponse.ok) return;
      const profile = await profileResponse.json();
      const state = await stateResponse.json();
      const cards = await cardsResponse.json();
      if (profile?.id) {
        this.user = {
          id: this.user.id,
          name: profile.name || this.user.name,
          balance: Number(profile.balance) || 0,
          pixKey: profile.pixKey || this.user.pixKey,
        };
        this.saveUser();
      }
      if (state?.id) this.round = state as BingoRound;
      if (Array.isArray(cards?.cards)) this.activeCards = cards.cards as BingoCard[];
      this.persistLocalGameState();
      this.notifyRound();
      this.notifyCards();
    } catch {
      // Keep the last locally persisted state while the backend reconnects.
    }
  }

  private saveUser() {
    try {
      localStorage.setItem('bingoupix_user_v2', JSON.stringify(this.user));
    } catch {
      // ignore
    }
    this.persistLocalGameState();
    this.notifyUser();
  }

  private initRound(id: number): BingoRound {
    return {
      id,
      status: 'waiting',
      roundStartTime: Date.now(),
      waitingSecondsRemaining: 60, // 1 minute interval between rounds
      ballDrawIntervalRemaining: 10,
      drawnNumbers: [],
      currentNumber: null,
      totalCards: 0,
      potTotal: 0,
      prizePot: 0,
      winner: null,
      historyRounds: [],
    };
  }

  private initChat() {
    this.chatMessages = [
      {
        id: 'msg-init-1',
        senderId: 'system',
        senderName: 'Sistema BingouPix',
        senderAvatar: '🎱',
        text: 'Bem-vindo ao BingouPix! Cada PC ou celular conectado conta como 1 jogador. A partida inicia com no mínimo 2 jogadores.',
        isSystem: true,
        systemType: 'round',
        timestamp: Date.now() - 10000,
      },
    ];
  }

  // Cross-device and Cross-tab synchronization
  private initMultiplayerSync() {
    multiplayerSync.onMessage((msg: SyncMessage) => {
      if (msg.type === 'CHAT') {
        if (msg.payload && !this.chatMessages.some((m) => m.id === msg.payload.id)) {
          this.chatMessages.push(msg.payload);
          if (this.chatMessages.length > 80) this.chatMessages.shift();
          this.notifyChat();
        }
      }
    });
  }

  // Count distinct real players (PCs or mobile phones) who have bought at least 1 card in the current round
  public getRealPlayersCount(): number {
    const playersSet = new Set<string>();
    for (const card of this.activeCards) {
      playersSet.add(card.userId);
    }
    return playersSet.size;
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
      id: `card-${this.round.id}-${userId}-${Math.random().toString(36).substring(2, 6)}`,
      roundId: this.round.id,
      userId,
      userName,
      isUser,
      numbers: cardNumbers,
      marked,
      hasWon: false,
    };
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

  // Main 1-second engine loop
  private startEngine() {
    if (this.timer) clearInterval(this.timer);

    this.timer = window.setInterval(async () => {
      if (this.round.status === 'waiting') {
        const playersCount = this.getRealPlayersCount();

        // O tempo para a próxima partida só começa a correr com no mínimo 2 jogadores com cartela
        if (playersCount >= 2) {
          if (this.round.waitingSecondsRemaining > 0) {
            this.round.waitingSecondsRemaining--;
          }

          if (this.round.waitingSecondsRemaining <= 0) {
            // Start round
            this.round.status = 'in_progress';
            this.round.ballDrawIntervalRemaining = 10;
            this.round.drawnNumbers = [];
            this.round.currentNumber = null;
            this.round.winner = null;

            this.addChatMessageLocal({
              senderId: 'system',
              senderName: 'Sistema BingouPix',
              senderAvatar: '🎲',
              text: `Rodada #${this.round.id} INICIADA com ${playersCount} jogadores participantes e ${this.activeCards.length} cartelas em jogo!`,
              isSystem: true,
              systemType: 'round',
            });
          }
        } else {
          // Mantém em 60s pausado enquanto houver menos de 2 jogadores
          this.round.waitingSecondsRemaining = 60;
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
          this.round.ballDrawIntervalRemaining = 10;

          // Broadcast ball draw to all other devices/tabs
          multiplayerSync.broadcast('BALL', { roundId: this.round.id, number: drawn });

          this.addChatMessageLocal({
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
              const winnerPixKey: PixKey = card.isUser
                ? (this.user.pixKey && this.user.pixKey.type === 'email' && this.user.pixKey.key?.includes('@')
                    ? this.user.pixKey
                    : { type: 'email', key: '', name: card.userName })
                : { type: 'email', key: `${card.userName.toLowerCase().replace(/[^a-z0-9]/g, '')}@mercadopago.com`, name: card.userName };

              const winnerObj: WinnerInfo = {
                userId: card.userId,
                userName: card.userName,
                isUser: card.isUser,
                cardId: card.id,
                patternType: win.type!,
                patternName: win.name || 'Linha Premiada',
                prizeAmount,
                totalPot: this.round.potTotal,
                pixKey: winnerPixKey,
                mercadoPagoPaymentId: 'PROCESSANDO...',
                mercadoPagoStatus: 'in_process',
                timestamp: Date.now(),
              };

              this.round.winner = winnerObj;
              this.round.status = 'finished';
              this.round.waitingSecondsRemaining = 12;

              // Broadcast winner to other devices
              multiplayerSync.broadcast('WINNER', { winner: winnerObj });

              if (!winnerPixKey.key || !winnerPixKey.key.includes('@')) {
                winnerObj.mercadoPagoPaymentId = '';
                winnerObj.mercadoPagoStatus = 'failed';
                this.notifyRound();

                this.addChatMessageLocal({
                  senderId: 'system',
                  senderName: 'Mercado Pago Pix',
                  senderAvatar: '⚠️',
                  text: `Atenção ${card.userName}: Cadastre sua chave Pix (E-mail Mercado Pago) para liberar o repasse de R$ ${prizeAmount.toFixed(2)}.`,
                  isSystem: true,
                  systemType: 'pix',
                });
              } else {
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

                    // If in_process, check again after 4 seconds to confirm if it moved to approved
                    if (payout.status === 'in_process' && payout.paymentId) {
                      const checkId = payout.paymentId;
                      setTimeout(async () => {
                        const check = await mercadoPagoService.checkPayoutStatus(checkId);
                        if (check && check.status !== 'in_process' && this.round.winner) {
                          this.round.winner.mercadoPagoStatus = check.status;
                          this.notifyRound();
                        }
                      }, 4000);
                    }

                    this.addChatMessageLocal({
                      senderId: 'system',
                      senderName: 'Mercado Pago Pix',
                      senderAvatar: '💸',
                      text: payout.status === 'failed'
                        ? `Prêmio de R$ ${prizeAmount.toFixed(2)}: ${payout.error || 'Mercado Pago não confirmou a transferência. Verifique seu e-mail cadastrado.'}`
                        : payout.status === 'in_process'
                        ? `Prêmio de R$ ${prizeAmount.toFixed(2)} em processamento no Mercado Pago (aguardando liberação via Pix para ${winnerObj.pixKey.key}).`
                        : `Prêmio de R$ ${prizeAmount.toFixed(2)} transferido com sucesso via Pix pelo Mercado Pago para ${winnerObj.userName}!`,
                      isSystem: true,
                      systemType: 'pix',
                    });
                  });
              }

              this.addChatMessageLocal({
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

          this.addChatMessageLocal({
            senderId: 'system',
            senderName: 'Sistema BingouPix',
            senderAvatar: '⏳',
            text: `Rodada #${nextId} aberta! A contagem regressiva inicia com no mínimo 2 jogadores com cartela.`,
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
  public async buyCards(quantity: number): Promise<{ success: boolean; error?: string }> {
    const cost = quantity * 1.0;
    if (this.user.balance < cost) {
      return { success: false, error: 'Saldo insuficiente. Recarregue via Pix.' };
    }

    try {
      const response = await fetch(this.apiUrl('/api/game/buy-cards'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity, userId: this.user.id, userName: this.user.name }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return { success: false, error: data.error || 'Não foi possível comprar a cartela.' };
      this.user.balance = Number(data.newBalance) || 0;
      this.activeCards = Array.isArray(data.boughtCards)
        ? [...this.activeCards, ...data.boughtCards]
        : this.activeCards;
      this.saveUser();
      this.notifyCards();
      void this.syncBackendState();
    } catch {
      return { success: false, error: 'Servidor indisponível. Tente novamente.' };
    }

    this.addChatMessageLocal({
      senderId: this.user.id,
      senderName: this.user.name,
      senderAvatar: this.user.name.includes('Celular') ? '📱' : '💻',
      text: `Comprou ${quantity} cartela(s) para a Rodada #${this.round.id}!`,
    });

    return { success: true };
  }

  public async registerPixKey(pixKey: PixKey) {
    this.user.pixKey = {
      type: 'email',
      key: pixKey.key.trim().toLowerCase(),
      name: pixKey.name.trim(),
    };
    this.saveUser();
    void fetch(this.apiUrl('/api/user/pix-key'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...this.user.pixKey, userId: this.user.id, userName: this.user.name }),
    }).catch(() => {
      // Keep the local value until the backend is reachable.
    });

    // If current round winner is user and waiting for payout, trigger immediately.
    if (this.round.winner && this.round.winner.isUser && this.round.winner.mercadoPagoStatus !== 'approved') {
      void mercadoPagoService.executePixPrizePayout(this.user.name, this.user.pixKey, this.round.winner.prizeAmount, this.round.id);
    }
  }

  public addDeposit(amount: number) {
    this.user.balance = Number((this.user.balance + amount).toFixed(2));
    this.saveUser();

    this.addChatMessageLocal({
      senderId: 'system',
      senderName: 'Mercado Pago Pix',
      senderAvatar: '💳',
      text: `Depósito Pix de R$ ${amount.toFixed(2)} aprovado no Mercado Pago! Saldo atualizado.`,
      isSystem: true,
      systemType: 'pix',
    });
  }

  public addChatMessage(msg: Omit<ChatMessage, 'id' | 'timestamp'>) {
    const newMsg = this.addChatMessageLocal(msg);
    multiplayerSync.broadcast('CHAT', newMsg);
    return newMsg;
  }

  private addChatMessageLocal(msg: Omit<ChatMessage, 'id' | 'timestamp'>) {
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

  public getAllActiveCards(): BingoCard[] {
    return [...this.activeCards];
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
