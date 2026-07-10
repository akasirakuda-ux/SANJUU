import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useUser } from './useUser';
import { useAuth } from './useAuth';
import { useLogs } from './useLogs';
import { useGame } from './useGame';
import { usePresence } from './usePresence';
import { useHubVisitorTotal } from './useHubVisitorTotal';
import { useWakeLock } from './useWakeLock';
import { usePwa } from './usePwa';
import { useUrlParams } from './useUrlParams';
import { useMultiplayer } from './useMultiplayer';
import { sanitizeRkUsersCloudPayload } from '../lib/rkUsersCloudSync';
import { handleFirestoreError, stringToSeed, vibrate, encodeProCode, decodeProCode } from '../lib/utils';
import { MASTER, isWordCategoryPaused } from '../constants';
import { audioService } from '../services/audioService';
import { adService, setInterstitialUiHandler, type GateAdPresentation } from '../services/adService';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { USER_MODERATION_COLLECTION } from '../lib/userModeration';
import { isProtectedRenrakuAdminUid } from '../constants/renrakuAdmin';
import { isRenrakuAdmin } from '../lib/renrakuAdmin';
import { todayKeyJst } from '../lib/dateKey';
import { saveHundredRestoreForRoom } from '../lib/hundredRejoin';
import { gridRowsFromFirestore, hundredRoomBoardReady, hundredRoomCanEnterGame } from '../lib/hundredRoomBoard';
import { hundredBoardKeySignature } from '../lib/hundredBoardSync';
import { isRoboPickupLoungeRoomId, ROBO_PICKUP_LOUNGE_COLS, ROBO_PICKUP_LOUNGE_ROWS, resolveRoboPickupLoungeProfile, roboLoungeLoadedGridMismatch } from '../lib/roboPickupLoungeConfig';
import {
  ensureRoboPickupLoungeRoomDoc,
  refreshRoboPickupLoungeSeedIfNeeded,
  refreshRoboPickupLoungeBoardSizeIfNeeded,
} from '../lib/roboPickupLoungeRefresh';
import { leaveHundredRoomPlayer } from '../lib/hundredRoomPlayer';
import { getTotalStampCount, syncSpecialDates } from '../lib/shussekiDailyClears';
import {
  gatherRecoveredShussekiDates,
  persistShussekiDatesBackup,
  uniqShussekiDateKeys,
} from '../lib/shussekiRecovery';
import { shussekiMilestoneToastAfterNewStamp } from '../lib/shussekiMilestones';
import { isShussekiRegularUser } from '../lib/shussekiRegularEmoji';
import {
  hrefWithPathname,
  persistStreamModeEnabled,
  readStreamModeEnabled,
  syncStreamModeFromUrlToStorage,
} from '../lib/rakudaStreamMode';
import { persistCoordOverlayEnabled, readCoordOverlayEnabled } from '../lib/rakudaCoordOverlay';
import {
  persistStreamLiveBadgeEnabled,
  readStreamLiveBadgeEnabled,
  RK_STREAM_LIVE_BADGE_LABEL,
} from '../lib/rakudaStreamLiveBadge';
import { publishYoutubeLiveBannerPulse } from '../lib/rakudaLiveBannerPulse';
import {
  closesGlobalOverlays,
  computeStampsFromLogs,
  ensureRenrakuAdminFirestoreAuth,
  firestoreLikeToMillis,
  INTERSTITIAL_ARM_MS,
  INTERSTITIAL_MIN_GAP_MS,
  isRenrakuAdmin,
  migrateStampArrays,
  recordShussekiGamePlay as applyShussekiGamePlayRecord,
  RAKUDA_HUNDRED_CREATE_FRAGMENT,
  readLastInterstitialDismissedMs,
  STOPS_HUB_BGM,
  suppressesQuietImmersiveGlobalChrome,
  waitForGoogleSessionRestore,
  writeLastInterstitialDismissedMs,
  resolveAuthUserForLoginDisplay,
} from '../lib/rakudaHubShell';
import { useRenrakuchoUnreadBadge } from './useRenrakuchoUnreadBadge';
import { useOuenNoteUnreadBadge } from './useOuenNoteUnreadBadge';
import { OUEN_NOTE_HUB_LIVE } from '../lib/ouenNoteConfig';
import {
  TILE_MATCH_HUNDRED_MODE,
  type HundredStartOpts,
} from '../lib/tileMatch/config';
import { markHundredRecruitSeenNow, useHundredRecruitHubAlert } from './useHundredRecruitHubAlert';
import { useReversiRecruitHubAlert } from './useReversiRecruitHubAlert';
import { useGomokuRecruitHubAlert } from './useGomokuRecruitHubAlert';
import {
  loadReversiPendingHostRoomCode,
  REVERSI_PENDING_HOST_CHANGED_EVENT,
} from '../lib/reversiConfig';
import { subscribeReversiRoom } from '../lib/reversiRooms';
import {
  GOMOKU_PENDING_HOST_CHANGED_EVENT,
  loadGomokuPendingHostRoomCode,
} from '../lib/gomokuConfig';
import { subscribeGomokuRoom } from '../lib/gomokuRooms';
import { saveBoardGamePendingJoinRoomCode, type BoardGameRecruitKind } from '../lib/boardGameRenrakuRecruit';
import AppRouter from '../components/AppRouter';
import type { AppLayoutProps } from '../components/AppLayout';
import type { AppHeaderProps } from '../components/AppHeader';
import type { HundredPublicRecruit, RenrakuchoPublicScreenState } from '../components/Renrakucho/types';
import type {
  HundredWaitHeadlessController,
  HundredWaitHeadlessState,
} from '../lib/hundredWaitHeadless';
import { HUNDRED_WAIT_HEADLESS_IDLE } from '../lib/hundredWaitHeadless';
import {
  clearHundredRestoreSession,
  loadHundredRestoreSession,
  saveHundredRestoreSession,
} from '../lib/rakudaHundredRestore';
import { sendGaPageView } from '../lib/initGa';
import { trackRakudaScreen } from '../lib/rakudaGaEvents';
import { readRakudaProfileQuery } from '../lib/sanjuuWebOrigin';
import {
  activateGreenGateSubscription,
  applyGateNicknameCssColor,
  gateAdSequenceForGate,
  resolveActiveRakudaGate,
  applyFirstVisitDefaultBlueGate,
  dismissWelcomeIntro,
  ensureDefaultFreeGateWhenGreenExpired,
  shouldShowGateOverlay,
  shouldSuppressAdsForGate,
  isGreenGateActive,
  syncLocalGreenGateFromServer,
  writeRakudaGateChoice,
  type RakudaGateId,
} from '../lib/rakudaGate';
import { RAKUDA_SUPPORT_GATE_LABEL } from '../constants/rakudaSupportGateLabels';
import { isGreenGateEntranceClosed, isGreenGateStripeEnabled } from '../lib/greenGateStripeConfig';
import {
  createGreenGateCheckoutSession,
  createGreenGatePortalSession,
  greenGatePortalErrorJa,
  syncGreenGateAfterCheckout,
  syncGreenGateBillingFromStripe,
  markSettingsBillingLoginIntent,
  consumeSettingsBillingLoginIntent,
} from '../lib/greenGateStripeClient';
import {
  greenPassRedeemErrorJa,
  isGreenPassEntryPath,
  normalizeGreenPassCodeInput,
  redeemGreenPass,
} from '../lib/greenGatePassConfig';
import { resolveDonationThanksOnLoad } from '../lib/donationReturn';
import {
  cancelSocialPlayAdDeferral,
  settleSocialPlayAdSession,
  shouldDeferInterstitialDuringSocialPlay,
} from '../lib/socialPlayAdSession';
import { useGreenGateFirestore } from './useGreenGateFirestore';
import { useRoboPickupLoungeAutoRefresh } from './useRoboPickupLoungeAutoRefresh';

const RENRAKU_RESUME_KEY = 'rk_renraku_resume';

function isHundredPathNorm(pathNorm: string): boolean {
  return pathNorm === '/hundred' || pathNorm.endsWith('/hundred');
}

function isKeijibanPathNorm(pathNorm: string): boolean {
  return pathNorm === '/keijiban' || pathNorm.endsWith('/keijiban');
}

/** `/hundred#rk-hundred-create`（問題を作る直リンク） */
function locationHasHundredCreateHash(): boolean {
  try {
    const h = window.location.hash;
    return (
      h === `#${RAKUDA_HUNDRED_CREATE_FRAGMENT}` ||
      h.endsWith(`#${RAKUDA_HUNDRED_CREATE_FRAGMENT}`)
    );
  } catch {
    return false;
  }
}

function locationHasJoinHundredPublic(): boolean {
  try {
    return !!(new URLSearchParams(window.location.search).get('joinHundredPublic') || '').trim();
  } catch {
    return false;
  }
}

/** スーパーリロード時に待機室・盤面へ戻すための復元（募集一覧を見る用途では使わない） */
function hundredPlayRestoreForColdLoad() {
  const restored = loadHundredRestoreSession();
  if (!restored) return null;
  if (restored.publicScreen === 'hundred-wait' || restored.publicScreen === 'hundred-board') {
    return restored;
  }
  return null;
}

export const useAppShell = () => {
  const [isEntered, setIsEntered] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  const language = 'ja';

  const [showGateSelection, setShowGateSelection] = useState(() => {
    applyFirstVisitDefaultBlueGate();
    return shouldShowGateOverlay();
  });
  const [rakudaGate, setRakudaGate] = useState<RakudaGateId | null>(() => {
    applyFirstVisitDefaultBlueGate();
    return resolveActiveRakudaGate();
  });

  /** nickname / userEmoji は useUser 内で保持（word_search_user_v2 と同期）し、AppRouter・Renrakucho へ渡す */
  const {
    user,
    setUser,
    nickname,
    setNickname,
    userEmoji,
    setUserEmoji,
    accounts,
    activeUserId,
    switchAccount,
    createAccount,
  } = useUser();

  /** 三十募集一覧などから `rkEmoji` / `rkNick` 付きで戻ったとき、未設定なら反映する */
  useEffect(() => {
    const { emoji, nickname: urlNick } = readRakudaProfileQuery();
    if (!emoji || !urlNick) return;
    if (!(nickname || '').trim()) setNickname(urlNick);
    if (!(userEmoji || '').trim()) setUserEmoji(emoji);
  }, [nickname, userEmoji, setNickname, setUserEmoji]);

  const {
    firebaseUser,
    effectiveFirebaseUser,
    googleUser,
    isAuthReady,
    ensureAuth,
    handleGoogleLogin,
    handleGoogleLoginViaPopup,
    handleGoogleLoginViaRedirect,
    handleGoogleLogout,
  } = useAuth(language, setNotification);
  const authUserForUi = useMemo(
    () => resolveAuthUserForLoginDisplay(effectiveFirebaseUser ?? firebaseUser, googleUser),
    [effectiveFirebaseUser, firebaseUser, googleUser],
  );
  const greenGateServer = useGreenGateFirestore(authUserForUi?.uid);
  const serverGreenUntilMs = greenGateServer.greenUntilMs;
  const serverGreenUntilMsRef = useRef(serverGreenUntilMs);
  serverGreenUntilMsRef.current = serverGreenUntilMs;
  const billingSyncUidRef = useRef<string | null>(null);
  const stripeGreenEnabled = isGreenGateStripeEnabled();
  const [greenCheckoutBusy, setGreenCheckoutBusy] = useState(false);
  const [greenPortalBusy, setGreenPortalBusy] = useState(false);
  const [greenPassBusy, setGreenPassBusy] = useState(false);
  const [greenPassStatusMessage, setGreenPassStatusMessage] = useState<string | null>(null);
  const [greenPassStatusTone, setGreenPassStatusTone] = useState<'ok' | 'error' | 'neutral'>('neutral');
  const { logs, addLog } = useLogs(authUserForUi, handleFirestoreError);

  const isRenrakuAdminUser = useMemo(() => isRenrakuAdmin(authUserForUi), [authUserForUi]);
  const renrakuchoHasUnread = useRenrakuchoUnreadBadge(isRenrakuAdminUser, isAuthReady);
  const ouenNoteHasUnread = useOuenNoteUnreadBadge(
    OUEN_NOTE_HUB_LIVE && isAuthReady && !!authUserForUi?.uid,
    authUserForUi?.uid ?? null,
  );

  const [puzzleSizeHintMessage, setPuzzleSizeHintMessage] = useState<string | null>(null);
  const puzzleHintTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const showPuzzleSizeHint = useCallback((message: string) => {
    if (puzzleHintTimeoutRef.current) window.clearTimeout(puzzleHintTimeoutRef.current);
    setPuzzleSizeHintMessage(message);
    puzzleHintTimeoutRef.current = window.setTimeout(() => {
      setPuzzleSizeHintMessage(null);
      puzzleHintTimeoutRef.current = null;
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (puzzleHintTimeoutRef.current) window.clearTimeout(puzzleHintTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    applyGateNicknameCssColor(rakudaGate);
  }, [rakudaGate]);

  useEffect(() => {
    syncLocalGreenGateFromServer(serverGreenUntilMs);
    ensureDefaultFreeGateWhenGreenExpired(serverGreenUntilMs);
    const active = resolveActiveRakudaGate(Date.now(), serverGreenUntilMs);
    setRakudaGate(active);
    setShowGateSelection(shouldShowGateOverlay());
  }, [serverGreenUntilMs]);

  /** ログイン後: Firestore に契約が無いとき Stripe から greenUntilMs を復旧 */
  useEffect(() => {
    const uid = authUserForUi?.uid;
    if (!stripeGreenEnabled || !isAuthReady || !uid) return;
    if (billingSyncUidRef.current === uid) return;
    if (serverGreenUntilMs != null && serverGreenUntilMs > Date.now()) {
      billingSyncUidRef.current = uid;
      return;
    }
    billingSyncUidRef.current = uid;
    void (async () => {
      try {
        const user = authUserForUi ?? auth.currentUser;
        if (!user) return;
        const token = await user.getIdToken();
        await syncGreenGateBillingFromStripe(token);
      } catch {
        /* ignore */
      }
    })();
  }, [stripeGreenEnabled, isAuthReady, authUserForUi, serverGreenUntilMs]);

  const gateSuppressAds = useMemo(
    () => shouldSuppressAdsForGate(undefined, serverGreenUntilMs),
    [rakudaGate, serverGreenUntilMs],
  );

  const {
    screen,
    setScreen,
    difficulty,
    setDifficulty,
    isMultiplay,
    setIsMultiplay,
    isSyncMode,
    setIsSyncMode,
    isReady,
    setIsReady,
    narration,
    seed,
    setSeed,
    isGenerating,
    setIsGenerating,
    roomId,
    setRoomId,
    syncShareRoomId,
    pendingRoomId,
    setPendingRoomId,
    roomStartTime,
    setRoomStartTime,
    gameState,
    setGameState,
    startNewGame,
    startSearchGame,
    startPickupSoloGame,
    handleRecordFinish,
    onUpdateFound,
    setSyncFromHundredRooms,
    syncFromHundredRooms,
    hundredRoster,
    hundredRoomHostUid,
    hundredRoomStartedAt,
    hundredRoomLastFoundAt,
    hundredRoomUpdatedAt,
    onHundredRoomFinished,
    onRakudaRoboReplay,
    onRoboPickupLoungeNext,
    onRoboPickupLoungeAutoRefresh,
  } = useGame(user, setUser, nickname, language, setNotification, handleFirestoreError, authUserForUi, isAuthReady, ensureAuth, userEmoji, showPuzzleSizeHint);

  useRoboPickupLoungeAutoRefresh(
    isAuthReady,
    screen === 'game' && isRoboPickupLoungeRoomId(roomId),
    roomId,
  );

  const [isRoomCreator, setIsRoomCreator] = useState(false);
  const [syncCountdown, setSyncCountdown] = useState(0);

  // IMPORTANT:
  // `useMultiplayer` is for normal multiplayer (`rooms/{roomId}`).
  // In "みんなであそぶ" we reuse `roomId` for `hundred_rooms/{roomId}`.
  // If we keep `useMultiplayer` running, it will subscribe/join `rooms/{roomId}` with a hundred id,
  // causing extra Firestore traffic and 429 retry storms right when the problem screen opens.
  const multiplayerRoomId = isMultiplay && !syncFromHundredRooms ? roomId : null;

  const {
    players: roomPlayers,
    isHost: isHostFromMultiplayer,
    roomHostId,
    roomStatus,
    toggleReady,
    updateRoomStatus,
  } = useMultiplayer(multiplayerRoomId, nickname, userEmoji, authUserForUi?.uid || null, isRoomCreator);

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDonationThanks, setShowDonationThanks] = useState(false);
  const [showInstructionModal, setShowInstructionModal] = useState(false);
  const [isBgmEnabled, setIsBgmEnabled] = useState(true);
  const isAdVisible = true;
  const setIsAdVisible = useCallback((_visible: boolean) => {
    // 固定バナー廃止に伴い no-op（連絡帳へ渡す互換のため残す）
  }, []);
  const [isStampCardOpen, setIsStampCardOpen] = useState(false);
  const [gateAdPresentation, setGateAdPresentation] = useState<GateAdPresentation | null>(null);
  const interstitialArmedRef = useRef(false);
  /** 2分経過後「次の自然な区切り」でリワード／全面を出してよい（メモリのみ） */
  const lastInterstitialDismissedMsRef = useRef(readLastInterstitialDismissedMs());
  const interstitialDismissWaitersRef = useRef<Array<() => void>>([]);

  const shussekiRegular = useMemo(
    () =>
      isShussekiRegularUser({
        completedDates: user.completedDates || [],
        specialDates: user.specialDates || [],
        dailyClearCounts: user.dailyClearCounts,
      }),
    [user.completedDates, user.specialDates, user.dailyClearCounts],
  );

  const [showRenrakucho, setShowRenrakuchoState] = useState(false);
  const leaveCurrentHundredRoom = useCallback(async () => {
    const rid = roomId;
    const uid = auth.currentUser?.uid;
    if (!rid || !uid) return;
    await leaveHundredRoomPlayer(rid, uid);
  }, [roomId]);

  useEffect(() => {
    if (!syncFromHundredRooms) return;
    const rid = roomId;
    const uid = auth.currentUser?.uid;
    if (!rid || !uid) return;
    const onPageHide = () => {
      void leaveHundredRoomPlayer(rid, uid);
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [syncFromHundredRooms, roomId]);
  const [renrakuchoMountKey, setRenrakuchoMountKey] = useState(0);
  const [renrakuchoInitialActiveTab, setRenrakuchoInitialActiveTab] = useState<'post' | 'public' | 'admin' | undefined>(
    undefined
  );
  const [renrakuchoInitialPublicScreen, setRenrakuchoInitialPublicScreen] = useState<
    RenrakuchoPublicScreenState | undefined
  >(undefined);
  const [renrakuchoInitialSelectedHundred, setRenrakuchoInitialSelectedHundred] =
    useState<HundredPublicRecruit | null>(null);
  const [hundredWaitRecruit, setHundredWaitRecruit] = useState<HundredPublicRecruit | null>(null);
  const [hundredWaitHeadlessState, setHundredWaitHeadlessState] =
    useState<HundredWaitHeadlessState>(HUNDRED_WAIT_HEADLESS_IDLE);
  const hundredWaitControllerRef = useRef<HundredWaitHeadlessController | null>(null);

  const endHundredWaitSession = useCallback(() => {
    setHundredWaitRecruit(null);
    setHundredWaitHeadlessState(HUNDRED_WAIT_HEADLESS_IDLE);
    hundredWaitControllerRef.current = null;
  }, []);

  const handleHundredWaitHeadlessState = useCallback((state: HundredWaitHeadlessState) => {
    setHundredWaitHeadlessState(state);
  }, []);

  const handleHundredWaitHeadlessController = useCallback((controller: HundredWaitHeadlessController | null) => {
    hundredWaitControllerRef.current = controller;
  }, []);

  const onHundredHostStart = useCallback(() => {
    hundredWaitControllerRef.current?.requestStart();
  }, []);

  const onHundredJoinRetry = useCallback(() => {
    hundredWaitControllerRef.current?.retryJoin();
  }, []);

  const handleHundredWaitSessionEnded = useCallback(() => {
    endHundredWaitSession();
    setSyncFromHundredRooms(false);
    setRoomId(null);
    setScreen('seat-selection');
  }, [endHundredWaitSession, setRoomId, setScreen, setSyncFromHundredRooms]);

  const beginHundredJoin = useCallback(
    (recruit: HundredPublicRecruit) => {
      const rid = recruit.roomId || '';
      if (!rid) return;
      setHundredWaitRecruit(recruit);
      saveHundredRestoreSession({ publicScreen: 'hundred-wait', selectedHundred: recruit });
      setIsMultiplay(false);
      setIsSyncMode(true);
      setSyncFromHundredRooms(true);
      setRoomId(rid);
      setShowRenrakuchoState(false);
      markHundredRecruitSeenNow();
      setScreen('game');
    },
    [
      setIsMultiplay,
      setIsSyncMode,
      setRoomId,
      setScreen,
      setSyncFromHundredRooms,
    ],
  );

  const setShowRenrakucho = useCallback((show: boolean) => {
    if (!show) {
      const p = window.location.pathname;
      const pNorm = p.replace(/\/+$/, '') || '/';
      if (
        pNorm === '/hundred' ||
        pNorm.endsWith('/hundred') ||
        pNorm === '/keijiban' ||
        pNorm.endsWith('/keijiban')
      ) {
        window.history.replaceState(null, '', hrefWithPathname('/'));
      }
    }
    setShowRenrakuchoState(show);
  }, []);

  const hundredRecruitHubEnabled =
    isAuthReady &&
    (screen === 'seat-selection' || screen === 'slide-puzzle' || screen === 'sudoku' || screen === 'othello' || screen === 'gomoku' || screen === 'relay-story' || screen === 'ouen-note') &&
    !showRenrakucho;
  const {
    hasActiveRecruits: hasActiveRecruitments,
    hasNewRecruits: hundredRecruitHasNew,
    markSeen: markHundredRecruitSeen,
  } = useHundredRecruitHubAlert(hundredRecruitHubEnabled);

  const { hasOpenRecruits: reversiRecruitHasOpen, hasMyHostRecruiting: reversiRecruitHostWaiting } =
    useReversiRecruitHubAlert(hundredRecruitHubEnabled, authUserForUi?.uid ?? null);

  const { hasOpenRecruits: gomokuRecruitHasOpen, hasMyHostRecruiting: gomokuRecruitHostWaiting } =
    useGomokuRecruitHubAlert(hundredRecruitHubEnabled, authUserForUi?.uid ?? null);

  const [clearsCount, setClearsCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [recruitMessageId, setRecruitMessageId] = useState<string | null>(null);
  const [recruitedAt, setRecruitedAt] = useState<string | null>(null);
  // hundredRoomId was only used by the removed legacy sync-hundred route

  const [streamMode, setStreamModeState] = useState(() => readStreamModeEnabled());
  const [coordOverlayEnabled, setCoordOverlayEnabledState] = useState(() => readCoordOverlayEnabled());
  const [streamLiveBadgeEnabled, setStreamLiveBadgeEnabledState] = useState(() =>
    readStreamLiveBadgeEnabled(),
  );

  const streamModeRef = useRef(streamMode);
  streamModeRef.current = streamMode;

  const rakudaGateRef = useRef(rakudaGate);
  rakudaGateRef.current = rakudaGate;

  const screenRef = useRef(screen);
  screenRef.current = screen;

  const gateAdPresentationRef = useRef(gateAdPresentation);
  gateAdPresentationRef.current = gateAdPresentation;

  // 全面広告: 永続化された「最後に閉じた時刻」で 2 分アームを更新
  useEffect(() => {
    lastInterstitialDismissedMsRef.current = readLastInterstitialDismissedMs();
    if (!streamMode && Date.now() - lastInterstitialDismissedMsRef.current >= INTERSTITIAL_ARM_MS) {
      interstitialArmedRef.current = true;
    }
  }, [streamMode]);

  useEffect(() => {
    if (streamMode) return;
    const id = window.setInterval(() => {
      const last = lastInterstitialDismissedMsRef.current;
      if (Date.now() - last >= INTERSTITIAL_ARM_MS) interstitialArmedRef.current = true;
    }, 10_000);
    return () => window.clearInterval(id);
  }, [streamMode]);

  // GA4: 画面 ID（メニュー以外の遷移・戻る含む）
  useEffect(() => {
    trackRakudaScreen(screen);
  }, [screen]);

  // GA4: SPA の画面遷移（pushState/replaceState/popstate）でも page_view を送る
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!import.meta.env.VITE_GA_MEASUREMENT_ID?.startsWith('G-')) return;

    sendGaPageView();

    const origPush = window.history.pushState;
    const origReplace = window.history.replaceState;
    const wrap = (fn: typeof window.history.pushState) =>
      function (this: History, ...args: Parameters<typeof window.history.pushState>) {
        const r = fn.apply(this, args);
        sendGaPageView();
        return r;
      };

    try {
      window.history.pushState = wrap(origPush);
      window.history.replaceState = wrap(origReplace);
    } catch {
      // ignore
    }

    const onPop = () => sendGaPageView();
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      try {
        window.history.pushState = origPush;
        window.history.replaceState = origReplace;
      } catch {
        // ignore
      }
    };
  }, []);

  // URL パラメータで入ったときは localStorage に反映して以後も維持する
  useEffect(() => {
    syncStreamModeFromUrlToStorage();
    setStreamModeState(readStreamModeEnabled());
  }, []);

  // 戻る/進むで ?stream=1 ブックマークに合わせる（?stream=0 では OFF にしない）
  useEffect(() => {
    const syncFromUrl = () => {
      syncStreamModeFromUrlToStorage();
      const enabled = readStreamModeEnabled();
      setStreamModeState((prev) => (prev === enabled ? prev : enabled));
    };
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  const enableHubPresence = useMemo(
    () => screen === 'seat-selection' && (!streamMode || isRenrakuAdminUser),
    [screen, streamMode, isRenrakuAdminUser],
  );

  // 配信モード中は一般利用者の購読を止める。管理者はトップで在籍絵文字を見られるようにする。
  const enableSitePresence = useMemo(
    () => !streamMode || isRenrakuAdminUser,
    [streamMode, isRenrakuAdminUser],
  );

  const { viewerCount, hubPresencePeers } = usePresence(
    nickname,
    userEmoji,
    enableSitePresence,
  );
  const hubVisitorTotal = useHubVisitorTotal(enableHubPresence);

  useEffect(() => {
    if (!enableSitePresence) return;
    void ensureAuth().catch(() => {
      /* fail-open */
    });
  }, [enableSitePresence, ensureAuth]);
  useWakeLock(screen);
  const { deferredPrompt, handleInstallClick, showInstallGuideModal, setShowInstallGuideModal } = usePwa();

  /**
   * Cross-device sync (Firestore) — keep costs low:
   * - read: once on login + occasionally on foreground (min interval)
   * - write: debounced (batch changes into one write)
   */
  const cloudUid = authUserForUi?.uid ?? null;
  const [isBanned, setIsBanned] = useState(false);
  const [banUserName, setBanUserName] = useState<string | null>(null);
  const [banReason, setBanReason] = useState<'blocked' | 'red_card' | null>(null);
  const lastCloudPullAtMsRef = useRef(0);
  const cloudWriteTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const lastPushedSnapshotRef = useRef<string>('');
  const cloudInitialSyncDoneRef = useRef(false);
  const pushToCloudRef = useRef<(() => Promise<void>) | null>(null);
  const didStampMigrationRef = useRef(false);

  const RK_LAST_CLOUD_UID_KEY = 'rk_last_cloud_uid_v1';

  const localUpdatedAtMs = useMemo(() => {
    const s = (user.lastSyncAt || '').trim();
    const ms = s ? Date.parse(s) : 0;
    return Number.isFinite(ms) ? ms : 0;
  }, [user.lastSyncAt]);

  const pullFromCloud = useCallback(
    async (reason: 'login' | 'foreground') => {
      if (!cloudUid) return;
      const now = Date.now();
      const minIntervalMs = reason === 'login' ? 0 : 60_000;
      if (now - lastCloudPullAtMsRef.current < minIntervalMs) return;
      lastCloudPullAtMsRef.current = now;

      const prevCloudUid = (() => {
        try {
          return sessionStorage.getItem(RK_LAST_CLOUD_UID_KEY);
        } catch {
          return null;
        }
      })();
      const switchedGoogleAccount = Boolean(prevCloudUid && prevCloudUid !== cloudUid);
      if (reason === 'login') {
        try {
          sessionStorage.setItem(RK_LAST_CLOUD_UID_KEY, cloudUid);
        } catch {
          /* ignore */
        }
      }

      const finishLoginSync = () => {
        cloudInitialSyncDoneRef.current = true;
        lastPushedSnapshotRef.current = '';
        window.setTimeout(() => {
          void pushToCloudRef.current?.();
        }, 200);
      };

      try {
        try {
          await auth.currentUser?.getIdToken();
        } catch (e) {
          console.warn('[CloudSync] getIdToken before pull failed', e);
        }
        const snap = await getDoc(doc(db, 'rk_users', cloudUid));
        if (!snap.exists()) {
          if (reason === 'login' && switchedGoogleAccount) {
            setUser((prev: any) => ({
              ...prev,
              completedDates: [],
              specialDates: [],
              dailyClearCounts: {},
            }));
          }
          if (reason === 'login') finishLoginSync();
          return;
        }

        const d = snap.data() as Record<string, unknown>;
        const cloudUpdated =
          typeof d.updatedAtMs === 'number' ? d.updatedAtMs : Number(d.updatedAtMs) || 0;

        const nextNickname = typeof d.nickname === 'string' ? d.nickname : '';
        const nextEmoji = typeof d.userEmoji === 'string' ? d.userEmoji : '';
        const nextPoints = typeof d.totalPoints === 'number' ? d.totalPoints : Number(d.totalPoints) || undefined;
        const nextCompleted = Array.isArray(d.completedDates) ? (d.completedDates as string[]) : undefined;
        const nextSpecial = Array.isArray(d.specialDates) ? (d.specialDates as string[]) : undefined;
        const sanitized = sanitizeRkUsersCloudPayload({
          uid: cloudUid,
          nickname: nextNickname || '',
          userEmoji: nextEmoji || '',
          totalPoints: nextPoints ?? 0,
          completedDates: nextCompleted ?? [],
          specialDates: nextSpecial ?? [],
          dailyClearCounts: d.dailyClearCounts,
          updatedAtMs: cloudUpdated,
        });

        if (reason === 'login') {
          setUser((prev: any) => ({
            ...prev,
            ...(cloudUpdated > localUpdatedAtMs && nextNickname ? { nickname: sanitized.nickname } : {}),
            ...(cloudUpdated > localUpdatedAtMs && nextEmoji ? { userEmoji: sanitized.userEmoji } : {}),
            ...(cloudUpdated > localUpdatedAtMs && nextPoints !== undefined
              ? { totalPoints: sanitized.totalPoints }
              : {}),
            ...(switchedGoogleAccount
              ? {
                  completedDates: sanitized.completedDates,
                  specialDates: sanitized.specialDates,
                  dailyClearCounts: sanitized.dailyClearCounts,
                }
              : {}),
          }));
          finishLoginSync();
          return;
        }

        if (cloudUpdated <= localUpdatedAtMs) return;

        setUser((prev: any) => ({
          ...prev,
          ...(nextNickname ? { nickname: sanitized.nickname } : {}),
          ...(nextEmoji ? { userEmoji: sanitized.userEmoji } : {}),
          ...(nextPoints !== undefined ? { totalPoints: sanitized.totalPoints } : {}),
          lastSyncAt: new Date(cloudUpdated).toISOString(),
        }));
      } catch (e) {
        console.warn('[CloudSync] pull failed', e);
        if (reason === 'login') cloudInitialSyncDoneRef.current = false;
      }
    },
    [cloudUid, localUpdatedAtMs, setUser]
  );

  const pushToCloud = useCallback(async () => {
    if (!cloudUid) return;
    // Critical: prevent "blank local" from overwriting cloud before the first pull on this device.
    if (!cloudInitialSyncDoneRef.current) return;
    const now = Date.now();
    const payload = sanitizeRkUsersCloudPayload({
      uid: cloudUid,
      nickname: user.nickname || nickname || '',
      userEmoji: user.userEmoji || userEmoji || '',
      totalPoints: user.totalPoints,
      completedDates: user.completedDates,
      specialDates: user.specialDates,
      dailyClearCounts: user.dailyClearCounts,
      updatedAtMs: now,
    });

    const snapshot = JSON.stringify(payload);
    if (snapshot === lastPushedSnapshotRef.current) return;
    lastPushedSnapshotRef.current = snapshot;

    try {
      try {
        await auth.currentUser?.getIdToken();
      } catch (e) {
        console.warn('[CloudSync] getIdToken before push failed', e);
      }
      await setDoc(doc(db, 'rk_users', cloudUid), payload, { merge: true });
      // Mark local as synced.
      setUser((prev: any) => ({ ...prev, lastSyncAt: new Date(now).toISOString() }));
    } catch (e) {
      const code =
        typeof e === 'object' && e !== null && 'code' in e ? String((e as { code?: string }).code) : '';
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[CloudSync] push failed', code || msg, e);
      // allow retry on next change
      lastPushedSnapshotRef.current = '';
    }
  }, [cloudUid, nickname, userEmoji, user.completedDates, user.dailyClearCounts, user.nickname, user.specialDates, user.totalPoints, user.userEmoji, setUser]);

  useEffect(() => {
    pushToCloudRef.current = pushToCloud;
  }, [pushToCloud]);

  // Pull once when a real uid becomes available.
  useEffect(() => {
    if (!isAuthReady) return;
    if (!cloudUid) return;
    cloudInitialSyncDoneRef.current = false;
    void pullFromCloud('login');
  }, [cloudUid, isAuthReady, pullFromCloud]);

  // Global ban gate: blockedUsers またはレッドカードでサイト全体を拒否
  useEffect(() => {
    if (!isAuthReady) return;
    if (!cloudUid) {
      setIsBanned(false);
      setBanUserName(null);
      setBanReason(null);
      return;
    }

    let blockedList = false;
    let redActive = false;
    let nameFromBlock = '';
    let nameFromRed = '';

    const applyBanState = () => {
      if (isProtectedRenrakuAdminUid(cloudUid) || isRenrakuAdmin(authUserForUi)) {
        setIsBanned(false);
        setBanUserName(null);
        setBanReason(null);
        return;
      }
      const banned = blockedList || redActive;
      setIsBanned(banned);
      if (!banned) {
        setBanUserName(null);
        setBanReason(null);
        return;
      }
      setBanReason(banned ? 'red_card' : null);
      const n = (nameFromRed || nameFromBlock).trim();
      setBanUserName(n || null);
      setIsEntered(true);
      setScreen('seat-selection');
      setShowRenrakucho(false);
    };

    const blockRef = doc(db, 'blockedUsers', cloudUid);
    const modRef = doc(db, USER_MODERATION_COLLECTION, cloudUid);

    const unsubBlock = onSnapshot(
      blockRef,
      (snap) => {
        blockedList = snap.exists();
        if (snap.exists()) {
          const d = snap.data() as Record<string, unknown>;
          nameFromBlock = typeof d.userName === 'string' ? d.userName.trim() : '';
        } else {
          nameFromBlock = '';
        }
        applyBanState();
      },
      (e) => {
        console.warn('[BanGate] blockedUsers subscription failed', e);
        blockedList = false;
        applyBanState();
      }
    );

    const unsubMod = onSnapshot(
      modRef,
      (snap) => {
        if (!snap.exists()) {
          redActive = false;
          nameFromRed = '';
        } else {
          const d = snap.data() as Record<string, unknown>;
          redActive = d.redActive === true;
          nameFromRed = typeof d.userName === 'string' ? d.userName.trim() : '';
        }
        applyBanState();
      },
      (e) => {
        console.warn('[BanGate] user_moderation subscription failed', e);
        redActive = false;
        applyBanState();
      }
    );

    return () => {
      unsubBlock();
      unsubMod();
    };
  }, [cloudUid, isAuthReady, authUserForUi, setScreen, setShowRenrakucho]);

  // Periodic pull on foreground (low frequency).
  useEffect(() => {
    const onFocus = () => void pullFromCloud('foreground');
    const onVis = () => {
      if (document.visibilityState === 'visible') void pullFromCloud('foreground');
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [pullFromCloud]);

  // Debounced push on changes (avoid writing on every point change).
  useEffect(() => {
    if (!cloudUid) return;
    if (cloudWriteTimerRef.current) window.clearTimeout(cloudWriteTimerRef.current);
    cloudWriteTimerRef.current = window.setTimeout(() => {
      cloudWriteTimerRef.current = null;
      void pushToCloud();
    }, 5000);
    return () => {
      if (cloudWriteTimerRef.current) window.clearTimeout(cloudWriteTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cloudUid,
    // only the fields we care about syncing
    nickname,
    userEmoji,
    user.totalPoints,
    user.completedDates?.length,
    user.specialDates?.length,
    JSON.stringify(user.dailyClearCounts ?? {}),
    user.nickname,
    user.userEmoji,
  ]);

  const handleCancelRecruit = useCallback(async () => {
    if (!recruitMessageId) return;
    try {
      await deleteDoc(doc(db, 'renraku_public', recruitMessageId));
      if (roomId) {
        await setDoc(doc(db, 'rooms', roomId), { recruitMessageId: null }, { merge: true });
      }
      setRecruitMessageId(null);
      setRecruitedAt(null);
    } catch (error) {
      console.error('Cancel recruit error:', error);
    }
  }, [recruitMessageId, roomId]);

  useEffect(() => {
    if (!roomId && recruitMessageId) {
      handleCancelRecruit();
    }
  }, [roomId, recruitMessageId, handleCancelRecruit]);

  useEffect(() => {
    if (roomId && isHostFromMultiplayer && !recruitMessageId) {
      const roomRef = doc(db, 'rooms', roomId);
      const unsubscribe = onSnapshot(roomRef, snap => {
        const data = snap.data();
        if (data?.recruitMessageId && data.recruitMessageId !== recruitMessageId) {
          setRecruitMessageId(data.recruitMessageId);
        }
      });
      return () => unsubscribe();
    }
  }, [roomId, isHostFromMultiplayer, recruitMessageId]);

  const handleInitRoom = useCallback(
    async (newSeed: string, category?: any, isKatakana?: boolean, searchWord?: string) => {
      const hiraSeed = stringToSeed(newSeed).toString();
      setRoomId(hiraSeed);
      setIsMultiplay(true);
      setIsReady(true);
      setIsRoomCreator(true);
      setSeed(newSeed);
    },
    [setRoomId, setIsMultiplay, setIsReady, setSeed, setIsRoomCreator]
  );

  const handleHostStartGame = useCallback(
    async (settings: any) => {
      if (!roomId || !isHostFromMultiplayer || isGenerating) return;
      try {
        const cat = MASTER.categories.find(c => c.category === settings.category) || MASTER.categories[0];
        const started =
          settings.gameMode === 'search' && settings.targetWord
            ? await startSearchGame(settings.targetWord, settings.difficulty, 20, settings.seed, settings.isKatakana, false)
            : await startNewGame(cat, settings.seed, settings.difficulty, settings.isKatakana, false);

        if (!started) return;

        await updateRoomStatus('start');

        setTimeout(async () => {
          await updateRoomStatus('playing');
        }, 5000);
      } catch (e) {
        console.error('Error starting game:', e);
      }
    },
    [roomId, isHostFromMultiplayer, isGenerating, updateRoomStatus, startNewGame, startSearchGame]
  );

  const handleToggleReady = useCallback(() => {
    const nextReady = !isReady;
    setIsReady(nextReady);
    toggleReady(nextReady);
  }, [isReady, toggleReady, setIsReady]);

  const handleSetSyncMode = useCallback(
    (sync: boolean) => {
      setIsSyncMode(sync);
    },
    [setIsSyncMode]
  );

  const handleConfirmJoin = useCallback(
    async (rid: string) => {
      try {
        await ensureAuth();
      } catch (e) {}
      if (rid.startsWith('test-') || rid.startsWith('sync-')) {
        setIsEntered(true);
        setPendingRoomId(null);
        setShowRenrakucho(false);
        setScreen('seat-selection');
        vibrate(30);
        return;
      }
      setRoomId(rid);
      setIsMultiplay(true);
      setIsReady(false);
      setIsRoomCreator(false);
      setIsEntered(true);
      setScreen('select');
      setPendingRoomId(null);
      setShowRenrakucho(false);
      setGameState(prev => ({ ...prev, foundWords: [] }));
      vibrate(30);
    },
    [setRoomId, setIsMultiplay, setIsReady, setScreen, setPendingRoomId, ensureAuth, setIsEntered, setIsRoomCreator, setGameState, setShowRenrakucho]
  );

  const handleJoinBoardGameRecruit = useCallback(
    async (kind: BoardGameRecruitKind, roomCode: string) => {
      try {
        await ensureAuth();
      } catch {
        /* ignore */
      }
      saveBoardGamePendingJoinRoomCode(kind, roomCode);
      setShowRenrakucho(false);
      setScreen(kind === 'reversi' ? 'othello' : 'gomoku');
      vibrate(30);
    },
    [ensureAuth, setScreen, setShowRenrakucho],
  );

  useUrlParams(isAuthReady, handleConfirmJoin, handleJoinBoardGameRecruit, startSearchGame, startNewGame, startPickupSoloGame);

  useEffect(() => {
    if (!closesGlobalOverlays(screen)) return;
    setShowRenrakucho(false);
    setShowSettingsModal(false);
    setShowInstructionModal(false);
    setIsStampCardOpen(false);
    setShowInstallGuideModal(false);
    if (puzzleHintTimeoutRef.current) {
      window.clearTimeout(puzzleHintTimeoutRef.current);
      puzzleHintTimeoutRef.current = null;
    }
    setPuzzleSizeHintMessage(null);
    setNotification(null);
  }, [screen]);

  /** 静かな没入中はトーストを DOM にも state にも残さない（SHOW_TOAST の取りこぼし） */
  useEffect(() => {
    if (!suppressesQuietImmersiveGlobalChrome(screen)) return;
    if (!notification) return;
    setNotification(null);
  }, [screen, notification]);

  /** リバーシ募集ホスト: 相手参加でトップ等から自動でリバーシ画面へ */
  useEffect(() => {
    const myUid = authUserForUi?.uid;
    if (!myUid) return;

    let unsub: (() => void) | null = null;

    const attach = (code: string) => {
      unsub?.();
      if (!code) return;
      unsub = subscribeReversiRoom(code, (room) => {
        if (!room || room.host.uid !== myUid) return;
        if (!room.guest || room.status === 'waiting') return;
        if (screenRef.current === 'othello') return;
        setScreen('othello');
      });
    };

    attach(loadReversiPendingHostRoomCode());
    const onPendingChanged = () => attach(loadReversiPendingHostRoomCode());
    window.addEventListener(REVERSI_PENDING_HOST_CHANGED_EVENT, onPendingChanged);
    return () => {
      unsub?.();
      window.removeEventListener(REVERSI_PENDING_HOST_CHANGED_EVENT, onPendingChanged);
    };
  }, [authUserForUi?.uid, setScreen]);

  /** 五目並べ募集ホスト: 相手参加でトップ等から自動で五目並べ画面へ */
  useEffect(() => {
    const myUid = authUserForUi?.uid;
    if (!myUid) return;

    let unsub: (() => void) | null = null;

    const attach = (code: string) => {
      unsub?.();
      if (!code) return;
      unsub = subscribeGomokuRoom(code, (room) => {
        if (!room || room.host.uid !== myUid) return;
        if (!room.guest || room.status === 'waiting') return;
        if (screenRef.current === 'gomoku') return;
        setScreen('gomoku');
      });
    };

    attach(loadGomokuPendingHostRoomCode());
    const onPendingChanged = () => attach(loadGomokuPendingHostRoomCode());
    window.addEventListener(GOMOKU_PENDING_HOST_CHANGED_EVENT, onPendingChanged);
    return () => {
      unsub?.();
      window.removeEventListener(GOMOKU_PENDING_HOST_CHANGED_EVENT, onPendingChanged);
    };
  }, [authUserForUi?.uid, setScreen]);

  useEffect(() => {
    if (isMultiplay && roomStatus === 'playing' && screen !== 'game') {
      setScreen('game');
    }
    if (isMultiplay && roomStatus === 'start') {
      setSyncCountdown(5);
      const timer = setInterval(() => {
        setSyncCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setSyncCountdown(0);
    }
  }, [isMultiplay, roomStatus, screen, setScreen]);

  useEffect(() => {
    const cmActive = Boolean(gateAdPresentation) && !streamMode;
    const quietImmersive = STOPS_HUB_BGM.has(screen);

    if (quietImmersive) {
      audioService.stopHubBgm();
      return;
    }
    if (cmActive) {
      audioService.pauseHubBgm();
      return;
    }
    if (isBgmEnabled && isEntered) {
      audioService.resumeHubBgm();
    } else if (!isBgmEnabled) {
      audioService.stop();
    }
  }, [screen, isBgmEnabled, isEntered, gateAdPresentation, streamMode]);

  /** どの画面でも最初のタップで Web Audio / BGM を解禁（席選択以外でも鳴るように） */
  useEffect(() => {
    const unlockAudio = () => {
      audioService.startFromUserAction();
    };
    document.addEventListener('pointerdown', unlockAudio, { capture: true });
    return () => document.removeEventListener('pointerdown', unlockAudio, { capture: true });
  }, []);

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === 'string' && detail.trim()) {
        setNotification(detail.trim());
      }
    };
    window.addEventListener('SHOW_TOAST', onToast);
    return () => window.removeEventListener('SHOW_TOAST', onToast);
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // しゅっせき（スタンプ）配列の修復。ロジックの正は `rakudaHubShell` 経由の stampMigration。
  // - Fixes UTC date-key bug for recent days
  // - Only rewrites the range that logs actually cover; older data remains untouched
  useEffect(() => {
    if (!isAuthReady) return;
    if (didStampMigrationRef.current) return;
    if (!Array.isArray(logs) || logs.length === 0) return;

    didStampMigrationRef.current = true;
    const computed = computeStampsFromLogs({ logs });

    setUser((prev) => {
      const migrated = migrateStampArrays({
        existingCompletedDates: prev.completedDates,
        existingSpecialDates: prev.specialDates,
        existingDailyClearCounts: prev.dailyClearCounts,
        computedCompletedDates: computed.completedDates,
        computedSpecialDates: computed.specialDates,
        computedDailyClearCounts: computed.dailyClearCounts,
        computedRange: computed.range,
      });

      if (!migrated.changed) return prev;
      return {
        ...prev,
        completedDates: migrated.completedDates,
        specialDates: migrated.specialDates,
        dailyClearCounts: migrated.dailyClearCounts,
      };
    });
  }, [isAuthReady, logs, setUser]);

  /** 失われたしゅっせきを端末・ログ・クラウドから復元（増える方向のみ） */
  const didShussekiRecoveryRef = useRef(false);
  useEffect(() => {
    if (!isAuthReady) return;
    if (didShussekiRecoveryRef.current) return;

    const timer = window.setTimeout(() => {
      if (didShussekiRecoveryRef.current) return;
      didShussekiRecoveryRef.current = true;

      void (async () => {
        const recovered = await gatherRecoveredShussekiDates({
          uid: cloudUid,
          currentDates: [],
          localLogs: logs ?? [],
        });

        setUser((prev) => {
          const before = getTotalStampCount(prev);
          const merged = uniqShussekiDateKeys([prev.completedDates ?? [], recovered]);
          if (merged.length <= before) {
            persistShussekiDatesBackup(prev.completedDates);
            return prev;
          }
          const draft = { ...prev, completedDates: merged };
          persistShussekiDatesBackup(merged);
          return {
            ...draft,
            specialDates: syncSpecialDates(draft),
          };
        });

        if (cloudUid && cloudInitialSyncDoneRef.current) {
          lastPushedSnapshotRef.current = '';
          window.setTimeout(() => {
            void pushToCloudRef.current?.();
          }, 400);
        }
      })();
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [isAuthReady, cloudUid, logs, setUser]);

  useEffect(() => {
    persistShussekiDatesBackup(user.completedDates);
  }, [user.completedDates]);

  const recordShussekiGamePlay = useCallback((): number => {
    let todayCount = 0;
    let milestoneToast: string | null = null;
    const appendGreenHint =
      stripeGreenEnabled && !isGreenGateActive(Date.now(), serverGreenUntilMs);
    setUser((prev) => {
      const beforeTotal = getTotalStampCount(prev);
      const result = applyShussekiGamePlayRecord(prev);
      todayCount = result.todayCount;
      if (todayCount > 0) {
        milestoneToast = shussekiMilestoneToastAfterNewStamp(
          beforeTotal,
          getTotalStampCount(result.user),
          { appendGreenHint },
        );
      }
      return result.user;
    });
    if (milestoneToast) setNotification(milestoneToast);
    return todayCount;
  }, [setUser, setNotification, stripeGreenEnabled, serverGreenUntilMs]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleStartGameWithSeed = useCallback(
    (s: string) => {
      const playableCategories = MASTER.categories.filter((c) => !isWordCategoryPaused(c.category));
      const hira = s.trim();
      if (!hira) {
        if (playableCategories.length === 0) return;
        const cat = playableCategories[Math.floor(Math.random() * playableCategories.length)];
        vibrate(30);
        startNewGame(cat);
        return;
      }
      const decoded = decodeProCode(hira);
      if (decoded) {
        const cat = playableCategories.find(c => c.category === decoded.category);
        if (cat) {
          vibrate(30);
          startNewGame(cat, decoded.seed, decoded.difficulty);
          return;
        }
      }
      if (playableCategories.length === 0) return;
      const seedNum = stringToSeed(hira);
      const catIndex = seedNum % playableCategories.length;
      const cat = playableCategories[catIndex];
      vibrate(30);
      startNewGame(cat, seedNum);
    },
    [startNewGame]
  );

  const handleSaveHistory = useCallback(
    (res: any) => {
      const details = res.details || {
        category: res.category?.category,
        difficulty: res.difficulty,
        seed: res.actualSeed,
        wordsCount: res.foundWords?.length,
      };
      addLog(
        res.type || 'game_clear',
        res.tag || 'SUCCESS',
        res.message || (res.category?.title ? `${res.category.title}をクリア！` : 'クリア！'),
        details,
        res.emoji || res.category?.emoji
      );
    },
    [addLog]
  );

  const handleClear = useCallback(() => {
    setClearsCount(prev => prev + 1);
    handleRecordFinish();
    recordShussekiGamePlay();
  }, [handleRecordFinish, recordShussekiGamePlay]);

  const flushInterstitialDismissWaiter = useCallback(() => {
    const q = interstitialDismissWaitersRef.current;
    interstitialDismissWaitersRef.current = [];
    for (const fn of q) {
      try {
        fn();
      } catch {
        // ignore
      }
    }
  }, []);

  const handleDismissFullScreenAd = useCallback(() => {
    const now = Date.now();
    lastInterstitialDismissedMsRef.current = now;
    writeLastInterstitialDismissedMs(now);
    interstitialArmedRef.current = false;
    setGateAdPresentation(null);
    flushInterstitialDismissWaiter();
  }, [flushInterstitialDismissWaiter]);

  const setStreamMode = useCallback(
    (enabled: boolean, opts?: { silent?: boolean }) => {
      persistStreamModeEnabled(enabled);
      setStreamModeState(enabled);
      if (enabled) {
        interstitialArmedRef.current = false;
        handleDismissFullScreenAd();
      }
      if (!opts?.silent) {
        window.dispatchEvent(
          new CustomEvent('SHOW_TOAST', {
            detail: enabled ? '配信モード ON（広告OFF・軽量化）' : '配信モード OFF（通常）',
          }),
        );
      }
    },
    [handleDismissFullScreenAd],
  );

  const setCoordOverlayEnabled = useCallback((enabled: boolean) => {
    persistCoordOverlayEnabled(enabled);
    setCoordOverlayEnabledState(enabled);
    window.dispatchEvent(
      new CustomEvent('SHOW_TOAST', {
        detail: enabled ? '座標表示 ON' : '座標表示 OFF',
      }),
    );
  }, []);

  const setStreamLiveBadgeEnabled = useCallback((enabled: boolean) => {
    persistStreamLiveBadgeEnabled(enabled);
    setStreamLiveBadgeEnabledState(enabled);
    void publishYoutubeLiveBannerPulse(enabled).catch((e) => {
      console.warn('[useAppShell] publishYoutubeLiveBannerPulse failed', e);
    });
    window.dispatchEvent(
      new CustomEvent('SHOW_TOAST', {
        detail: enabled
          ? `ひと言探し「${RK_STREAM_LIVE_BADGE_LABEL}」ON — 主要画面に3秒通知`
          : `ひと言探し「${RK_STREAM_LIVE_BADGE_LABEL}」表示 OFF`,
      }),
    );
  }, []);

  const adminStreamLiveBadgeControl = useMemo(
    () => streamMode && isRenrakuAdminUser,
    [streamMode, isRenrakuAdminUser],
  );

  useEffect(() => {
    setInterstitialUiHandler(async (presentation) => {
      if (streamModeRef.current) return;
      if (shouldSuppressAdsForGate(Date.now(), serverGreenUntilMsRef.current)) return;
      await new Promise<void>((resolve) => {
        interstitialDismissWaitersRef.current.push(resolve);
        setGateAdPresentation(presentation);
      });
    });
    return () => setInterstitialUiHandler(null);
  }, []);

  /** 全面広告は body 直下 z-[5000]。没入へ遷移したら取りこぼしでシェルだけ見えない事故を防ぐ */
  useEffect(() => {
    if (!suppressesQuietImmersiveGlobalChrome(screen)) return;
    if (!gateAdPresentation) return;
    handleDismissFullScreenAd();
  }, [screen, gateAdPresentation, handleDismissFullScreenAd]);

  /**
   * 「自然な区切り」で呼ぶ。2分アーム済みかつ最小間隔を満たせばリワード／全面フローへ入り、閉じるまで await。
   */
  const tryInterstitialAtNaturalBreak = useCallback(async () => {
    if (streamMode) return;
    if (shouldSuppressAdsForGate(Date.now(), serverGreenUntilMs)) return;
    if (shouldDeferInterstitialDuringSocialPlay()) return;
    if (gateAdPresentation) return;
    if (isGenerating) return;
    const narr = typeof narration === 'string' ? narration.trim() : '';
    if (narr.length > 0) return;

    const now = Date.now();
    const last = lastInterstitialDismissedMsRef.current;
    if (now - last < INTERSTITIAL_MIN_GAP_MS) return;
    if (!interstitialArmedRef.current && now - last < INTERSTITIAL_ARM_MS) return;
    if (!interstitialArmedRef.current) return;

    const gate =
      rakudaGateRef.current ?? resolveActiveRakudaGate(Date.now(), serverGreenUntilMs);
    if (gateAdSequenceForGate(gate).length <= 0) return;

    interstitialArmedRef.current = false;
    await adService.showInterstitialForGate(gate);
  }, [streamMode, gateAdPresentation, isGenerating, narration, serverGreenUntilMs]);

  /** 対人セッション終了（席に戻る）— 2分アーム不要でゲート契約どおり清算 */
  const tryInterstitialAtSocialSessionEnd = useCallback(async () => {
    if (streamMode) {
      settleSocialPlayAdSession();
      return;
    }
    if (shouldSuppressAdsForGate(Date.now(), serverGreenUntilMs)) {
      cancelSocialPlayAdDeferral();
      return;
    }
    if (gateAdPresentation) return;
    if (isGenerating) return;
    const narr = typeof narration === 'string' ? narration.trim() : '';
    if (narr.length > 0) return;

    if (!settleSocialPlayAdSession()) return;

    const gate =
      rakudaGateRef.current ?? resolveActiveRakudaGate(Date.now(), serverGreenUntilMs);
    if (gateAdSequenceForGate(gate).length <= 0) return;

    interstitialArmedRef.current = false;
    await adService.showInterstitialForGate(gate);
  }, [streamMode, gateAdPresentation, isGenerating, narration, serverGreenUntilMs]);

  /** ひと言探しクリア・9×9数字パズルクリアなど — 達成の区切り（2分アーム不要・最小間隔60秒） */
  const tryInterstitialAtSoloPuzzleClear = useCallback(async () => {
    if (streamMode) return;
    if (shouldSuppressAdsForGate(Date.now(), serverGreenUntilMs)) return;
    if (gateAdPresentation) return;
    if (isGenerating) return;
    const narr = typeof narration === 'string' ? narration.trim() : '';
    if (narr.length > 0) return;

    const now = Date.now();
    const last = lastInterstitialDismissedMsRef.current;
    if (now - last < INTERSTITIAL_MIN_GAP_MS) return;

    const gate =
      rakudaGateRef.current ?? resolveActiveRakudaGate(Date.now(), serverGreenUntilMs);
    if (gateAdSequenceForGate(gate).length <= 0) return;

    interstitialArmedRef.current = false;
    await adService.showInterstitialForGate(gate);
    cancelSocialPlayAdDeferral();
  }, [streamMode, gateAdPresentation, isGenerating, narration, serverGreenUntilMs]);

  const tryInterstitialAtHundredPickupClear = tryInterstitialAtSoloPuzzleClear;
  const tryInterstitialAtSudokuClear = tryInterstitialAtSoloPuzzleClear;

  const handleSelectGate = useCallback(
    (gate: RakudaGateId) => {
      if (gate === 'green') return;
      writeRakudaGateChoice(gate);
      dismissWelcomeIntro();
      const active = resolveActiveRakudaGate(undefined, serverGreenUntilMs);
      setRakudaGate(active);
      applyGateNicknameCssColor(active);
      setShowGateSelection(false);
      setScreen('seat-selection');
    },
    [setScreen, serverGreenUntilMs],
  );

  const handleGreenGateDevBypass = useCallback(() => {
    if (isGreenGateEntranceClosed()) return;
    activateGreenGateSubscription();
    dismissWelcomeIntro();
    const active = resolveActiveRakudaGate(undefined, serverGreenUntilMs);
    setRakudaGate(active);
    applyGateNicknameCssColor(active);
    setShowGateSelection(false);
    setScreen('seat-selection');
  }, [setScreen, serverGreenUntilMs]);

  const handleEnterGreenGate = useCallback(() => {
    if (!isGreenGateActive(Date.now(), serverGreenUntilMs)) return;
    syncLocalGreenGateFromServer(serverGreenUntilMs);
    dismissWelcomeIntro();
    const active = resolveActiveRakudaGate(Date.now(), serverGreenUntilMs);
    setRakudaGate(active);
    applyGateNicknameCssColor(active);
    setShowGateSelection(false);
    setScreen('seat-selection');
  }, [setScreen, serverGreenUntilMs]);

  const handleGreenGateCheckout = useCallback(async () => {
    if (!stripeGreenEnabled) return;
    if (isGreenGateEntranceClosed() && !isGreenGateActive(Date.now(), serverGreenUntilMs)) {
      setNotification(`${RAKUDA_SUPPORT_GATE_LABEL}は、いま新規のお申し込みをお休みしています。`);
      return;
    }
    setGreenCheckoutBusy(true);
    try {
      let user = authUserForUi;
      if (!user) {
        handleGoogleLoginViaPopup?.() ?? handleGoogleLogin();
        user = auth.currentUser;
      }
      if (!user) {
        setNotification('Google ログインが必要です。');
        return;
      }
      await waitForGoogleSessionRestore(2500);
      const readyUser = auth.currentUser ?? user;
      const token = await readyUser.getIdToken();
      const synced = await syncGreenGateBillingFromStripe(token);
      if (synced.ok && synced.greenUntilMs != null && synced.greenUntilMs > Date.now()) {
        syncLocalGreenGateFromServer(synced.greenUntilMs);
        dismissWelcomeIntro();
        const active = resolveActiveRakudaGate(Date.now(), synced.greenUntilMs);
        setRakudaGate(active);
        applyGateNicknameCssColor(active);
        setShowGateSelection(false);
        setScreen('seat-selection');
        const untilJa = new Date(synced.greenUntilMs).toLocaleDateString('ja-JP');
        setNotification(`${RAKUDA_SUPPORT_GATE_LABEL}はすでに有効です（${untilJa}まで）。新規のお申し込みは不要です。`);
        return;
      }
      const result = await createGreenGateCheckoutSession(token);
      if (!result.ok) {
        setNotification('決済の準備中です。しばらくしてからお試しください。');
        return;
      }
      window.location.href = result.url;
    } finally {
      setGreenCheckoutBusy(false);
    }
  }, [
    stripeGreenEnabled,
    serverGreenUntilMs,
    authUserForUi,
    handleGoogleLogin,
    handleGoogleLoginViaPopup,
    setNotification,
  ]);

  const handleSettingsGoogleLoginPopup = useCallback(async () => {
    markSettingsBillingLoginIntent();
    await handleGoogleLoginViaPopup();
  }, [handleGoogleLoginViaPopup]);

  const handleSettingsGoogleLoginRedirect = useCallback(async () => {
    markSettingsBillingLoginIntent();
    await handleGoogleLoginViaRedirect();
  }, [handleGoogleLoginViaRedirect]);

  const handleGreenGatePortal = useCallback(async () => {
    if (!stripeGreenEnabled) return;
    setGreenPortalBusy(true);
    try {
      let user = authUserForUi;
      if (!user) {
        await (handleGoogleLoginViaPopup?.() ?? handleGoogleLogin());
        user = auth.currentUser;
      }
      if (!user) {
        setNotification('Google ログインが必要です。');
        return;
      }
      await waitForGoogleSessionRestore(2500);
      const readyUser = auth.currentUser ?? user;
      const token = await readyUser.getIdToken();
      const result = await createGreenGatePortalSession(token);
      if (!result.ok) {
        setNotification(greenGatePortalErrorJa(result.error));
        return;
      }
      window.location.href = result.url;
    } finally {
      setGreenPortalBusy(false);
    }
  }, [
    stripeGreenEnabled,
    authUserForUi,
    handleGoogleLogin,
    handleGoogleLoginViaPopup,
    setNotification,
  ]);

  const applyGreenPassSuccess = useCallback(
    (greenUntilMs: number, label?: string) => {
      syncLocalGreenGateFromServer(greenUntilMs);
      dismissWelcomeIntro();
      const active = resolveActiveRakudaGate(Date.now(), greenUntilMs);
      setRakudaGate(active);
      applyGateNicknameCssColor(active);
      setShowGateSelection(false);
      if (isGreenPassEntryPath()) {
        window.history.replaceState({}, '', '/');
      }
      setScreen('seat-selection');
      const untilJa = new Date(greenUntilMs).toLocaleDateString('ja-JP');
      const prefix = label?.trim() ? `${label.trim()}を` : '感謝の1年無料パスを';
      setGreenPassStatusMessage(`${prefix}有効にしました（${untilJa}まで・広告なし）`);
      setGreenPassStatusTone('ok');
      setNotification(`${RAKUDA_SUPPORT_GATE_LABEL}が有効になりました。ありがとうございます。`);
    },
    [setNotification, setScreen],
  );

  const handleGreenPassRedeem = useCallback(
    async (rawCode: string) => {
      const code = normalizeGreenPassCodeInput(rawCode);
      if (!code) {
        setGreenPassStatusMessage(greenPassRedeemErrorJa('invalid_code'));
        setGreenPassStatusTone('error');
        return;
      }
      setGreenPassBusy(true);
      setGreenPassStatusMessage(null);
      setGreenPassStatusTone('neutral');
      try {
        let user = authUserForUi ?? auth.currentUser;
        if (!user) {
          await (handleGoogleLoginViaPopup?.() ?? handleGoogleLogin());
          user = auth.currentUser;
        }
        if (!user) {
          setGreenPassStatusMessage(greenPassRedeemErrorJa('auth_required'));
          setGreenPassStatusTone('error');
          return;
        }
        await waitForGoogleSessionRestore(2500);
        const readyUser = auth.currentUser ?? user;
        const token = await readyUser.getIdToken();
        const result = await redeemGreenPass(token, code);
        if (!result.ok) {
          setGreenPassStatusMessage(greenPassRedeemErrorJa(result.error));
          setGreenPassStatusTone('error');
          return;
        }
        applyGreenPassSuccess(result.greenUntilMs, result.label);
      } finally {
        setGreenPassBusy(false);
      }
    },
    [
      applyGreenPassSuccess,
      authUserForUi,
      handleGoogleLogin,
      handleGoogleLoginViaPopup,
    ],
  );

  useEffect(() => {
    if (!isAuthReady) return;
    const params = new URLSearchParams(window.location.search);
    const passRaw = params.get('green_pass');
    if (!passRaw) return;

    const code = normalizeGreenPassCodeInput(passRaw);
    const url = new URL(window.location.href);
    url.searchParams.delete('green_pass');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);

    if (!code) return;
    void handleGreenPassRedeem(code);
  }, [isAuthReady, handleGreenPassRedeem]);

  useEffect(() => {
    if (!isAuthReady) return;
    const params = new URLSearchParams(window.location.search);
    const gateResult = params.get('green_gate');
    if (!gateResult) return;

    const url = new URL(window.location.href);
    url.searchParams.delete('green_gate');
    url.searchParams.delete('session_id');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);

    if (gateResult === 'cancel') return;

    const sessionId = params.get('session_id');
    if (gateResult !== 'success' || !sessionId) return;

    void (async () => {
      const user = authUserForUi ?? auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const synced = await syncGreenGateAfterCheckout(token, sessionId);
      if (synced.ok && synced.greenUntilMs) {
        syncLocalGreenGateFromServer(synced.greenUntilMs);
      }
      dismissWelcomeIntro();
      const active = resolveActiveRakudaGate(Date.now(), synced.greenUntilMs ?? serverGreenUntilMs);
      setRakudaGate(active);
      applyGateNicknameCssColor(active);
      setShowGateSelection(false);
      setScreen('seat-selection');
      setNotification(
        `${RAKUDA_SUPPORT_GATE_LABEL}が有効になりました。解約は 設定 →「解約・カード変更（Stripe）」からいつでもできます。`,
      );
    })();
  }, [isAuthReady, authUserForUi, serverGreenUntilMs, setNotification, setScreen]);

  useEffect(() => {
    if (resolveDonationThanksOnLoad()) setShowDonationThanks(true);
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('green_gate') !== 'portal_return') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('green_gate');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    setNotification('お支払い・解約の設定を反映しました。');
    setShowSettingsModal(true);
  }, [isAuthReady, setNotification]);

  useEffect(() => {
    if (!isAuthReady || !authUserForUi) return;
    if (!consumeSettingsBillingLoginIntent()) return;
    setShowSettingsModal(true);
  }, [isAuthReady, authUserForUi]);

  const onOpenKeijiban = useCallback(async () => {
    try {
      await waitForGoogleSessionRestore(2500);
      if (authUserForUi && isRenrakuAdmin(authUserForUi)) {
        await ensureRenrakuAdminFirestoreAuth(authUserForUi);
      }
    } catch (e) {
      console.warn('[onOpenKeijiban] session restore failed (continuing)', e);
    }
    setRenrakuchoInitialActiveTab('public');
    setRenrakuchoInitialPublicScreen('list');
    setRenrakuchoInitialSelectedHundred(null);
    setRenrakuchoMountKey((k) => k + 1);
    window.history.pushState({ rk: 'keijiban' }, '', hrefWithPathname('/keijiban'));
    setShowRenrakucho(true);
  }, [authUserForUi, setShowRenrakucho]);

  const openHundredHubPath = useCallback(
    async (opts: {
      focusCreateForm?: boolean;
      createFragment?: string;
    }) => {
      const focusCreate = opts.focusCreateForm !== false;
      setRenrakuchoInitialActiveTab('public');
      setRenrakuchoMountKey((k) => k + 1);

      if (!focusCreate) {
        const playRestore = loadHundredRestoreSession();
        if (
          playRestore?.publicScreen === 'hundred-wait' &&
          playRestore.selectedHundred?.roomId
        ) {
          beginHundredJoin(playRestore.selectedHundred);
          window.history.pushState({ rk: 'keijiban' }, '', hrefWithPathname('/keijiban'));
          void ensureAuth().catch(() => {
            /* keep flow */
          });
          return;
        }
        setRenrakuchoInitialPublicScreen('list');
        setRenrakuchoInitialSelectedHundred(null);
        markHundredRecruitSeenNow();
        window.history.pushState({ rk: 'keijiban' }, '', hrefWithPathname('/keijiban'));
        setShowRenrakucho(true);
        void ensureAuth().catch(() => {
          /* keep flow */
        });
        return;
      }

      clearHundredRestoreSession();
      setRenrakuchoInitialPublicScreen('list');
      setRenrakuchoInitialSelectedHundred(null);
      const hash = opts.createFragment ? `#${opts.createFragment}` : '';
      window.history.pushState({ rk: 'hundred-hub' }, '', hrefWithPathname('/hundred', hash));
      setShowRenrakucho(true);
      void ensureAuth().catch(() => {
        /* keep flow */
      });
    },
    [ensureAuth, setShowRenrakucho, beginHundredJoin],
  );

  const onOpenHundredHub = useCallback(
    async (opts?: { focusCreateForm?: boolean }) => {
      await openHundredHubPath({
        focusCreateForm: opts?.focusCreateForm,
        createFragment: RAKUDA_HUNDRED_CREATE_FRAGMENT,
      });
    },
    [openHundredHubPath]
  );

  const onOpenRenrakuchoAdmin = useCallback(async () => {
    await waitForGoogleSessionRestore(2500);
    const user = authUserForUi;
    if (user && isRenrakuAdmin(user)) {
      await ensureRenrakuAdminFirestoreAuth(user);
    }
    setRenrakuchoInitialActiveTab('admin');
    setRenrakuchoInitialPublicScreen('list');
    setRenrakuchoInitialSelectedHundred(null);
    setRenrakuchoMountKey((k) => k + 1);
    window.history.pushState({ rk: 'hundred-hub-admin' }, '', hrefWithPathname('/hundred'));
    setShowRenrakucho(true);
    void ensureAuth().catch(() => {
      /* keep flow */
    });
  }, [authUserForUi, ensureAuth, setShowRenrakucho]);

  useEffect(() => {
    if (!isEntered) return;
    if (screen === 'game') return;
    const path = window.location.pathname;
    const pathNorm = path.replace(/\/+$/, '') || '/';
    const onKeijiban = isKeijibanPathNorm(pathNorm);
    const onHundred = isHundredPathNorm(pathNorm);
    const openRenrakuFromPath = onKeijiban || onHundred;
    if (!openRenrakuFromPath) return;
    if (showRenrakucho) return;

    if (onHundred && !locationHasHundredCreateHash() && !locationHasJoinHundredPublic()) {
      const playRestore = hundredPlayRestoreForColdLoad();
      if (!playRestore) {
        // 裸の /hundred はホスト用。リロードでは席メニューへ（プレイ画面ではない）
        window.history.replaceState(null, '', hrefWithPathname('/'));
        return;
      }
    }

    let canceled = false;
    void (async () => {
      await waitForGoogleSessionRestore(2500);
      if (canceled) return;
      setRenrakuchoInitialActiveTab('public');
      try {
        const wantsCreate = locationHasHundredCreateHash();
        if (wantsCreate) {
          clearHundredRestoreSession();
          setRenrakuchoInitialPublicScreen('list');
          setRenrakuchoInitialSelectedHundred(null);
        } else if (onKeijiban) {
          setRenrakuchoInitialPublicScreen('list');
          setRenrakuchoInitialSelectedHundred(null);
        } else if (onHundred) {
          const playRestore = hundredPlayRestoreForColdLoad();
          if (playRestore?.selectedHundred?.roomId) {
            beginHundredJoin(playRestore.selectedHundred);
            return;
          }
          setRenrakuchoInitialPublicScreen('list');
          setRenrakuchoInitialSelectedHundred(null);
        } else {
          setRenrakuchoInitialPublicScreen('list');
          setRenrakuchoInitialSelectedHundred(null);
        }
      } catch {
        setRenrakuchoInitialPublicScreen('list');
        setRenrakuchoInitialSelectedHundred(null);
      }
      setRenrakuchoMountKey((k) => k + 1);
      setShowRenrakucho(true);
    })();

    return () => {
      canceled = true;
    };
  }, [isEntered, screen, showRenrakucho, setShowRenrakucho]);

  /** 旧リンク `/?play=tile-match` を無効化 */
  useEffect(() => {
    if (!isEntered) return;
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.get('play') !== 'tile-match') return;
      u.searchParams.delete('play');
      const qs = u.searchParams.toString();
      window.history.replaceState(null, '', `${u.pathname}${qs ? `?${qs}` : ''}${u.hash}`);
      setNotification('ペア探しは終了しました。');
    } catch {
      /* ignore */
    }
  }, [isEntered, setNotification]);

  const hideBottomStatusBar = useMemo(() => {
    if (
      screen === 'quiet-room' ||
      screen === 'slide-puzzle' ||
      screen === 'sudoku' ||
      screen === 'othello' ||
      screen === 'gomoku' ||
      screen === 'relay-story' ||
      screen === 'ouen-note' ||
      screen === 'game' ||
      screen === 'seat-selection' ||
      screen === 'select'
    ) {
      return true;
    }
    if (!showRenrakucho || typeof window === 'undefined') return false;
    const p = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
    return p === '/keijiban' || p.endsWith('/keijiban');
  }, [screen, showRenrakucho]);

  const appLayoutProps: AppLayoutProps = {
    // 固定バナー広告は使わない（リワード相当の全面のみ `showFullScreenAd`）。
    reserveBottomAdSpace: false,
    reserveBottomStatusInset: !hideBottomStatusBar,
    language,
    isGenerating,
    isMultiplay,
    roomStatus,
    syncCountdown,
    generatingTitle: syncFromHundredRooms && isGenerating ? 'ホストが問題を作成中です...' : undefined,
    generatingHint: syncFromHundredRooms && isGenerating ? 'しばらくお待ちください' : undefined,
    suppressGameStatusOverlays:
      suppressesQuietImmersiveGlobalChrome(screen) || (screen === 'game' && syncFromHundredRooms),
    gateAdPresentation,
    onDismissFullScreenAd: handleDismissFullScreenAd,
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
    isAdVisible: streamMode ? false : isAdVisible,
    setIsAdVisible,
    isBgmEnabled,
    onToggleBgm: () => {
      audioService.noteUserGesture();
      const s = !isBgmEnabled;
      audioService.toggle(s);
      setIsBgmEnabled(s);
    },
    notification,
    puzzleSizeHintMessage,
    isOnline,
    screen,
    user,
    nickname,
    userEmoji,
    setUserEmoji,
    setNickname,
    viewerCount,
    hubVisitorTotal,
    onJoinRoom: handleConfirmJoin,
    onJoinBoardGameRecruit: handleJoinBoardGameRecruit,
    onStartHundred: async (hundredRoomDocId: string, opts?: HundredStartOpts): Promise<boolean> => {
      const restored = loadHundredRestoreSession();
      const isRoboRoom = isRoboPickupLoungeRoomId(hundredRoomDocId);

      if (restored?.selectedHundred?.roomId === hundredRoomDocId) {
        setHundredWaitRecruit((prev) => prev ?? restored.selectedHundred);
      }

      let mode = opts?.hundredMode;
      if (!mode) {
        try {
          const snap = await getDoc(doc(db, 'hundred_rooms', hundredRoomDocId));
          const d = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
          mode = typeof d?.hundredMode === 'string' ? d.hundredMode : undefined;
        } catch {
          /* ignore */
        }
      }

      if (mode === TILE_MATCH_HUNDRED_MODE) {
        setNotification('ペア探しは終了しました。');
        return false;
      }

      setIsMultiplay(false);
      setIsSyncMode(true);
      setSyncFromHundredRooms(true);
      setRoomId(hundredRoomDocId);

      const preloadedGrid = opts?.preloadedGrid;
      const preloadedWords = opts?.preloadedWords;
      const hasPreload =
        Array.isArray(preloadedGrid) &&
        preloadedGrid.length > 0 &&
        preloadedGrid.some((row) => Array.isArray(row) && row.length > 0);

      if (restored?.selectedHundred?.roomId === hundredRoomDocId) {
        saveHundredRestoreSession({
          publicScreen: 'hundred-board',
          selectedHundred: restored.selectedHundred,
        });
      }
      // 待機室でポーリング完了まで留めない — 先にゲーム画面へ（盤面は snapshot / preload で追従）
      setShowRenrakucho(false);
      markHundredRecruitSeenNow();
      setScreen('game');

      if (hasPreload) {
        setGameState((prev) => {
          const preloadSig = hundredBoardKeySignature(preloadedGrid);
          const prevSig = prev.grid?.length ? hundredBoardKeySignature(prev.grid) : '';
          // 次のお題など盤面が変わったときは必ず preload を採用（前問の盤面のまま遊ばない）
          if (prevSig !== '' && preloadSig === prevSig) {
            return prev;
          }
          return {
            ...prev,
            grid: preloadedGrid,
            placedWords: (Array.isArray(preloadedWords) ? preloadedWords : []) as typeof prev.placedWords,
            foundWords: [],
          };
        });
        setIsGenerating(false);
        return true;
      }

      setIsGenerating(true);

      const tryLoadHundredBoard = async (
        maxAttempts: number,
        delayMs: number,
      ): Promise<{ grid: string[][]; words: unknown[] } | null> => {
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          try {
            const snap = await getDoc(doc(db, 'hundred_rooms', hundredRoomDocId));
            if (snap.exists()) {
              const d = snap.data() as Record<string, unknown>;
              if (d.problemsGenerating === true && !hundredRoomBoardReady(d, hundredRoomDocId)) {
                if (attempt < maxAttempts - 1) {
                  await new Promise((r) => window.setTimeout(r, delayMs));
                  continue;
                }
                continue;
              }
              if (hundredRoomCanEnterGame(d, hundredRoomDocId)) {
                const grid = gridRowsFromFirestore(d);
                if (grid?.length) {
                  return {
                    grid,
                    words: Array.isArray(d.words) ? d.words : [],
                  };
                }
              }
            }
          } catch {
            /* retry */
          }
          if (attempt < maxAttempts - 1) {
            await new Promise((r) => window.setTimeout(r, delayMs));
          }
        }
        return null;
      };

      const reopenWaitPanel = () => {
        const waitItem =
          restored?.selectedHundred?.roomId === hundredRoomDocId
            ? restored.selectedHundred
            : isRoboRoom
              ? (() => {
                  const profile = resolveRoboPickupLoungeProfile(hundredRoomDocId);
                  return {
                    id: profile.publicId,
                    type: 'hundred' as const,
                    roomId: profile.roomId,
                    roboPickupLounge: true,
                    hundredMode: 'pickup' as const,
                    targetWord: '',
                    boardSize: ROBO_PICKUP_LOUNGE_COLS,
                    boardCols: ROBO_PICKUP_LOUNGE_COLS,
                    boardRows: ROBO_PICKUP_LOUNGE_ROWS,
                    gameTimeLimitSec: 0,
                  } satisfies HundredPublicRecruit;
                })()
              : null;
        if (!waitItem) return;
        beginHundredJoin(waitItem);
      };

      const applyLoadedBoard = (loaded: { grid: string[][]; words: unknown[] }) => {
        setGameState((prev) => ({
          ...prev,
          grid: loaded.grid,
          placedWords: loaded.words as typeof prev.placedWords,
          foundWords: [],
        }));
        setIsGenerating(false);
      };

      if (isRoboRoom) {
        void (async () => {
          try {
            const profile = resolveRoboPickupLoungeProfile(hundredRoomDocId);
            await ensureRoboPickupLoungeRoomDoc(profile);
            await refreshRoboPickupLoungeBoardSizeIfNeeded(hundredRoomDocId);

            let loaded = await tryLoadHundredBoard(8, 500);
            if (loaded && roboLoungeLoadedGridMismatch(loaded.grid)) {
              await refreshRoboPickupLoungeBoardSizeIfNeeded(hundredRoomDocId);
              loaded = await tryLoadHundredBoard(8, 500);
            }
            if (!loaded) {
              await refreshRoboPickupLoungeSeedIfNeeded(hundredRoomDocId);
              loaded = await tryLoadHundredBoard(8, 500);
            }
            if (loaded) {
              applyLoadedBoard(loaded);
              return;
            }
            setIsGenerating(false);
            setNotification(
              '盤面の準備に失敗しました。もう一度お試しください。',
            );
            reopenWaitPanel();
          } catch (e) {
            console.warn('[useAppShell] robo lounge board bootstrap failed', e);
            setIsGenerating(false);
            setNotification('盤面の読み込みに失敗しました。もう一度お試しください。');
            reopenWaitPanel();
          }
        })();
        return true;
      }

      let loaded = await tryLoadHundredBoard(12, 250);

      if (!loaded) {
        setIsGenerating(false);
        setSyncFromHundredRooms(false);
        setRoomId(null);
        setScreen('seat-selection');
        setNotification(
          '盤面がまだできていません。ホストが「はじめる」を押すまでお待ちください。',
        );
        reopenWaitPanel();
        return false;
      }

      applyLoadedBoard(loaded);
      return true;
    },
    ensureAuth,
    shellFirebaseUser: authUserForUi,
    onRequestGoogleLogin: handleGoogleLogin,
    onGoogleLogout: handleGoogleLogout,
    settingsFirebaseUser: authUserForUi,
    settingsIsAuthReady: isAuthReady,
    renrakuchoMountKey,
    renrakuchoInitialActiveTab,
    renrakuchoInitialPublicScreen,
    renrakuchoInitialSelectedHundred,
    streamMode,
    setStreamMode,
    coordOverlayEnabled,
    setCoordOverlayEnabled,
    myGreenUntilMs: serverGreenUntilMs,
    myShussekiRegular: shussekiRegular,
    gateSuppressAds,
    rakudaGate,
    onGreenGateCheckout: handleGreenGateCheckout,
    greenCheckoutBusy,
    onGreenGateDevBypass: handleGreenGateDevBypass,
    greenGateUntilMs: serverGreenUntilMs,
    greenGateHasStripeBilling: !!greenGateServer.stripeCustomerId,
    stripeGreenEnabled,
    onGreenGateManageBilling: handleGreenGatePortal,
    greenGatePortalBusy: greenPortalBusy,
    onGoogleLoginPopup: handleSettingsGoogleLoginPopup,
    onGoogleLoginRedirect: handleSettingsGoogleLoginRedirect,
    showDonationThanks,
    setShowDonationThanks,
    hundredWaitRecruit,
    beginHundredJoin,
    handleHundredWaitHeadlessState,
    handleHundredWaitHeadlessController,
    handleHundredWaitSessionEnded,
  };

  const appRouterProps: React.ComponentProps<typeof AppRouter> = {
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
    isAuthReady,
    firebaseUser: authUserForUi,
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
    isHost: isRoomCreator || isHostFromMultiplayer,
    isRoomCreator,
    roomHostId,
    roomId,
    syncShareRoomId,
    handleInitRoom,
    isReady,
    handleToggleReady,
    roomStatus: roomStatus as any,
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
    onOpenRenrakuchoAdmin,
    onUpdateFound,
    syncFromHundredRooms,
    hundredRoster,
    hundredRoomHostUid,
    hundredRoomStartedAt,
    hundredRoomLastFoundAt,
    hundredRoomUpdatedAt,
    onHundredRoomFinished,
    onRakudaRoboReplay,
    onRoboPickupLoungeNext,
    onRoboPickupLoungeAutoRefresh,
    ensureAuth,
    hasActiveRecruitments,
    hundredRecruitHasNew,
    markHundredRecruitSeen,
    reversiRecruitHasOpen,
    reversiRecruitHostWaiting,
    gomokuRecruitHasOpen,
    gomokuRecruitHostWaiting,
    viewerCount,
    hubPresencePeers,
    hubVisitorTotal,
    userEmoji,
    setUserEmoji,
    onCancelRecruit: handleCancelRecruit,
    recruitMessageId,
    setRecruitMessageId,
    recruitedAt,
    setRecruitedAt,
    onOpenKeijiban,
    onOpenHundredHub,
    renrakuchoHasUnread,
    ouenNoteHasUnread,
    accounts,
    activeUserId,
    switchAccount,
    createAccount,
    streamMode,
    coordOverlayEnabled,
    adminStreamLiveBadgeControl,
    streamLiveBadgeEnabled,
    setStreamLiveBadgeEnabled,
    showRenrakucho,
    logs,
    addLog,
    recordShussekiGamePlay,
    setSyncFromHundredRooms,
    leaveCurrentHundredRoom,
    greenGateActive: isGreenGateActive(Date.now(), serverGreenUntilMs),
    shussekiRegular,
    hundredWaitHeadlessState,
    onHundredHostStart,
    onHundredJoinRetry,
    endHundredWaitSession,
  };

  const statusProps = {
    language,
    isGenerating,
    isMultiplay,
    roomStatus,
    syncCountdown,
    gateAdPresentation,
    onDismissFullScreenAd: handleDismissFullScreenAd,
  };

  const headerProps: AppHeaderProps = {
    userEmoji,
    nickname,
    isOnline,
    firebaseUser: authUserForUi,
    isAuthReady,
    onGoogleLogin: handleGoogleLogin,
    onGoogleLoginPopup: handleGoogleLoginViaPopup,
    hidden: hideBottomStatusBar,
    greenGateActive: isGreenGateActive(Date.now(), serverGreenUntilMs),
    shussekiRegular,
  };

  return {
    appLayoutProps,
    appRouterProps,
    statusProps,
    headerProps,
    isBanned,
    banUserName,
    banReason,
    showGateSelection,
    handleSelectGate,
    stripeGreenEnabled,
    handleGreenGateCheckout,
    handleGreenGateDevBypass,
    handleEnterGreenGate,
    handleGreenGatePortal,
    greenCheckoutBusy,
    serverGreenUntilMs,
    greenGateHasStripeBilling: !!greenGateServer.stripeCustomerId,
    handleGreenPassRedeem,
    greenPassBusy,
    greenPassStatusMessage,
    greenPassStatusTone,
  };
};
