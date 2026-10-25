import React, { useState, useEffect } from 'react';
import { X, Mail, Check, AlertCircle, User, Clock, CheckCircle2, Sparkles, ChevronRight } from 'lucide-react';
import { PixKey, WinnerInfo } from '../types/bingo.ts';

interface PixKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPixKey?: PixKey;
  onSavePixKey: (key: PixKey) => Promise<boolean>;
  currentWinner?: WinnerInfo | null;
}

export const PixKeyModal: React.FC<PixKeyModalProps> = ({
  isOpen,
  onClose,
  currentPixKey,
  onSavePixKey,
  currentWinner,
}) => {
  const [emailKey, setEmailKey] = useState(
    currentPixKey?.type === 'email' && currentPixKey?.key ? currentPixKey.key : ''
  );
  // Without automatic prefilling for the holder name: starts empty
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Keep email in sync if currentPixKey is provided; do not auto-fill name
  useEffect(() => {
    if (currentPixKey?.key && currentPixKey.type === 'email') {
      setEmailKey(currentPixKey.key);
    }
  }, [currentPixKey]);

  if (!isOpen) return null;

  const isUserWinner = Boolean(currentWinner?.isUser);
  const payoutStatus = currentWinner?.mercadoPagoStatus; // 'approved' | 'in_process' | 'failed'

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanEmail = emailKey.trim().toLowerCase();
    if (!cleanEmail || !validateEmail(cleanEmail)) {
      setErrorMsg('Informe um e-mail válido cadastrado na sua conta Mercado Pago.');
      return;
    }

    if (!name.trim()) {
      setErrorMsg('Informe o nome completo do titular da conta Mercado Pago.');
      return;
    }

    setLoading(true);
    const ok = await onSavePixKey({
      type: 'email',
      key: cleanEmail,
      name: name.trim(),
    });
    setLoading(false);

    if (ok) {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        if (!isUserWinner) {
          onClose();
        }
      }, 1400);
    } else {
      setErrorMsg('Falha ao registrar a chave Pix. Tente novamente.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-xl text-slate-800 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 text-white shrink-0">
            <Mail className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-['Outfit'] text-slate-900">
              Chave Pix para Prêmios
            </h3>
            <p className="text-xs text-slate-500">
              E-mail da sua conta Mercado Pago para recebimento automático do prêmio.
            </p>
          </div>
        </div>

        {/* Live Winner Payout Alert (If user is winner) */}
        {isUserWinner && currentWinner && (
          <div className={`mb-4 p-3.5 rounded-xl border text-xs space-y-2 ${
            payoutStatus === 'approved'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : payoutStatus === 'in_process'
              ? 'bg-sky-50 border-sky-200 text-sky-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Você Ganhou o Prêmio de R$ {currentWinner.prizeAmount.toFixed(2)}!
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                payoutStatus === 'approved'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : payoutStatus === 'in_process'
                  ? 'bg-sky-100 text-sky-800 border border-sky-300 animate-pulse'
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}>
                {payoutStatus === 'approved' ? '✓ Concluído' : payoutStatus === 'in_process' ? '⏳ Em Processamento' : 'Pendente'}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-700">
              {payoutStatus === 'approved'
                ? `O pagamento foi liberado pelo Mercado Pago e transferido para a sua conta Pix vinculada ao e-mail ${currentWinner.pixKey.key}.`
                : payoutStatus === 'in_process'
                ? `A ordem foi enviada ao Mercado Pago (ID: ${currentWinner.mercadoPagoPaymentId || 'em processamento'}). O pagamento está em análise e será concluído via Pix.`
                : 'Para receber o prêmio agora, informe abaixo o seu e-mail cadastrado no Mercado Pago e clique em Salvar.'}
            </p>
          </div>
        )}

        {/* 3-Step Lifecycle Visualizer - Refined & Balanced Layout */}
        <div className="mb-5 bg-slate-50/90 rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span className="font-bold text-slate-800 tracking-tight">
              Etapas do Pagamento do Vencedor
            </span>
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
              Mercado Pago Pix
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Step 1: Chave E-mail */}
            <div className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
              currentPixKey?.key && currentPixKey.type === 'email'
                ? 'bg-white border-emerald-300 text-emerald-900 shadow-xs'
                : 'bg-white border-slate-200 text-slate-700'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Etapa 1
                  </span>
                  {currentPixKey?.key && currentPixKey.type === 'email' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-500 text-[10px] flex items-center justify-center font-bold">
                      1
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold text-slate-800">
                  Chave E-mail
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                {currentPixKey?.key && currentPixKey.type === 'email'
                  ? 'E-mail cadastrado'
                  : 'Cadastre seu e-mail'}
              </p>
            </div>

            {/* Step 2: Processamento */}
            <div className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
              payoutStatus === 'in_process'
                ? 'bg-white border-sky-400 text-sky-900 shadow-xs ring-1 ring-sky-300'
                : payoutStatus === 'approved'
                ? 'bg-white border-emerald-300 text-emerald-900 shadow-xs'
                : 'bg-white border-slate-200 text-slate-700'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Etapa 2
                  </span>
                  {payoutStatus === 'in_process' ? (
                    <Clock className="w-4 h-4 text-sky-600 animate-spin" />
                  ) : payoutStatus === 'approved' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-500 text-[10px] flex items-center justify-center font-bold">
                      2
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold text-slate-800">
                  Processamento
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                {payoutStatus === 'in_process'
                  ? 'Em análise no MP (in_process)'
                  : payoutStatus === 'approved'
                  ? 'Aprovado pelo MP'
                  : 'Validação pelo banco'}
              </p>
            </div>

            {/* Step 3: Concluído */}
            <div className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
              payoutStatus === 'approved'
                ? 'bg-white border-emerald-400 text-emerald-900 shadow-xs ring-1 ring-emerald-300'
                : 'bg-white border-slate-200 text-slate-700'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Etapa 3
                  </span>
                  {payoutStatus === 'approved' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-500 text-[10px] flex items-center justify-center font-bold">
                      3
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold text-slate-800">
                  Concluído
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                {payoutStatus === 'approved'
                  ? 'Prêmio liquidado via Pix'
                  : 'Transferência Pix final'}
              </p>
            </div>
          </div>
        </div>

        {/* Pix Email Registration Form */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* Email Key Input */}
          <div>
            <label className="text-xs font-bold text-slate-700 mb-1.5 block">
              E-mail da sua Conta Mercado Pago:
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={emailKey}
                onChange={(e) => setEmailKey(e.target.value)}
                placeholder="seu-email@mercadopago.com"
                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none font-mono"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Deve ser o mesmo e-mail utilizado no login do seu Mercado Pago.
            </p>
          </div>

          {/* Beneficiary Full Name - Starts EMPTY without auto-fill */}
          <div>
            <label className="text-xs font-bold text-slate-700 mb-1.5 block">
              Nome Completo do Titular:
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Digite o nome completo do titular"
                autoComplete="off"
                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            </div>
          </div>

          {errorMsg && (
            <div className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {success && (
            <div className="text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 flex items-center justify-center gap-1.5 font-bold">
              <Check className="w-4 h-4 text-emerald-600" /> Chave Pix (E-mail Mercado Pago) salva com sucesso!
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Salvando...</span>
              ) : isUserWinner && payoutStatus !== 'approved' ? (
                <span>Salvar e Solicitar Repasse Pix</span>
              ) : (
                <span>Salvar Chave Pix (E-mail)</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
