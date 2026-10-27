import { PixPaymentInfo } from '../types/bingo.ts';
import { apiFetch } from './apiSession.ts';

export interface MercadoPagoCredentials {
  publicKey: string;
}

/**
 * Cliente do backend Mercado Pago.
 * O Access Token nunca deve chegar ao navegador, ao localStorage ou ao bundle.
 */
class MercadoPagoWebService {
  public getMpInstance(): null {
    return null;
  }

  public async createPixDeposit(amount: number): Promise<PixPaymentInfo> {
    const response = await apiFetch('/api/wallet/pix/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
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
  ): Promise<{ status: 'approved' | 'pending' | 'rejected'; balance?: number }> {
    if (!paymentId) return { status: 'pending' };

    const response = await apiFetch(`/api/wallet/pix/status/${encodeURIComponent(paymentId)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { status: 'pending' };
    return data;
  }

  public async checkPayoutStatus(
    paymentId: string,
  ): Promise<{ status: 'approved' | 'in_process' | 'failed' }> {
    if (!paymentId || paymentId === 'PROCESSANDO...' || paymentId.startsWith('PROCESSANDO')) {
      return { status: 'in_process' };
    }
    try {
      const response = await apiFetch(`/api/wallet/pix/payout/status/${encodeURIComponent(paymentId)}`);
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
