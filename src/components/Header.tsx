import React from 'react';
import { Volume2, VolumeX, Smartphone, Monitor, Wallet, Plus, Key, Users, Info } from 'lucide-react';
import { soundManager } from '../utils/audio.ts';
import { PixKey } from '../types/bingo.ts';

interface HeaderProps {
  balance: number;
  pixKey?: PixKey;
  isMuted: boolean;
  onToggleMute: () => void;
  isMobileFrame: boolean;
  onToggleMobileFrame: () => void;
  onOpenDeposit: () => void;
  onOpenPixKey: () => void;
  onOpenHistory: () => void;
  onOpenInfo: () => void;
  activePlayers: number;
}

export const Header: React.FC<HeaderProps> = ({
  balance,
  pixKey,
  isMuted,
  onToggleMute,
  isMobileFrame,
  onToggleMobileFrame,
  onOpenDeposit,
  onOpenPixKey,
  onOpenHistory,
  onOpenInfo,
  activePlayers,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-3 py-2.5 sm:px-6 sm:py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Logo / Brand */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-amber-500 via-emerald-500 to-cyan-400 p-[2px] shadow-lg shadow-emerald-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <span className="font-extrabold text-lg sm:text-xl text-transparent bg-clip-text bg-gradient-to-br from-amber-300 via-emerald-300 to-white font-['Outfit']">
                60
              </span>
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border border-slate-950"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-black text-lg sm:text-xl tracking-tight text-white font-['Outfit']">
                Pix<span className="text-emerald-400">Bingo</span>
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                Ao Vivo
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3 text-cyan-400" />
                <span className="font-medium text-slate-300">{activePlayers}</span> jogando
              </span>
              <span>•</span>
              <span className="text-amber-400/90 font-medium">Cartela R$ 1,00</span>
            </div>
          </div>
        </div>

        {/* Right side controls: Balance + Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Wallet Balance Chip */}
          <div className="flex items-center bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-1 sm:p-1.5 pl-2.5 sm:pl-3 shadow-inner">
            <div className="flex flex-col text-left mr-1.5 sm:mr-2">
              <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">
                Saldo
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-emerald-400 tabular-nums">
                R$ {balance.toFixed(2)}
              </span>
            </div>

            <button
              onClick={onOpenDeposit}
              title="Depositar via Pix Mercado Pago"
              className="flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-slate-950 text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span className="hidden xs:inline">Pix</span>
            </button>
          </div>

          {/* Pix Key Configured Status */}
          <button
            onClick={onOpenPixKey}
            title={pixKey ? `Chave Pix: ${pixKey.key}` : 'Cadastrar Chave Pix para Prêmios'}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
              pixKey
                ? 'bg-slate-800/80 border-emerald-500/40 text-emerald-300 hover:bg-slate-800'
                : 'bg-amber-500/10 border-amber-500/40 text-amber-300 animate-pulse hover:bg-amber-500/20'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">
              {pixKey ? 'Chave Pix OK' : 'Cadastrar Pix'}
            </span>
          </button>

          {/* Sound Mute Toggle */}
          <button
            onClick={() => {
              const muted = soundManager.toggleMuted();
              onToggleMute();
            }}
            title={isMuted ? 'Ativar Sons e Locução' : 'Silenciar Sons'}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* Device Frame View Toggle (Simulating Expo Mobile App vs Desktop) */}
          <button
            onClick={onToggleMobileFrame}
            title={isMobileFrame ? 'Expandir para Visão Completa (Desktop)' : 'Modo App Celular (Expo Preview)'}
            className="hidden sm:flex p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 transition-colors cursor-pointer"
          >
            {isMobileFrame ? (
              <Monitor className="w-4 h-4 text-cyan-400" />
            ) : (
              <Smartphone className="w-4 h-4 text-amber-400" />
            )}
          </button>

          {/* Mercado Pago API Status / Rules Modal */}
          <button
            onClick={onOpenInfo}
            title="Mercado Pago & Regras do Jogo"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 transition-colors cursor-pointer"
          >
            <Info className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>
    </header>
  );
};
