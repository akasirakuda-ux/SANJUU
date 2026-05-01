
import React, { useCallback, useState } from 'react';
import SelectScreen from './SelectScreen';
import GameScreen from './GameScreen';
import QuietRoom from './QuietRoom';
import SeatSelection from '../pages/SeatSelection';
import WorldsWish from './WorldsWish';
import Entrance from './Entrance';
import GameNarrator from './GameNarrator';
import { MASTER } from '../constants';
import { vibrate } from '../lib/utils';
import { audioService } from '../services/audioService';
import type { UserAccount } from '../types';

interface AppRouterProps {
  screen: any;
  setScreen: (s: any) => void;
  isEntered: boolean;
  setIsEntered: (e: boolean) => void;
  onEnter: () => void;
  nickname: string;
  setNickname: (n: string) => void;
  language: 'ja';
  setNotification: (msg: string | null) => void;
  handleStartGameWithSeed: (seed: string) => void;
  handleConfirmJoin: (roomId: string) => void;
  handleGoogleLogin: () => void;
  firebaseUser: any;
  setIsStampCardOpen: (open: boolean) => void;
  setShowSettingsModal: (show: boolean) => void;
  setIsAdVisible: (visible: boolean) => void;
  isAdVisible: boolean;
  handleInstallClick: () => void;
  deferredPrompt: any;
  showInstallGuideModal: boolean;
  pendingRoomId: any;
  isMultiplay: boolean;
  setIsMultiplay: (m: boolean) => void;
  isSyncMode: boolean;
  setIsSyncMode: (s: boolean) => void;
  handleSetSyncMode: (s: boolean) => void;
  startNewGame: any;
  startSearchGame: any;
  setClearsCount: (c: number) => void;
  setSeed: (s: string) => void;
  setRoomId: (id: string | null) => void;
  setIsReady: (r: boolean) => void;
  setIsRoomCreator: (v: boolean) => void;
  user: any;
  seed: string;
  roomPlayers: any[];
  handleHostStartGame: (settings: any) => void;
  isHost: boolean;
  isRoomCreator: boolean;
  roomHostId: string | null;
  roomId: string | null;
  syncShareRoomId: string | null;
  handleInitRoom: (seed: string, category?: any, isKatakana?: boolean, searchWord?: string) => void;
  isReady: boolean;
  handleToggleReady: () => void;
  roomStatus: 'waiting' | 'start' | 'playing' | 'finished';
  gameState: any;
  handleSaveHistory: (data: any) => void;
  spendPoints: (p: number) => void;
  isOnline: boolean;
  handleShowFullScreenAd: () => void;
  handleClear: () => void;
  handleAddPointsWithNotification: (p: number) => void;
  narration: string;
  difficulty: number;
  setDifficulty: (d: number) => void;
  clearsCount: number;
  setShowRenrakucho: (show: boolean) => void;
  onUpdateFound: (word: string, start: any, end: any, isHint?: boolean) => void;
  syncFromHundredRooms: boolean;
  hundredRoster: { uid: string; name: string; emoji: string; foundCount: number }[];
  /** hundred_rooms.hostUid（みんなであそぶでホストがゲーム画面を離れるときの確認用） */
  hundredRoomHostUid: string | null;
  onHundredRoomFinished: (reason: 'timeout' | 'cleared') => void | Promise<void>;
  ensureAuth: () => Promise<void>;
  hasActiveRecruitments: boolean;
  viewerCount?: number;
  userEmoji: string;
  setUserEmoji: (emoji: string) => void;
  onCancelRecruit: () => Promise<void>;
  recruitMessageId: string | null;
  setRecruitMessageId: (id: string | null) => void;
  recruitedAt: string | null;
  setRecruitedAt: (at: string | null) => void;
  onOpenHundredHub: () => Promise<void>;
  onOpenRenrakuchoAdmin: () => Promise<void>;
  /** メインハブ「みんなであそぶ（連絡帳）」未読バッジ */
  renrakuchoHasUnread?: boolean;
  /** ローカル複数アカウント（ハブ右上の切替用） */
  accounts: UserAccount[];
  activeUserId: string;
  switchAccount: (userId: string) => void;
  createAccount: () => string;
  /** 配信モード（軽量化） */
  streamMode?: boolean;
}

const AppRouter: React.FC<AppRouterProps> = ({
  screen,
  setScreen,
  isEntered,
  setIsEntered,
  onEnter,
  nickname,
  setNickname,
  language,
  setNotification,
  handleStartGameWithSeed,
  handleConfirmJoin,
  handleGoogleLogin,
  firebaseUser,
  setIsStampCardOpen,
  setShowSettingsModal,
  setIsAdVisible,
  isAdVisible,
  handleInstallClick,
  deferredPrompt,
  showInstallGuideModal,
  pendingRoomId,
  isMultiplay,
  setIsMultiplay,
  isSyncMode,
  setIsSyncMode,
  handleSetSyncMode,
  startNewGame,
  startSearchGame,
  setClearsCount,
  setSeed,
  setRoomId,
  setIsReady,
  setIsRoomCreator,
  user,
  seed,
  roomPlayers,
  handleHostStartGame,
  isHost,
  isRoomCreator,
  roomHostId,
  roomId,
  syncShareRoomId,
  handleInitRoom,
  isReady,
  handleToggleReady,
  roomStatus,
  gameState,
  handleSaveHistory,
  spendPoints,
  isOnline,
  handleShowFullScreenAd,
  handleClear,
  handleAddPointsWithNotification,
  narration,
  difficulty,
  setDifficulty,
  clearsCount,
  setShowRenrakucho,
  onUpdateFound,
  syncFromHundredRooms,
  hundredRoster,
  hundredRoomHostUid,
  onHundredRoomFinished,
  ensureAuth,
  hasActiveRecruitments,
  viewerCount,
  userEmoji,
  setUserEmoji,
  onCancelRecruit,
  recruitMessageId,
  setRecruitMessageId,
  recruitedAt,
  setRecruitedAt,
  onOpenHundredHub,
  onOpenRenrakuchoAdmin,
  renrakuchoHasUnread,
  accounts,
  activeUserId,
  switchAccount,
  createAccount,
  streamMode = false,
}) => {
  const [quietSkipIntro, setQuietSkipIntro] = useState(false);
  const handleBackToTitle = useCallback(() => {
    vibrate(10);
    setClearsCount(0);
    setIsMultiplay(false);
    setIsSyncMode(false);
    setSeed('');
    setRoomId(null);
    setIsReady(false);
    setIsRoomCreator(false);
    onCancelRecruit();
    setScreen('seat-selection');
  }, [setScreen, setClearsCount, setIsMultiplay, setIsSyncMode, setSeed, setRoomId, setIsReady, setIsRoomCreator, onCancelRecruit]);

  return (
    <>
      {screen === 'entrance' && (
        <Entrance onEnter={onEnter} />
      )}

      {screen === 'seat-selection' && (
        <SeatSelection 
          onSelectWindow={() => {
            vibrate(10);
            audioService.start();
            setScreen('select');
          }}
          onOpenHundredHub={async () => {
            vibrate(10);
            await onOpenHundredHub();
          }}
          onOpenRenrakuchoAdmin={async () => {
            vibrate(10);
            await onOpenRenrakuchoAdmin();
          }}
          onSelectQuietRoom={() => {
            vibrate(10);
            setQuietSkipIntro(true);
            setScreen('quiet-room');
          }}
          onOpenStampCard={() => { vibrate(10); setIsStampCardOpen(true); }}
          onOpenSettings={() => { vibrate(10); setShowSettingsModal(true); }}
          isOnline={isOnline}
          onGoogleLogin={handleGoogleLogin}
          firebaseUser={firebaseUser}
          hasActiveRecruitments={hasActiveRecruitments}
          renrakuchoHasUnread={renrakuchoHasUnread}
          viewerCount={viewerCount}
          nickname={nickname}
          setNickname={setNickname}
          userEmoji={userEmoji}
          setUserEmoji={setUserEmoji}
          totalPoints={user.totalPoints || 0}
          accounts={accounts}
          activeUserId={activeUserId}
          switchAccount={switchAccount}
          createAccount={createAccount}
        />
      )}

      {screen === 'quiet-room' && (
        <QuietRoom
          skipIntro={quietSkipIntro}
          onBack={() => {
            vibrate(10);
            setQuietSkipIntro(false);
            setScreen('seat-selection');
          }}
        />
      )}

      {screen === 'worlds-wish' && (
        <WorldsWish
          onBack={() => {
            vibrate(10);
            setScreen('seat-selection');
          }}
        />
      )}
      
      <GameNarrator 
        message={narration} 
        isVisible={isMultiplay && !!roomId && (screen === 'select' || screen === 'game')} 
      />

      {screen === 'select' && (
        <SelectScreen 
          difficulty={difficulty} 
          onSetDifficulty={(d) => { vibrate(5); setDifficulty(d); }} 
          isMultiplay={isMultiplay}
          isSyncMode={isSyncMode}
          onSetSyncMode={handleSetSyncMode}
          onSelectProblem={(cat, isKatakana) => { 
            vibrate(20); 
            startNewGame(cat, undefined, undefined, isKatakana); 
          }} 
          nickname={nickname}
          categories={MASTER.categories} 
          addOns={user.addOns}
          onBack={handleBackToTitle}
          language={language} 
          totalPoints={user.totalPoints}
          seed={seed}
          onClearSeed={() => {
            setSeed('');
            setRoomId(null);
            setIsReady(false);
          }}
          onHostStartGame={handleHostStartGame}
          isHost={isHost}
          roomId={roomId}
          shareRoomId={syncShareRoomId}
          onInitRoom={handleInitRoom}
          isReady={isReady}
          onToggleReady={handleToggleReady}
          roomPlayers={roomPlayers}
          roomStatus={roomStatus}
          roomHostId={roomHostId}
          recruitMessageId={recruitMessageId}
          setRecruitMessageId={setRecruitMessageId}
          recruitedAt={recruitedAt}
          setRecruitedAt={setRecruitedAt}
          onCancelRecruit={onCancelRecruit}
          userEmoji={userEmoji}
        />
      )}

      {screen === 'game' && (
        <GameScreen 
          gameState={gameState} 
          onUpdateFound={onUpdateFound}
          onBack={() => { 
            vibrate(10); 
            // みんなであそぶ（掲示板）から来た盤面は「掲示板」へ戻す
            if (isSyncMode && !isMultiplay && syncFromHundredRooms && !!roomId) {
              setScreen('select');
              void onOpenHundredHub();
              return;
            }
            setScreen('select');
          }} 
          onBackToBoard={async () => {
            // クリア後の「もどる」は掲示板へ
            // 盤面の状態は GameScreen 側で onClearSeed を呼ぶ
            // 掲示板は Select 画面の上に重ねて表示する
            setScreen('select');
            await onOpenHundredHub();
          }}
          onBackToTitle={handleBackToTitle}
          showToast={setNotification} 
          onSaveHistory={handleSaveHistory} 
          onSpendPoints={spendPoints}
          vibrate={vibrate}
          language={language} 
          totalPoints={user.totalPoints}
          isOnline={isOnline}
          onShowFullScreenAd={handleShowFullScreenAd}
          onClear={handleClear}
          onClearSeed={() => {
            setSeed('');
            setRoomId(null);
          }}
          userId={user.user_id}
          onAddPoints={handleAddPointsWithNotification}
          onNextProblem={() => {
            // みんなであそぶ（hundred_rooms）中は「次の問題」でソロ盤面を生成すると、
            // hundred_rooms の購読が上書きして前の foundWords が復活し「全てのこたえ」が帯付きになる事故が起きる。
            // この導線は掲示板へ戻す（次の問題はホスト側で新しい募集/盤面を開始）。
            if (isSyncMode && !isMultiplay && syncFromHundredRooms && !!roomId) {
              setSeed('');
              setRoomId(null);
              setScreen('select');
              void onOpenHundredHub();
              return;
            }
            if (gameState.category) startNewGame(gameState.category, undefined, gameState.difficulty, gameState.isKatakana);
          }}
          seed={seed}
          proCode={gameState.category && gameState.actualSeed !== undefined ? `${gameState.category.category}-${String.fromCharCode(65 + gameState.difficulty)}-${gameState.actualSeed}` : undefined}
          nickname={nickname}
          userEmoji={userEmoji}
          isMultiplay={isMultiplay}
          isSyncMode={isSyncMode}
          roomId={roomId}
          shareRoomId={syncShareRoomId}
          roomPlayers={roomPlayers}
          roomStatus={roomStatus}
          consecutiveClears={clearsCount}
          hundredCoop={isSyncMode && !isMultiplay && syncFromHundredRooms && !!roomId}
          hundredRoster={hundredRoster}
          hundredRoomHostUid={hundredRoomHostUid}
          currentFirebaseUid={firebaseUser?.uid ?? null}
          onHundredRoomFinished={onHundredRoomFinished}
          streamMode={streamMode}
        />
      )}
    </>
  );
};

export default AppRouter;
