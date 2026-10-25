export type PixKeyType = 'cpf' | 'phone' | 'email' | 'random';

export interface PixKey {
  type: PixKeyType;
  key: string;
  name: string;
}

export interface BingoCard {
  id: string;
  roundId: number;
  userId: string;
  userName: string;
  isUser: boolean;
  numbers: number[][]; // 5 rows x 5 cols
  marked: boolean[][];  // 5 rows x 5 cols
  hasWon: boolean;
  winningPattern?: {
    type: 'row' | 'column' | 'diagonal' | 'full';
    index?: number;
    cells: [number, number][];
  };
}

export type RoundStatus = 'waiting' | 'in_progress' | 'finished';

export interface WinnerInfo {
  userId: string;
  userName: string;
  isUser: boolean;
  cardId: string;
  patternType: 'row' | 'column' | 'diagonal' | 'full';
  patternName: string;
  prizeAmount: number;
  totalPot: number;
  pixKey: PixKey;
  mercadoPagoPaymentId: string;
  mercadoPagoStatus: 'approved' | 'in_process' | 'failed';
  timestamp: number;
}

export interface BingoRound {
  id: number;
  status: RoundStatus;
  roundStartTime: number;
  waitingSecondsRemaining: number; // 60s -> 0s
  ballDrawIntervalRemaining: number; // 10s -> 0s
  drawnNumbers: number[];
  currentNumber: number | null;
  totalCards: number;
  activePlayerCount?: number;
  potTotal: number; // Total collected (R$ 1 per card)
  prizePot: number; // 80% of potTotal
  winner: WinnerInfo | null;
  historyRounds: WinnerInfo[];
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  isSystem?: boolean;
  systemType?: 'ball' | 'round' | 'winner' | 'pix' | 'join';
  timestamp: number;
}

export interface PixPaymentInfo {
  id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  qrCode: string;
  qrCodeBase64: string;
  copyPaste: string;
  expiresAt: number;
  mercadoPagoId?: string;
  isSimulated?: boolean;
}
