import React, { useState } from 'react';
import { X, ShieldCheck, CheckCircle2, Key, Code2, Cpu, Github, Save } from 'lucide-react';
import { mercadoPagoService } from '../services/mercadoPagoService.ts';

interface MercadoPagoSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MercadoPagoSettingsModal: React.FC<MercadoPagoSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const currentConfig = mercadoPagoService.getConfig();
  const [publicKey, setPublicKey] = useState(currentConfig.publicKey);
  const [accessToken, setAccessToken] = useState(currentConfig.accessToken);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    mercadoPagoService.saveConfig({
      publicKey: publicKey.trim(),
      accessToken: accessToken.trim(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-slate-950">
            <Cpu className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-lg font-black font-['Outfit'] text-white">
              WebService Mercado Pago & GitHub Pages
            </h3>
            <p className="text-xs text-slate-400">
              Pronto para publicação no GitHub Pages como SPA estático.
            </p>
          </div>
        </div>

        {/* GitHub Pages Badge */}
        <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30 flex items-center gap-2.5 mb-4 text-xs">
          <Github className="w-5 h-5 text-white shrink-0" />
          <div className="flex-1">
            <span className="font-bold text-emerald-400 block">
              Compatibilidade com GitHub Pages Ativa
            </span>
            <span className="text-slate-400 text-[11px]">
              O site roda 100% no navegador (Client-Side WebService). Não requer servidor backend.
            </span>
          </div>
        </div>

        {/* Config Form with User Provided Credentials */}
        <form onSubmit={handleSave} className="space-y-3 mb-5">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Credenciais de Teste Ativas:
          </h4>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Public Key (Mercado Pago):
            </label>
            <input
              type="text"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Access Token (Mercado Pago):
            </label>
            <input
              type="text"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500">
              Salvo localmente no navegador (LocalStorage)
            </span>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar Credenciais</span>
            </button>
          </div>

          {saved && (
            <div className="text-xs font-bold text-emerald-400 text-center py-1">
              ✓ Credenciais atualizadas com sucesso!
            </div>
          )}
        </form>

        {/* Rules Card */}
        <div className="space-y-2 mb-4 text-xs">
          <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
            Especificações da Rodada:
          </h4>
          <ul className="space-y-2 text-slate-300">
            <li className="flex items-start gap-2 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
              <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 font-bold text-[10px]">
                1
              </span>
              <span>
                <strong>Intervalo de 1 minuto:</strong> 60 segundos entre rodadas para compra de cartelas e chat.
              </span>
            </li>
            <li className="flex items-start gap-2 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
              <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 font-bold text-[10px]">
                2
              </span>
              <span>
                <strong>Cartelas 5x5 a R$ 1,00:</strong> Débito automático do saldo.
              </span>
            </li>
            <li className="flex items-start gap-2 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
              <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 font-bold text-[10px]">
                3
              </span>
              <span>
                <strong>Sorteio a cada 10 segundos:</strong> Bolas de 1 a 60 sorteadas e marcadas automaticamente em todas as cartelas ativas.
              </span>
            </li>
            <li className="flex items-start gap-2 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
              <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 font-bold text-[10px]">
                4
              </span>
              <span>
                <strong>Prêmio de 80% via Pix:</strong> O primeiro a completar linha ou cartela ganha 80% do valor total arrecadado.
              </span>
            </li>
          </ul>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors cursor-pointer"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};
