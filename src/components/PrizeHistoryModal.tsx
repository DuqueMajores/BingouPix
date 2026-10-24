import React from 'react';
import { X, History, Trophy, ShieldCheck, ArrowUpRight, DollarSign } from 'lucide-react';
import { WinnerInfo } from '../types/bingo.ts';

interface PrizeHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: WinnerInfo[];
}

export const PrizeHistoryModal: React.FC<PrizeHistoryModalProps> = ({
  isOpen,
  onClose,
  history,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-2xl text-slate-100 max-h-[85vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4 shrink-0">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20 text-white">
            <History className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-lg font-black font-['Outfit'] text-white">
              Histórico de Prêmios Pagos
            </h3>
            <p className="text-xs text-slate-400">
              Repasses automáticos de 80% do valor arrecadado via Pix Mercado Pago.
            </p>
          </div>
        </div>

        {/* List of winners */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
          {history.length > 0 ? (
            history.map((item, idx) => (
              <div
                key={`${item.cardId}-${idx}`}
                className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-bold text-slate-200">
                      {item.userName}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                      {item.patternName}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-2">
                    <span>Pix: {item.pixKey.key}</span>
                    <span>•</span>
                    <span>{new Date(item.timestamp).toLocaleTimeString('pt-BR')}</span>
                  </div>

                  <div className="text-[10px] font-mono text-slate-500 truncate max-w-[260px]">
                    ID MP: {item.mercadoPagoPaymentId}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-black text-emerald-400 text-sm font-['Outfit'] tabular-nums">
                    R$ {item.prizeAmount.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Total: R$ {item.totalPot.toFixed(2)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              Nenhuma rodada finalizada ainda nesta sessão.
            </div>
          )}
        </div>

        <div className="pt-4 mt-3 border-t border-slate-800 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors cursor-pointer"
          >
            Fechar Histórico
          </button>
        </div>
      </div>
    </div>
  );
};
