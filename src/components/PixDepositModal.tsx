import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, QrCode, Copy, Check, Clock, ShieldCheck, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { PixPaymentInfo } from '../types/bingo.ts';
import { mercadoPagoService } from '../services/mercadoPagoService.ts';
import { bingoWebService } from '../services/bingoWebService.ts';

interface PixDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDepositSuccess: (newBalance: number) => void;
}

export const PixDepositModal: React.FC<PixDepositModalProps> = ({
  isOpen,
  onClose,
  onDepositSuccess,
}) => {
  const [selectedAmount, setSelectedAmount] = useState(10);
  const [pixData, setPixData] = useState<PixPaymentInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isApprovedRef = useRef(false);
  isApprovedRef.current = isApproved;

  const quickAmounts = [5, 10, 20, 50, 100];

  const handleGeneratePix = async (amount: number) => {
    setSelectedAmount(amount);
    setLoading(true);
    setSuccessMessage('');
    setStatusNote('');
    setIsApproved(false);
    try {
      const data = await mercadoPagoService.createPixDeposit(amount);
      setPixData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!pixData?.copyPaste) return;
    navigator.clipboard.writeText(pixData.copyPaste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Process confirmed payment and update balance
  const confirmAndCreditDeposit = useCallback((amount: number) => {
    if (isApprovedRef.current) return;
    setIsApproved(true);
    isApprovedRef.current = true;
    bingoWebService.addDeposit(amount);
    setSuccessMessage(`Pagamento de R$ ${amount.toFixed(2)} confirmado! Saldo atualizado.`);
    const user = bingoWebService.getUser();
    onDepositSuccess(user.balance);

    setTimeout(() => {
      onClose();
      setPixData(null);
      setSuccessMessage('');
      setIsApproved(false);
      setStatusNote('');
    }, 2200);
  }, [onClose, onDepositSuccess]);

  // Query payment status with Mercado Pago
  const verifyPayment = useCallback(async (isManual = false) => {
    if (!pixData || isApprovedRef.current) return;
    if (isManual) setVerifying(true);

    try {
      const res = await mercadoPagoService.checkPaymentStatus(
        pixData.mercadoPagoId || '',
        pixData.isSimulated
      );

      if (res.status === 'approved') {
        confirmAndCreditDeposit(pixData.amount);
      } else if (isManual) {
        setStatusNote('Pagamento ainda pendente de confirmação bancária. O saldo só é atualizado quando houver a confirmação do pagamento.');
      }
    } catch (err) {
      if (isManual) {
        setStatusNote('Aguardando confirmação bancária. O saldo só é atualizado quando houver a confirmação do pagamento.');
      }
      console.warn(err);
    } finally {
      if (isManual) {
        setTimeout(() => setVerifying(false), 500);
      }
    }
  }, [pixData, confirmAndCreditDeposit]);

  // Automatic status polling every 3 seconds while waiting for confirmation
  useEffect(() => {
    if (!isOpen || !pixData || isApproved) return;

    const interval = setInterval(() => {
      if (!isApprovedRef.current) {
        verifyPayment(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen, pixData, isApproved, verifyPayment]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-slate-950">
            <QrCode className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-lg font-black font-['Outfit'] text-white">
                Depósito Pix
              </h3>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                Mercado Pago
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Recarga segura para apostas a R$ 1,00 a cartela.
            </p>
          </div>
        </div>

        {/* Step 1: Select Amount if not generated yet */}
        {!pixData && (
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-2 block">
              Escolha o valor do depósito:
            </label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setSelectedAmount(amt)}
                  className={`py-3 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                    selectedAmount === amt
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-md'
                      : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-400 block">R$</span>
                  <span className="text-lg font-black font-['Outfit'] text-white">
                    {amt.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-amber-400 font-semibold block mt-0.5">
                    {amt} {amt === 1 ? 'cartela' : 'cartelas'}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => handleGeneratePix(selectedAmount)}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gerando QR Code Pix...</span>
                </>
              ) : (
                <span>Gerar Pix de R$ {selectedAmount.toFixed(2)}</span>
              )}
            </button>
          </div>
        )}

        {/* Step 2: Show QR Code & Copia e Cola */}
        {pixData && (
          <div className="space-y-4">
            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white text-slate-900 shadow-inner">
              <img
                src={pixData.qrCode}
                alt="QR Code Pix Mercado Pago"
                className="w-48 h-48 rounded-lg shadow-sm"
              />
              <span className="text-[11px] font-bold text-slate-600 mt-2 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Válido por 30 minutos • Valor: R$ {pixData.amount.toFixed(2)}
              </span>
            </div>

            {/* Copy / Paste Box */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Código Pix Copia e Cola:</span>
                {copied && (
                  <span className="text-emerald-400 text-[11px] font-bold flex items-center gap-1">
                    <Check className="w-3 h-3 stroke-[3]" /> Copiado com sucesso!
                  </span>
                )}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={pixData.copyPaste}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 truncate focus:outline-none select-all"
                />
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar</span>
                </button>
              </div>
            </div>

            {/* Payment Status & Strict Confirmation */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  {isApproved ? (
                    <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                  ) : (
                    <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                  )}
                  {isApproved ? 'Pagamento Aprovado' : 'Aguardando Confirmação'}
                </span>
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                  isApproved
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}>
                  {isApproved ? 'Confirmado' : 'Pendente Pix'}
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                O saldo só é atualizado quando houver a confirmação do pagamento.
              </p>

              {!isApproved && (
                <button
                  onClick={() => verifyPayment(true)}
                  disabled={verifying}
                  className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                >
                  {verifying ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verificando com o banco...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Verificar Confirmação de Pagamento</span>
                    </>
                  )}
                </button>
              )}

              {statusNote && !isApproved && (
                <div className="mt-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{statusNote}</span>
                </div>
              )}
            </div>

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-bold text-center flex items-center justify-center gap-2">
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{successMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  setPixData(null);
                  setStatusNote('');
                  setIsApproved(false);
                }}
                className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
              >
                Escolher outro valor
              </button>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Mercado Pago WebService
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
