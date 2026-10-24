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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-2xl text-slate-100 max-h-[85vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header: Regras do Jogo */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950">
            <BookOpen className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-lg font-black font-['Outfit'] text-white">
              Regras do Jogo
            </h3>
            <p className="text-xs text-slate-400">
              Como funciona o BingouPix e as rodadas ao vivo.
            </p>
          </div>
        </div>

        {/* Regras List */}
        <div className="space-y-2.5 mb-5 text-xs">
          <div className="flex items-start gap-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 font-black text-xs">
              1
            </span>
            <div>
              <strong className="text-white block text-sm mb-0.5">Mínimo de 2 Jogadores:</strong>
              <p className="text-slate-300 leading-relaxed">
                O sorteio só é iniciado se pelo menos <strong>2 jogadores reais</strong> tiverem comprado pelo menos 1 cartela na rodada. Não há jogadores fantasmas no sistema.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 font-black text-xs">
              2
            </span>
            <div>
              <strong className="text-white block text-sm mb-0.5">Intervalo de 1 Minuto:</strong>
              <p className="text-slate-300 leading-relaxed">
                Assim que houver 2 jogadores com cartela comprada, inicia-se a contagem regressiva de <strong>1 minuto</strong> para o início do sorteio.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 font-black text-xs">
              3
            </span>
            <div>
              <strong className="text-white block text-sm mb-0.5">Preço da Cartela:</strong>
              <p className="text-slate-300 leading-relaxed">
                Cada cartela custa <strong>R$ 1,00</strong> e o valor é debitado diretamente da sua carteira no BingouPix. As cartelas são geradas no formato 5x5.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 font-black text-xs">
              4
            </span>
            <div>
              <strong className="text-white block text-sm mb-0.5">Sorteio a Cada 10 Segundos:</strong>
              <p className="text-slate-300 leading-relaxed">
                Durante a rodada, o globo sorteia uma bola de 1 a 60 a cada 10 segundos. Os números sorteados são marcados automaticamente em todas as suas cartelas ativas.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 font-black text-xs">
              5
            </span>
            <div>
              <strong className="text-white block text-sm mb-0.5">Premiação Automática via Pix:</strong>
              <p className="text-slate-300 leading-relaxed">
                O primeiro jogador a completar uma linha (horizontal, vertical, diagonal) ou cartela cheia ganha a partida. O prêmio é transferido altomaticamente via Pix do vencedor.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors cursor-pointer"
        >
          Entendido
        </button>
      </div>
    </div>
  );
};
