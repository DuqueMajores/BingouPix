import React from 'react';
import { Check, Sparkles, Award } from 'lucide-react';
import { BingoCard } from '../types/bingo.ts';

interface BingoCardViewProps {
  card: BingoCard;
  currentNumber: number | null;
}

const COLUMN_HEADERS = [
  { label: 'B', range: '1-12', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
  { label: 'I', range: '13-24', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { label: 'N', range: '25-36', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { label: 'G', range: '37-48', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
  { label: 'O', range: '49-60', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
];

export const BingoCardView: React.FC<BingoCardViewProps> = ({ card, currentNumber }) => {
  // Count total marked numbers
  let totalMarked = 0;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (card.marked[r][c]) totalMarked++;
    }
  }

  // Calculate best row or column (closest to winning line)
  let minMissingInLine = 5;
  for (let r = 0; r < 5; r++) {
    const missing = 5 - card.marked[r].filter(Boolean).length;
    if (missing < minMissingInLine) minMissingInLine = missing;
  }
  for (let c = 0; c < 5; c++) {
    let markedInCol = 0;
    for (let r = 0; r < 5; r++) {
      if (card.marked[r][c]) markedInCol++;
    }
    const missing = 5 - markedInCol;
    if (missing < minMissingInLine) minMissingInLine = missing;
  }

  const isWinningCell = (row: number, col: number) => {
    if (!card.hasWon || !card.winningPattern) return false;
    return card.winningPattern.cells.some(([r, c]) => r === row && c === col);
  };

  return (
    <div
      className={`relative rounded-2xl p-3.5 sm:p-4 transition-all duration-300 ${
        card.hasWon
          ? 'bg-gradient-to-b from-amber-950/80 via-slate-900 to-slate-950 border-2 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.35)] scale-[1.01]'
          : 'bg-slate-900/90 border border-slate-800 hover:border-slate-700 shadow-md'
      }`}
    >
      {/* Top Card Info Bar */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md">
            #{card.id.split('-').pop()}
          </span>
          {card.hasWon ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 shadow-sm animate-bounce">
              <Award className="w-3 h-3" />
              PREMIADA!
            </span>
          ) : minMissingInLine === 1 ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
              <Sparkles className="w-2.5 h-2.5 text-amber-400" />
              Falta 1 para Linha!
            </span>
          ) : null}
        </div>

        <div className="text-[11px] font-medium text-slate-400">
          Marcados:{' '}
          <span className="font-bold text-emerald-400 tabular-nums">
            {totalMarked}/25
          </span>
        </div>
      </div>

      {/* Column Headers (B - I - N - G - O) */}
      <div className="grid grid-cols-5 gap-1 sm:gap-1.5 mb-1.5">
        {COLUMN_HEADERS.map((col, idx) => (
          <div
            key={idx}
            className={`flex flex-col items-center justify-center py-1 sm:py-1.5 rounded-lg border text-center ${col.color}`}
          >
            <span className="font-black text-sm sm:text-base font-['Outfit'] leading-none">
              {col.label}
            </span>
            <span className="text-[8px] font-bold opacity-75 hidden xs:inline mt-0.5">
              {col.range}
            </span>
          </div>
        ))}
      </div>

      {/* 5x5 Grid */}
      <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
        {card.numbers.map((row, rIdx) =>
          row.map((num, cIdx) => {
            const isMarked = card.marked[rIdx][cIdx];
            const isLatest = currentNumber === num;
            const isWinner = isWinningCell(rIdx, cIdx);

            return (
              <div
                key={`${rIdx}-${cIdx}`}
                className={`relative aspect-square flex items-center justify-center rounded-xl font-['Outfit'] font-black text-sm sm:text-base transition-all select-none ${
                  isWinner
                    ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.8)] scale-105 z-10'
                    : isMarked
                    ? 'bg-gradient-to-br from-emerald-600/90 to-teal-700 text-white shadow-inner border border-emerald-400/50'
                    : 'bg-slate-950/70 border border-slate-800/80 text-slate-200 hover:border-slate-700'
                } ${isLatest ? 'ring-2 ring-amber-400 animate-pulse' : ''}`}
              >
                {/* Daub stamp overlay */}
                {isMarked && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                        isWinner
                          ? 'bg-amber-300 text-slate-950'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3.5] opacity-60" />
                    </div>
                  </div>
                )}

                <span className="relative z-10 tabular-nums">
                  {num}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Footer Details */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2.5 pt-2 border-t border-slate-800/70">
        <span className="font-medium text-slate-400">Cartela Oficial 5x5</span>
        <span className="text-amber-400/80 font-semibold">Custo R$ 1,00</span>
      </div>
    </div>
  );
};
