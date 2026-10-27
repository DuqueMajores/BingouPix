import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowDownToLine, CheckCircle2, Clock3, Loader2, ShieldCheck, X } from 'lucide-react';
import { PixKey } from '../types/bingo.ts';
import { bingoWebService, WalletWithdrawal } from '../services/bingoWebService.ts';

interface PixWithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  pixKey?: PixKey;
  onWalletUpdated: () => void;
}

export const PixWithdrawModal: React.FC<PixWithdrawModalProps> = ({
  isOpen,
  onClose,
  balance,
  pixKey,
  onWalletUpdated,
}) => {
  const [amount, setAmount] = useState('');
  const [withdrawal, setWithdrawal] = useState<WalletWithdrawal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestIdRef = useRef('');

  useEffect(() => {
    if (!isOpen) return;
    setAmount(balance > 0 ? balance.toFixed(2) : '');
    setWithdrawal(null);
    setError('');
    requestIdRef.current = '';
    void bingoWebService.getActiveWithdrawal().then((active) => {
      if (active) setWithdrawal(active);
      onWalletUpdated();
    }).catch(() => { /* modal can still be used if history lookup is temporarily unavailable */ });
  }, [isOpen, onWalletUpdated]);

  useEffect(() => {
    if (!isOpen || !withdrawal || withdrawal.status !== 'in_process') return;
    const timer = window.setInterval(async () => {
      try {
        const latest = await bingoWebService.checkWithdrawalStatus(withdrawal.id);
        setWithdrawal(latest);
        onWalletUpdated();
      } catch {
        // Keep displaying the durable pending request; status can be checked again.
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [isOpen, withdrawal?.id, withdrawal?.status, onWalletUpdated]);

  if (!isOpen) return null;

  const hasPixKey = Boolean(pixKey?.type === 'email' && pixKey.key && pixKey.name);
  const amountValue = Number(amount.replace(',', '.'));
  const cents = Math.round(amountValue * 100);
  const canSubmit = hasPixKey && Number.isSafeInteger(cents) && cents >= 100 && cents <= Math.round(balance * 100) && !loading;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || withdrawal?.status === 'in_process') return;
    setLoading(true);
    setError('');
    if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();
    try {
      const result = await bingoWebService.requestWithdrawal(cents / 100, requestIdRef.current);
      setWithdrawal(result);
      onWalletUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível solicitar o saque. Tente novamente.');
      // Keep the same request ID on network errors so a retry cannot create a second withdrawal.
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = withdrawal?.status === 'approved'
    ? 'Saque aprovado'
    : withdrawal?.status === 'failed'
      ? 'Saque rejeitado — saldo devolvido'
      : 'Em processamento';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-2xl text-slate-800">
        <button
          onClick={onClose}
          aria-label="Fechar saque"
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5 pr-8">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
            <ArrowDownToLine className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-['Outfit'] text-slate-900">Sacar saldo via Pix</h2>
            <p className="text-xs text-slate-500">O Mercado Pago enviará para o e-mail Pix cadastrado.</p>
          </div>
        </div>

        {withdrawal ? (
          <div className={`rounded-xl border p-4 ${withdrawal.status === 'approved' ? 'bg-emerald-50 border-emerald-200' : withdrawal.status === 'failed' ? 'bg-rose-50 border-rose-200' : 'bg-sky-50 border-sky-200'}`}>
            <div className="flex items-center gap-2 font-bold text-sm">
              {withdrawal.status === 'approved' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : withdrawal.status === 'failed' ? <AlertCircle className="w-5 h-5 text-rose-600" /> : <Clock3 className="w-5 h-5 text-sky-600" />}
              <span>{statusLabel}</span>
            </div>
            <p className="mt-2 text-sm">R$ {(withdrawal.amountCents / 100).toFixed(2)} para <strong>{withdrawal.pixKey.key}</strong></p>
            {withdrawal.paymentId && withdrawal.paymentId !== 'PROCESSANDO...' && (
              <p className="mt-1 text-[11px] text-slate-600 break-all">ID Mercado Pago: {withdrawal.paymentId}</p>
            )}
            {withdrawal.error && withdrawal.status === 'failed' && <p className="mt-2 text-xs text-rose-700">{withdrawal.error}</p>}
            {withdrawal.status === 'in_process' && <p className="mt-2 text-xs text-sky-800">O saldo foi reservado. A confirmação é atualizada automaticamente; não solicite outro saque enquanto esta operação estiver pendente.</p>}
            {withdrawal.status === 'approved' && <p className="mt-2 text-xs text-emerald-800">O Mercado Pago confirmou a transferência. Saldo disponível: R$ {withdrawal.balance.toFixed(2)}.</p>}
            {withdrawal.status === 'failed' && <p className="mt-2 text-xs text-rose-800">O valor foi devolvido ao saldo da carteira.</p>}
            <button onClick={onClose} className="mt-4 w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-2.5 cursor-pointer">Fechar</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 mb-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500"><span>Saldo disponível</span><strong className="text-emerald-700">R$ {balance.toFixed(2)}</strong></div>
              <div className="flex justify-between gap-3 text-slate-500"><span>Destino</span><strong className="text-slate-800 text-right break-all">{hasPixKey ? pixKey?.key : 'Cadastre seu e-mail Pix'}</strong></div>
              {pixKey?.name && <div className="flex justify-between gap-3 text-slate-500"><span>Titular</span><strong className="text-slate-800 text-right">{pixKey.name}</strong></div>}
            </div>

            <label htmlFor="withdraw-amount" className="block text-xs font-bold text-slate-700 mb-1.5">Valor do saque (mínimo R$ 1,00)</label>
            <div className="relative mb-3">
              <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">R$</span>
              <input
                id="withdraw-amount"
                type="number"
                min="1.00"
                max={balance.toFixed(2)}
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(event) => { setAmount(event.target.value); requestIdRef.current = ''; }}
                className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                placeholder="0,00"
                required
              />
            </div>

            {!hasPixKey && <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Cadastre primeiro o e-mail Pix da sua conta Mercado Pago.</div>}
            {error && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</div>}

            <div className="flex items-start gap-2 rounded-xl bg-sky-50 border border-sky-100 p-3 mb-4 text-[11px] leading-relaxed text-sky-900">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-sky-600" />
              <p>O valor será reservado ao solicitar. Se o Mercado Pago rejeitar definitivamente, o saldo será devolvido; enquanto o resultado estiver pendente, a solicitação não será duplicada.</p>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={onClose} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm cursor-pointer">Cancelar</button>
              <button type="submit" disabled={!canSubmit} className="flex-[2] py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-sm cursor-pointer flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : 'Solicitar saque'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
