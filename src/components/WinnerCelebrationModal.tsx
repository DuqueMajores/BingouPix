import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, CheckCircle2, X, Sparkles, ShieldCheck, Clock, AlertCircle, Mail, ArrowRight } from 'lucide-react';
import { WinnerInfo } from '../types/bingo.ts';
import { soundManager } from '../utils/audio.ts';
import { mercadoPagoService } from '../services/mercadoPagoService.ts';

interface WinnerCelebrationModalProps {
  winner: WinnerInfo | null;
  onClose: () => void;
  waitingSecondsRemaining: number;
  onOpenPixKeyModal?: () => void;
}

export const WinnerCelebrationModal: React.FC<WinnerCelebrationModalProps> = ({
  winner,
  onClose,
  waitingSecondsRemaining,
  onOpenPixKeyModal,
}) => {
  const [currentStatus, setCurrentStatus] = useState<'approved' | 'in_process' | 'failed'>(
    winner?.mercadoPagoStatus || 'in_process'
  );

  // Sync state if winner prop changes
  useEffect(() => {
    if (winner) {
      setCurrentStatus(winner.mercadoPagoStatus || 'in_process');
    }
  }, [winner]);

  // Confetti and fanfare
  useEffect(() => {
    if (!winner) return;

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#059669', '#d97706', '#0284c7', '#e11d48', '#f8fafc'],
      });

      const timer = setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#d97706', '#059669', '#f59e0b'],
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#0284c7', '#059669', '#38bdf8'],
        });
      }, 350);

      soundManager.playBingoFanfare();

      return () => clearTimeout(timer);
    } catch {
      // ignore
    }
  }, [winner]);

  // Poll payout status while in_process
  useEffect(() => {
    if (!winner || currentStatus !== 'in_process' || !winner.mercadoPagoPaymentId) return;
    if (winner.mercadoPagoPaymentId.startsWith('PROCESSANDO')) return;

    const interval = setInterval(async () => {
      try {
        const check = await mercadoPagoService.checkPayoutStatus(winner.mercadoPagoPaymentId);
        if (check && check.status !== 'in_process') {
          setCurrentStatus(check.status);
          winner.mercadoPagoStatus = check.status;
        }
      } catch {
        // ignore
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [winner, currentStatus]);

  if (!winner) return null;

  const isUser = winner.isUser;
  const isEmailMissing = !winner.pixKey?.key || !winner.pixKey.key.includes('@');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl bg-white border border-amber-300 p-5 sm:p-7 shadow-2xl text-slate-800 text-center overflow-hidden max-h-[94vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Big Trophy icon */}
        <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-200 flex items-center justify-center shadow-lg shadow-amber-400/25 text-amber-950 mb-3.5 transform hover:scale-105 transition-transform">
          <Trophy className="w-8 h-8 sm:w-10 sm:h-10 stroke-[2.5]" />
          <div className="absolute -top-1 -right-1">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 animate-spin" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1 mb-3">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
            {isUser ? '🎉 INCRÍVEL! VOCÊ FOI O PRIMEIRO!' : '🏆 BINGO! TEMOS UM VENCEDOR!'}
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-['Outfit']">
            {isUser ? 'Você Ganhou o Prêmio!' : `${winner.userName} Venceu!`}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Completou com sucesso a <strong className="text-emerald-700">{winner.patternName}</strong>
          </p>
        </div>

        {/* Prize Box */}
        <div className="my-3 py-3 px-4 sm:py-4 sm:px-5 rounded-2xl bg-gradient-to-r from-amber-50 via-emerald-50/60 to-amber-50 border border-amber-200">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            PRÊMIO TOTAL LIQUIDADO VIA PIX
          </span>
          <div className="text-3xl sm:text-4xl font-black text-emerald-700 font-['Outfit'] tabular-nums my-1">
            R$ {winner.prizeAmount.toFixed(2)}
          </div>
        </div>

        {/* 3-Step Lifecycle Progress Tracker for the Winner */}
        <div className="mb-4 text-left bg-slate-50 rounded-2xl border border-slate-200 p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Status do Repasse Mercado Pago Pix</span>
            </div>

            {/* Dynamic Status Badge */}
            {currentStatus === 'approved' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Pagamento Concluído
              </span>
            )}

            {currentStatus === 'in_process' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 border border-sky-300 animate-pulse">
                <Clock className="w-3.5 h-3.5 text-sky-600 animate-spin" />
                Em Processamento
              </span>
            )}

            {currentStatus === 'failed' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                Pendente de Ajuste
              </span>
            )}
          </div>

          {/* Stepper Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {/* Step 1: Chave Pix (E-mail) */}
            <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
              !isEmailMissing
                ? 'bg-white border-emerald-300 text-emerald-900 shadow-xs'
                : 'bg-white border-rose-300 text-rose-900 shadow-xs'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">1. Chave</span>
                {!isEmailMissing ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                )}
              </div>
              <div className="font-bold text-slate-800 text-[11px]">E-mail Pix</div>
              <span className="text-[10px] text-slate-500 truncate font-mono mt-0.5">
                {!isEmailMissing ? winner.pixKey.key : 'Não cadastrado'}
              </span>
            </div>

            {/* Step 2: Processamento Mercado Pago */}
            <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
              currentStatus === 'in_process'
                ? 'bg-white border-sky-400 text-sky-900 shadow-xs ring-1 ring-sky-300'
                : currentStatus === 'approved'
                ? 'bg-white border-emerald-300 text-emerald-900 shadow-xs'
                : 'bg-white border-slate-200 text-slate-700'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">2. Análise</span>
                {currentStatus === 'in_process' ? (
                  <Clock className="w-3.5 h-3.5 text-sky-600 animate-spin shrink-0" />
                ) : currentStatus === 'approved' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full bg-slate-100 text-[9px] flex items-center justify-center font-bold text-slate-500">2</span>
                )}
              </div>
              <div className="font-bold text-slate-800 text-[11px]">Processamento</div>
              <span className="text-[10px] text-slate-500 mt-0.5">
                {currentStatus === 'in_process'
                  ? 'Em análise no MP'
                  : currentStatus === 'approved'
                  ? 'Aprovado pelo MP'
                  : 'Aguardando envio'}
              </span>
            </div>

            {/* Step 3: Concluído */}
            <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
              currentStatus === 'approved'
                ? 'bg-white border-emerald-400 text-emerald-900 shadow-xs ring-1 ring-emerald-300'
                : 'bg-white border-slate-200 text-slate-700'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">3. Final</span>
                {currentStatus === 'approved' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full bg-slate-100 text-[9px] flex items-center justify-center font-bold text-slate-500">3</span>
                )}
              </div>
              <div className="font-bold text-slate-800 text-[11px]">Concluído</div>
              <span className="text-[10px] text-slate-500 mt-0.5">
                {currentStatus === 'approved'
                  ? 'Transferência Pix concluída'
                  : 'Crédito em conta'}
              </span>
            </div>
          </div>

          {/* Details / Receipt lines */}
          <div className="text-[11px] font-mono space-y-1.5 pt-2 border-t border-slate-200">
            <div className="flex justify-between text-slate-500">
              <span>Favorecido:</span>
              <span className="text-slate-800 font-sans font-semibold">
                {winner.pixKey.name || winner.userName}
              </span>
            </div>

            <div className="flex justify-between text-slate-500">
              <span>Chave Pix (E-mail MP):</span>
              <span className="text-emerald-700 font-bold truncate max-w-[200px]">
                {winner.pixKey.key || 'Pendente'}
              </span>
            </div>

            {winner.mercadoPagoPaymentId && (
              <div className="flex justify-between text-slate-500 text-[10px]">
                <span>ID Mercado Pago:</span>
                <span className="font-mono text-slate-700 truncate max-w-[200px]">
                  {winner.mercadoPagoPaymentId}
                </span>
              </div>
            )}
          </div>

          {/* Status Explanation Box */}
          {currentStatus === 'in_process' && (
            <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-sky-900 flex items-start gap-2">
              <Clock className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Em Processamento no Mercado Pago:</strong> A ordem foi gerada e está em processamento bancário (status <code className="text-sky-800 font-mono font-bold">in_process</code>). Assim que validada pelo Mercado Pago, o pagamento é concluído automaticamente na sua conta Pix.
              </p>
            </div>
          )}

          {currentStatus === 'approved' && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Pagamento Concluído!</strong> O repasse via Pix foi aprovado pelo Mercado Pago e creditado na conta vinculada ao e-mail {winner.pixKey.key}.
              </p>
            </div>
          )}

          {currentStatus === 'failed' && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Atenção:</strong> O Mercado Pago não concluiu o repasse automático. Certifique-se de que o e-mail informado é o mesmo e-mail cadastrado na sua conta ativa do Mercado Pago.
              </p>
            </div>
          )}
        </div>

        {/* If user is the winner and needs to fix/register email */}
        {isUser && (currentStatus === 'failed' || isEmailMissing) && onOpenPixKeyModal && (
          <button
            onClick={() => {
              onClose();
              onOpenPixKeyModal();
            }}
            className="w-full mb-3 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <Mail className="w-4 h-4" />
            <span>Cadastrar / Confirmar E-mail Mercado Pago</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {/* Countdown to next round */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mb-3.5">
          <span>Próxima rodada inicia em:</span>
          <span className="font-bold text-slate-800 tabular-nums">
            {waitingSecondsRemaining}s
          </span>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
        >
          Continuar para a Próxima Rodada
        </button>
      </div>
    </div>
  );
};
