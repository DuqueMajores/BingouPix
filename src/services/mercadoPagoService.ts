import { PixKey, PixPaymentInfo } from '../types/bingo.ts';

export interface MercadoPagoCredentials {
  publicKey: string;
}

export interface PayoutResult {
  paymentId: string;
  status: 'approved' | 'in_process' | 'failed';
  timestamp: number;
  transactionHash: string;
  error?: string;
}

/**
 * Cliente do backend Mercado Pago.
 * O Access Token nunca deve chegar ao navegador, ao localStorage ou ao bundle.
 */
class MercadoPagoWebService {
  private readonly apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

  private apiUrl(path: string): string {
    if (!this.apiBaseUrl && typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
      throw new Error('Backend Render não configurado no build do frontend. Defina RENDER_BACKEND_URL no GitHub Actions e publique novamente.');
    }
    return `${this.apiBaseUrl}${path}`;
  }

  public getMpInstance(): null {
    return null;
  }

  public async createPixDeposit(
    amount: number,
    payerEmail?: string,
    payerName?: string,
  ): Promise<PixPaymentInfo> {
    const response = await fetch(this.apiUrl('/api/wallet/pix/deposit'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, payerEmail, payerName }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Não foi possível criar o pagamento Pix.');
    }
    return data as PixPaymentInfo;
  }

  public async checkPaymentStatus(
    paymentId: string,
    _isSimulated = false,
  ): Promise<{ status: 'approved' | 'pending' | 'rejected' }> {
    if (!paymentId) return { status: 'pending' };

    const response = await fetch(this.apiUrl(`/api/wallet/pix/status/${encodeURIComponent(paymentId)}`));
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { status: 'pending' };
    return data;
  }

  public async executePixPrizePayout(
    winnerName: string,
    pixKey: PixKey,
    prizeAmount: number,
    roundId: number,
  ): Promise<PayoutResult> {
    const response = await fetch(this.apiUrl('/api/wallet/pix/payout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winnerName, pixKey, prizeAmount, roundId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        paymentId: '',
        status: 'failed',
        timestamp: Date.now(),
        transactionHash: '',
        error: data.error || 'O Mercado Pago não confirmou o repasse.',
      };
    }
    return data as PayoutResult;
  }

  public async checkPayoutStatus(
    paymentId: string,
  ): Promise<{ status: 'approved' | 'in_process' | 'failed' }> {
    if (!paymentId || paymentId === 'PROCESSANDO...' || paymentId.startsWith('PROCESSANDO')) {
      return { status: 'in_process' };
    }
    try {
      const response = await fetch(this.apiUrl(`/api/wallet/pix/payout/status/${encodeURIComponent(paymentId)}`));
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return { status: 'in_process' };
      return data;
    } catch {
      return { status: 'in_process' };
    }
  }

  public getConfig(): MercadoPagoCredentials {
    return { publicKey: import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY || '' };
  }

  public saveConfig(_config: MercadoPagoCredentials): void {
    // Credenciais são configuradas somente no servidor via variáveis de ambiente.
  }
}

export const mercadoPagoService = new MercadoPagoWebService();
