/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  Plus,
  LayoutGrid,
  CheckCircle2,
} from 'lucide-react';

import { Header } from './components/Header.tsx';
import { RoundStatusBanner } from './components/RoundStatusBanner.tsx';
import { BallQueue } from './components/BallQueue.tsx';
import { BingoCardView } from './components/BingoCardView.tsx';
import { BuyCardsModal } from './components/BuyCardsModal.tsx';
import { PixDepositModal } from './components/PixDepositModal.tsx';
import { PixKeyModal } from './components/PixKeyModal.tsx';
import { WinnerCelebrationModal } from './components/WinnerCelebrationModal.tsx';
import { PrizeHistoryModal } from './components/PrizeHistoryModal.tsx';
import { MercadoPagoSettingsModal } from './components/MercadoPagoSettingsModal.tsx';
import { ExpoMobileFrame } from './components/ExpoMobileFrame.tsx';

import { BingoRound, BingoCard, PixKey } from './types/bingo.ts';
import { soundManager } from './utils/audio.ts';
import { bingoWebService, UserProfile } from './services/bingoWebService.ts';

export default function App() {
  // App state from bingoWebService
  const [roundState, setRoundState] = useState<BingoRound>(bingoWebService.getRound());
  const [user, setUser] = useState<UserProfile>(bingoWebService.getUser());
  const [userCards, setUserCards] = useState<BingoCard[]>(bingoWebService.getUserCards());
  const [realPlayersCount, setRealPlayersCount] = useState<number>(bingoWebService.getRealPlayersCount());

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

  // Track previous ball to trigger sound & voice announcer
  const lastDrawnNumberRef = useRef<number | null>(null);
  const lastRoundStatusRef = useRef<string>('waiting');

  // Subscriptions to BingouPix WebService
  useEffect(() => {
    const unsubRound = bingoWebService.subscribeRound((r) => {
      setRoundState(r);
      setRealPlayersCount(r.activePlayerCount ?? bingoWebService.getRealPlayersCount());

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
    const unsubCards = bingoWebService.subscribeCards((c) => {
      setUserCards(c);
      setRealPlayersCount(bingoWebService.getRound().activePlayerCount ?? bingoWebService.getRealPlayersCount());
    });

    return () => {
      unsubRound();
      unsubUser();
      unsubCards();
    };
  }, []);

  // Handlers
  const handleBuyCards = async (quantity: number): Promise<boolean> => {
    const res = await bingoWebService.buyCards(quantity);
    setRealPlayersCount(bingoWebService.getRound().activePlayerCount ?? bingoWebService.getRealPlayersCount());
    return res.success;
  };

  const handleSavePixKey = async (pixKey: PixKey): Promise<boolean> => {
    bingoWebService.registerPixKey(pixKey);
    return true;
  };

  const showCelebrationModal =
    roundState.status === 'finished' &&
    roundState.winner !== null &&
    celebrationDismissedForRound !== roundState.id;

  return (
    <ExpoMobileFrame isFrameActive={isMobileFrame}>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans selection:bg-emerald-500 selection:text-white">
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
          activePlayers={realPlayersCount}
        />

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-6">
          {/* Status & Jackpot Banner */}
          <RoundStatusBanner
            roundId={roundState.id}
            status={roundState.status}
            waitingSecondsRemaining={roundState.waitingSecondsRemaining}
            ballDrawIntervalRemaining={roundState.ballDrawIntervalRemaining}
            totalCards={roundState.totalCards}
            prizePot={roundState.prizePot}
            userCardsCount={userCards.length}
            realPlayersCount={realPlayersCount}
            onOpenBuyCards={() => setIsBuyModalOpen(true)}
          />

          {/* Ball Queue */}
          <BallQueue
            currentNumber={roundState.currentNumber}
            drawnNumbers={roundState.drawnNumbers}
            roundStatus={roundState.status}
          />

          {/* Player's Bingo Cards */}
          <div className="space-y-4">
            {/* Cards Section Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <LayoutGrid className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 font-['Outfit']">
                    Suas Cartelas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Números sorteados são marcados automaticamente em todas as suas cartelas.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsBuyModalOpen(true)}
                disabled={roundState.status === 'in_progress'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                  roundState.status === 'in_progress'
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-95'
                }`}
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Comprar Cartelas</span>
              </button>
            </div>

            {/* Cards Grid */}
            {userCards.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {userCards.map((card) => (
                  <BingoCardView
                    key={card.id}
                    card={card}
                    currentNumber={roundState.currentNumber}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center flex flex-col items-center justify-center shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-3">
                  <ShoppingBag className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-900 font-['Outfit']">
                  Você ainda não comprou cartelas!
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4 leading-relaxed">
                  Cada cartela custa apenas R$ 1,00. O prêmio é transferido automaticamente via Pix do vencedor.
                </p>
                <button
                  onClick={() => setIsBuyModalOpen(true)}
                  disabled={roundState.status === 'in_progress'}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer ${
                    roundState.status === 'in_progress'
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  {roundState.status === 'in_progress'
                    ? 'Aguarde o término da rodada atual'
                    : 'Comprar Cartelas Agora (R$ 1,00)'}
                </button>
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-slate-800 bg-slate-900 py-4 px-4 text-center text-xs text-slate-400">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="font-semibold text-slate-200">
              BingouPix Online
            </span>
            <div className="flex items-center gap-3 text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Mercado Pago Integrado
              </span>
              <span className="text-slate-600">•</span>
              <span>Cartelas R$ 1,00 • Prêmio Automático via Pix</span>
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
          currentWinner={roundState.winner}
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
          onOpenPixKeyModal={() => setIsPixKeyModalOpen(true)}
        />
      </div>
    </ExpoMobileFrame>
  );
}
