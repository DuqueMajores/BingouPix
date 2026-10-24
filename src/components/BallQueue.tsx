import React, { useState } from 'react';
import { LayoutGrid, Hash } from 'lucide-react';

interface BallQueueProps {
  currentNumber: number | null;
  drawnNumbers: number[];
  roundStatus: string;
}

// 3D Spherical Radial Gradients for round bingo balls
export function getBallColor(num: number): {
  radialStyle: string;
  borderColor: string;
  textColor: string;
  glow: string;
  letter: string;
} {
  if (num <= 12) {
    return {
      radialStyle: 'radial-gradient(circle at 35% 30%, #fb7185 0%, #f43f5e 40%, #be123c 85%, #881337 100%)',
      borderColor: 'border-rose-400/80',
      textColor: 'text-white font-black',
      glow: 'shadow-[0_0_24px_rgba(244,63,94,0.65)]',
      letter: 'B',
    };
  } else if (num <= 24) {
    return {
      radialStyle: 'radial-gradient(circle at 35% 30%, #fef08a 0%, #f59e0b 45%, #d97706 85%, #78350f 100%)',
      borderColor: 'border-amber-300',
      textColor: 'text-slate-950 font-black',
      glow: 'shadow-[0_0_24px_rgba(245,158,11,0.65)]',
      letter: 'I',
    };
  } else if (num <= 36) {
    return {
      radialStyle: 'radial-gradient(circle at 35% 30%, #6ee7b7 0%, #10b981 45%, #047857 85%, #064e3b 100%)',
      borderColor: 'border-emerald-300',
      textColor: 'text-slate-950 font-black',
      glow: 'shadow-[0_0_24px_rgba(16,185,129,0.65)]',
      letter: 'N',
    };
  } else if (num <= 48) {
    return {
      radialStyle: 'radial-gradient(circle at 35% 30%, #67e8f9 0%, #06b6d4 45%, #0369a1 85%, #0c4a6e 100%)',
      borderColor: 'border-cyan-300',
      textColor: 'text-white font-black',
      glow: 'shadow-[0_0_24px_rgba(6,182,212,0.65)]',
      letter: 'G',
    };
  } else {
    return {
      radialStyle: 'radial-gradient(circle at 35% 30%, #f0abfc 0%, #a855f7 45%, #7e22ce 85%, #581c87 100%)',
      borderColor: 'border-purple-300',
      textColor: 'text-white font-black',
      glow: 'shadow-[0_0_24px_rgba(168,85,247,0.65)]',
      letter: 'O',
    };
  }
}

export const BallQueue: React.FC<BallQueueProps> = ({
  currentNumber,
  drawnNumbers,
  roundStatus,
}) => {
  const [showFullBoard, setShowFullBoard] = useState(false);

  // Reversed queue for display (most recent first)
  const recentDrawn = [...drawnNumbers].reverse();

  return (
    <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-3 sm:p-4 shadow-lg backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300">
            Fila de Bolas Sorteadas
          </h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
            {drawnNumbers.length} / 60
          </span>
        </div>

        <button
          onClick={() => setShowFullBoard(!showFullBoard)}
          className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors cursor-pointer"
        >
          <LayoutGrid className="w-3.5 h-3.5 text-cyan-400" />
          <span>{showFullBoard ? 'Ocultar Tabela de Bolas' : 'Ver Tabela Completa de Bolas'}</span>
        </button>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
        {/* Large Spherical Latest Ball */}
        <div className="flex-shrink-0 flex flex-col items-center">
          {currentNumber !== null ? (
            <div className="relative group">
              {/* Outer pulsing ring */}
              <div className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 opacity-60 blur-md animate-pulse" />

              {/* Spherical ball with circular radial highlight */}
              <div
                style={{ background: getBallColor(currentNumber).radialStyle }}
                className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full ${
                  getBallColor(currentNumber).glow
                } border-2 ${
                  getBallColor(currentNumber).borderColor
                } flex flex-col items-center justify-center shadow-2xl transition-transform transform scale-100 hover:scale-105 overflow-hidden`}
              >
                {/* Circular specular reflection for round look */}
                <div className="absolute top-1.5 left-2.5 w-3.5 h-3.5 rounded-full bg-white/60 blur-[0.6px] pointer-events-none" />
                <div className="absolute top-1 left-2 w-5 h-5 rounded-full bg-white/25 pointer-events-none" />

                <span className="text-[10px] uppercase font-black tracking-widest text-white/90 font-['Outfit'] -mb-0.5 drop-shadow">
                  {getBallColor(currentNumber).letter}
                </span>
                <span
                  className={`text-xl sm:text-2xl font-black font-['Outfit'] ${
                    getBallColor(currentNumber).textColor
                  } tabular-nums leading-none drop-shadow-md`}
                >
                  {currentNumber}
                </span>
              </div>
              <span className="block text-center text-[10px] font-bold text-amber-400 uppercase tracking-wider mt-1">
                Última
              </span>
            </div>
          ) : (
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-800/60 border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500">
              <Hash className="w-5 h-5 opacity-40 mb-0.5" />
              <span className="text-[9px] font-semibold">Aguarde</span>
            </div>
          )}
        </div>

        {/* Horizontal scroll of remaining drawn balls */}
        <div className="flex-1 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {drawnNumbers.length > 0 ? (
            <div className="flex items-center gap-2 min-w-max pr-2">
              {recentDrawn.slice(0, 30).map((num, idx) => {
                const color = getBallColor(num);
                const isLatest = idx === 0;
                return (
                  <div
                    key={`${num}-${idx}`}
                    style={{ background: color.radialStyle }}
                    className={`relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border ${
                      color.borderColor
                    } shadow-md transition-all overflow-hidden ${
                      isLatest ? 'ring-2 ring-white/90 scale-105' : 'opacity-90'
                    }`}
                  >
                    {/* Circular highlight */}
                    <div className="absolute top-1 left-1.5 w-2 h-2 rounded-full bg-white/50 blur-[0.4px] pointer-events-none" />
                    <span
                      className={`text-xs sm:text-sm font-black font-['Outfit'] ${color.textColor} tabular-nums drop-shadow-sm`}
                    >
                      {num}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-14 flex items-center text-xs text-slate-500 italic">
              {roundStatus === 'waiting'
                ? 'Os números sorteados aparecerão enfileirados aqui a cada 10 segundos.'
                : 'Iniciando o sorteio das bolas...'}
            </div>
          )}
        </div>
      </div>

      {/* Expandable 60-Ball Full Matrix Board */}
      {showFullBoard && (
        <div className="mt-4 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Tabela Completa de Bolas</span>
            <span className="text-emerald-400 font-semibold">
              Marcadas: {drawnNumbers.length} / 60
            </span>
          </div>

          <div className="grid grid-cols-10 sm:grid-cols-12 md:grid-cols-15 gap-1 sm:gap-1.5">
            {Array.from({ length: 60 }, (_, i) => i + 1).map((n) => {
              const isDrawn = drawnNumbers.includes(n);
              const isCurrent = currentNumber === n;
              const color = getBallColor(n);

              return (
                <div
                  key={n}
                  style={isCurrent ? { background: color.radialStyle } : undefined}
                  className={`flex items-center justify-center h-7 text-xs font-bold rounded-full transition-all ${
                    isCurrent
                      ? `text-white ring-2 ring-white scale-110 shadow-lg z-10 font-black`
                      : isDrawn
                      ? 'bg-slate-700 text-emerald-300 border border-emerald-500/40 line-through opacity-80'
                      : 'bg-slate-950/60 text-slate-400 border border-slate-800'
                  }`}
                >
                  {n}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
