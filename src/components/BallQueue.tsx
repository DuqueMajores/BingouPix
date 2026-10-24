import React, { useState } from 'react';
import { LayoutGrid, ChevronRight, Hash, Eye, Sparkles } from 'lucide-react';

interface BallQueueProps {
  currentNumber: number | null;
  drawnNumbers: number[];
  roundStatus: string;
}

// Color schemes matching column ranges 1-12, 13-24, 25-36, 37-48, 49-60
export function getBallColor(num: number): {
  bg: string;
  border: string;
  text: string;
  glow: string;
  letter: string;
} {
  if (num <= 12) {
    return {
      bg: 'from-rose-600 via-rose-500 to-red-400',
      border: 'border-rose-400',
      text: 'text-white',
      glow: 'shadow-[0_0_20px_rgba(244,63,94,0.6)]',
      letter: 'B',
    };
  } else if (num <= 24) {
    return {
      bg: 'from-amber-600 via-amber-500 to-yellow-300',
      border: 'border-amber-300',
      text: 'text-slate-950 font-black',
      glow: 'shadow-[0_0_20px_rgba(245,158,11,0.6)]',
      letter: 'I',
    };
  } else if (num <= 36) {
    return {
      bg: 'from-emerald-600 via-emerald-500 to-teal-300',
      border: 'border-emerald-300',
      text: 'text-slate-950 font-black',
      glow: 'shadow-[0_0_20px_rgba(16,185,129,0.6)]',
      letter: 'N',
    };
  } else if (num <= 48) {
    return {
      bg: 'from-sky-600 via-cyan-500 to-blue-400',
      border: 'border-cyan-300',
      text: 'text-white',
      glow: 'shadow-[0_0_20px_rgba(6,182,212,0.6)]',
      letter: 'G',
    };
  } else {
    return {
      bg: 'from-purple-600 via-fuchsia-500 to-pink-400',
      border: 'border-purple-300',
      text: 'text-white',
      glow: 'shadow-[0_0_20px_rgba(168,85,247,0.6)]',
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
            Fila de Bolas Sorteadas (1 a 60)
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
          <span>{showFullBoard ? 'Ocultar Globo 1-60' : 'Ver Todas as 60 Bolas'}</span>
        </button>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
        {/* Large Glowing Latest Ball */}
        <div className="flex-shrink-0 flex flex-col items-center">
          {currentNumber !== null ? (
            <div className="relative group">
              {/* Outer pulsing ring */}
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 opacity-70 blur-sm animate-pulse" />

              {/* Ball sphere */}
              <div
                className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br ${
                  getBallColor(currentNumber).bg
                } ${getBallColor(currentNumber).glow} border-2 ${
                  getBallColor(currentNumber).border
                } flex flex-col items-center justify-center shadow-2xl transition-transform transform scale-100 hover:scale-105`}
              >
                {/* 3D sphere highlight */}
                <div className="absolute top-1 left-2 w-4 h-2.5 rounded-full bg-white/40 blur-[1px] transform -rotate-45" />

                <span className="text-[10px] uppercase font-black tracking-widest text-white/80 font-['Outfit'] -mb-1">
                  {getBallColor(currentNumber).letter}
                </span>
                <span
                  className={`text-xl sm:text-2xl font-black font-['Outfit'] ${
                    getBallColor(currentNumber).text
                  } tabular-nums leading-none`}
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
                    className={`relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br ${
                      color.bg
                    } border ${color.border} shadow-md transition-all ${
                      isLatest ? 'ring-2 ring-white/60 scale-105' : 'opacity-85'
                    }`}
                  >
                    <span
                      className={`text-xs sm:text-sm font-black font-['Outfit'] ${color.text} tabular-nums`}
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
                : 'Iniciando o sorteio das bolas de 1 a 60...'}
            </div>
          )}
        </div>
      </div>

      {/* Expandable 60-Ball Full Matrix Board */}
      {showFullBoard && (
        <div className="mt-4 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Tabela Completa de Bolas (1 a 60)</span>
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
                  className={`flex items-center justify-center h-7 text-xs font-bold rounded-lg transition-all ${
                    isCurrent
                      ? `bg-gradient-to-br ${color.bg} text-white ring-2 ring-white scale-110 shadow-lg z-10`
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
