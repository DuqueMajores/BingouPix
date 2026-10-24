import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, CheckCircle2, X, Sparkles, ShieldCheck } from 'lucide-react';
import { WinnerInfo } from '../types/bingo.ts';
import { soundManager } from '../utils/audio.ts';

interface WinnerCelebrationModalProps {
  winner: WinnerInfo | null;
  onClose: () => void;
  waitingSecondsRemaining: number;
}

export const WinnerCelebrationModal: React.FC<WinnerCelebrationModalProps> = ({
  winner,
  onClose,
  waitingSecondsRemaining,
}) => {
  useEffect(() => {
    if (!winner) return;

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#f59e0b', '#06b6d4', '#e11d48', '#ffffff'],
      });

      const timer = setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#f59e0b', '#10b981', '#fbbf24'],
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#06b6d4', '#10b981', '#38bdf8'],
        });
      }, 350);

      soundManager.playBingoFanfare();

      return () => clearTimeout(timer);
    } catch {
      // ignore
    }
  }, [winner]);

  if (!winner) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/50 p-6 sm:p-7 shadow-[0_0_50px_rgba(245,158,11,0.25)] text-slate-100 text-center overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Ambient glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Big Trophy icon */}
        <div className="relative mx-auto w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-200 flex items-center justify-center shadow-xl shadow-amber-500/30 text-slate-950 mb-4 transform hover:scale-105 transition-transform">
          <Trophy className="w-10 h-10 stroke-[2.5]" />
          <div className="absolute -top-1 -right-1">
            <Sparkles className="w-6 h-6 text-yellow-200 animate-spin" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1 mb-4">
          <span className="text-xs font-black uppercase tracking-widest text-amber-400">
            {winner.isUser ? '🎉 INCRÍVEL! VOCÊ FOI O PRIMEIRO!' : '🏆 BINGO! TEMOS UM VENCEDOR!'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">
            {winner.isUser ? 'Você Ganhou o Prêmio!' : `${winner.userName} Venceu!`}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            Completou com sucesso a <strong className="text-emerald-400">{winner.patternName}</strong>
          </p>
        </div>

        {/* Prize Box */}
        <div className="my-4 py-4 px-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-emerald-500/15 to-amber-500/15 border border-amber-500/40">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            PRÊMIO
          </span>
          <div className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-200 to-emerald-400 font-['Outfit'] tabular-nums my-1">
            R$ {winner.prizeAmount.toFixed(2)}
          </div>
        </div>

        {/* Pix Receipt Card */}
        <div className="text-left bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-5 text-xs space-y-2 font-mono">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 font-sans">
            <div className="flex items-center gap-1.5 font-bold text-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Comprovante Pix</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3" />
              Transferido
            </span>
          </div>

          <div className="flex justify-between text-slate-400">
            <span>Favorecido:</span>
            <span className="text-slate-200 font-sans font-semibold">
              {winner.pixKey.name || winner.userName}
            </span>
          </div>

          <div className="flex justify-between text-slate-400">
            <span>Chave Pix ({winner.pixKey.type.toUpperCase()}):</span>
            <span className="text-emerald-400 font-bold">
              {winner.pixKey.key}
            </span>
          </div>

          <div className="flex justify-between text-slate-400">
            <span>Valor Liquidado:</span>
            <span className="text-amber-400 font-bold">
              R$ {winner.prizeAmount.toFixed(2)}
            </span>
          </div>

          {winner.mercadoPagoPaymentId && (
            <div className="flex justify-between text-slate-500 text-[10px]">
              <span>ID Transação:</span>
              <span className="font-mono text-slate-300 truncate max-w-[200px]">
                {winner.mercadoPagoPaymentId}
              </span>
            </div>
          )}

          <div className="flex justify-between text-slate-500 text-[10px] pt-1 border-t border-slate-800/80">
            <span>Data / Horário:</span>
            <span>{new Date(winner.timestamp).toLocaleTimeString('pt-BR')}</span>
          </div>
        </div>

        {/* Countdown to next round */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mb-4">
          <span>Próxima rodada inicia em:</span>
          <span className="font-bold text-amber-400 tabular-nums">
            {waitingSecondsRemaining}s
          </span>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
        >
          Continuar para a Próxima Rodada
        </button>
      </div>
    </div>
  );
};
