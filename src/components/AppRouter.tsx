
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import SeatSelection from '../pages/SeatSelection';
import SelectScreen from './SelectScreen';
import GameNarrator from './GameNarrator';
import { MASTER } from '../constants';
import { vibrate } from '../lib/utils';
import { audioService } from '../services/audioService';
import type { ScreenType, UserAccount, LogEntry } from '../types';

import {
  getRakudaScreenMeta,
  sanjuuRecruitBoardUrlWithRakudaProfile,
  type QuietImmersiveHistoryKind,
  usesQuietImmersiveHistoryScreen,
} from '../lib/rakudaHubShell';
import { lazyWithReload } from '../lib/lazyWithReload';
import { markSocialPlayAdSessionActive } from '../lib/socialPlayAdSession';
import HundredRecruitNewPopup from './HundredRecruitNewPopup';

const GameScreen = lazyWithReload(() => import('./GameScreen'));
const QuietRoom = lazyWithReload(() => import('./QuietRoom'));
const SlidePuzzleGame = lazyWithReload(() => import('../games/slide-puzzle/SlidePuzzleGame'));
const OthelloGame = lazyWithReload(() => import('../games/othello/OthelloGame'));

function RakudaRouteFallback() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-rk-amber-100 text-rk-amber-950 px-6"
      role="status"
      aria-live="polite"
    >
      <span className="text-sm font-black">読み込み中…</span>
    </div>
  );
}

/** 同一 URL のまま没入画面を積む（端末の戻るでハブへ） */
function pushQuietImmersiveHistory(kind: QuietImmersiveHistoryKind) {
  if (typeof window === 'undefined') return;
  try {
    const path = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
    window.history.pushState({ rk: kind }, '', path || '/');
  } catch {
    /* ignore */
  }
}

interface AppRouterProps {
  screen: ScreenType;
  setScreen: (s: ScreenType) => void;
  nickname: string;
  setNickname: (n: string) => void;
  language: 'ja';
  setNotification: (msg: string | null) => void;
  handleStartGameWithSeed: (seed: string) => void;
  handleConfirmJoin: (roomId: string) => void;
  handleGoogleLogin: () => void;
  handleGoogleLoginViaPopup?: () => void | Promise<void>;
  isAuthReady?: boolean;
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
  isOnline: boolean;
  tryInterstitialAtNaturalBreak: () => Promise<void>;
  tryInterstitialAtSocialSessionEnd: () => Promise<void>;
  handleClear: () => void;
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
  onRakudaRoboReplay?: () => Promise<boolean>;
  ensureAuth: () => Promise<void>;
  hasActiveRecruitments: boolean;
  /** トップハブ: hundred_public に最終閲覧より新しい募集がある */
  hundredRecruitHasNew?: boolean;
  markHundredRecruitSeen?: () => void;
  /** トップハブ: 参加可能なリバーシ募集がある */
  reversiRecruitHasOpen?: boolean;
  /** トップハブ: 自分のリバーシ募集が待機中 */
  reversiRecruitHostWaiting?: boolean;
  viewerCount?: number;
  userEmoji: string;
  setUserEmoji: (emoji: string) => void;
  onCancelRecruit: () => Promise<void>;
  recruitMessageId: string | null;
  setRecruitMessageId: (id: string | null) => void;
  recruitedAt: string | null;
  setRecruitedAt: (at: string | null) => void;
  onOpenKeijiban: () => Promise<void>;
  onOpenHundredHub: (opts?: { focusCreateForm?: boolean }) => Promise<void>;
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
  /** 連絡帳オーバーを表示中（席画面が裏に残っていても募集 API を叩かない） */
  showRenrakucho?: boolean;
  logs: LogEntry[];
  addLog: (
    type: LogEntry['type'],
    tag: string,
    message: string,
    details?: unknown,
    emoji?: string,
  ) => void;
  /** ゲームプレイ1回分のしゅっせき簿加算（本日の枚数を返す） */
  recordShussekiGamePlay: () => number;
}

const AppRouter: React.FC<AppRouterProps> = ({
  screen,
  setScreen,
  nickname,
  setNickname,
  language,
  setNotification,
  handleStartGameWithSeed,
  handleConfirmJoin,
  handleGoogleLogin,
  handleGoogleLoginViaPopup,
  isAuthReady = true,
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
  isOnline,
  tryInterstitialAtNaturalBreak,
  tryInterstitialAtSocialSessionEnd,
  handleClear,
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
  onRakudaRoboReplay,
  ensureAuth,
  hasActiveRecruitments,
  hundredRecruitHasNew = false,
  markHundredRecruitSeen,
  reversiRecruitHasOpen = false,
  reversiRecruitHostWaiting = false,
  viewerCount,
  userEmoji,
  setUserEmoji,
  onCancelRecruit,
  recruitMessageId,
  setRecruitMessageId,
  recruitedAt,
  setRecruitedAt,
  onOpenKeijiban,
  onOpenHundredHub,
  onOpenRenrakuchoAdmin,
  renrakuchoHasUnread,
  accounts,
  activeUserId,
  switchAccount,
  createAccount,
  streamMode = false,
  showRenrakucho = false,
  logs,
  addLog,
  recordShussekiGamePlay,
}) => {
  const [quietSkipIntro, setQuietSkipIntro] = useState(false);
  const [showNewRecruitPopup, setShowNewRecruitPopup] = useState(false);
  const quietImmersivePopRef = useRef(false);

  useEffect(() => {
    if (hundredRecruitHasNew) setShowNewRecruitPopup(true);
  }, [hundredRecruitHasNew]);

  /** ひと言探しマルチ・三十協力 — 対人セッション中は途中広告を抑止 */
  useEffect(() => {
    const inSocialPlay =
      (screen === 'select' && isMultiplay && !!roomId) ||
      (screen === 'game' && (isMultiplay || (isSyncMode && !!roomId)));
    if (inSocialPlay) markSocialPlayAdSessionActive();
  }, [screen, isMultiplay, isSyncMode, roomId]);

  const dismissNewRecruitPopup = useCallback(() => {
    markHundredRecruitSeen?.();
    setShowNewRecruitPopup(false);
  }, [markHundredRecruitSeen]);

  useEffect(() => {
    const onPop = () => {
      const s = screen;
      if (!usesQuietImmersiveHistoryScreen(s)) return;
      if (quietImmersivePopRef.current) return;
      quietImmersivePopRef.current = true;
      void (async () => {
        try {
          await tryInterstitialAtNaturalBreak();
          if (getRakudaScreenMeta(s).clearsQuietRoomSkipIntroOnPop) setQuietSkipIntro(false);
          setScreen('seat-selection');
        } finally {
          quietImmersivePopRef.current = false;
        }
      })();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [screen, setScreen, tryInterstitialAtNaturalBreak]);

  /** 低メモリ端末向け: 選択画面にいるあいだプレイ本体（GameScreen）チャンクを先読み */
  useEffect(() => {
    if (screen !== 'select' || typeof window === 'undefined') return;
    const prefetch = () => {
      void import('./GameScreen');
    };
    if ('requestIdleCallback' in window) {
      const idleHandle = window.requestIdleCallback(prefetch, { timeout: 2500 });
      return () => window.cancelIdleCallback(idleHandle);
    }
    const timeoutHandle = globalThis.setTimeout(prefetch, 500);
    return () => globalThis.clearTimeout(timeoutHandle);
  }, [screen]);

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
      {screen === 'seat-selection' && (
        <div onPointerDownCapture={() => audioService.startFromUserAction()}>
        <SeatSelection 
          onSelectWindow={() => {
            vibrate(10);
            setScreen('select');
          }}
          onOpenKeijiban={async () => {
            vibrate(10);
            await onOpenKeijiban();
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
            pushQuietImmersiveHistory('quiet-room');
            setQuietSkipIntro(true);
            setScreen('quiet-room');
          }}
          onOpenStampCard={() => { vibrate(10); setIsStampCardOpen(true); }}
          onOpenSlidePuzzle={() => {
            vibrate(10);
            pushQuietImmersiveHistory('slide-puzzle');
            setScreen('slide-puzzle');
          }}
          onOpenOthello={() => {
            vibrate(10);
            pushQuietImmersiveHistory('othello');
            setScreen('othello');
          }}
          onOpenSettings={() => { vibrate(10); setShowSettingsModal(true); }}
          isOnline={isOnline}
          hasActiveRecruitments={hasActiveRecruitments}
          hundredRecruitHasNew={hundredRecruitHasNew}
          reversiRecruitHasOpen={reversiRecruitHasOpen}
          reversiRecruitHostWaiting={reversiRecruitHostWaiting}
          renrakuchoHasUnread={renrakuchoHasUnread}
          viewerCount={viewerCount}
          nickname={nickname}
          setNickname={setNickname}
          userEmoji={userEmoji}
          setUserEmoji={setUserEmoji}
          accounts={accounts}
          activeUserId={activeUserId}
          switchAccount={switchAccount}
          createAccount={createAccount}
          firebaseUser={firebaseUser}
          isAuthReady={isAuthReady}
          onGoogleLogin={handleGoogleLogin}
          onGoogleLoginPopup={handleGoogleLoginViaPopup}
        />
        </div>
      )}

      <Suspense fallback={<RakudaRouteFallback />}>
        {screen === 'quiet-room' && (
          <QuietRoom
            skipIntro={quietSkipIntro}
            onBack={() => {
              vibrate(10);
              window.history.back();
            }}
          />
        )}

        {screen === 'slide-puzzle' && (
          <SlidePuzzleGame
            onBack={handleBackToTitle}
            onRecordShussekiGamePlay={recordShussekiGamePlay}
          />
        )}

        {screen === 'othello' && (
          <OthelloGame
            onBack={handleBackToTitle}
            nickname={nickname}
            userEmoji={userEmoji}
            firebaseUser={firebaseUser}
            addLog={addLog}
            logs={logs}
            onGoogleLogin={handleGoogleLogin}
            onInterstitialNaturalBreak={tryInterstitialAtNaturalBreak}
            onSocialSessionEndInterstitial={tryInterstitialAtSocialSessionEnd}
            onRecordShussekiGamePlay={recordShussekiGamePlay}
          />
        )}
      </Suspense>

      <GameNarrator
        message={narration}
        isVisible={isMultiplay && !!roomId && (screen === 'select' || screen === 'game')}
        reserveBottomStatusInset={
          screen !== 'quiet-room' &&
          screen !== 'slide-puzzle' &&
          screen !== 'othello' &&
          screen !== 'select' &&
          screen !== 'game' &&
          screen !== 'seat-selection'
        }
      />

      {screen === 'select' && (
        <SelectScreen
          difficulty={difficulty}
          onSetDifficulty={(d) => {
            vibrate(5);
            setDifficulty(d);
          }}
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
          onInterstitialNaturalBreak={tryInterstitialAtNaturalBreak}
          language={language}
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
          onBackToTitle={async () => {
            if (isMultiplay) {
              await tryInterstitialAtSocialSessionEnd();
            } else {
              await tryInterstitialAtNaturalBreak();
            }
            handleBackToTitle();
          }}
        />
      )}

      <Suspense fallback={<RakudaRouteFallback />}>
        {screen === 'game' && (
          <GameScreen
            gameState={gameState}
            onUpdateFound={onUpdateFound}
            onBack={async () => {
              vibrate(10);
              if (isMultiplay || (isSyncMode && !!roomId)) {
                setScreen('select');
                if (isSyncMode && !isMultiplay && syncFromHundredRooms && !!roomId) {
                  void onOpenHundredHub({ focusCreateForm: false });
                }
                return;
              }
              await tryInterstitialAtNaturalBreak();
              if (isSyncMode && !isMultiplay && syncFromHundredRooms && !!roomId) {
                setScreen('select');
                void onOpenHundredHub({ focusCreateForm: false });
                return;
              }
              setScreen('select');
            }}
            onBackToBoard={async () => {
              setScreen('select');
              await onOpenHundredHub({ focusCreateForm: false });
            }}
            onBackToRecruitBoard={async () => {
              vibrate(10);
              if (isMultiplay || (isSyncMode && !!roomId)) {
                await tryInterstitialAtSocialSessionEnd();
              } else {
                await tryInterstitialAtNaturalBreak();
              }
              setSeed('');
              setRoomId(null);
              setScreen('seat-selection');
              markHundredRecruitSeen?.();
              window.location.assign(
                sanjuuRecruitBoardUrlWithRakudaProfile({ emoji: userEmoji, nickname })
              );
            }}
            onBackToTitle={async () => {
              if (isMultiplay || (isSyncMode && !!roomId)) {
                await tryInterstitialAtSocialSessionEnd();
              } else {
                await tryInterstitialAtNaturalBreak();
              }
              handleBackToTitle();
            }}
            showToast={setNotification}
            onSaveHistory={handleSaveHistory}
            vibrate={vibrate}
            language={language}
            isOnline={isOnline}
            onClear={handleClear}
            onClearSeed={() => {
              setSeed('');
              setRoomId(null);
            }}
            userId={user.user_id}
            onNextProblem={() => {
              // みんなであそぶ（hundred_rooms）中は「次の問題」でソロ盤面を生成すると、
              // hundred_rooms の購読が上書きして前の foundWords が復活し「全てのこたえ」が帯付きになる事故が起きる。
              // この導線は掲示板へ戻す（次の問題はホスト側で新しい募集/盤面を開始）。
              if (isSyncMode && !isMultiplay && syncFromHundredRooms && !!roomId) {
                setSeed('');
                setRoomId(null);
                setScreen('select');
                void onOpenHundredHub({ focusCreateForm: false });
                return;
              }
              if (gameState.category) startNewGame(gameState.category, undefined, gameState.difficulty, gameState.isKatakana);
            }}
            seed={seed}
            proCode={
              gameState.category && gameState.actualSeed !== undefined
                ? `${gameState.category.category}-${String.fromCharCode(65 + gameState.difficulty)}-${gameState.actualSeed}`
                : undefined
            }
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
            onRakudaRoboReplay={onRakudaRoboReplay}
            streamMode={streamMode}
          />
        )}
      </Suspense>

      <HundredRecruitNewPopup
        open={
          showNewRecruitPopup &&
          hundredRecruitHasNew &&
          (screen === 'seat-selection' || screen === 'slide-puzzle' || screen === 'othello')
        }
        userEmoji={userEmoji}
        nickname={nickname}
        onDismiss={dismissNewRecruitPopup}
      />
    </>
  );
};

export default AppRouter;
