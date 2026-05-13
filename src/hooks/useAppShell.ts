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
import { adService } from '../services/adService';
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
import { firestoreLikeToMillis, RENRAKU_RECRUIT_TTL_MS } from '../lib/firestoreTime';
import { isRenrakuEntryVisible } from '../lib/renrakuVisibility';
import { isRenrakuAdmin } from '../lib/renrakuAdmin';
import { todayKeyJst } from '../lib/dateKey';
import { computeStampsFromLogs, migrateStampArrays } from '../lib/stampMigration';
import { useRenrakuchoUnreadBadge } from './useRenrakuchoUnreadBadge';
import AppRouter from '../components/AppRouter';
import type { AppLayoutProps } from '../components/AppLayout';
import type { AppHeaderProps } from '../components/AppHeader';
import type { RenrakuchoPublicScreenState } from '../components/Renrakucho/types';
import {
  INTERSTITIAL_ARM_MS,
  INTERSTITIAL_MIN_GAP_MS,
  readLastInterstitialDismissedMs,
  writeLastInterstitialDismissedMs,
} from '../lib/interstitialPolicy';

const RENRAKU_RESUME_KEY = 'rk_renraku_resume';

export const useAppShell = () => {
  const [isEntered, setIsEntered] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  const language = 'ja';

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
  const { firebaseUser, isAuthReady, ensureAuth, handleGoogleLogin } = useAuth(language, setNotification);
  const { logs, addLog } = useLogs(firebaseUser, handleFirestoreError);

  const isRenrakuAdminUser = useMemo(() => isRenrakuAdmin(firebaseUser), [firebaseUser]);
  const renrakuchoHasUnread = useRenrakuchoUnreadBadge(isRenrakuAdminUser, isAuthReady);

  const [hasActiveRecruitments, setHasActiveRecruitments] = useState(false);

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
  } = useGame(user, setUser, nickname, language, setNotification, handleFirestoreError, firebaseUser, isAuthReady, ensureAuth, userEmoji, showPuzzleSizeHint);

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
  } = useMultiplayer(multiplayerRoomId, nickname, userEmoji, firebaseUser?.uid || null, isRoomCreator);

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showInstructionModal, setShowInstructionModal] = useState(false);
  const [isBgmEnabled, setIsBgmEnabled] = useState(true);
  const isAdVisible = true;
  const setIsAdVisible = useCallback((_visible: boolean) => {
    // Ads are always on (no user-side hide).
  }, []);
  const [isStampCardOpen, setIsStampCardOpen] = useState(false);
  const [showFullScreenAd, setShowFullScreenAd] = useState(false);
  /** 2分経過後「次の自然な区切り」で全面広告を出してよい（メモリのみ） */
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
  const [clearsCount, setClearsCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [recruitMessageId, setRecruitMessageId] = useState<string | null>(null);
  const [recruitedAt, setRecruitedAt] = useState<string | null>(null);
  // hundredRoomId was only used by the removed legacy sync-hundred route

  const streamMode = useMemo(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    try {
      const params = new URLSearchParams(search);
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
    const w = window as any;
    if (typeof w.gtag !== 'function') return;

    const send = () => {
      try {
        w.gtag('event', 'page_view', {
          page_path: window.location.pathname + window.location.search,
          page_location: window.location.href,
          page_title: document.title,
        });
      } catch {
        // ignore
      }
    };

    // initial
    send();

    const origPush = window.history.pushState;
    const origReplace = window.history.replaceState;
    const wrap = (fn: any) =>
      function (this: History, ...args: any[]) {
        const r = fn.apply(this, args);
        send();
        return r;
      };

    try {
      window.history.pushState = wrap(origPush) as any;
      window.history.replaceState = wrap(origReplace) as any;
    } catch {
      // ignore
    }

    const onPop = () => send();
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
  const cloudUid = firebaseUser?.uid ?? null;
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

        setUser((prev: any) => ({
          ...prev,
          ...(nextNickname ? { nickname: nextNickname } : {}),
          ...(nextEmoji ? { userEmoji: nextEmoji } : {}),
          ...(nextPoints !== undefined ? { totalPoints: nextPoints } : {}),
          ...(nextCompleted ? { completedDates: nextCompleted } : {}),
          ...(nextSpecial ? { specialDates: nextSpecial } : {}),
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
  }, [cloudUid, nickname, userEmoji, user.completedDates, user.nickname, user.specialDates, user.totalPoints, user.userEmoji, setUser]);

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
    if (screen === 'game') {
      setShowRenrakucho(false);
      setShowSettingsModal(false);
      setShowInstructionModal(false);
      setIsStampCardOpen(false);
    }
  }, [screen]);

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
    if (screen === 'quiet-room') {
      audioService.stop();
    } else if (isBgmEnabled && isEntered) {
      audioService.start();
    }
  }, [screen, isBgmEnabled, isEntered]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    // Lightweight mode: avoid background Firestore subscription on low-memory devices.
    // We only monitor recruitments while Renrakucho (みんなであそぶ/掲示板) is open.
    if (!showRenrakucho) {
      setHasActiveRecruitments(false);
      return;
    }
    const q = query(collection(db, 'renraku_public'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const now = Date.now();
        const active = snapshot.docs.some((doc) => {
          const data = doc.data();
          if (!isRenrakuEntryVisible(data)) return false;
          if (data.type !== 'recruit' || !data.createdAt) return false;
          const createdMs = firestoreLikeToMillis(data.createdAt);
          if (createdMs == null) return false;
          const expiryTime = createdMs + RENRAKU_RECRUIT_TTL_MS;
          return now < expiryTime;
        });
        setHasActiveRecruitments(active);
      },
      error => {
        console.error('Error monitoring recruitments:', error);
      }
    );
    return () => unsubscribe();
  }, [showRenrakucho]);

  // Migrate/repair stamp arrays from clear logs (JST date keys).
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
        computedCompletedDates: computed.completedDates,
        computedSpecialDates: computed.specialDates,
        computedRange: computed.range,
      });

      if (!migrated.changed) return prev;
      return { ...prev, completedDates: migrated.completedDates, specialDates: migrated.specialDates };
    });
  }, [isAuthReady, logs, setUser]);

  useEffect(() => {
    if (isAuthReady) {
      const today = todayKeyJst();
      setUser(prev => {
        const dates = prev.completedDates || [];
        if (!dates.includes(today)) {
          return { ...prev, completedDates: [...dates, today] };
        }
        return prev;
      });
    }
  }, [isAuthReady, setUser]);

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
      addLog(
        res.type || 'game_clear',
        res.tag || 'SUCCESS',
        res.message || (res.category?.title ? `${res.category.title}をクリア！` : 'クリア！'),
        res.details || {
          category: res.category?.category,
          difficulty: res.difficulty,
          seed: res.actualSeed,
          wordsCount: res.foundWords?.length,
        },
        res.emoji || res.category?.emoji
      );
    },
    [addLog]
  );

  const handleClear = useCallback(() => {
    setClearsCount(prev => prev + 1);
    handleRecordFinish();
  }, [handleRecordFinish]);

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
    setShowFullScreenAd(false);
    flushInterstitialDismissWaiter();
  }, [flushInterstitialDismissWaiter]);

  /**
   * 「自然な区切り」で呼ぶ。2分アーム済みかつ直近60秒以内に出していなければ全面広告を出し、閉じるまで await。
   */
  const tryInterstitialAtNaturalBreak = useCallback(async () => {
    if (streamMode) return;
    if (showFullScreenAd) return;
    if (isGenerating) return;
    const narr = typeof narration === 'string' ? narration.trim() : '';
    if (narr.length > 0) return;

    const now = Date.now();
    const last = lastInterstitialDismissedMsRef.current;
    if (now - last < INTERSTITIAL_MIN_GAP_MS) return;
    if (!interstitialArmedRef.current && now - last < INTERSTITIAL_ARM_MS) return;
    if (!interstitialArmedRef.current) return;

    interstitialArmedRef.current = false;
    await adService.showInterstitial();
    await new Promise<void>((resolve) => {
      interstitialDismissWaitersRef.current.push(resolve);
      setShowFullScreenAd(true);
    });
  }, [streamMode, showFullScreenAd, isGenerating, narration]);

  const onOpenHundredHub = useCallback(async () => {
    setRenrakuchoInitialActiveTab('public');
    setRenrakuchoInitialPublicScreen('list');
    setRenrakuchoMountKey((k) => k + 1);
    window.history.pushState({ rk: 'hundred-hub' }, '', '/hundred');
    setShowRenrakucho(true);
    // Auth can be slow/unreliable on some iPad/Safari environments.
    // Open the UI first so it doesn't look "broken", then ensure auth in background.
    void ensureAuth().catch(() => {
      /* keep flow */
    });
  }, [ensureAuth, setShowRenrakucho]);

  const onOpenRenrakuchoAdmin = useCallback(async () => {
    setRenrakuchoInitialActiveTab('admin');
    setRenrakuchoInitialPublicScreen('list');
    setRenrakuchoMountKey((k) => k + 1);
    window.history.pushState({ rk: 'hundred-hub-admin' }, '', '/hundred');
    setShowRenrakucho(true);
    // Admin tab still requires auth for actions, but opening the UI should be immediate.
    void ensureAuth().catch(() => {
      /* keep flow */
    });
  }, [ensureAuth, setShowRenrakucho]);

  useEffect(() => {
    if (!isEntered) return;
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
      if (canceled) return;
      setRenrakuchoInitialActiveTab('public');
      setRenrakuchoInitialPublicScreen('list');
      setRenrakuchoMountKey((k) => k + 1);
      setShowRenrakucho(true);
      // Ensure auth in background; don't block showing the overlay.
      void ensureAuth().catch(() => {
        /* keep flow */
      });
    })();

    return () => {
      canceled = true;
    };
  }, [isEntered, screen, showRenrakucho, ensureAuth, setShowRenrakucho]);

  const appLayoutProps: AppLayoutProps = {
    // Ad banner is always present on normal screens; reserve space to avoid covering UI.
    reserveBottomAdSpace: !streamMode && !(isMultiplay && screen === 'game') && screen !== 'seat-selection',
    language,
    isGenerating,
    isMultiplay,
    roomStatus,
    syncCountdown,
    generatingTitle: syncFromHundredRooms && isGenerating ? 'ホストが問題を作成中です...' : undefined,
    generatingHint: syncFromHundredRooms && isGenerating ? 'しばらくお待ちください' : undefined,
    showFullScreenAd,
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
    renrakuchoMountKey,
    renrakuchoInitialActiveTab,
    renrakuchoInitialPublicScreen,
    streamMode,
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
    viewerCount,
    userEmoji,
    setUserEmoji,
    onCancelRecruit: handleCancelRecruit,
    recruitMessageId,
    setRecruitMessageId,
    recruitedAt,
    setRecruitedAt,
    onOpenHundredHub,
    renrakuchoHasUnread,
    accounts,
    activeUserId,
    switchAccount,
    createAccount,
    streamMode,
    showRenrakucho,
  };

  const statusProps = {
    language,
    isGenerating,
    isMultiplay,
    roomStatus,
    syncCountdown,
    showFullScreenAd,
    onDismissFullScreenAd: handleDismissFullScreenAd,
  };

  const headerProps: AppHeaderProps = {
    userEmoji,
    nickname,
    isOnline,
  };

  return {
    appLayoutProps,
    appRouterProps,
    statusProps,
    headerProps,
    isBanned,
    banUserName,
  };
};
