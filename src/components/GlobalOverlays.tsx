
import React from 'react';
import { createPortal } from 'react-dom';
import SettingsModal from './SettingsModal';
import InstructionModal from './InstructionModal';
import Renrakucho from './Renrakucho/Renrakucho';
import type { HundredPublicRecruit, RenrakuchoPublicScreenState } from './Renrakucho/types';
import DonationThanksModal from './DonationThanksModal';
import InstallGuideModal from './InstallGuideModal';
import HundredWaitHeadlessHost from './HundredWaitHeadlessHost';
import type { HundredWaitHeadlessController, HundredWaitHeadlessState } from '../lib/hundredWaitHeadless';
import { NetworkStatusHandler } from './NetworkStatusHandler';
import { StampCard, suppressesQuietImmersiveGlobalChrome } from '../lib/rakudaHubShell';
import { clearHundredRestoreSession } from '../lib/rakudaHundredRestore';

interface GlobalOverlaysProps {
  showSettingsModal: boolean;
  setShowSettingsModal: (show: boolean) => void;
  showInstructionModal: boolean;
  setShowInstructionModal: (show: boolean) => void;
  isStampCardOpen: boolean;
  setIsStampCardOpen: (open: boolean) => void;
  showRenrakucho: boolean;
  setShowRenrakucho: (show: boolean) => void;
  showInstallGuideModal: boolean;
  setShowInstallGuideModal: (show: boolean) => void;
  isAdVisible: boolean;
  setIsAdVisible: (visible: boolean) => void;
  isBgmEnabled: boolean;
  onToggleBgm: () => void;
  language: 'ja';
  notification: string | null;
  /** 盤面が作れないときなど、画面中央に数秒表示するヒント */
  puzzleSizeHintMessage: string | null;
  isOnline: boolean;
  screen: string;
  /** ゲーム中バナー抑制用 */
  isMultiplay: boolean;
  /** 配信モード — `useAppShell` と同じ値を渡す（二重に URL を読まない） */
  streamMode?: boolean;
  setStreamMode?: (enabled: boolean) => void;
  /** 盤面の座標表示（配信モードと別） */
  coordOverlayEnabled?: boolean;
  setCoordOverlayEnabled?: (enabled: boolean) => void;
  myGreenUntilMs?: number | null;
  rakudaGate?: import('../lib/rakudaGate').RakudaGateId | null;
  onGreenGateCheckout?: () => void | Promise<void>;
  greenCheckoutBusy?: boolean;
  onGreenGateDevBypass?: () => void;
  user: any;
  nickname: string;
  userEmoji: string;
  setUserEmoji: (e: string) => void;
  setNickname: (n: string) => void;
  viewerCount?: number;
  onJoinRoom?: (roomId: string) => void;
  onJoinBoardGameRecruit?: (kind: 'reversi' | 'gomoku', roomCode: string) => void;
  onStartHundred: (roomId: string, opts?: { hundredMode?: string }) => void | Promise<void>;
  hundredWaitRecruit?: HundredPublicRecruit | null;
  beginHundredJoin?: (recruit: HundredPublicRecruit) => void;
  handleHundredWaitHeadlessState?: (state: HundredWaitHeadlessState) => void;
  handleHundredWaitHeadlessController?: (controller: HundredWaitHeadlessController | null) => void;
  handleHundredWaitSessionEnded?: () => void;
  ensureAuth: () => Promise<void>;
  shellFirebaseUser?: import('firebase/auth').User | null;
  onRequestGoogleLogin?: () => void;
  onGoogleLogout?: () => void | Promise<void>;
  settingsFirebaseUser?: import('firebase/auth').User | null;
  settingsIsAuthReady?: boolean;
  renrakuchoMountKey: number;
  renrakuchoInitialActiveTab?: 'post' | 'public' | 'admin';
  renrakuchoInitialPublicScreen?: RenrakuchoPublicScreenState;
  renrakuchoInitialSelectedHundred?: HundredPublicRecruit | null;
  showDonationThanks?: boolean;
  setShowDonationThanks?: (open: boolean) => void;
  greenGateUntilMs?: number | null;
  greenGateHasStripeBilling?: boolean;
  stripeGreenEnabled?: boolean;
  onGreenGateManageBilling?: () => void | Promise<void>;
  greenGatePortalBusy?: boolean;
  onGoogleLoginPopup?: () => void | Promise<void>;
  onGoogleLoginRedirect?: () => void | Promise<void>;
  myShussekiRegular?: boolean;
}

const GlobalOverlays: React.FC<GlobalOverlaysProps> = ({
  showSettingsModal,
  setShowSettingsModal,
  showInstructionModal,
  setShowInstructionModal,
  isStampCardOpen,
  setIsStampCardOpen,
  showRenrakucho,
  setShowRenrakucho,
  showInstallGuideModal,
  setShowInstallGuideModal,
  isAdVisible,
  setIsAdVisible,
  isBgmEnabled,
  onToggleBgm,
  language,
  notification,
  puzzleSizeHintMessage,
  isOnline,
  screen,
  isMultiplay,
  streamMode = false,
  setStreamMode,
  coordOverlayEnabled = false,
  setCoordOverlayEnabled,
  myGreenUntilMs = null,
  rakudaGate = null,
  onGreenGateCheckout,
  greenCheckoutBusy = false,
  onGreenGateDevBypass,
  user,
  nickname,
  userEmoji,
  setUserEmoji,
  setNickname,
  viewerCount,
  onJoinRoom,
  onJoinBoardGameRecruit,
  onStartHundred,
  hundredWaitRecruit = null,
  beginHundredJoin,
  handleHundredWaitHeadlessState,
  handleHundredWaitHeadlessController,
  handleHundredWaitSessionEnded,
  ensureAuth,
  shellFirebaseUser,
  onRequestGoogleLogin,
  onGoogleLogout,
  settingsFirebaseUser,
  settingsIsAuthReady,
  renrakuchoMountKey,
  renrakuchoInitialActiveTab,
  renrakuchoInitialPublicScreen,
  renrakuchoInitialSelectedHundred,
  showDonationThanks = false,
  setShowDonationThanks,
  greenGateUntilMs = null,
  greenGateHasStripeBilling = false,
  stripeGreenEnabled = false,
  onGreenGateManageBilling,
  greenGatePortalBusy = false,
  onGoogleLoginPopup,
  onGoogleLoginRedirect,
  myShussekiRegular = false,
}) => {
  return (
    <>
      <SettingsModal 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)} 
        isBgmEnabled={isBgmEnabled} 
        onToggleBgm={onToggleBgm} 
        language={language}
        coordOverlayEnabled={coordOverlayEnabled}
        onToggleCoordOverlay={() => setCoordOverlayEnabled?.(!coordOverlayEnabled)}
        rakudaGate={rakudaGate}
        onGreenGateCheckout={onGreenGateCheckout}
        greenCheckoutBusy={greenCheckoutBusy}
        onGreenGateDevBypass={onGreenGateDevBypass}
        firebaseUser={settingsFirebaseUser}
        isAuthReady={settingsIsAuthReady}
        onGoogleLogout={onGoogleLogout}
        greenGateUntilMs={greenGateUntilMs}
        greenGateHasStripeBilling={greenGateHasStripeBilling}
        stripeGreenEnabled={stripeGreenEnabled}
        onGreenGateManageBilling={onGreenGateManageBilling}
        greenGatePortalBusy={greenGatePortalBusy}
        onGoogleLoginPopup={onGoogleLoginPopup}
        onGoogleLoginRedirect={onGoogleLoginRedirect}
      />
      
      <InstructionModal 
        isOpen={showInstructionModal} 
        onClose={() => setShowInstructionModal(false)} 
        language={language} 
      />
      
      {isStampCardOpen && (
        <StampCard
          completedDates={user.completedDates || []}
          specialDates={user.specialDates || []}
          dailyClearCounts={user.dailyClearCounts}
          onClose={() => setIsStampCardOpen(false)}
        />
      )}
      
      {showRenrakucho && (
        <Renrakucho
          key={renrakuchoMountKey}
          onBack={() => {
            clearHundredRestoreSession();
            setShowRenrakucho(false);
            try {
              const p = window.location.pathname.replace(/\/+$/, '') || '/';
              if (p === '/keijiban' || p.endsWith('/keijiban') || p === '/hundred' || p.endsWith('/hundred')) {
                window.history.replaceState(null, '', '/');
              }
            } catch {
              /* ignore */
            }
          }}
          nickname={nickname}
          userEmoji={userEmoji}
          setUserEmoji={setUserEmoji}
          setNickname={setNickname}
          onJoinRoom={onJoinRoom}
          onJoinBoardGameRecruit={onJoinBoardGameRecruit}
          onStartHundred={onStartHundred}
          onJoinHundredRecruit={beginHundredJoin}
          ensureAuth={ensureAuth}
          shellFirebaseUser={shellFirebaseUser}
          onRequestGoogleLogin={onRequestGoogleLogin}
          initialActiveTab={renrakuchoInitialActiveTab}
          initialPublicScreen={renrakuchoInitialPublicScreen}
          initialSelectedHundred={renrakuchoInitialSelectedHundred}
          isAdVisible={isAdVisible}
          setIsAdVisible={setIsAdVisible}
          viewerCount={viewerCount}
          streamMode={streamMode}
          setStreamMode={setStreamMode}
          myGreenUntilMs={myGreenUntilMs}
          myShussekiRegular={myShussekiRegular}
        />
      )}

      {hundredWaitRecruit && handleHundredWaitHeadlessState && handleHundredWaitHeadlessController ? (
        <HundredWaitHeadlessHost
          recruit={hundredWaitRecruit}
          nickname={nickname}
          userEmoji={userEmoji}
          currentUid={shellFirebaseUser?.uid}
          streamMode={streamMode}
          onStartHundred={onStartHundred}
          onHeadlessState={handleHundredWaitHeadlessState}
          onHeadlessController={handleHundredWaitHeadlessController}
          onSessionEnded={handleHundredWaitSessionEnded}
        />
      ) : null}
      
      {showInstallGuideModal && (
        <InstallGuideModal 
          onClose={() => setShowInstallGuideModal(false)} 
          language={language} 
        />
      )}
      
      {/* 生成失敗ヒントは「ことば探し」選択画面でのみ。ハブ/没入へ z-[850] が残らないようガード */}
      {puzzleSizeHintMessage && screen === 'select' && (
        <div
          className="fixed inset-0 z-[850] flex items-center justify-center p-6 bg-rk-slate-900/40 pointer-events-none"
          role="alert"
          aria-live="polite"
        >
          <div className="pointer-events-auto max-w-[min(92vw,24rem)] rounded-2xl border-4 border-rk-amber-300 bg-rk-amber-50 px-6 py-5 shadow-2xl text-center animate-in fade-in duration-300">
            <p className="text-base md:text-lg font-black text-rk-amber-950 leading-snug">{puzzleSizeHintMessage}</p>
          </div>
        </div>
      )}

      {notification &&
        !suppressesQuietImmersiveGlobalChrome(screen) &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="alert"
            aria-live="polite"
            className="fixed bottom-[calc(env(safe-area-inset-bottom)+var(--rk-app-status-footer-reserve)+5.5rem)] left-1/2 -translate-x-1/2 z-[3500] max-w-[min(92vw,24rem)] bg-rk-slate-900 text-rk-white px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold text-center whitespace-pre-wrap"
          >
            {notification}
          </div>,
          document.body
        )}

      {showDonationThanks && setShowDonationThanks ? (
        <DonationThanksModal onClose={() => setShowDonationThanks(false)} />
      ) : null}
      
      {!isOnline && !suppressesQuietImmersiveGlobalChrome(screen) && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[400] bg-rk-amber-500 text-rk-white px-4 py-1 rounded-lg shadow-lg text-[10px] font-black flex items-center gap-2">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M18.364 5.636a9 9 0 010 12.728m0-12.728L5.636 18.364m12.728-12.728L5.636 5.636m12.728 12.728L5.636 18.364"/>
          </svg>
          {language === 'ja' ? 'オフライン' : 'OFFLINE'}
        </div>
      )}

      <NetworkStatusHandler
        suppressFloatingWarnings={suppressesQuietImmersiveGlobalChrome(screen)}
        onReset={() => window.location.reload()}
      />
    </>
  );
};

export default GlobalOverlays;
