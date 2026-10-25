import React from 'react';
import { Check, Sparkles, Award } from 'lucide-react';
import { BingoCard } from '../types/bingo.ts';

interface BingoCardViewProps {
  card: BingoCard;
  currentNumber: number | null;
}

const COLUMN_HEADERS = [
  { label: 'B', range: '1-12', color: 'text-rose-700 bg-rose-50 border-rose-200' },
  { label: 'I', range: '13-24', color: 'text-amber-800 bg-amber-50 border-amber-200' },
  { label: 'N', range: '25-36', color: 'text-emerald-800 bg-emerald-50 border-emerald-200' },
  { label: 'G', range: '37-48', color: 'text-sky-800 bg-sky-50 border-sky-200' },
  { label: 'O', range: '49-60', color: 'text-purple-800 bg-purple-50 border-purple-200' },
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
          ? 'bg-gradient-to-b from-amber-50/80 via-white to-white border-2 border-amber-400 shadow-md scale-[1.01]'
          : 'bg-white border border-slate-200 hover:border-slate-300 shadow-xs'
      }`}
    >
      {/* Top Card Info Bar */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
            #{card.id.split('-').pop()}
          </span>
          {card.hasWon ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-xs animate-bounce">
              <Award className="w-3 h-3" />
              PREMIADA!
            </span>
          ) : minMissingInLine === 1 ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
              Falta 1 para Linha!
            </span>
          ) : null}
        </div>

        <div className="text-[11px] font-medium text-slate-500">
          Marcados:{' '}
          <span className="font-bold text-emerald-700 tabular-nums">
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
                    ? 'bg-amber-400 text-slate-950 shadow-sm scale-105 z-10'
                    : isMarked
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                } ${isLatest ? 'ring-2 ring-emerald-500' : ''}`}
              >
                {/* Daub stamp overlay */}
                {isMarked && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                        isWinner
                          ? 'bg-white/30 text-slate-950'
                          : 'bg-white/20 text-white'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3.5] opacity-70" />
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
      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2.5 pt-2 border-t border-slate-100">
        <span className="font-medium text-slate-500">Cartela Oficial 5x5</span>
        <span className="text-emerald-700 font-semibold">Custo R$ 1,00</span>
      </div>
    </div>
  );
};
