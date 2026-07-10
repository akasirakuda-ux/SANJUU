
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import SeatSelection from '../pages/SeatSelection';
import SelectScreen from './SelectScreen';
import GameNarrator from './GameNarrator';
import { MASTER, isWordCategoryPaused } from '../constants';
import { vibrate } from '../lib/utils';
import { audioService } from '../services/audioService';
import type { ScreenType, UserAccount, LogEntry } from '../types';

import { saveHundredRestoreForRoom } from '../lib/hundredRejoin';
import { clearHundredRestoreSession } from '../lib/rakudaHundredRestore';
import {
  getRakudaScreenMeta,
  sanjuuRecruitBoardUrlForHundredRecruit,
  type QuietImmersiveHistoryKind,
  usesQuietImmersiveHistoryScreen,
} from '../lib/rakudaHubShell';
import { lazyWithReload } from '../lib/lazyWithReload';
import { markSocialPlayAdSessionActive } from '../lib/socialPlayAdSession';
import HundredRecruitNewPopup from './HundredRecruitNewPopup';
import GomokuTrialPopup from './GomokuTrialPopup';
import RelayStoryTrialPopup from './RelayStoryTrialPopup';
import { markGomokuTrialPopupDismissed, shouldShowGomokuTrialPopup } from '../lib/gomokuTrialPopup';
import {
  markRelayStoryTrialPopupDismissed,
  shouldShowRelayStoryTrialPopup,
} from '../lib/relayStoryTrialPopup';
import { checkOuenNoteAccess, ouenNoteAccessDeniedMessage } from '../lib/ouenNoteGate';
import { isRenrakuAdmin } from '../lib/renrakuAdmin';

const GameScreen = lazyWithReload(() => import('./GameScreen'));
const QuietRoom = lazyWithReload(() => import('./QuietRoom'));
const SlidePuzzleGame = lazyWithReload(() => import('../games/slide-puzzle/SlidePuzzleGame'));
const OthelloGame = lazyWithReload(() => import('../games/othello/OthelloGame'));
const GomokuGame = lazyWithReload(() => import('../games/gomoku/GomokuGame'));
const RelayStoryScreen = lazyWithReload(() => import('../games/relay-story/RelayStoryScreen'));
const OuenNoteScreen = lazyWithReload(() => import('../components/OuenNote/OuenNoteScreen'));
const SudokuGame = lazyWithReload(() => import('../games/sudoku/SudokuGame'));

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
  tryInterstitialAtHundredPickupClear: () => Promise<void>;
  tryInterstitialAtSudokuClear: () => Promise<void>;
  handleClear: () => void;
  narration: string;
  difficulty: number;
  setDifficulty: (d: number) => void;
  clearsCount: number;
  setShowRenrakucho: (show: boolean) => void;
  onUpdateFound: (word: string, start: any, end: any, isHint?: boolean) => void;
  syncFromHundredRooms: boolean;
  hundredRoster: import('../lib/hundredPlayerPresence').HundredRosterPlayer[];
  /** hundred_rooms.hostUid（みんなであそぶでホストがゲーム画面を離れるときの確認用） */
  hundredRoomHostUid: string | null;
  /** 現行お題の開始（ロボ常設の参加者フィルタ用） */
  hundredRoomStartedAt?: unknown;
  hundredRoomLastFoundAt?: unknown;
  hundredRoomUpdatedAt?: unknown;
  onHundredRoomFinished: (reason: 'timeout' | 'cleared') => void | Promise<void>;
  onRakudaRoboReplay?: () => Promise<boolean>;
  onRoboPickupLoungeAutoRefresh?: () => void | Promise<void>;
  ensureAuth: () => Promise<void>;
  hasActiveRecruitments: boolean;
  /** トップハブ: hundred_public に最終閲覧より新しい募集がある */
  hundredRecruitHasNew?: boolean;
  markHundredRecruitSeen?: () => void;
  /** トップハブ: 参加可能なリバーシ募集がある */
  reversiRecruitHasOpen?: boolean;
  /** トップハブ: 自分のリバーシ募集が待機中 */
  reversiRecruitHostWaiting?: boolean;
  /** トップハブ: 参加可能な五目並べ募集がある */
  gomokuRecruitHasOpen?: boolean;
  /** トップハブ: 自分の五目並べ募集が待機中 */
  gomokuRecruitHostWaiting?: boolean;
  viewerCount?: number;
  /** トップハブ: いまここにいる人（絵文字のみ・らくだロボ除く） */
  hubPresencePeers?: readonly import('../hooks/usePresence').HubPresencePeer[];
  /** トップハブ: 累計来場者数 */
  hubVisitorTotal?: number;
  greenGateActive?: boolean;
  shussekiRegular?: boolean;
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
  /** メインハブ「ちょっと誰かに…」未読バッジ */
  ouenNoteHasUnread?: boolean;
  /** ローカル複数アカウント（ハブ右上の切替用） */
  accounts: UserAccount[];
  activeUserId: string;
  switchAccount: (userId: string) => void;
  createAccount: () => string;
  /** 配信モード（軽量化） */
  streamMode?: boolean;
  /** 盤面の座標表示（配信モードと別） */
  coordOverlayEnabled?: boolean;
  /** 管理者・配信モード時のひと言探し「配信中」バッジ切替UI */
  adminStreamLiveBadgeControl?: boolean;
  streamLiveBadgeEnabled?: boolean;
  setStreamLiveBadgeEnabled?: (enabled: boolean) => void;
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
  /** しゅっせき簿：その日初めて遊んだとき 1、同じ日の2回目以降 0 */
  recordShussekiGamePlay: () => number;
  setSyncFromHundredRooms?: (v: boolean) => void;
  leaveCurrentHundredRoom?: () => Promise<void>;
  hundredWaitHeadlessState?: import('../lib/hundredWaitHeadless').HundredWaitHeadlessState | null;
  onHundredHostStart?: () => void;
  onHundredJoinRetry?: () => void;
  endHundredWaitSession?: () => void;
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
  tryInterstitialAtHundredPickupClear,
  tryInterstitialAtSudokuClear,
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
  hundredRoomStartedAt,
  hundredRoomLastFoundAt,
  hundredRoomUpdatedAt,
  onHundredRoomFinished,
  onRakudaRoboReplay,
  onRoboPickupLoungeAutoRefresh,
  ensureAuth,
  hasActiveRecruitments,
  hundredRecruitHasNew = false,
  markHundredRecruitSeen,
  reversiRecruitHasOpen = false,
  reversiRecruitHostWaiting = false,
  gomokuRecruitHasOpen = false,
  gomokuRecruitHostWaiting = false,
  viewerCount,
  hubPresencePeers,
  hubVisitorTotal,
  greenGateActive = false,
  shussekiRegular = false,
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
  ouenNoteHasUnread,
  accounts,
  activeUserId,
  switchAccount,
  createAccount,
  streamMode = false,
  coordOverlayEnabled = false,
  adminStreamLiveBadgeControl = false,
  streamLiveBadgeEnabled = false,
  setStreamLiveBadgeEnabled,
  showRenrakucho = false,
  logs,
  addLog,
  recordShussekiGamePlay,
  setSyncFromHundredRooms,
  leaveCurrentHundredRoom,
  hundredWaitHeadlessState = null,
  onHundredHostStart,
  onHundredJoinRetry,
  endHundredWaitSession,
}) => {
  const [quietSkipIntro, setQuietSkipIntro] = useState(false);
  const [showNewRecruitPopup, setShowNewRecruitPopup] = useState(false);
  const [showGomokuTrialPopup, setShowGomokuTrialPopup] = useState(false);
  const [showRelayStoryTrialPopup, setShowRelayStoryTrialPopup] = useState(false);
  const quietImmersivePopRef = useRef(false);

  const suppressHundredRecruitPopup =
    screen === 'game' && isSyncMode && !!roomId && syncFromHundredRooms;

  useEffect(() => {
    if (suppressHundredRecruitPopup) {
      setShowNewRecruitPopup(false);
      return;
    }
    if (hundredRecruitHasNew) setShowNewRecruitPopup(true);
  }, [hundredRecruitHasNew, suppressHundredRecruitPopup]);

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

  const dismissGomokuTrialPopup = useCallback(() => {
    markGomokuTrialPopupDismissed();
    setShowGomokuTrialPopup(false);
  }, []);

  const dismissRelayStoryTrialPopup = useCallback(() => {
    markRelayStoryTrialPopupDismissed();
    setShowRelayStoryTrialPopup(false);
  }, []);

  const openGomokuFromHub = useCallback(() => {
    vibrate(10);
    pushQuietImmersiveHistory('gomoku');
    setScreen('gomoku');
  }, [setScreen]);

  const openRelayStoryFromHub = useCallback(() => {
    vibrate(10);
    pushQuietImmersiveHistory('relay-story');
    setScreen('relay-story');
  }, [setScreen]);

  const openOuenNoteFromHub = useCallback(() => {
    const access = checkOuenNoteAccess({
      firebaseUser: firebaseUser ?? null,
      shusseki: {
        completedDates: user.completedDates,
        specialDates: user.specialDates,
        dailyClearCounts: user.dailyClearCounts,
      },
      isAdmin: isRenrakuAdmin(firebaseUser ?? null),
    });
    if (!access.ok) {
      window.dispatchEvent(
        new CustomEvent('SHOW_TOAST', {
          detail: ouenNoteAccessDeniedMessage(access.reason),
        }),
      );
      return;
    }
    vibrate(10);
    pushQuietImmersiveHistory('ouen-note');
    setScreen('ouen-note');
  }, [firebaseUser, setScreen, user.completedDates, user.specialDates, user.dailyClearCounts]);

  useEffect(() => {
    if (screen !== 'seat-selection' || showNewRecruitPopup) return;
    if (!shouldShowGomokuTrialPopup()) return;
    setShowGomokuTrialPopup(true);
  }, [screen, showNewRecruitPopup]);

  useEffect(() => {
    if (screen !== 'seat-selection' || showNewRecruitPopup || showGomokuTrialPopup) return;
    if (!shouldShowRelayStoryTrialPopup()) return;
    setShowRelayStoryTrialPopup(true);
  }, [screen, showNewRecruitPopup, showGomokuTrialPopup]);

  const tryGomokuFromTrialPopup = useCallback(() => {
    markGomokuTrialPopupDismissed();
    setShowGomokuTrialPopup(false);
    openGomokuFromHub();
  }, [openGomokuFromHub]);

  const tryRelayStoryFromTrialPopup = useCallback(() => {
    markRelayStoryTrialPopupDismissed();
    setShowRelayStoryTrialPopup(false);
    openRelayStoryFromHub();
  }, [openRelayStoryFromHub]);

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

  /** ひと言探し共同: 一旦退室して募集へ（再参加可） */
  const exitHundredPlayToHub = useCallback(
    async (playRoomId: string | null) => {
      vibrate(10);
      if (playRoomId) {
        await leaveCurrentHundredRoom?.();
        await saveHundredRestoreForRoom(playRoomId);
      }
      endHundredWaitSession?.();
      setRoomId(null);
      setSyncFromHundredRooms?.(false);
      setSeed('');
      setScreen('select');
      await onOpenHundredHub({ focusCreateForm: false });
    },
    [
      leaveCurrentHundredRoom,
      endHundredWaitSession,
      setRoomId,
      setSyncFromHundredRooms,
      setSeed,
      setScreen,
      onOpenHundredHub,
    ]
  );

  const handleBackToTitle = useCallback(() => {
    vibrate(10);
    void (async () => {
      if (syncFromHundredRooms && roomId) {
        await leaveCurrentHundredRoom?.();
      }
      endHundredWaitSession?.();
      clearHundredRestoreSession();
      setClearsCount(0);
      setIsMultiplay(false);
      setIsSyncMode(false);
      setSyncFromHundredRooms?.(false);
      setSeed('');
      setRoomId(null);
      setIsReady(false);
      setIsRoomCreator(false);
      onCancelRecruit();
      setScreen('seat-selection');
    })();
  }, [
    setScreen,
    setClearsCount,
    setIsMultiplay,
    setIsSyncMode,
    setSyncFromHundredRooms,
    setSeed,
    setRoomId,
    setIsReady,
    setIsRoomCreator,
    onCancelRecruit,
    syncFromHundredRooms,
    roomId,
    leaveCurrentHundredRoom,
  ]);

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
            try {
              await onOpenKeijiban();
            } catch (e) {
              console.warn('[AppRouter] onOpenKeijiban failed', e);
            }
          }}
          onOpenRenrakuchoAdmin={async () => {
            vibrate(10);
            try {
              await onOpenRenrakuchoAdmin();
            } catch (e) {
              console.warn('[AppRouter] onOpenRenrakuchoAdmin failed', e);
            }
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
          onOpenSudoku={() => {
            vibrate(10);
            pushQuietImmersiveHistory('sudoku');
            setScreen('sudoku');
          }}
          onOpenOthello={() => {
            vibrate(10);
            pushQuietImmersiveHistory('othello');
            setScreen('othello');
          }}
          onOpenGomoku={() => {
            openGomokuFromHub();
          }}
          onOpenRelayStory={() => {
            openRelayStoryFromHub();
          }}
          onOpenOuenNote={() => {
            void openOuenNoteFromHub();
          }}
          onOpenSettings={() => { vibrate(10); setShowSettingsModal(true); }}
          isOnline={isOnline}
          hasActiveRecruitments={hasActiveRecruitments}
          hundredRecruitHasNew={hundredRecruitHasNew}
          reversiRecruitHasOpen={reversiRecruitHasOpen}
          reversiRecruitHostWaiting={reversiRecruitHostWaiting}
          gomokuRecruitHasOpen={gomokuRecruitHasOpen}
          gomokuRecruitHostWaiting={gomokuRecruitHostWaiting}
          renrakuchoHasUnread={renrakuchoHasUnread}
          ouenNoteHasUnread={ouenNoteHasUnread}
          viewerCount={viewerCount}
          hubPresencePeers={hubPresencePeers}
          hubVisitorTotal={hubVisitorTotal}
          greenGateActive={greenGateActive}
          shussekiRegular={shussekiRegular}
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
            streamMode={streamMode}
            coordOverlayEnabled={coordOverlayEnabled}
          />
        )}

        {screen === 'gomoku' && (
          <GomokuGame
            onBack={handleBackToTitle}
            nickname={nickname}
            userEmoji={userEmoji}
            firebaseUser={firebaseUser}
            addLog={addLog}
            logs={logs}
            onGoogleLogin={handleGoogleLogin}
            onRecordShussekiGamePlay={recordShussekiGamePlay}
            streamMode={streamMode}
            coordOverlayEnabled={coordOverlayEnabled}
          />
        )}

        {screen === 'relay-story' && (
          <RelayStoryScreen
            onBack={handleBackToTitle}
            nickname={nickname}
            userEmoji={userEmoji}
            firebaseUser={firebaseUser}
            onGoogleLogin={handleGoogleLogin}
          />
        )}

        {screen === 'ouen-note' && (
          <OuenNoteScreen
            onBack={() => {
              vibrate(10);
              window.history.back();
            }}
            nickname={nickname}
            userEmoji={userEmoji}
            firebaseUser={firebaseUser}
            onGoogleLogin={handleGoogleLogin}
          />
        )}

        {screen === 'sudoku' && (
          <SudokuGame
            onBack={() => {
              vibrate(10);
              handleBackToTitle();
            }}
            onClearInterstitial={tryInterstitialAtSudokuClear}
          />
        )}
      </Suspense>

      <GameNarrator
        message={narration}
        isVisible={isMultiplay && !!roomId && (screen === 'select' || screen === 'game')}
        reserveBottomStatusInset={
          screen !== 'quiet-room' &&
          screen !== 'slide-puzzle' &&
          screen !== 'sudoku' &&
          screen !== 'othello' &&
          screen !== 'gomoku' &&
          screen !== 'relay-story' &&
          screen !== 'ouen-note' &&
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
            if (isWordCategoryPaused(cat.category)) return;
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
          onClearSeed={async () => {
            if (syncFromHundredRooms && roomId) {
              await leaveCurrentHundredRoom?.();
            }
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
              if (isSyncMode && !isMultiplay && syncFromHundredRooms && !!roomId) {
                await exitHundredPlayToHub(roomId);
                return;
              }
              vibrate(10);
              if (isMultiplay || (isSyncMode && !!roomId)) {
                setScreen('select');
                return;
              }
              await tryInterstitialAtNaturalBreak();
              setScreen('select');
            }}
            onBackToBoard={async () => {
              if (roomId) {
                await exitHundredPlayToHub(roomId);
                return;
              }
              setScreen('select');
              await onOpenHundredHub({ focusCreateForm: false });
            }}
            onBackToRecruitBoard={async () => {
              vibrate(10);
              clearHundredRestoreSession();
              await leaveCurrentHundredRoom?.();
              setSeed('');
              setRoomId(null);
              setSyncFromHundredRooms?.(false);
              setScreen('seat-selection');
              markHundredRecruitSeen?.();
              window.location.assign(
                sanjuuRecruitBoardUrlForHundredRecruit({
                  emoji: userEmoji,
                  nickname,
                  hundredMode: 'pickup',
                })
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
            hundredRoomStartedAt={hundredRoomStartedAt}
            hundredRoomLastFoundAt={hundredRoomLastFoundAt}
            hundredRoomUpdatedAt={hundredRoomUpdatedAt}
            currentFirebaseUid={firebaseUser?.uid ?? null}
            onHundredRoomFinished={onHundredRoomFinished}
            onRakudaRoboReplay={onRakudaRoboReplay}
            onRoboPickupLoungeAutoRefresh={onRoboPickupLoungeAutoRefresh}
            onLeaveHundredRoom={leaveCurrentHundredRoom}
            onHundredPickupClearInterstitial={tryInterstitialAtHundredPickupClear}
            streamMode={streamMode}
            coordOverlayEnabled={coordOverlayEnabled}
            adminStreamLiveBadgeControl={adminStreamLiveBadgeControl}
            streamLiveBadgeEnabled={streamLiveBadgeEnabled}
            onToggleStreamLiveBadge={
              setStreamLiveBadgeEnabled
                ? () => setStreamLiveBadgeEnabled(!streamLiveBadgeEnabled)
                : undefined
            }
            hundredWaitHeadlessState={hundredWaitHeadlessState}
            onHundredHostStart={onHundredHostStart}
            onHundredJoinRetry={onHundredJoinRetry}
          />
        )}
      </Suspense>

      <HundredRecruitNewPopup
        open={
          showNewRecruitPopup &&
          hundredRecruitHasNew &&
          !suppressHundredRecruitPopup &&
          (screen === 'seat-selection' ||
            screen === 'slide-puzzle' ||
            screen === 'sudoku' ||
            screen === 'othello' ||
            screen === 'gomoku' ||
            screen === 'relay-story')
        }
        userEmoji={userEmoji}
        nickname={nickname}
        onDismiss={dismissNewRecruitPopup}
      />

      <GomokuTrialPopup
        open={showGomokuTrialPopup && screen === 'seat-selection' && !showNewRecruitPopup}
        onDismiss={dismissGomokuTrialPopup}
        onTry={tryGomokuFromTrialPopup}
      />

      <RelayStoryTrialPopup
        open={
          showRelayStoryTrialPopup &&
          screen === 'seat-selection' &&
          !showNewRecruitPopup &&
          !showGomokuTrialPopup
        }
        onDismiss={dismissRelayStoryTrialPopup}
        onTry={tryRelayStoryFromTrialPopup}
      />
    </>
  );
};

export default AppRouter;
