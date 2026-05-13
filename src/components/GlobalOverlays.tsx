
import React from 'react';
import SettingsModal from './SettingsModal';
import InstructionModal from './InstructionModal';
import StampCard from './StampCard';
import Renrakucho from './Renrakucho/Renrakucho';
import type { RenrakuchoPublicScreenState } from './Renrakucho/types';
import InstallGuideModal from './InstallGuideModal';
import AdSpace from './AdSpace';
import { NetworkStatusHandler } from './NetworkStatusHandler';

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
  user: any;
  nickname: string;
  userEmoji: string;
  setUserEmoji: (e: string) => void;
  setNickname: (n: string) => void;
  viewerCount?: number;
  onJoinRoom?: (roomId: string) => void;
  onStartHundred: (roomId: string) => void;
  ensureAuth: () => Promise<void>;
  renrakuchoMountKey: number;
  renrakuchoInitialActiveTab?: 'post' | 'public' | 'admin';
  renrakuchoInitialPublicScreen?: RenrakuchoPublicScreenState;
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
  user,
  nickname,
  userEmoji,
  setUserEmoji,
  setNickname,
  viewerCount,
  onJoinRoom,
  onStartHundred,
  ensureAuth,
  renrakuchoMountKey,
  renrakuchoInitialActiveTab,
  renrakuchoInitialPublicScreen,
}) => {
  const streamMode = (() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get('stream') === '1') return true;
    } catch {
      // ignore
    }
    try {
      return window.localStorage.getItem('rk_stream_mode') === '1';
    } catch {
      return false;
    }
  })();

  return (
    <>
      <SettingsModal 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)} 
        isBgmEnabled={isBgmEnabled} 
        onToggleBgm={onToggleBgm} 
        language={language} 
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
          onClose={() => setIsStampCardOpen(false)} 
        />
      )}
      
      {showRenrakucho && (
        <Renrakucho
          key={renrakuchoMountKey}
          onBack={() => setShowRenrakucho(false)}
          nickname={nickname}
          userEmoji={userEmoji}
          setUserEmoji={setUserEmoji}
          setNickname={setNickname}
          onJoinRoom={onJoinRoom}
          onStartHundred={onStartHundred}
          ensureAuth={ensureAuth}
          initialActiveTab={renrakuchoInitialActiveTab}
          initialPublicScreen={renrakuchoInitialPublicScreen}
          isAdVisible={isAdVisible}
          setIsAdVisible={setIsAdVisible}
          viewerCount={viewerCount}
          streamMode={streamMode}
        />
      )}
      
      {showInstallGuideModal && (
        <InstallGuideModal 
          onClose={() => setShowInstallGuideModal(false)} 
          language={language} 
        />
      )}
      
      {puzzleSizeHintMessage && (
        <div
          className="fixed inset-0 z-[850] flex items-center justify-center p-6 bg-slate-900/40 pointer-events-none"
          role="alert"
          aria-live="polite"
        >
          <div className="pointer-events-auto max-w-[min(92vw,24rem)] rounded-2xl border-4 border-amber-300 bg-amber-50 px-6 py-5 shadow-2xl text-center animate-in fade-in duration-300">
            <p className="text-base md:text-lg font-black text-amber-950 leading-snug">{puzzleSizeHintMessage}</p>
          </div>
        </div>
      )}

      {notification && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[400] bg-slate-800 text-white px-6 py-3 rounded-2xl shadow-2xl animate-scale-in text-sm font-bold text-center">
          {notification}
        </div>
      )}
      
      {!isOnline && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[400] bg-amber-500 text-white px-4 py-1 rounded-lg shadow-lg text-[10px] font-black flex items-center gap-2">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M18.364 5.636a9 9 0 010 12.728m0-12.728L5.636 18.364m12.728-12.728L5.636 5.636m12.728 12.728L5.636 18.364"/>
          </svg>
          {language === 'ja' ? 'オフライン' : 'OFFLINE'}
        </div>
      )}
      
      {/* body 直下ポータルでビューポート最下部の帯に固定（連絡帳オーバーの上に重ねる） */}
      {isAdVisible && !streamMode && !(isMultiplay && screen === 'game') && (
        <AdSpace
          isVisible={isAdVisible}
          onHide={() => setIsAdVisible(false)}
          language={language}
          viewerCount={viewerCount}
          placement="fixed"
        />
      )}
      
      <NetworkStatusHandler onReset={() => window.location.reload()} />
    </>
  );
};

export default GlobalOverlays;
