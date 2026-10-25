import React from 'react';
import { X, BookOpen } from 'lucide-react';

interface MercadoPagoSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MercadoPagoSettingsModal: React.FC<MercadoPagoSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-xl text-slate-800 max-h-[85vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header: Regras do Jogo */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 text-white">
            <BookOpen className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-['Outfit'] text-slate-900">
              Regras do Jogo
            </h3>
            <p className="text-xs text-slate-500">
              Como funciona o BingouPix e as rodadas ao vivo.
            </p>
          </div>
        </div>

        {/* Regras List */}
        <div className="space-y-2.5 mb-5 text-xs">
          <div className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center shrink-0 font-bold text-xs">
              1
            </span>
            <div>
              <strong className="text-slate-900 block text-sm mb-0.5">Mínimo de 2 Jogadores:</strong>
              <p className="text-slate-600 leading-relaxed">
                O sorteio só é iniciado se pelo menos <strong>2 jogadores reais</strong> tiverem comprado pelo menos 1 cartela na rodada. Não há jogadores fantasmas no sistema.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center shrink-0 font-bold text-xs">
              2
            </span>
            <div>
              <strong className="text-slate-900 block text-sm mb-0.5">Intervalo de 1 Minuto:</strong>
              <p className="text-slate-600 leading-relaxed">
                Assim que houver 2 jogadores com cartela comprada, inicia-se a contagem regressiva de <strong>1 minuto</strong> para o início do sorteio.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center shrink-0 font-bold text-xs">
              3
            </span>
            <div>
              <strong className="text-slate-900 block text-sm mb-0.5">Preço da Cartela:</strong>
              <p className="text-slate-600 leading-relaxed">
                Cada cartela custa <strong>R$ 1,00</strong> e o valor é debitado diretamente da sua carteira no BingouPix. As cartelas são geradas no formato 5x5.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center shrink-0 font-bold text-xs">
              4
            </span>
            <div>
              <strong className="text-slate-900 block text-sm mb-0.5">Sorteio a Cada 10 Segundos:</strong>
              <p className="text-slate-600 leading-relaxed">
                Durante a rodada, o globo sorteia uma bola de 1 a 60 a cada 10 segundos. Os números sorteados são marcados automaticamente em todas as suas cartelas ativas.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center shrink-0 font-bold text-xs">
              5
            </span>
            <div>
              <strong className="text-slate-900 block text-sm mb-0.5">Premiação Automática via Pix:</strong>
              <p className="text-slate-600 leading-relaxed">
                O primeiro jogador a completar uma linha ou cartela cheia ganha a partida. O prêmio é repassado automaticamente via Pix para a chave Pix do tipo <strong>e-mail cadastrada na conta Mercado Pago</strong> do vencedor.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer"
        >
          Entendido
        </button>
      </div>
    </div>
  );
};
