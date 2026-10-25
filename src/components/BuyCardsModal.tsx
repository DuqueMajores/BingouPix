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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-xl text-slate-800">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 text-white">
            <ShoppingBag className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-['Outfit'] text-slate-900">
              Comprar Cartelas de Bingo
            </h3>
            <p className="text-xs text-slate-500">
              Cada cartela custa R$ 1,00 • Sorteio a cada 10s
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
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div>{qty} {qty === 1 ? 'Cartela' : 'Cartelas'}</div>
              <div className="text-[10px] text-emerald-700 font-extrabold mt-0.5">
                R$ {qty.toFixed(2)}
              </div>
            </button>
          ))}
        </div>

        {/* Stepper */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-slate-700">
            Quantidade desejada:
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center font-bold text-lg font-['Outfit'] text-slate-900 tabular-nums">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(Math.min(20, quantity + 1))}
              disabled={quantity >= 20}
              className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 mb-4 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>Preço por cartela:</span>
            <span className="font-semibold text-slate-800">R$ 1,00</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Total da aposta:</span>
            <span className="font-bold text-emerald-700 text-sm">
              R$ {cost.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-slate-500 pt-1 border-t border-slate-200">
            <span className="flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-slate-500" />
              Seu saldo disponível:
            </span>
            <span className={`font-bold ${hasEnoughBalance ? 'text-emerald-700' : 'text-rose-600'}`}>
              R$ {userBalance.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Insufficient balance warning + quick deposit button */}
        {!hasEnoughBalance && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <span className="font-bold text-rose-800 block">Saldo insuficiente</span>
              <span className="text-slate-600">
                Você precisa de mais R$ {(cost - userBalance).toFixed(2)} para efetuar essa compra.
              </span>
              <button
                onClick={() => {
                  onClose();
                  onOpenDeposit();
                }}
                className="mt-2 text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer underline"
              >
                Recarregar saldo com Pix agora <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 text-xs text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
            {errorMsg}
          </div>
        )}

        {/* Benefits Note */}
        <div className="flex items-center gap-2 text-[11px] text-slate-600 mb-5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Cada cartela custa apenas R$ 1,00. O prêmio é transferido automaticamente via Pix do vencedor.
          </span>
        </div>

        {/* Action Button */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleBuy}
            disabled={!hasEnoughBalance || loading}
            className="flex-[2] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
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
