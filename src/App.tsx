/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Trophy,
  ShoppingBag,
  Plus,
  Key,
  MessageSquare,
  QrCode,
  LayoutGrid,
  Sparkles,
  AlertTriangle,
  History,
  CheckCircle2,
  Volume2,
  VolumeX,
} from 'lucide-react';

import { Header } from './components/Header.tsx';
import { RoundStatusBanner } from './components/RoundStatusBanner.tsx';
import { BallQueue } from './components/BallQueue.tsx';
import { BingoCardView } from './components/BingoCardView.tsx';
import { LiveChat } from './components/LiveChat.tsx';
import { BuyCardsModal } from './components/BuyCardsModal.tsx';
import { PixDepositModal } from './components/PixDepositModal.tsx';
import { PixKeyModal } from './components/PixKeyModal.tsx';
import { WinnerCelebrationModal } from './components/WinnerCelebrationModal.tsx';
import { PrizeHistoryModal } from './components/PrizeHistoryModal.tsx';
import { MercadoPagoSettingsModal } from './components/MercadoPagoSettingsModal.tsx';
import { ExpoMobileFrame } from './components/ExpoMobileFrame.tsx';

import { BingoRound, BingoCard, ChatMessage, PixKey } from './types/bingo.ts';
import { soundManager } from './utils/audio.ts';
import { bingoWebService, UserProfile } from './services/bingoWebService.ts';

export default function App() {
  // App state from bingoWebService
  const [roundState, setRoundState] = useState<BingoRound>(bingoWebService.getRound());
  const [user, setUser] = useState<UserProfile>(bingoWebService.getUser());
  const [userCards, setUserCards] = useState<BingoCard[]>(bingoWebService.getUserCards());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(bingoWebService.getChat());
  const [activePlayerCount, setActivePlayerCount] = useState(14);

  // Modals state
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isPixKeyModalOpen, setIsPixKeyModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [celebrationDismissedForRound, setCelebrationDismissedForRound] = useState<number | null>(null);

  // Sound & Frame preferences
  const [isMuted, setIsMuted] = useState(soundManager.getMuted());
  const [isMobileFrame, setIsMobileFrame] = useState(false);

  // Mobile active tab: 'game' | 'cards' | 'chat'
  const [activeTab, setActiveTab] = useState<'game' | 'cards' | 'chat'>('game');

  // Track previous ball to trigger sound & voice announcer
  const lastDrawnNumberRef = useRef<number | null>(null);
  const lastRoundStatusRef = useRef<string>('waiting');

  // Subscriptions to Bingo WebService (runs self-contained, no external server needed!)
  useEffect(() => {
    const unsubRound = bingoWebService.subscribeRound((r) => {
      setRoundState(r);

      // Play audio and voice announcer on new ball
      if (r.currentNumber !== null && r.currentNumber !== lastDrawnNumberRef.current) {
        lastDrawnNumberRef.current = r.currentNumber;
        soundManager.playBallDrawn();
        soundManager.announceNumber(r.currentNumber);
      }

      // Detect round finish for win line sound
      if (r.status === 'finished' && lastRoundStatusRef.current !== 'finished') {
        soundManager.playWinLine();
      }
      lastRoundStatusRef.current = r.status;
    });

    const unsubUser = bingoWebService.subscribeUser((u) => setUser(u));
    const unsubCards = bingoWebService.subscribeCards((c) => setUserCards(c));
    const unsubChat = bingoWebService.subscribeChat((ch) => setChatMessages(ch));

    // Dynamic player count fluctuation
    const interval = setInterval(() => {
      setActivePlayerCount(10 + Math.floor(Math.random() * 8));
    }, 7000);

    return () => {
      unsubRound();
      unsubUser();
      unsubCards();
      unsubChat();
      clearInterval(interval);
    };
  }, []);

  // Handlers
  const handleBuyCards = async (quantity: number): Promise<boolean> => {
    const res = bingoWebService.buyCards(quantity);
    return res.success;
  };

  const handleSavePixKey = async (pixKey: PixKey): Promise<boolean> => {
    bingoWebService.registerPixKey(pixKey);
    return true;
  };

  const handleSendMessage = async (text: string): Promise<boolean> => {
    bingoWebService.addChatMessage({
      senderId: user.id,
      senderName: user.name,
      senderAvatar: '😎',
      text,
    });
    return true;
  };

  const showCelebrationModal =
    roundState.status === 'finished' &&
    roundState.winner !== null &&
    celebrationDismissedForRound !== roundState.id;

  return (
    <ExpoMobileFrame isFrameActive={isMobileFrame}>
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-black">
        {/* Main Header */}
        <Header
          balance={user.balance}
          pixKey={user.pixKey}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted(soundManager.getMuted())}
          isMobileFrame={isMobileFrame}
          onToggleMobileFrame={() => setIsMobileFrame(!isMobileFrame)}
          onOpenDeposit={() => setIsDepositModalOpen(true)}
          onOpenPixKey={() => setIsPixKeyModalOpen(true)}
          onOpenHistory={() => setIsHistoryModalOpen(true)}
          onOpenInfo={() => setIsInfoModalOpen(true)}
          activePlayers={activePlayerCount}
        />

        {/* Missing Pix Key Alert Banner */}
        {!user.pixKey?.key && (
          <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
              <span>
                Cadastre sua chave Pix para receber os 80% do prêmio automaticamente caso vença!
              </span>
            </div>
            <button
              onClick={() => setIsPixKeyModalOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-slate-950 text-amber-300 hover:bg-slate-900 text-xs font-extrabold cursor-pointer transition-colors"
            >
              Cadastrar Agora
            </button>
          </div>
        )}

        {/* Mobile Navigation Tabs */}
        <div className="sm:hidden sticky top-[57px] z-20 bg-slate-900 border-b border-slate-800 grid grid-cols-3 text-xs font-bold text-center">
          <button
            onClick={() => setActiveTab('game')}
            className={`py-2.5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-b-2 ${
              activeTab === 'game'
                ? 'text-emerald-400 border-emerald-400 bg-slate-800/40'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Sorteio</span>
          </button>

          <button
            onClick={() => setActiveTab('cards')}
            className={`py-2.5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-b-2 relative ${
              activeTab === 'cards'
                ? 'text-emerald-400 border-emerald-400 bg-slate-800/40'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Cartelas</span>
            {userCards.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                {userCards.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`py-2.5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-b-2 ${
              activeTab === 'chat'
                ? 'text-emerald-400 border-emerald-400 bg-slate-800/40'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-6">
          {/* Status & Jackpot Banner */}
          <RoundStatusBanner
            roundId={roundState.id}
            status={roundState.status}
            waitingSecondsRemaining={roundState.waitingSecondsRemaining}
            ballDrawIntervalRemaining={roundState.ballDrawIntervalRemaining}
            totalCards={roundState.totalCards}
            potTotal={roundState.potTotal}
            prizePot={roundState.prizePot}
            userCardsCount={userCards.length}
            onOpenBuyCards={() => setIsBuyModalOpen(true)}
          />

          {/* Ball Queue */}
          <BallQueue
            currentNumber={roundState.currentNumber}
            drawnNumbers={roundState.drawnNumbers}
            roundStatus={roundState.status}
          />

          {/* Grid Layout: Left Cards / Right Chat (Desktop), Tabbed on Mobile */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left 2 Cols: Player's Bingo Cards */}
            <div
              className={`lg:col-span-2 space-y-4 ${
                activeTab === 'chat' ? 'hidden sm:block' : 'block'
              }`}
            >
              {/* Cards Section Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <LayoutGrid className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-white font-['Outfit']">
                      Suas Cartelas (5x5 • R$ 1,00 cada)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Números sorteados (1 a 60) são marcados automaticamente em todas as suas cartelas.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsBuyModalOpen(true)}
                  disabled={roundState.status === 'in_progress'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
                    roundState.status === 'in_progress'
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20 active:scale-95'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Comprar Cartelas</span>
                </button>
              </div>

              {/* Cards Grid */}
              {userCards.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userCards.map((card) => (
                    <BingoCardView
                      key={card.id}
                      card={card}
                      currentNumber={roundState.currentNumber}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/40 p-8 text-center flex flex-col items-center justify-center">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
                    <ShoppingBag className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-white font-['Outfit']">
                    Você ainda não comprou cartelas para esta rodada!
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4 leading-relaxed">
                    Cada cartela custa apenas R$ 1,00. O vencedor leva 80% de toda a arrecadação transferido automaticamente via Pix Mercado Pago.
                  </p>
                  <button
                    onClick={() => setIsBuyModalOpen(true)}
                    disabled={roundState.status === 'in_progress'}
                    className={`px-5 py-2.5 rounded-xl font-black text-xs text-slate-950 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer ${
                      roundState.status === 'in_progress'
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-amber-500 to-emerald-400 hover:from-amber-400 hover:to-emerald-300'
                    }`}
                  >
                    {roundState.status === 'in_progress'
                      ? 'Aguarde o término da rodada atual'
                      : 'Comprar Cartelas Agora (R$ 1,00)'}
                  </button>
                </div>
              )}
            </div>

            {/* Right Col: Live Chat & Quick Info */}
            <div
              className={`space-y-4 ${
                activeTab !== 'chat' ? 'hidden lg:block' : 'block'
              }`}
            >
              <LiveChat
                messages={chatMessages}
                onSendMessage={handleSendMessage}
                currentUser={user}
              />

              {/* Quick Shortcuts Box */}
              <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Ações Rápidas & Mercado Pago
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                  <button
                    onClick={() => setIsDepositModalOpen(true)}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/60 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <QrCode className="w-4 h-4 text-emerald-400" />
                    <span>Recarga Pix</span>
                  </button>
                  <button
                    onClick={() => setIsPixKeyModalOpen(true)}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/60 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Key className="w-4 h-4 text-amber-400" />
                    <span>Chave Pix</span>
                  </button>
                  <button
                    onClick={() => setIsHistoryModalOpen(true)}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/60 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <History className="w-4 h-4 text-purple-400" />
                    <span>Ganhadores</span>
                  </button>
                  <button
                    onClick={() => setIsInfoModalOpen(true)}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/60 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Trophy className="w-4 h-4 text-cyan-400" />
                    <span>Credenciais MP</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-slate-900 bg-slate-950/80 py-4 px-4 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              PixBingo Online • WebService SPA para GitHub Pages
            </span>
            <div className="flex items-center gap-3 text-slate-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Mercado Pago Integrado
              </span>
              <span>•</span>
              <span>Cartelas R$ 1,00 • 80% Prêmio Pix</span>
            </div>
          </div>
        </footer>

        {/* Modals */}
        <BuyCardsModal
          isOpen={isBuyModalOpen}
          onClose={() => setIsBuyModalOpen(false)}
          userBalance={user.balance}
          onConfirmBuy={handleBuyCards}
          onOpenDeposit={() => setIsDepositModalOpen(true)}
          prizePot={roundState.prizePot}
        />

        <PixDepositModal
          isOpen={isDepositModalOpen}
          onClose={() => setIsDepositModalOpen(false)}
          onDepositSuccess={(newBalance) => {
            setUser((prev) => ({ ...prev, balance: newBalance }));
          }}
        />

        <PixKeyModal
          isOpen={isPixKeyModalOpen}
          onClose={() => setIsPixKeyModalOpen(false)}
          currentPixKey={user.pixKey}
          onSavePixKey={handleSavePixKey}
        />

        <PrizeHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          history={roundState.historyRounds || []}
        />

        <MercadoPagoSettingsModal
          isOpen={isInfoModalOpen}
          onClose={() => setIsInfoModalOpen(false)}
        />

        <WinnerCelebrationModal
          winner={showCelebrationModal ? roundState.winner : null}
          onClose={() => setCelebrationDismissedForRound(roundState.id)}
          waitingSecondsRemaining={roundState.waitingSecondsRemaining}
        />
      </div>
    </ExpoMobileFrame>
  );
}
