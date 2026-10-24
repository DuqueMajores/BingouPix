import React from 'react';
import { Timer, Zap, Trophy, ShoppingBag, ArrowRight, Sparkles } from 'lucide-react';
import { RoundStatus } from '../types/bingo.ts';

interface RoundStatusBannerProps {
  roundId: number;
  status: RoundStatus;
  waitingSecondsRemaining: number;
  ballDrawIntervalRemaining: number;
  totalCards: number;
  prizePot: number;
  userCardsCount: number;
  realPlayersCount: number;
  onOpenBuyCards: () => void;
}

export const RoundStatusBanner: React.FC<RoundStatusBannerProps> = ({
  roundId,
  status,
  waitingSecondsRemaining,
  ballDrawIntervalRemaining,
  totalCards,
  prizePot,
  userCardsCount,
  realPlayersCount,
  onOpenBuyCards,
}) => {
  // 60-second progress calculation
  const waitingProgress = Math.max(0, Math.min(100, (waitingSecondsRemaining / 60) * 100));
  // 10-second ball progress calculation
  const ballProgress = Math.max(0, Math.min(100, (ballDrawIntervalRemaining / 10) * 100));

  const formatMinutesSeconds = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 p-4 sm:p-5 shadow-xl">
      {/* Background ambient lighting */}
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Left: Round Status & Timer */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400">
              Rodada #{roundId}
            </span>

            {status === 'waiting' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Timer className="w-3 h-3 animate-spin text-amber-400" />
                Intervalo (1 min)
              </span>
            )}

            {status === 'in_progress' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 animate-pulse">
                <Zap className="w-3 h-3 text-emerald-400" />
                Sorteio Ao Vivo
              </span>
            )}

            {status === 'finished' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                <Trophy className="w-3 h-3 text-purple-400" />
                Prêmio Sendo Pago!
              </span>
            )}

            {status === 'waiting' && (
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                  realPlayersCount >= 2
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}
              >
                {realPlayersCount >= 2
                  ? `✓ ${realPlayersCount} jogadores prontos para iniciar`
                  : `Aguardando 2 jogadores (${realPlayersCount}/2)`}
              </span>
            )}
          </div>

          {/* Heading description based on status */}
          {status === 'waiting' && (
            <div>
              <div className="flex items-baseline gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white font-['Outfit']">
                  {realPlayersCount >= 2 ? (
                    <>
                      Próxima partida em{' '}
                      <span className="text-amber-400 tabular-nums">
                        {formatMinutesSeconds(waitingSecondsRemaining)}
                      </span>
                    </>
                  ) : (
                    <>
                      Próxima partida:{' '}
                      <span className="text-amber-400">
                        Aguardando 2 jogadores
                      </span>
                    </>
                  )}
                </h2>
              </div>
              <div className="mt-0.5">
                <p className="text-xs sm:text-sm text-slate-400">
                  A partida só inicia com no mínimo 2 jogadores com cartela.
                </p>
              </div>

              {/* Progress bar for 60s - runs only when at least 2 players */}
              <div className="w-full bg-slate-800/80 rounded-full h-1.5 mt-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: realPlayersCount >= 2 ? `${100 - waitingProgress}%` : '0%' }}
                />
              </div>
            </div>
          )}

          {status === 'in_progress' && (
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white font-['Outfit']">
                  Sorteando Números
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Próxima bola em{' '}
                <span className="text-emerald-400 font-bold tabular-nums">
                  {ballDrawIntervalRemaining}s
                </span>
                .
              </p>

              {/* Progress bar for 10s */}
              <div className="w-full bg-slate-800/80 rounded-full h-2 mt-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 h-full transition-all duration-1000 ease-linear rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                  style={{ width: `${100 - ballProgress}%` }}
                />
              </div>
            </div>
          )}

          {status === 'finished' && (
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-purple-300 font-['Outfit'] flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-amber-400" />
                Temos um Ganhador!
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                Transferência efetuada via Pix Mercado Pago ao vencedor.
              </p>
            </div>
          )}
        </div>

        {/* Right: Prize Pot */}
        <div className="flex flex-row md:flex-col items-center md:items-end justify-between border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-6 gap-3">
          <div className="text-left md:text-right">
            <div className="flex items-center md:justify-end gap-1 text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
              <Trophy className="w-3.5 h-3.5" />
              <span>PRÊMIO</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-200 to-emerald-400 font-['Outfit'] tabular-nums drop-shadow-sm">
              R$ {prizePot.toFixed(2)}
            </div>
          </div>

          {/* User Participation / Buy Button */}
          <div className="flex items-center gap-2">
            {userCardsCount > 0 ? (
              <div className="flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-emerald-300">
                  {userCardsCount} {userCardsCount === 1 ? 'cartela ativa' : 'cartelas ativas'}
                </span>
                <button
                  onClick={onOpenBuyCards}
                  disabled={status === 'in_progress'}
                  className={`text-[11px] font-bold underline cursor-pointer ml-1 ${
                    status === 'in_progress' ? 'opacity-40 cursor-not-allowed' : 'text-emerald-400 hover:text-emerald-300'
                  }`}
                >
                  + Mais
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenBuyCards}
                disabled={status === 'in_progress'}
                className={`flex items-center gap-2 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-black text-sm px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer ${
                  status === 'in_progress' ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                <ShoppingBag className="w-4 h-4 stroke-[2.5]" />
                <span>Comprar (R$ 1,00)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
