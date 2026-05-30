import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useUser } from './useUser';
import { useAuth } from './useAuth';
import { useLogs } from './useLogs';
import { useGame } from './useGame';
import { usePresence } from './usePresence';
import { useWakeLock } from './useWakeLock';
import { usePwa } from './usePwa';
import { useUrlParams } from './useUrlParams';
import { useMultiplayer } from './useMultiplayer';
import { handleFirestoreError, stringToSeed, vibrate, encodeProCode, decodeProCode } from '../lib/utils';
import { MASTER } from '../constants';
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
import { todayKeyJst } from '../lib/dateKey';
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
} from '../lib/rakudaHubShell';
import { useRenrakuchoUnreadBadge } from './useRenrakuchoUnreadBadge';
import { markHundredRecruitSeenNow, useHundredRecruitHubAlert } from './useHundredRecruitHubAlert';
import { useReversiRecruitHubAlert } from './useReversiRecruitHubAlert';
import AppRouter from '../components/AppRouter';
import type { AppLayoutProps } from '../components/AppLayout';
import type { AppHeaderProps } from '../components/AppHeader';
import type { HundredPublicRecruit, RenrakuchoPublicScreenState } from '../components/Renrakucho/types';
import {
  clearHundredRestoreSession,
  loadHundredRestoreSession,
  saveHundredRestoreSession,
} from '../lib/rakudaHundredRestore';
import { sendGaPageView } from '../lib/initGa';
import { readRakudaProfileQuery } from '../lib/sanjuuWebOrigin';
import {
  activateGreenGateSubscription,
  applyGateNicknameCssColor,
  clearRakudaGateChoice,
  gateAdSequenceForGate,
  resolveActiveRakudaGate,
  shouldShowGateSelection,
  shouldSuppressAdsForGate,
  syncLocalGreenGateFromServer,
  writeRakudaGateChoice,
  type RakudaGateId,
} from '../lib/rakudaGate';
import { isGreenGateStripeEnabled } from '../lib/greenGateStripeConfig';
import { createGreenGateCheckoutSession, syncGreenGateAfterCheckout } from '../lib/greenGateStripeClient';
import { resolveDonationThanksOnLoad } from '../lib/donationReturn';
import {
  cancelSocialPlayAdDeferral,
  settleSocialPlayAdSession,
  shouldDeferInterstitialDuringSocialPlay,
} from '../lib/socialPlayAdSession';
import { useGreenGateFirestore } from './useGreenGateFirestore';

const RENRAKU_RESUME_KEY = 'rk_renraku_resume';

export const useAppShell = () => {
  const [isEntered, setIsEntered] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  const language = 'ja';

  const [showGateSelection, setShowGateSelection] = useState(() => shouldShowGateSelection());
  const [rakudaGate, setRakudaGate] = useState<RakudaGateId | null>(() => resolveActiveRakudaGate());

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

  const { firebaseUser, effectiveFirebaseUser, isAuthReady, ensureAuth, handleGoogleLogin, handleGoogleLoginViaPopup, handleGoogleLogout } =
    useAuth(language, setNotification);
  const authUserForUi = effectiveFirebaseUser ?? firebaseUser;
  const serverGreenUntilMs = useGreenGateFirestore(authUserForUi?.uid);
  const stripeGreenEnabled = isGreenGateStripeEnabled();
  const [greenCheckoutBusy, setGreenCheckoutBusy] = useState(false);
  const { logs, addLog } = useLogs(authUserForUi, handleFirestoreError);

  const isRenrakuAdminUser = useMemo(() => isRenrakuAdmin(authUserForUi), [authUserForUi]);
  const renrakuchoHasUnread = useRenrakuchoUnreadBadge(isRenrakuAdminUser, isAuthReady);

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
    const active = resolveActiveRakudaGate(Date.now(), serverGreenUntilMs);
    setRakudaGate(active);
    setShowGateSelection(shouldShowGateSelection(Date.now(), serverGreenUntilMs));
  }, [serverGreenUntilMs]);

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
    handleRecordFinish,
    onUpdateFound,
    setSyncFromHundredRooms,
    syncFromHundredRooms,
    hundredRoster,
    hundredRoomHostUid,
    onHundredRoomFinished,
  } = useGame(user, setUser, nickname, language, setNotification, handleFirestoreError, authUserForUi, isAuthReady, ensureAuth, userEmoji, showPuzzleSizeHint);

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
  /** 2分経過後「次の自然な区切り」でリワード／全面を出してよい（メモリのみ） */
  const interstitialArmedRef = useRef(false);
  const lastInterstitialDismissedMsRef = useRef(readLastInterstitialDismissedMs());
  const interstitialDismissWaitersRef = useRef<Array<() => void>>([]);

  const [showRenrakucho, setShowRenrakuchoState] = useState(false);
  const [renrakuchoMountKey, setRenrakuchoMountKey] = useState(0);
  const [renrakuchoInitialActiveTab, setRenrakuchoInitialActiveTab] = useState<'post' | 'public' | 'admin' | undefined>(
    undefined
  );
  const [renrakuchoInitialPublicScreen, setRenrakuchoInitialPublicScreen] = useState<
    RenrakuchoPublicScreenState | undefined
  >(undefined);
  const [renrakuchoInitialSelectedHundred, setRenrakuchoInitialSelectedHundred] =
    useState<HundredPublicRecruit | null>(null);

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
        window.history.replaceState(null, '', '/');
      }
    }
    setShowRenrakuchoState(show);
  }, []);

  const hundredRecruitHubEnabled =
    isAuthReady &&
    (screen === 'seat-selection' || screen === 'slide-puzzle' || screen === 'othello') &&
    !showRenrakucho;
  const {
    hasActiveRecruits: hasActiveRecruitments,
    hasNewRecruits: hundredRecruitHasNew,
    markSeen: markHundredRecruitSeen,
  } = useHundredRecruitHubAlert(hundredRecruitHubEnabled);

  const { hasOpenRecruits: reversiRecruitHasOpen, hasMyHostRecruiting: reversiRecruitHostWaiting } =
    useReversiRecruitHubAlert(hundredRecruitHubEnabled, authUserForUi?.uid ?? null);

  const [clearsCount, setClearsCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [recruitMessageId, setRecruitMessageId] = useState<string | null>(null);
  const [recruitedAt, setRecruitedAt] = useState<string | null>(null);
  // hundredRoomId was only used by the removed legacy sync-hundred route

  const streamMode = useMemo(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    try {
      const params = new URLSearchParams(search);
      if (params.get('stream') === '0') {
        try {
          window.localStorage.setItem('rk_stream_mode', '0');
        } catch {
          /* ignore */
        }
        return false;
      }
      if (params.get('stream') === '1') return true;
    } catch {
      // ignore
    }
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem('rk_stream_mode') === '1';
    } catch {
      return false;
    }
  }, []);

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
    if (typeof window === 'undefined') return;
    let v: string | null = null;
    try {
      const params = new URLSearchParams(window.location.search);
      v = params.get('stream');
    } catch {
      v = null;
    }
    if (v !== '0' && v !== '1') return;
    try {
      window.localStorage.setItem('rk_stream_mode', v);
    } catch {
      // ignore
    }
  }, []);

  const enableViewerCount = useMemo(() => {
    // 配信モードでは回線・負荷優先で viewer 購読を止める（YouTube Live の安定化）。
    if (streamMode) return false;
    // 閲覧者数は運用者だけが気にする想定のため、既定では全ユーザーでの購読を無効化する。
    // - 連絡帳管理者は常に有効
    // - それ以外は URL クエリ `?viewer=1` または localStorage `rk_viewer_count=1` で手動有効化
    if (isRenrakuAdminUser) return true;
    const search = typeof window !== 'undefined' ? window.location.search : '';
    try {
      const params = new URLSearchParams(search);
      if (params.get('viewer') === '1') return true;
    } catch {
      // ignore
    }
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem('rk_viewer_count') === '1';
    } catch {
      return false;
    }
  }, [isRenrakuAdminUser, streamMode]);

  const { viewerCount } = usePresence(isAuthReady, nickname, enableViewerCount);
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
  const lastCloudPullAtMsRef = useRef(0);
  const cloudWriteTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const lastPushedSnapshotRef = useRef<string>('');
  const cloudInitialSyncDoneRef = useRef(false);
  const didStampMigrationRef = useRef(false);

  const localUpdatedAtMs = useMemo(() => {
    const s = (user.lastSyncAt || '').trim();
    const ms = s ? Date.parse(s) : 0;
    return Number.isFinite(ms) ? ms : 0;
  }, [user.lastSyncAt]);

  const pullFromCloud = useCallback(
    async (reason: 'login' | 'foreground') => {
      if (!cloudUid) return;
      // Avoid repeated reads on frequent focus events.
      const now = Date.now();
      const minIntervalMs = reason === 'login' ? 0 : 60_000;
      if (now - lastCloudPullAtMsRef.current < minIntervalMs) return;
      lastCloudPullAtMsRef.current = now;

      try {
        // Ensure an ID token is available before Firestore access.
        try {
          await auth.currentUser?.getIdToken();
        } catch (e) {
          console.warn('[CloudSync] getIdToken before pull failed', e);
        }
        const snap = await getDoc(doc(db, 'rk_users', cloudUid));
        if (!snap.exists()) {
          // No cloud record yet. Allow first push to create it.
          if (reason === 'login') cloudInitialSyncDoneRef.current = true;
          return;
        }
        const d = snap.data() as Record<string, unknown>;
        const cloudUpdated =
          typeof d.updatedAtMs === 'number' ? d.updatedAtMs : Number(d.updatedAtMs) || 0;

        if (cloudUpdated <= localUpdatedAtMs) return;

        const nextNickname = typeof d.nickname === 'string' ? d.nickname : '';
        const nextEmoji = typeof d.userEmoji === 'string' ? d.userEmoji : '';
        const nextPoints = typeof d.totalPoints === 'number' ? d.totalPoints : Number(d.totalPoints) || undefined;
        const nextCompleted = Array.isArray(d.completedDates) ? (d.completedDates as string[]) : undefined;
        const nextSpecial = Array.isArray(d.specialDates) ? (d.specialDates as string[]) : undefined;
        const nextDaily =
          d.dailyClearCounts && typeof d.dailyClearCounts === 'object'
            ? (d.dailyClearCounts as Record<string, number>)
            : undefined;

        setUser((prev: any) => ({
          ...prev,
          ...(nextNickname ? { nickname: nextNickname } : {}),
          ...(nextEmoji ? { userEmoji: nextEmoji } : {}),
          ...(nextPoints !== undefined ? { totalPoints: nextPoints } : {}),
          ...(nextCompleted ? { completedDates: nextCompleted } : {}),
          ...(nextSpecial ? { specialDates: nextSpecial } : {}),
          ...(nextDaily ? { dailyClearCounts: nextDaily } : {}),
          lastSyncAt: new Date(cloudUpdated).toISOString(),
        }));
        if (reason === 'login') cloudInitialSyncDoneRef.current = true;
      } catch (e) {
        console.warn('[CloudSync] pull failed', e);
        // Fail-safe: don't push immediately after a pull failure (prevents wiping cloud).
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
    const payload = {
      uid: cloudUid,
      nickname: (user.nickname || nickname || '').trim(),
      userEmoji: (user.userEmoji || userEmoji || '').trim(),
      totalPoints: typeof user.totalPoints === 'number' ? user.totalPoints : 0,
      completedDates: Array.isArray(user.completedDates) ? user.completedDates : [],
      specialDates: Array.isArray(user.specialDates) ? user.specialDates : [],
      dailyClearCounts:
        user.dailyClearCounts && typeof user.dailyClearCounts === 'object' ? user.dailyClearCounts : {},
      updatedAtMs: now,
    };

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
      console.warn('[CloudSync] push failed', e);
      // allow retry on next change
      lastPushedSnapshotRef.current = '';
    }
  }, [cloudUid, nickname, userEmoji, user.completedDates, user.dailyClearCounts, user.nickname, user.specialDates, user.totalPoints, user.userEmoji, setUser]);

  // Pull once when a real uid becomes available.
  useEffect(() => {
    if (!isAuthReady) return;
    if (!cloudUid) return;
    cloudInitialSyncDoneRef.current = false;
    void pullFromCloud('login');
  }, [cloudUid, isAuthReady, pullFromCloud]);

  // Global ban gate: if uid exists in blockedUsers, deny entry to the whole app.
  useEffect(() => {
    if (!isAuthReady) return;
    if (!cloudUid) {
      setIsBanned(false);
      setBanUserName(null);
      return;
    }
    const ref = doc(db, 'blockedUsers', cloudUid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const banned = snap.exists();
        setIsBanned(banned);
        if (!banned) {
          setBanUserName(null);
          return;
        }
        const d = snap.data() as Record<string, unknown>;
        const n = typeof d.userName === 'string' ? d.userName.trim() : '';
        setBanUserName(n || null);
        // Force back to hub so lingering game UI doesn't keep running.
        setIsEntered(true);
        setScreen('seat-selection');
        setShowRenrakucho(false);
      },
      (e) => {
        console.warn('[BanGate] blockedUsers subscription failed', e);
        // Fail-open: don't ban on transient errors.
        setIsBanned(false);
        setBanUserName(null);
      }
    );
    return () => unsub();
  }, [cloudUid, isAuthReady, setScreen, setShowRenrakucho]);

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

  useEffect(() => {
    if (roomStatus === 'playing' && isHostFromMultiplayer && recruitMessageId) {
      handleCancelRecruit();
    }
  }, [roomStatus, isHostFromMultiplayer, recruitMessageId, handleCancelRecruit]);

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
        if (recruitMessageId) {
          await handleCancelRecruit();
        }

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
    [roomId, isHostFromMultiplayer, recruitMessageId, handleCancelRecruit, updateRoomStatus, startNewGame, startSearchGame]
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

  useUrlParams(isAuthReady, handleConfirmJoin, startSearchGame, startNewGame);

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

  const recordShussekiGamePlay = useCallback((): number => {
    let todayCount = 0;
    setUser((prev) => {
      const result = applyShussekiGamePlayRecord(prev);
      todayCount = result.todayCount;
      return result.user;
    });
    return todayCount;
  }, [setUser]);

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
      const hira = s.trim();
      if (!hira) {
        const cat = MASTER.categories[Math.floor(Math.random() * MASTER.categories.length)];
        vibrate(30);
        startNewGame(cat);
        return;
      }
      const decoded = decodeProCode(hira);
      if (decoded) {
        const cat = MASTER.categories.find(c => c.category === decoded.category);
        if (cat) {
          vibrate(30);
          startNewGame(cat, decoded.seed, decoded.difficulty);
          return;
        }
      }
      const seedNum = stringToSeed(hira);
      const catIndex = seedNum % MASTER.categories.length;
      const cat = MASTER.categories[catIndex];
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

  useEffect(() => {
    setInterstitialUiHandler(async (presentation) => {
      if (streamModeRef.current) return;
      if (shouldSuppressAdsForGate()) return;
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
    if (shouldSuppressAdsForGate()) return;
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

    const gate = rakudaGateRef.current ?? resolveActiveRakudaGate();
    if (gateAdSequenceForGate(gate).length <= 0) return;

    interstitialArmedRef.current = false;
    await adService.showInterstitialForGate(gate);
  }, [streamMode, gateAdPresentation, isGenerating, narration]);

  /** 対人セッション終了（席に戻る）— 2分アーム不要でゲート契約どおり清算 */
  const tryInterstitialAtSocialSessionEnd = useCallback(async () => {
    if (streamMode) {
      settleSocialPlayAdSession();
      return;
    }
    if (shouldSuppressAdsForGate()) {
      cancelSocialPlayAdDeferral();
      return;
    }
    if (gateAdPresentation) return;
    if (isGenerating) return;
    const narr = typeof narration === 'string' ? narration.trim() : '';
    if (narr.length > 0) return;

    if (!settleSocialPlayAdSession()) return;

    const gate = rakudaGateRef.current ?? resolveActiveRakudaGate();
    if (gateAdSequenceForGate(gate).length <= 0) return;

    interstitialArmedRef.current = false;
    await adService.showInterstitialForGate(gate);
  }, [streamMode, gateAdPresentation, isGenerating, narration]);

  const handleSelectGate = useCallback(
    (gate: RakudaGateId) => {
      if (gate === 'green') return;
      writeRakudaGateChoice(gate);
      const active = resolveActiveRakudaGate(undefined, serverGreenUntilMs);
      setRakudaGate(active);
      applyGateNicknameCssColor(active);
      setShowGateSelection(false);
      setScreen('seat-selection');
    },
    [setScreen, serverGreenUntilMs],
  );

  const handleGreenGateDevBypass = useCallback(() => {
    activateGreenGateSubscription();
    const active = resolveActiveRakudaGate(undefined, serverGreenUntilMs);
    setRakudaGate(active);
    applyGateNicknameCssColor(active);
    setShowGateSelection(false);
    setScreen('seat-selection');
  }, [setScreen, serverGreenUntilMs]);

  const handleGreenGateCheckout = useCallback(async () => {
    if (!stripeGreenEnabled) return;
    setGreenCheckoutBusy(true);
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
    authUserForUi,
    handleGoogleLogin,
    handleGoogleLoginViaPopup,
    setNotification,
  ]);

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
      const active = resolveActiveRakudaGate(Date.now(), synced.greenUntilMs ?? serverGreenUntilMs);
      setRakudaGate(active);
      applyGateNicknameCssColor(active);
      setShowGateSelection(false);
      setScreen('seat-selection');
      setNotification('緑のゲートが有効になりました。協力ありがとうございます。');
    })();
  }, [isAuthReady, authUserForUi, serverGreenUntilMs, setNotification, setScreen]);

  useEffect(() => {
    if (resolveDonationThanksOnLoad()) setShowDonationThanks(true);
  }, []);

  const handleRequestGateReselect = useCallback(() => {
    clearRakudaGateChoice();
    setRakudaGate(null);
    applyGateNicknameCssColor(null);
    setShowGateSelection(true);
    setShowSettingsModal(false);
  }, []);

  const onOpenKeijiban = useCallback(async () => {
    await waitForGoogleSessionRestore(2500);
    if (authUserForUi && isRenrakuAdmin(authUserForUi)) {
      await ensureRenrakuAdminFirestoreAuth(authUserForUi);
    }
    setRenrakuchoInitialActiveTab('public');
    setRenrakuchoInitialPublicScreen('list');
    setRenrakuchoInitialSelectedHundred(null);
    window.history.pushState({ rk: 'keijiban' }, '', '/keijiban');
    setShowRenrakucho(true);
  }, [authUserForUi, setShowRenrakucho]);

  const onOpenHundredHub = useCallback(
    async (opts?: { focusCreateForm?: boolean }) => {
      const focusCreate = opts?.focusCreateForm !== false;
      setRenrakuchoInitialActiveTab('public');
      if (focusCreate) {
        clearHundredRestoreSession();
        setRenrakuchoInitialPublicScreen('list');
        setRenrakuchoInitialSelectedHundred(null);
      } else {
        const restored = loadHundredRestoreSession();
        setRenrakuchoInitialPublicScreen(restored?.publicScreen ?? 'list');
        setRenrakuchoInitialSelectedHundred(restored?.selectedHundred ?? null);
      }
      setRenrakuchoMountKey((k) => k + 1);
      if (focusCreate) {
        try {
          window.localStorage.setItem('rk_stream_mode', '0');
        } catch {
          /* ignore */
        }
      }
      const hash = focusCreate ? `#${RAKUDA_HUNDRED_CREATE_FRAGMENT}` : '';
      const query = focusCreate ? '?stream=0' : '';
      window.history.pushState({ rk: 'hundred-hub' }, '', `/hundred${query}${hash}`);
      setShowRenrakucho(true);
      if (!focusCreate) {
        markHundredRecruitSeenNow();
      }
      void ensureAuth().catch(() => {
        /* keep flow */
      });
    },
    [ensureAuth, setShowRenrakucho]
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
    window.history.pushState({ rk: 'hundred-hub-admin' }, '', '/hundred');
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
    const openRenrakuFromPath =
      pathNorm === '/hundred' ||
      pathNorm.endsWith('/hundred') ||
      pathNorm === '/keijiban' ||
      pathNorm.endsWith('/keijiban');
    if (!openRenrakuFromPath) return;
    if (showRenrakucho) return;

    let canceled = false;
    void (async () => {
      await waitForGoogleSessionRestore(2500);
      if (canceled) return;
      setRenrakuchoInitialActiveTab('public');
      try {
        const h =
          typeof window !== 'undefined' && typeof window.location?.hash === 'string' ? window.location.hash : '';
        const wantsCreate =
          h === `#${RAKUDA_HUNDRED_CREATE_FRAGMENT}` || h.endsWith(`#${RAKUDA_HUNDRED_CREATE_FRAGMENT}`);
        if (wantsCreate) {
          clearHundredRestoreSession();
          setRenrakuchoInitialPublicScreen('list');
          setRenrakuchoInitialSelectedHundred(null);
        } else {
          const restored = loadHundredRestoreSession();
          setRenrakuchoInitialPublicScreen(restored?.publicScreen ?? 'list');
          setRenrakuchoInitialSelectedHundred(restored?.selectedHundred ?? null);
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

  const hideBottomStatusBar = useMemo(() => {
    if (
      screen === 'quiet-room' ||
      screen === 'slide-puzzle' ||
      screen === 'othello' ||
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
    suppressGameStatusOverlays: suppressesQuietImmersiveGlobalChrome(screen),
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
    onJoinRoom: handleConfirmJoin,
    onStartHundred: (hundredRoomDocId: string) => {
      const restored = loadHundredRestoreSession();
      if (restored?.selectedHundred?.roomId === hundredRoomDocId) {
        saveHundredRestoreSession({
          publicScreen: 'hundred-board',
          selectedHundred: restored.selectedHundred,
        });
      }
      setIsGenerating(true);
      setShowRenrakucho(false);
      // みんなであそぶは既存 GameScreen + hundred_rooms（grid/words/foundWords）購読
      // 前のゲームの foundWords が残ると入室直後に帯が出て「即クリア」扱いになるため、先にクリアする
      // foundWords だけでなく盤面自体も空にする（新ルームの盤面が届くまで前の盤面が見えてしまう事故を防ぐ）
      setGameState((prev) => ({ ...prev, grid: [], placedWords: [], foundWords: [] }));
      setIsMultiplay(false);
      setIsSyncMode(true);
      setSyncFromHundredRooms(true);
      setRoomId(hundredRoomDocId);
      setScreen('game');
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
    gateSuppressAds,
    rakudaGate,
    onRequestGateReselect: handleRequestGateReselect,
    showDonationThanks,
    setShowDonationThanks,
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
    onHundredRoomFinished,
    ensureAuth,
    hasActiveRecruitments,
    hundredRecruitHasNew,
    markHundredRecruitSeen,
    reversiRecruitHasOpen,
    reversiRecruitHostWaiting,
    viewerCount,
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
    accounts,
    activeUserId,
    switchAccount,
    createAccount,
    streamMode,
    showRenrakucho,
    logs,
    addLog,
    recordShussekiGamePlay,
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
  };

  return {
    appLayoutProps,
    appRouterProps,
    statusProps,
    headerProps,
    isBanned,
    banUserName,
    showGateSelection,
    handleSelectGate,
    stripeGreenEnabled,
    handleGreenGateCheckout,
    handleGreenGateDevBypass,
    greenCheckoutBusy,
  };
};
