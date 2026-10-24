import React, { useState } from 'react';
import { X, ShoppingBag, Plus, Minus, AlertCircle, ArrowRight, ShieldCheck, Wallet } from 'lucide-react';

interface BuyCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userBalance: number;
  onConfirmBuy: (quantity: number) => Promise<boolean>;
  onOpenDeposit: () => void;
  prizePot: number;
}

export const BuyCardsModal: React.FC<BuyCardsModalProps> = ({
  isOpen,
  onClose,
  userBalance,
  onConfirmBuy,
  onOpenDeposit,
  prizePot,
}) => {
  const [quantity, setQuantity] = useState(3);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const cost = quantity * 1.0;
  const hasEnoughBalance = userBalance >= cost;

  const handleBuy = async () => {
    setErrorMsg('');
    if (!hasEnoughBalance) {
      setErrorMsg(`Saldo insuficiente (R$ ${userBalance.toFixed(2)}). Recarregue via Pix.`);
      return;
    }
    setLoading(true);
    const success = await onConfirmBuy(quantity);
    setLoading(false);
    if (success) {
      onClose();
    } else {
      setErrorMsg('Erro ao comprar cartelas. Tente novamente.');
    }
  };

  const quickOptions = [1, 3, 5, 10];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-2xl text-slate-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950">
            <ShoppingBag className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-lg font-black font-['Outfit'] text-white">
              Comprar Cartelas de Bingo
            </h3>
            <p className="text-xs text-slate-400">
              Cada cartela custa <strong className="text-amber-400">R$ 1,00</strong>. Débito automático.
            </p>
          </div>
        </div>

        {/* Quick presets */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {quickOptions.map((qty) => (
            <button
              key={qty}
              onClick={() => setQuantity(qty)}
              className={`py-2 px-1 text-center rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                quantity === qty
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-sm'
                  : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div>{qty} {qty === 1 ? 'Cartela' : 'Cartelas'}</div>
              <div className="text-[10px] text-amber-400 font-extrabold mt-0.5">
                R$ {qty.toFixed(2)}
              </div>
            </button>
          ))}
        </div>

        {/* Stepper */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-slate-300">
            Quantidade desejada:
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 flex items-center justify-center text-slate-200 transition-colors cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center font-black text-lg font-['Outfit'] text-white tabular-nums">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(Math.min(20, quantity + 1))}
              disabled={quantity >= 20}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 flex items-center justify-center text-slate-200 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-800 space-y-2 mb-4 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Preço por cartela:</span>
            <span className="font-semibold text-slate-200">R$ 1,00</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Total da aposta:</span>
            <span className="font-bold text-amber-400 text-sm">
              R$ {cost.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-700/60">
            <span className="flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-slate-400" />
              Seu saldo disponível:
            </span>
            <span className={`font-bold ${hasEnoughBalance ? 'text-emerald-400' : 'text-rose-400'}`}>
              R$ {userBalance.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Insufficient balance warning + quick deposit button */}
        {!hasEnoughBalance && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <span className="font-bold text-rose-300 block">Saldo insuficiente</span>
              <span className="text-slate-300">
                Você precisa de mais R$ {(cost - userBalance).toFixed(2)} para efetuar essa compra.
              </span>
              <button
                onClick={() => {
                  onClose();
                  onOpenDeposit();
                }}
                className="mt-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer underline"
              >
                Recarregar saldo com Pix agora <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
            {errorMsg}
          </div>
        )}

        {/* Benefits Note */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-5 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            80% de toda a arrecadação da rodada é transferida automaticamente ao vencedor via Pix Mercado Pago!
          </span>
        </div>

        {/* Action Button */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleBuy}
            disabled={!hasEnoughBalance || loading}
            className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Gerando Cartelas...</span>
            ) : (
              <span>Confirmar (R$ {cost.toFixed(2)})</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
