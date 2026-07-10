import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { btnGhost, btnPrimary } from '../../../ui/policy';
import type { HundredPublicRecruit } from '../types';
import { auth, db } from '../../../firebase';
import { tripFirestoreCircuit } from '../../../lib/firestoreCircuit';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  deleteField,
} from 'firebase/firestore';
import {
  applyHostCancelledHundredGeneration,
  hundredPublicListingDocId,
} from '../../../lib/hundredRecruitCancel';
import { WORKER_CODE } from '../../../lib/puzzleWorker';
import { hundredPickupWorkerTimeoutMs } from '../../../lib/hundredPickupWorkerTimeout';
import {
  shouldRunPickupSync,
} from '../../../lib/hundredPickupGenerate';
import {
  countPlacedWordOccurrences,
  hundredPickupMinOccurrences,
} from '../../../lib/hundredPickupOccurrences';
import {
  generatePickupBoardReliable,
  isPickupBoardComboFeasible,
  pickupBoardFeasibilityErrorMessage,
  PICKUP_TARGET_COVERAGE,
} from '../../../lib/hundredPickupFeasibility';
import {
  isPickupTargetWordLengthOk,
  normalizePickupCharset,
  pickupLengthBounds,
} from '../../../lib/hundredPickupCharset';
import {
  formatBoardDimensions,
  resolveBoardCols,
  resolveBoardRows,
  targetWordFitsBoard,
} from '../../../lib/boardDimensions';
import { PROHIBITED_WORDS } from '../../../constants';
import { firestoreSafeJson, gridRowsFromFirestore, gridToFirestoreRows, hundredRoomBoardReady, hundredRoomCanEnterGame } from '../../../lib/hundredRoomBoard';
import {
  isHundredRoomInPlay,
  firestoreLikeToMillis,
  HUNDRED_OPEN_RECRUIT_DEADLINE_MS,
  isHundredBetweenRounds,
  isHundredOpenRecruitSessionEnded,
  type HundredRoomListMeta,
} from '../../../lib/firestoreTime';
import { parseHundredRoomMeta } from '../../../lib/hundredRoomListMeta';
import { syncHundredPublicForNewRound } from '../../../lib/hundredPublicRoundSync';
import { sanjuuRecruitBoardUrlForHundredRecruit } from '../../../lib/sanjuuWebOrigin';
import { RK_GATE_NICK_DISPLAY_CLASS } from '../../../lib/rakudaGate';
import { RK_GREEN_GATE_AVATAR_SHELL_CLASS } from '../../../lib/greenGateEmoji';
import RakudaGreenGateEmoji from '../../RakudaGreenGateEmoji';
import { useGreenGateActiveByUids } from '../../../hooks/useGreenGateActiveByUids';
import { RENRAKU_STATUS_ACTIVE } from '../../../lib/rakudaHubShell';
import {
  HUNDRED_MAX_PLAYERS,
  HUNDRED_ROOM_FULL_ERROR,
} from '../../../lib/hundredRoomCapacity';
import { clearHundredRestoreSession } from '../../../lib/rakudaHundredRestore';
import {
  countActiveHundredPlayersFromDocs,
  filterPresentHundredPlayers,
  filterRoboLoungeRoundPlayers,
  HUNDRED_PLAYER_HEARTBEAT_MS,
  HUNDRED_PLAYER_PRESENCE_TICK_MS,
} from '../../../lib/hundredPlayerPresence';
import {
  getFirestoreErrorCode,
  checkHundredRoomJoinCapacity,
  isHundredJoinRetryableError,
  leaveHundredRoomPlayer,
  reconcileHundredRoomPlayerCount,
} from '../../../lib/hundredRoomPlayer';
import HundredFullRoomPanel from './HundredFullRoomPanel';
import HundredProblemGeneratingOverlay from './HundredProblemGeneratingOverlay';
import {
  TILE_MATCH_DIFFICULTY_LABELS_JA,
  TILE_MATCH_HUNDRED_MODE,
  TILE_MATCH_LABEL_JA,
  type HundredStartOpts,
  type TileMatchDifficultyId,
} from '../../../lib/tileMatch/config';
import {
  buildInitialTileMatchRoomBoard,
  tileMatchBoardToFirestore,
} from '../../../lib/tileMatch/hundredSync';
import {
  isRoboPickupLoungeRecruit,
  resolveRoboPickupLoungeProfile,
  roboLoungeBoardSizeMismatch,
} from '../../../lib/roboPickupLoungeConfig';
import {
  ensureRoboPickupLoungeRoomDoc,
  refreshRoboPickupLoungeSeedIfNeeded,
  refreshRoboPickupLoungeBoardSizeIfNeeded,
} from '../../../lib/roboPickupLoungeRefresh';
import RoboPickupLoungeGuide from './RoboPickupLoungeGuide';
import type {
  HundredWaitHeadlessController,
  HundredWaitHeadlessState,
} from '../../../lib/hundredWaitHeadless';

type RoomPlayer = {
  uid: string;
  name: string;
  emoji: string;
  lastActiveAt?: unknown;
  joinedAt?: unknown;
};
type LobbyChatMessage = {
  id: string;
  uid: string;
  name: string;
  emoji: string;
  text: string;
  createdAtMs: number | null;
  flagged: boolean;
};

// 「探しもの」は単語 1 つだけを大量に配置する（正解リストに余計な語を混ぜない）

const HundredWaitPanel: React.FC<{
  selectedHundred: HundredPublicRecruit;
  nickname: string;
  userEmoji: string;
  currentUid: string | undefined;
  /** 配信/低負荷モード（YouTube Live 安定化用） */
  streamMode?: boolean;
  onBack: () => void;
  onStartHundred: (roomId: string, opts?: HundredStartOpts) => void | Promise<boolean>;
  /** ホストが生成キャンセルで募集を閉じたあと（一覧へ戻す等） */
  onGenerationCancelled?: () => void;
  /** 募集を閉じる（`hundred_public` 削除など）。詳細画面の「募集をとじる」と同じ経路 */
  onCloseRecruitment?: () => void | Promise<void>;
  /** ゲスト: 募集終了・とじられたときに closed 画面へ */
  onGuestRecruitmentClosed?: () => void;
  /** true: 参加・開始ロジックのみ（画面は出さない） */
  headless?: boolean;
  onHeadlessState?: (state: HundredWaitHeadlessState) => void;
  onHeadlessController?: (controller: HundredWaitHeadlessController | null) => void;
}> = ({
  selectedHundred,
  nickname,
  userEmoji,
  currentUid,
  streamMode = false,
  onBack,
  onStartHundred,
  onGenerationCancelled,
  onCloseRecruitment,
  onGuestRecruitmentClosed,
  headless = false,
  onHeadlessState,
  onHeadlessController,
}) => {
  const roomId = selectedHundred.roomId || '';
  const roomRef = useMemo(() => (roomId ? doc(db, 'hundred_rooms', roomId) : null), [roomId]);

  const handleBack = useCallback(() => {
    const uid = auth.currentUser?.uid;
    if (roomId && uid) {
      void leaveHundredRoomPlayer(roomId, uid);
    }
    clearHundredRestoreSession();
    onBack();
  }, [roomId, onBack]);
  const [status, setStatus] = useState<string>('recruiting');
  const [hostUid, setHostUid] = useState<string>('');
  const [roomEndReason, setRoomEndReason] = useState<string | undefined>(undefined);
  const [roomEndedAt, setRoomEndedAt] = useState<unknown>(undefined);
  const [authUid, setAuthUid] = useState<string | undefined>(() => auth.currentUser?.uid ?? undefined);
  const [problemsGenerating, setProblemsGenerating] = useState(false);
  const [roomRoundStartedAt, setRoomRoundStartedAt] = useState<unknown>(undefined);
  /** join effect 用 — Timestamp 参照ではなく ms だけ deps に載せる（foundWords 更新で参加がキャンセルされない） */
  const [roomRoundEpochMs, setRoomRoundEpochMs] = useState<number | null>(null);
  const [roomFoundWords, setRoomFoundWords] = useState<Array<{ playerId?: string }>>([]);
  const [presenceNowMs, setPresenceNowMs] = useState(() => Date.now());
  /** 1秒ごとに更新（プレゼンス・緑ゲート表示） */
  const [nowMs, setNowMs] = useState(() => Date.now());
  /** `hundred_rooms/{roomId}/players` — 参加表明済み（ホスト含む） */
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayer[]>([]);
  const [lobbyChat, setLobbyChat] = useState<LobbyChatMessage[]>([]);
  const [lobbyChatText, setLobbyChatText] = useState('');
  const [lobbyChatError, setLobbyChatError] = useState<string | null>(null);
  const lobbyChatBoxRef = useRef<HTMLDivElement | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinOk, setJoinOk] = useState(false);
  /** 20人上限：21人目以降は満室パネルへ（ホスト・既参加者は除外） */
  const [joinRoomFull, setJoinRoomFull] = useState(false);
  const [joinStalled, setJoinStalled] = useState(false);
  const [roboBoardReady, setRoboBoardReady] = useState(false);
  const [roomBoardReady, setRoomBoardReady] = useState(false);
  const [roomListMeta, setRoomListMeta] = useState<HundredRoomListMeta>({});
  const [boardTransitionBusy, setBoardTransitionBusy] = useState(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setAuthUid(u?.uid));
    return () => unsub();
  }, []);

  /** hundred_rooms の hostUid 購読前でも、募集データの hostUid でホスト判定できるようにする */
  const effectiveUid = authUid ?? currentUid;
  const isRoboLounge = isRoboPickupLoungeRecruit(selectedHundred);
  const isHost =
    !isRoboLounge &&
    !!effectiveUid &&
    (effectiveUid === hostUid || (!!selectedHundred.hostUid && effectiveUid === selectedHundred.hostUid));

  useEffect(() => {
    if (!isRoboLounge || !roomId || roomRoundStartedAt == null) return;
    void reconcileHundredRoomPlayerCount(roomId, {
      isRoboLounge: true,
      roundStartedAt: roomRoundStartedAt,
      foundWords: roomFoundWords,
      pruneAbsent: true,
    }).catch((e) => {
      console.warn('[HundredWaitPanel] reconcile robo lounge players', e);
    });
  }, [isRoboLounge, roomId, roomRoundStartedAt, roomFoundWords]);

  useEffect(() => {
    if (status !== 'recruiting' && status !== 'playing' && status !== 'started') return;
    const id = window.setInterval(
      () => setPresenceNowMs(Date.now()),
      streamMode ? HUNDRED_PLAYER_PRESENCE_TICK_MS * 2 : HUNDRED_PLAYER_PRESENCE_TICK_MS,
    );
    return () => window.clearInterval(id);
  }, [status, streamMode]);

  useEffect(() => {
    if (!roomId || !joinOk) return;
    // プレイ中は待機室ハートビートしない（merge で player doc が復活し満室固定になるのを防ぐ）
    if (status !== 'recruiting') return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const playerRef = doc(db, 'hundred_rooms', roomId, 'players', uid);
    const touch = () => {
      void setDoc(playerRef, { lastActiveAt: serverTimestamp() }, { merge: true }).catch(() => {});
    };
    touch();
    const id = window.setInterval(touch, HUNDRED_PLAYER_HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [roomId, joinOk, status]);

  const [roomHundredMode, setRoomHundredMode] = useState<string | undefined>(selectedHundred.hundredMode);

  useEffect(() => {
    setRoomHundredMode(selectedHundred.hundredMode);
  }, [selectedHundred.hundredMode, roomId]);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    void getDoc(doc(db, 'hundred_rooms', roomId))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const mode = (snap.data() as { hundredMode?: unknown })?.hundredMode;
        if (typeof mode === 'string') setRoomHundredMode(mode);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const isTileMatchRoom = (roomHundredMode ?? selectedHundred.hundredMode) === TILE_MATCH_HUNDRED_MODE;

  const hundredStartOptsFromRoomData = useCallback(
    (data: Record<string, unknown> | undefined, mode?: string): HundredStartOpts => {
      const opts: HundredStartOpts = {};
      if (mode) opts.hundredMode = mode;
      if (!roomId || !data || !hundredRoomCanEnterGame(data, roomId)) return opts;
      const grid = gridRowsFromFirestore(data);
      if (!grid?.length) return opts;
      opts.preloadedGrid = grid;
      opts.preloadedWords = Array.isArray(data.words) ? data.words : [];
      return opts;
    },
    [roomId],
  );

  const startHundredWithMode = useCallback(
    async (id: string, startOpts?: HundredStartOpts) => {
      if (hundredGameOpenedRef.current || startHundredInFlightRef.current) return;
      startHundredInFlightRef.current = true;
      setBoardTransitionBusy(true);
      try {
        const ok = !!(await onStartHundred(id, startOpts));
        if (ok) {
          hundredGameOpenedRef.current = true;
        } else {
          hundredGameOpenedRef.current = false;
        }
      } catch (e) {
        hundredGameOpenedRef.current = false;
        console.warn('[HundredWaitPanel] start hundred failed', e);
      } finally {
        startHundredInFlightRef.current = false;
        setBoardTransitionBusy(false);
      }
    },
    [onStartHundred],
  );

  /** キャンセルは Auth の UID で判定（親の currentUid より先に確定することがある） */
  const showCancelGeneration =
    problemsGenerating &&
    !!effectiveUid &&
    (effectiveUid === hostUid || (!!selectedHundred.hostUid && effectiveUid === selectedHundred.hostUid));
  const startInFlightRef = useRef(false);
  const startHundredInFlightRef = useRef(false);
  /** foundWords 更新で onSnapshot が再発火しても Game へ多重遷移しない */
  const hundredGameOpenedRef = useRef(false);
  const latestRoomDataRef = useRef<Record<string, unknown>>({});
  const workerRef = useRef<Worker | null>(null);
  /** 盤面生成 Promise をキャンセルするときに reject する */
  const rejectGenerationRef = useRef<((reason?: unknown) => void) | null>(null);
  const cancelRedirectedRef = useRef(false);
  /** お題切替検知 — 前局の join 状態を捨てて入り直し */
  const prevRoomRoundStartedMsRef = useRef<number | null>(null);
  /** room doc 欠損時の backfill は1回だけ（無限ループ/無駄な書き込み防止） */
  const didBackfillRoomDocRef = useRef(false);
  const startHundredWithModeRef = useRef(startHundredWithMode);
  useEffect(() => {
    startHundredWithModeRef.current = startHundredWithMode;
  }, [startHundredWithMode]);
  // NOTE: Start button has `startInFlightRef` already.
  // Keeping a persistent "did reset" flag can break reset on the next round.
  const handleStartRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    setRoomRoundStartedAt(undefined);
    setRoomRoundEpochMs(null);
    setRoomFoundWords([]);
    setRoboBoardReady(false);
    setRoomBoardReady(false);
    setJoinOk(false);
    setJoinError(null);
    setJoinRoomFull(false);
    setJoinStalled(false);
    setBoardTransitionBusy(false);
    cancelRedirectedRef.current = false;
    didBackfillRoomDocRef.current = false;
    prevRoomRoundStartedMsRef.current = null;
  }, [roomId]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), streamMode ? 5000 : 1000);
    return () => window.clearInterval(id);
  }, [streamMode]);

  /** 参加が長引くとき「壊れた」と誤解されないよう、再試行ボタンを出す */
  useEffect(() => {
    if (joinOk || joinError || joinRoomFull || !roomId) {
      setJoinStalled(false);
      return;
    }
    const t = window.setTimeout(() => setJoinStalled(true), 8000);
    return () => window.clearTimeout(t);
  }, [joinOk, joinError, joinRoomFull, roomId]);

  const retryJoin = useCallback(async () => {
    if (!roomId) return;
    setJoinStalled(false);
    setJoinError(null);
    setJoinRoomFull(false);
    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setJoinError('参加に失敗しました（UID取得に失敗）。ページを再読み込みしてください。');
        return;
      }
      if (isRoboLounge) {
        await ensureRoboPickupLoungeRoomDoc(resolveRoboPickupLoungeProfile(roomId));
      }
      const playerRef = doc(db, 'hundred_rooms', roomId, 'players', uid);
      await setDoc(
        playerRef,
        {
          uid,
          name: nickname || 'ななし',
          emoji: userEmoji || '🌸',
          lastActiveAt: serverTimestamp(),
          joinedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setJoinOk(true);
      const roomSnap = await getDoc(doc(db, 'hundred_rooms', roomId));
      if (hundredRoomCanEnterGame(roomSnap.data() as Record<string, unknown>, roomId)) {
        const mode =
          roomSnap.exists() && typeof roomSnap.data()?.hundredMode === 'string'
            ? String(roomSnap.data()!.hundredMode)
            : selectedHundred.hundredMode;
        void startHundredWithMode(
          roomId,
          hundredStartOptsFromRoomData(roomSnap.data() as Record<string, unknown>, mode),
        );
      }
    } catch (e) {
      console.warn('[HundredWaitPanel] retry join failed', e);
      setJoinError('参加に失敗しました。通信を確認してから「参加をやり直す」を押してください。');
      setJoinStalled(true);
    }
  }, [isRoboLounge, roomId, nickname, userEmoji, selectedHundred.hundredMode, startHundredWithMode, hundredStartOptsFromRoomData]);

  // ロボ常設: 待機室を開いた時点でお題を先読み（入室後の待ちを短くする）
  useEffect(() => {
    if (!isRoboLounge || !roomId) return;
    void ensureRoboPickupLoungeRoomDoc(resolveRoboPickupLoungeProfile(roomId))
      .then(() => refreshRoboPickupLoungeBoardSizeIfNeeded(roomId))
      .then(() => refreshRoboPickupLoungeSeedIfNeeded(roomId))
      .catch((e) => console.warn('[HundredWaitPanel] robo lounge prefetch seed', e));
  }, [isRoboLounge, roomId]);

  const handleCancelGeneration = useCallback(async () => {
    const rej = rejectGenerationRef.current;
    rejectGenerationRef.current = null;
    const err = Object.assign(new Error('cancelled'), { code: 'cancelled' as const });
    try {
      rej?.(err);
    } catch {
      /* ignore */
    }
    const w = workerRef.current;
    if (w) {
      try {
        w.terminate();
      } catch {
        /* ignore */
      }
      workerRef.current = null;
    }
    startInFlightRef.current = false;
    if (roomId) {
      await applyHostCancelledHundredGeneration({
        roomId,
        hundredPublicDocId: hundredPublicListingDocId(selectedHundred),
      });
    }
    onGenerationCancelled?.();
  }, [roomId, selectedHundred, onGenerationCancelled]);

  // Ensure signed in + join as a player（20人上限はトランザクションで判定）
  useEffect(() => {
    if (!roomId) return;

    let cancelled = false;
    void (async () => {
      try {
        setJoinError(null);
        setJoinRoomFull(false);
        setJoinStalled(false);
        if (!auth.currentUser) {
          try {
            await signInAnonymously(auth);
          } catch {
            setJoinError('参加に失敗しました（匿名ログインに失敗）。通信状態を確認して再度お試しください。');
            return;
          }
        }
        if (cancelled) return;
        const uid = auth.currentUser?.uid;
        if (!uid) {
          setJoinError('参加に失敗しました（UID取得に失敗）。ページを再読み込みしてください。');
          return;
        }
        const playerRef = doc(db, 'hundred_rooms', roomId, 'players', uid);
        const roomDocRef = doc(db, 'hundred_rooms', roomId);
        const hostUidResolved = (selectedHundred.hostUid || hostUid || '').trim();
        const isHostJoiner = !!hostUidResolved && uid === hostUidResolved;
        const playerProfile = {
          uid,
          name: nickname || 'ななし',
          emoji: userEmoji || '🌸',
          lastActiveAt: serverTimestamp(),
        };

        const finishJoinAfterSuccess = async () => {
          if (cancelled) return;

          setJoinOk(true);

          if (isHostJoiner) {
            const hostName = nickname || 'ななし';
            const hostEmojiNow = userEmoji || '🌸';
            void setDoc(
              roomDocRef,
              { hostNickname: hostName, hostEmoji: hostEmojiNow },
              { merge: true },
            ).catch(() => {});
            const publicId = selectedHundred.id;
            if (publicId && !publicId.startsWith('local-')) {
              void setDoc(
                doc(db, 'hundred_public', publicId),
                { hostNickname: hostName, hostEmoji: hostEmojiNow },
                { merge: true },
              ).catch(() => {});
            }
          }

          try {
            const roomSnap = await getDoc(roomDocRef);
            if (cancelled || hundredGameOpenedRef.current) return;
            if (roomId && hundredRoomCanEnterGame(roomSnap.data() as Record<string, unknown>, roomId)) {
              const mode =
                roomSnap.exists() && typeof roomSnap.data()?.hundredMode === 'string'
                  ? String(roomSnap.data()!.hundredMode)
                  : selectedHundred.hundredMode;
              void startHundredWithModeRef.current(
                roomId,
                hundredStartOptsFromRoomData(roomSnap.data() as Record<string, unknown>, mode),
              );
            }
          } catch (e) {
            console.warn('[HundredWaitPanel] post-join room status check failed', e);
          }
        };

        // ロボ常設: 満室判定・トランザクションを省略（merge で参加。詰まり防止）
        if (isRoboLounge) {
          try {
            await ensureRoboPickupLoungeRoomDoc(resolveRoboPickupLoungeProfile(roomId));
            await setDoc(
              playerRef,
              { ...playerProfile, joinedAt: serverTimestamp() },
              { merge: true },
            );
            await finishJoinAfterSuccess();
          } catch (e) {
            console.warn('[HundredWaitPanel] robo lounge join failed', e);
            setJoinError('参加に失敗しました。下の「参加をやり直す」を押してください。');
            setJoinStalled(true);
          }
          return;
        }

        const runJoinTransaction = async () => {
          await runTransaction(db, async (transaction) => {
            const existing = await transaction.get(playerRef);
            if (existing.exists()) {
              transaction.set(playerRef, playerProfile, { merge: true });
              return;
            }
            if (!isHostJoiner && !isRoboLounge) {
              const roomSnap = await transaction.get(roomDocRef);
              const pc = roomSnap.data()?.playerCount;
              const count = typeof pc === 'number' ? pc : 0;
              if (count >= HUNDRED_MAX_PLAYERS) {
                throw new Error(HUNDRED_ROOM_FULL_ERROR);
              }
            }
            transaction.set(playerRef, {
              ...playerProfile,
              joinedAt: serverTimestamp(),
            });
            transaction.set(
              roomDocRef,
              { playerCount: increment(1), updatedAt: serverTimestamp() },
              { merge: true },
            );
          });
        };

        const recoverJoinAfterRoomFull = async (
          joinRoundStartedAt: unknown,
          joinFoundWords: Array<{ playerId?: string }>,
        ): Promise<'retry' | 'full' | 'abort'> => {
          const cap = await checkHundredRoomJoinCapacity(roomId, {
            isRoboLounge,
            isHostJoiner,
            roundStartedAt: joinRoundStartedAt,
            foundWords: joinFoundWords,
          });
          if (cancelled) return 'abort';
          if (cap.full) {
            setJoinRoomFull(true);
            return 'full';
          }
          return 'retry';
        };

        const runJoinTransactionWithRetries = async (
          joinRoundStartedAt: unknown,
          joinFoundWords: Array<{ playerId?: string }>,
        ) => {
          const MAX_ATTEMPTS = 4;
          for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            if (!isHostJoiner && !isRoboLounge) {
              const cap = await checkHundredRoomJoinCapacity(roomId, {
                isRoboLounge,
                isHostJoiner,
                roundStartedAt: joinRoundStartedAt,
                foundWords: joinFoundWords,
              });
              if (cancelled) return;
              if (cap.full) {
                setJoinRoomFull(true);
                return;
              }
            }
            try {
              await runJoinTransaction();
              return;
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e ?? '');
              if (msg.includes(HUNDRED_ROOM_FULL_ERROR)) {
                const outcome = await recoverJoinAfterRoomFull(joinRoundStartedAt, joinFoundWords);
                if (outcome === 'retry') continue;
                return;
              }
              if (isHundredJoinRetryableError(e)) {
                const playerSnap = await getDoc(playerRef);
                if (cancelled) return;
                if (playerSnap.exists()) {
                  await setDoc(playerRef, playerProfile, { merge: true });
                  return;
                }
                if (attempt < MAX_ATTEMPTS - 1) {
                  await new Promise((r) => window.setTimeout(r, 60 * (attempt + 1)));
                  continue;
                }
              }
              throw e;
            }
          }
        };

        try {
          const existingPlayer = await getDoc(playerRef);
          if (cancelled) return;

          if (existingPlayer.exists()) {
            await setDoc(playerRef, playerProfile, { merge: true });
            await finishJoinAfterSuccess();
            return;
          }

          setJoinOk(false);

          let joinRoundStartedAt = roomRoundStartedAt;
          let joinFoundWords = roomFoundWords;
          try {
            const roomSnap = await getDoc(roomDocRef);
            if (roomSnap.exists()) {
              const rd = roomSnap.data() as Record<string, unknown>;
              const roomStatus = typeof rd.status === 'string' ? rd.status : '';
              if (isRoboLounge || isHundredRoomInPlay(roomStatus)) {
                joinRoundStartedAt = rd.startedAt;
                joinFoundWords = Array.isArray(rd.foundWords)
                  ? (rd.foundWords as Array<{ playerId?: string }>)
                  : [];
              }
            }
          } catch {
            /* ignore */
          }

          const cap = await checkHundredRoomJoinCapacity(roomId, {
            isRoboLounge,
            isHostJoiner,
            roundStartedAt: joinRoundStartedAt,
            foundWords: joinFoundWords,
          });
          if (cancelled) return;
          if (cap.full) {
            setJoinRoomFull(true);
            return;
          }

          await runJoinTransactionWithRetries(joinRoundStartedAt, joinFoundWords);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e ?? '');
          if (msg.includes(HUNDRED_ROOM_FULL_ERROR)) {
            if (!isRoboLounge) setJoinRoomFull(true);
            return;
          }
          const code = getFirestoreErrorCode(e);
          if (isHundredJoinRetryableError(e)) {
            try {
              const playerSnap = await getDoc(playerRef);
              if (playerSnap.exists()) {
                await setDoc(playerRef, playerProfile, { merge: true });
                await finishJoinAfterSuccess();
                return;
              }
            } catch {
              /* fall through */
            }
          }
          console.warn('[HundredWaitPanel] join transaction failed', { code, e });
          setJoinError('参加に失敗しました（権限/通信のエラー）。');
          return;
        }
        if (cancelled) return;

        await finishJoinAfterSuccess();
      } catch (e: unknown) {
        console.warn('[HundredWaitPanel] join unexpected error', e);
        setJoinError('参加に失敗しました。通信を確認してください。');
        setJoinStalled(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    roomId,
    nickname,
    userEmoji,
    selectedHundred.hostUid,
    selectedHundred.hundredMode,
    hostUid,
    isRoboLounge,
    roomRoundEpochMs,
  ]);

  // Subscribe to room status; if started -> switch everyone to GameScreen（1回だけ）
  useEffect(() => {
    hundredGameOpenedRef.current = false;
  }, [roomId]);

  useEffect(() => {
    if (!roomRef) return;
    const unsub = onSnapshot(
      roomRef,
      async (snap) => {
        if (!snap.exists()) {
          // ドキュメント欠損時も全クライアントで生成オーバーレイを閉じる（ホスト離脱・削除など）
          setProblemsGenerating(false);
          setHostUid('');
          setStatus('recruiting');
          if (isRoboLounge && !didBackfillRoomDocRef.current) {
            didBackfillRoomDocRef.current = true;
            void ensureRoboPickupLoungeRoomDoc(resolveRoboPickupLoungeProfile(roomId))
              .then(() => refreshRoboPickupLoungeBoardSizeIfNeeded(roomId))
              .then(() => refreshRoboPickupLoungeSeedIfNeeded(roomId))
              .catch((e) => console.warn('[HundredWaitPanel] robo lounge room bootstrap', e));
          }
          // Backfill room doc (host only) — but do it once to avoid write loops.
          if (
            !didBackfillRoomDocRef.current &&
            isHost &&
            auth.currentUser?.uid &&
            roomId
          ) {
            didBackfillRoomDocRef.current = true;
            await setDoc(
              doc(db, 'hundred_rooms', roomId),
              {
                status: 'recruiting',
                createdAt: serverTimestamp(),
                startedAt: null,
                hostUid: auth.currentUser.uid,
                targetWord: selectedHundred.targetWord,
                boardSize: selectedHundred.boardSize,
                boardCols: resolveBoardCols(selectedHundred),
                boardRows: resolveBoardRows(selectedHundred),
                gameTimeLimitSec: 0,
              },
              { merge: true }
            ).catch(() => {});
          }
          return;
        }
        const data = snap.data() as any;
        latestRoomDataRef.current = data as Record<string, unknown>;
        setRoomListMeta(parseHundredRoomMeta(data as Record<string, unknown>));
        const nextStatus = typeof data?.status === 'string' ? data.status : 'recruiting';
        setStatus(nextStatus);
        setHostUid(typeof data?.hostUid === 'string' ? data.hostUid : '');
        setRoomEndReason(typeof data?.endReason === 'string' ? data.endReason : undefined);
        setRoomEndedAt(data?.endedAt);
        if (data?.startedAt != null) {
          const startedMs = firestoreLikeToMillis(data.startedAt);
          if (startedMs != null) {
            const prevMs = prevRoomRoundStartedMsRef.current;
            if (prevMs != null && startedMs !== prevMs) {
              setJoinOk(false);
              setJoinRoomFull(false);
              setJoinError(null);
              hundredGameOpenedRef.current = false;
            }
            if (startedMs !== prevMs) {
              prevRoomRoundStartedMsRef.current = startedMs;
              setRoomRoundEpochMs(startedMs);
              setRoomRoundStartedAt(data.startedAt);
            }
          }
        }
        setRoomFoundWords(Array.isArray(data?.foundWords) ? data.foundWords : []);
        // Firestore の真偽のみ反映（ホストがキャンセルして false になったら全員のオーバーレイが閉じる）
        const boardReady = hundredRoomBoardReady(data as Record<string, unknown>, roomId);
        setRoomBoardReady(boardReady);
        setRoboBoardReady(isRoboLounge && boardReady);
        const generating = data?.problemsGenerating === true;
        setProblemsGenerating(generating && !boardReady);
        if (
          joinOk &&
          roomId &&
          !hundredGameOpenedRef.current &&
          !startHundredInFlightRef.current &&
          hundredRoomCanEnterGame(data as Record<string, unknown>, roomId)
        ) {
          const mode = typeof data?.hundredMode === 'string' ? data.hundredMode : selectedHundred.hundredMode;
          void startHundredWithMode(
            roomId,
            hundredStartOptsFromRoomData(data as Record<string, unknown>, mode),
          );
        }
      },
      (err) => {
        console.warn('[HundredWaitPanel] hundred_rooms snapshot error', err);
        tripFirestoreCircuit(db as any, err);
        setProblemsGenerating(false);
      }
    );
    return () => unsub();
  }, [
    roomRef,
    roomId,
    startHundredWithMode,
    selectedHundred.boardSize,
    selectedHundred.targetWord,
    selectedHundred.hundredMode,
    joinOk,
    isHost,
    isRoboLounge,
    hundredStartOptsFromRoomData,
  ]);

  // ロボ常設: 待機室で盤面未生成なら seed を明示トリガ（prefetch と二重だが merge で安全）
  useEffect(() => {
    if (!isRoboLounge || !joinOk || !roomId) return;
    const timer = window.setTimeout(() => {
      if (hundredGameOpenedRef.current || problemsGenerating) return;
      const d = latestRoomDataRef.current;
      if (hundredRoomCanEnterGame(d, roomId) && !roboLoungeBoardSizeMismatch(d)) return;
      void ensureRoboPickupLoungeRoomDoc(resolveRoboPickupLoungeProfile(roomId))
        .then(() => refreshRoboPickupLoungeBoardSizeIfNeeded(roomId))
        .then(() => refreshRoboPickupLoungeSeedIfNeeded(roomId))
        .catch((e) => {
          console.warn('[HundredWaitPanel] robo lounge seed', e);
        });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [isRoboLounge, joinOk, roomId, problemsGenerating, status]);

  // 参加者一覧（参加ボタン／入室と同じ players サブコレ）をリアルタイム表示
  useEffect(() => {
    if (!roomId) return;
    if (status !== 'recruiting' && !isHundredRoomInPlay(status)) return;
    const col = collection(db, 'hundred_rooms', roomId, 'players');
    const q = query(col, limit(HUNDRED_MAX_PLAYERS));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: RoomPlayer[] = [];
        snap.forEach((d) => {
          const x = d.data() as Record<string, unknown>;
          const name = typeof x.name === 'string' && x.name.trim() ? x.name.trim() : 'ななし';
          const emoji = typeof x.emoji === 'string' && x.emoji.trim() ? x.emoji.trim() : '🌸';
          next.push({
            uid: d.id,
            name,
            emoji,
            lastActiveAt: x.lastActiveAt,
            joinedAt: x.joinedAt,
          });
        });
        setRoomPlayers(next);
      },
      (err) => {
        console.warn('[HundredWaitPanel] players snapshot error', err);
        tripFirestoreCircuit(db as any, err);
        setRoomPlayers([]);
      }
    );
    return () => unsub();
  }, [roomId, status]);

  const displayPlayers = useMemo(() => {
    const h = selectedHundred.hostUid || hostUid;
    const byName = (a: RoomPlayer, b: RoomPlayer) => a.name.localeCompare(b.name, 'ja');
    const roster = roomPlayers.map((p) => ({
      uid: p.uid,
      name: p.name,
      emoji: p.emoji,
      foundCount: 0,
      lastActiveAt: p.lastActiveAt,
      joinedAt: p.joinedAt,
    }));
    let filtered = filterPresentHundredPlayers(roster, {
      nowMs: presenceNowMs,
      alwaysIncludeUid: effectiveUid,
    });
    if (isRoboLounge) {
      filtered = filterRoboLoungeRoundPlayers(
        filtered,
        roomRoundStartedAt,
        roomFoundWords,
        { nowMs: presenceNowMs, alwaysIncludeUid: effectiveUid },
      );
    }
    if (!h) return [...filtered].sort(byName);
    const hostRow = filtered.find((p) => p.uid === h);
    const rest = filtered.filter((p) => p.uid !== h).sort(byName);
    return hostRow ? [hostRow, ...rest] : rest;
  }, [
    roomPlayers,
    selectedHundred.hostUid,
    hostUid,
    presenceNowMs,
    effectiveUid,
    isRoboLounge,
    roomRoundStartedAt,
    roomFoundWords,
  ]);

  const waitGreenGateUids = useMemo(() => {
    const ids = displayPlayers.map((p) => p.uid);
    for (const m of lobbyChat) {
      if (m.uid) ids.push(m.uid);
    }
    return ids;
  }, [displayPlayers, lobbyChat]);
  const greenGateByUid = useGreenGateActiveByUids(waitGreenGateUids, nowMs);

  const recruitCountdownLine = useMemo(() => {
    if (isRoboLounge) return 'いつでも入れます — 全部見つけると次のお題';
    if (status === 'recruiting' && isHost) {
      return 'はじめると、募集一覧に載ります（途中参加OK）';
    }
    return null;
  }, [isRoboLounge, status, isHost]);

  const waitRoomMeta = useMemo(
    (): HundredRoomListMeta => ({
      ...roomListMeta,
      status,
      endReason: roomEndReason ?? roomListMeta.endReason,
      endedAt: roomEndedAt ?? roomListMeta.endedAt,
      startedAt: roomRoundStartedAt ?? roomListMeta.startedAt,
      foundWords: roomFoundWords.length > 0 ? roomFoundWords : roomListMeta.foundWords,
      problemsGenerating,
    }),
    [
      roomListMeta,
      status,
      roomEndReason,
      roomEndedAt,
      roomRoundStartedAt,
      roomFoundWords,
      problemsGenerating,
    ],
  );

  const betweenRounds = useMemo(() => isHundredBetweenRounds(waitRoomMeta), [waitRoomMeta]);

  const canHostStart = useMemo(
    () =>
      isHost &&
      !problemsGenerating &&
      (betweenRounds || status === 'recruiting' || !roomBoardReady),
    [isHost, problemsGenerating, betweenRounds, status, roomBoardReady],
  );

  useEffect(() => {
    if (!headless || !onHeadlessState) return;
    onHeadlessState({
      betweenRounds,
      problemsGenerating,
      joinOk,
      joinError,
      joinRoomFull,
      joinStalled,
      isHost,
      status,
      boardTransitionBusy,
      roomBoardReady,
      canHostStart,
    });
  }, [
    headless,
    onHeadlessState,
    betweenRounds,
    problemsGenerating,
    joinOk,
    joinError,
    joinRoomFull,
    joinStalled,
    isHost,
    status,
    boardTransitionBusy,
    roomBoardReady,
    canHostStart,
  ]);

  useEffect(() => {
    if (!headless || !onHeadlessController) return;
    onHeadlessController({
      requestStart: () => void handleStartRef.current(),
      retryJoin: () => void retryJoin(),
      cancelGeneration: () => void handleCancelGeneration(),
    });
    return () => onHeadlessController(null);
  }, [headless, onHeadlessController, retryJoin, handleCancelGeneration]);

  // 常設ロボはおわらない — 放置終了判定を掛けない（誤って「もうおわりました」を出さない）
  const sessionEnded = useMemo(
    () =>
      isRoboLounge
        ? false
        : isHundredOpenRecruitSessionEnded(selectedHundred, waitRoomMeta, nowMs),
    [isRoboLounge, selectedHundred, waitRoomMeta, nowMs],
  );

  const sessionEndedRedirectedRef = useRef(false);

  useEffect(() => {
    sessionEndedRedirectedRef.current = false;
  }, [roomId, roomRoundEpochMs]);

  useEffect(() => {
    if (isRoboLounge) return;
    const publicId = selectedHundred.id;
    if (!publicId || publicId.startsWith('local-')) return;
    if (!onGuestRecruitmentClosed) return;
    const hostUidResolved = (selectedHundred.hostUid || hostUid || '').trim();
    if (effectiveUid && hostUidResolved && effectiveUid === hostUidResolved) return;
    const ref = doc(db, 'hundred_public', publicId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          if (sessionEndedRedirectedRef.current) return;
          // お題間は hundred_public を消す設計。待機室に残して次のお題を待つ。
          if (betweenRounds) return;
          // 次お題開始直後は再掲示前の瞬間がある／プレイ中は掲示欠損だけで追い出さない
          if (status === 'playing' || status === 'started') return;
          if (problemsGenerating || roomBoardReady) return;
          sessionEndedRedirectedRef.current = true;
          clearHundredRestoreSession();
          onGuestRecruitmentClosed();
        }
      },
      () => {},
    );
    return () => unsub();
  }, [
    isRoboLounge,
    selectedHundred.id,
    selectedHundred.hostUid,
    hostUid,
    effectiveUid,
    onGuestRecruitmentClosed,
    betweenRounds,
    status,
    problemsGenerating,
    roomBoardReady,
  ]);

  useEffect(() => {
    if (isRoboLounge) return;
    if (!onGuestRecruitmentClosed) return;
    if (isHost) return;
    // あそび中・お題間は「もうおわり」にしない（掲示再作成・ホスト待ち）
    if (status === 'playing' || status === 'started' || betweenRounds) return;
    if (status !== 'finished' && status !== 'cancelled' && !sessionEnded) return;
    if (sessionEndedRedirectedRef.current) return;
    sessionEndedRedirectedRef.current = true;
    clearHundredRestoreSession();
    window.alert('このひと言探しは、もうおわりました。');
    onGuestRecruitmentClosed();
  }, [isRoboLounge, status, betweenRounds, sessionEnded, isHost, onGuestRecruitmentClosed]);

  const autoResetProgressBeforeStart = useCallback(async () => {
    if (!roomId) return;
    if (!isHost) return;
    try {
      // 1) Reset room-wide ribbons
      await setDoc(doc(db, 'hundred_rooms', roomId), { foundWords: [], updatedAt: serverTimestamp() }, { merge: true });
    } catch (e) {
      // Fail-open: start should still proceed even if reset hits transient errors.
      console.warn('[HundredWaitPanel] autoResetProgressBeforeStart failed', e);
    }
  }, [roomId, isHost]);

  const handleStart = async () => {
    if (!roomId) return;
    if (!isHost) return;
    if (problemsGenerating) return;
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    let didStartGame = false;
    const withTimeout = async <T,>(p: Promise<T>, ms: number, label: string): Promise<T> => {
      let t: number | undefined;
      const timeout = new Promise<T>((_, reject) => {
        t = window.setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
      });
      try {
        return await Promise.race([p, timeout]);
      } finally {
        if (t != null) window.clearTimeout(t);
      }
    };
    try {
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch {
          window.alert('ログインが必要です。');
          return;
        }
      }
      if (!auth.currentUser?.uid) {
        window.alert('ログインが必要です。');
        return;
      }

      // 利用者操作なしで、開始前に必ず帯/カウントを0に戻す（前の残骸対策）
      await autoResetProgressBeforeStart();

      const roomDocRef = doc(db, 'hundred_rooms', roomId);

      let effectiveTileMatch = isTileMatchRoom;
      if (!effectiveTileMatch) {
        try {
          const preSnap = await getDoc(roomDocRef);
          const preMode = preSnap.exists()
            ? (preSnap.data() as { hundredMode?: unknown })?.hundredMode
            : undefined;
          if (preMode === TILE_MATCH_HUNDRED_MODE) {
            effectiveTileMatch = true;
            setRoomHundredMode(TILE_MATCH_HUNDRED_MODE);
          }
        } catch {
          /* ignore */
        }
      }

      if (effectiveTileMatch) {
        window.alert('ペア探しは終了しました。');
        return;
      }

      // 探しもの（単語1つを大量配置）の盤面を生成し、hundred_rooms に保存して GameScreen へ遷移
      // `hundred_public` と同じ number（正方形の一辺）。欠損時は既定 50
      const cols = resolveBoardCols(selectedHundred);
      const rows = resolveBoardRows(selectedHundred);
      const targetWord = (selectedHundred.targetWord || '').trim();
      const pickupCharset = normalizePickupCharset(selectedHundred.pickupCharset);
      if (!targetWord) {
        window.alert('「探すことば」が空です。募集を作り直すか、別の部屋を選んでください。');
        return;
      }
      if (!isPickupTargetWordLengthOk(targetWord, pickupCharset)) {
        const { min, max } = pickupLengthBounds(pickupCharset);
        window.alert(
          `「探すことば」は${min}〜${max}${pickupCharset === 'digit' ? '桁' : '文字'}にしてください。募集を作り直してください。`,
        );
        return;
      }
      if (!targetWordFitsBoard(targetWord, cols, rows)) {
        window.alert(`「探すことば」が盤面サイズ（${cols}×${rows}）より長いです。募集を作り直してください。`);
        return;
      }
      if (!isPickupBoardComboFeasible(cols, rows, targetWord, pickupCharset, 12)) {
        window.alert(pickupBoardFeasibilityErrorMessage(cols, rows, targetWord, pickupCharset));
        return;
      }
      const dictionary = [targetWord];

      const clearProblemGenFlag = async () => {
        await withTimeout(
          setDoc(roomDocRef, { problemsGenerating: false, problemsReady: false }, { merge: true }).catch(() => {}),
          8000,
          'clear-problem-flag'
        ).catch(() => {});
      };

      await withTimeout(
        setDoc(roomDocRef, { problemsGenerating: true, problemsReady: false }, { merge: true }),
        8000,
        'set-problem-flag'
      );

      const runWorkerOnce = (seed: number) =>
        new Promise<{ grid: string[][]; placedWords: any[]; density?: number }>((resolve, reject) => {
          rejectGenerationRef.current = reject;
          const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
          const worker = new Worker(URL.createObjectURL(blob));
          workerRef.current = worker;

          const cleanup = () => {
            if (workerRef.current === worker) {
              workerRef.current = null;
            }
            try {
              worker.terminate();
            } catch {
              /* ignore */
            }
          };

          const timeoutMs = hundredPickupWorkerTimeoutMs(cols, rows);
          const timer = window.setTimeout(() => {
            rejectGenerationRef.current = null;
            cleanup();
            reject(new Error('worker-timeout'));
          }, timeoutMs);

          worker.onmessage = (e) => {
            try {
              const result = e.data as any;
              const grid = result?.grid;
              const placedWords = result?.placedWords;
              const density = typeof result?.density === 'number' ? result.density : undefined;
              rejectGenerationRef.current = null;
              if (!Array.isArray(grid) || grid.length === 0) {
                reject(new Error('empty-grid'));
                cleanup();
                return;
              }
              resolve({ grid, placedWords: Array.isArray(placedWords) ? placedWords : [], density });
            } finally {
              window.clearTimeout(timer);
              cleanup();
            }
          };
          worker.onerror = (err) => {
            rejectGenerationRef.current = null;
            window.clearTimeout(timer);
            reject(err);
            cleanup();
          };

          worker.postMessage({
            category: 'pickup',
            size: cols,
            cols,
            rows,
            dictionary,
            targetWord,
            prohibitedWords: pickupCharset === 'hiragana' ? PROHIBITED_WORDS : [],
            isKanji: false,
            seed,
            isKatakana: false,
            pickupCharset,
          });
        });

      const isValidPlacedWords = (placedWords: any[]) => {
        if (!Array.isArray(placedWords) || placedWords.length === 0) return false;
        return placedWords.some((pw) => pw && typeof pw.word === 'string' && Array.isArray(pw.occurrences) && pw.occurrences.length > 0);
      };

      const useSyncGen = shouldRunPickupSync(cols, rows);
      let gridAndWords: { grid: string[][]; placedWords: any[]; density?: number } | null = null;

      if (useSyncGen) {
        gridAndWords = generatePickupBoardReliable(cols, rows, targetWord, pickupCharset, {
          maxAttempts: 48,
        });
      } else {
        const minOccurrences = hundredPickupMinOccurrences(cols, targetWord, rows);
        const MAX_ATTEMPTS = 24;
        let best: { grid: string[][]; placedWords: any[]; coverage: number; occurrences: number } | null = null;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          const seed = Math.floor(Math.random() * 1000000);
          let r: { grid: string[][]; placedWords: any[]; density?: number } | null = null;
          try {
            r = await runWorkerOnce(seed);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes('worker-timeout')) {
              console.warn('[HundredWaitPanel] worker timeout', { attempt, cols, rows, targetWord });
              continue;
            }
            throw e;
          }
          if (!r || !isValidPlacedWords(r.placedWords)) continue;
          const coverage = typeof r.density === 'number' ? r.density : 0;
          const occurrences = countPlacedWordOccurrences(r.placedWords);
          if (
            !best ||
            occurrences > best.occurrences ||
            (occurrences === best.occurrences && coverage > best.coverage)
          ) {
            best = { ...r, coverage, occurrences };
          }
          if (coverage >= PICKUP_TARGET_COVERAGE && occurrences >= minOccurrences) {
            gridAndWords = r;
            break;
          }
        }
        if (!gridAndWords && best) {
          gridAndWords = best;
        }
      }

      if (!gridAndWords) {
        await clearProblemGenFlag();
        window.alert(
          `${pickupBoardFeasibilityErrorMessage(cols, rows, targetWord, pickupCharset)}\n\n` +
            `もう一度「今すぐスタート」を押すか、募集を作り直してください。`,
        );
        return;
      }

      const uid = auth.currentUser.uid;
      const grid = gridAndWords.grid;
      if (!Array.isArray(grid) || grid.length === 0) {
        await clearProblemGenFlag();
        window.alert('盤面データが空です。もう一度お試しください。');
        return;
      }
      const gridRows = gridToFirestoreRows(grid);
      if (gridRows.length === 0 || gridRows.some((row) => !row || row.length === 0)) {
        await clearProblemGenFlag();
        window.alert('盤面の行データが不正です。「探すことば」や盤面サイズを変えてお試しください。');
        return;
      }
      const wordsPayload = firestoreSafeJson(gridAndWords.placedWords ?? []);
      // プレイに時間制限は設けない（終了はクリア・ルーム終了のみ）
      const gameTimeLimitSec = 0;

      // 盤面は gridRows（string[]）で保存 — Firestore は配列のネストを許可しないため grid[][] は不可
      await withTimeout(
        setDoc(
          roomDocRef,
          {
            hostUid: uid,
            // 既存のマルチプレイの状態名に合わせて playing を使用（ゲストも一斉に同じ状態になる）
            status: 'playing',
            hundredMode: 'pickup',
            pickupCharset,
            gridRows,
            words: wordsPayload,
            targetWord,
            boardSize: cols,
            boardCols: cols,
            boardRows: rows,
            gameTimeLimitSec,
            recruitDeadlineAt: Timestamp.fromMillis(HUNDRED_OPEN_RECRUIT_DEADLINE_MS),
            foundWords: [],
            startedAt: serverTimestamp(),
            startedBy: uid,
            endReason: deleteField(),
            endedAt: deleteField(),
            problemsGenerating: false,
            problemsReady: true,
          },
          { merge: true }
        ),
        12000,
        'set-playing-doc'
      );

      // お題終了時に外した hundred_public を、次のお題開始で再掲示（完了を待つ）
      await syncHundredPublicForNewRound({
        roomId,
        targetWord,
        boardCols: cols,
        boardRows: rows,
        pickupCharset,
      }).catch((e) => {
        console.warn('[HundredWaitPanel] syncHundredPublicForNewRound failed', e);
      });

      // スナップショット待ちだとホスト側で遷移が遅れたり取りこぼすため、成功直後に必ず遷移
      didStartGame = true;
      const mode =
        roomHundredMode ?? selectedHundred.hundredMode ?? (effectiveTileMatch ? TILE_MATCH_HUNDRED_MODE : 'pickup');
      void startHundredWithMode(roomId, {
        hundredMode: mode,
        preloadedGrid: grid,
        preloadedWords: gridAndWords.placedWords,
      });

      // problems 記録は遷移後に非同期で（失敗しても遷移は止めない）
      const boardLabel = formatBoardDimensions({ boardCols: cols, boardRows: rows, boardSize: cols });
      void addDoc(collection(db, 'hundred_rooms', roomId, 'problems'), {
        order: 1,
        title: `探しもの：「${targetWord}」${boardLabel}`,
        targetWord,
        boardCols: cols,
        boardRows: rows,
        boardLabel,
        isCorrect: null,
        answerHistory: [],
        updatedAt: serverTimestamp(),
      }).catch((e) => {
        console.warn('[HundredWaitPanel] add problem doc failed', e);
      });
    } catch (e: unknown) {
      const isCancelled =
        (typeof e === 'object' &&
          e !== null &&
          'code' in e &&
          (e as { code?: string }).code === 'cancelled') ||
        (e instanceof Error && e.message === 'cancelled');
      if (isCancelled) {
        return;
      }
      await setDoc(doc(db, 'hundred_rooms', roomId), { problemsGenerating: false }, { merge: true }).catch(() => {});
      const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: string }).code) : '';
      const msg = typeof e === 'object' && e && 'message' in e ? String((e as { message?: string }).message) : '';
      console.error('[HundredWaitPanel] handleStart failed', e);
      if (code === 'permission-denied') {
        window.alert(
          '開始の保存が拒否されました（permission-denied）。Firebase コンソールで firestore.rules を公開し直してください。'
        );
      } else if (code === 'invalid-argument') {
        window.alert(
          '保存データの形式が不正です（invalid-argument）。アプリを再読み込みして再度お試しください。'
        );
      } else if (msg.includes('empty-grid') || msg.includes('Empty grid')) {
        window.alert('盤面の生成に失敗しました。「探すことば」や盤面サイズを変えてお試しください。');
      } else if (msg.includes('worker-timeout')) {
        window.alert('問題作成がタイムアウトしました。もう一度お試しください。');
      } else if (msg.includes('timeout:set-problem-flag') || msg.includes('timeout:set-playing-doc') || msg.includes('timeout:clear-problem-flag')) {
        window.alert('通信が混み合っているようです（保存がタイムアウト）。もう一度お試しください。');
      } else {
        window.alert(`ゲームの開始に失敗しました。（${code || 'unknown'}）`);
      }
    } finally {
      // Any failure path should clear the generating flag to avoid getting stuck.
      if (!didStartGame) {
        await setDoc(doc(db, 'hundred_rooms', roomId), { problemsGenerating: false, problemsReady: false }, { merge: true }).catch(() => {});
      }
      startInFlightRef.current = false;
    }
  };

  handleStartRef.current = handleStart;

  const autoHostStartRequestedRef = useRef(false);
  useEffect(() => {
    autoHostStartRequestedRef.current = false;
  }, [roomId]);

  /** 初回お題: ホストの「はじめる」タップを省略（お題間はクリア画面のロボボタンのみ） */
  useEffect(() => {
    if (!headless || !isHost || isRoboLounge) return;
    if (!joinOk || betweenRounds || problemsGenerating) return;
    if (roomBoardReady || status === 'playing' || status === 'started') return;
    if (status !== 'recruiting') return;
    if (autoHostStartRequestedRef.current || startInFlightRef.current) return;
    autoHostStartRequestedRef.current = true;
    void handleStartRef.current();
  }, [
    headless,
    isHost,
    isRoboLounge,
    joinOk,
    betweenRounds,
    problemsGenerating,
    roomBoardReady,
    status,
  ]);

  const maskOrBlockLobbyText = useCallback((raw: string): { text: string; flagged: boolean; matches: string[] } => {
    const src = raw.replace(/\s+/g, ' ').trim();
    const lowered = src.toLowerCase();
    const matches: string[] = [];
    let out = src;
    for (const w of PROHIBITED_WORDS) {
      if (!w) continue;
      if (lowered.includes(w)) {
        matches.push(w);
        // split/join は最小限（短文の送信時のみ）
        out = out.split(w).join('***');
      }
    }
    const flagged = matches.length > 0;
    return { text: out, flagged, matches };
  }, []);

  // Lobby chat: 直近メッセージ（邪魔にならない程度）を購読
  useEffect(() => {
    if (!roomId) return;
    // 入室前/開始後は購読しない（無駄な読みを減らして 429 を避ける）
    if (!joinOk) return;
    if (status !== 'recruiting') return;
    const col = collection(db, 'hundred_rooms', roomId, 'lobby_messages');
    setLobbyChatError(null);

    const parseSnap = (snap: any) => {
      const next: LobbyChatMessage[] = [];
      snap.forEach((d: any) => {
        const x = d.data() as Record<string, unknown>;
        const uid = typeof x.uid === 'string' ? x.uid : d.id;
        const name = typeof x.name === 'string' && x.name.trim() ? x.name.trim() : 'ななし';
        const emoji = typeof x.emoji === 'string' && x.emoji.trim() ? x.emoji.trim() : '💬';
        const text = typeof x.text === 'string' ? x.text : '';
        const flagged = x.flagged === true;
        const createdAtMs =
          typeof x.createdAtMs === 'number'
            ? x.createdAtMs
            : typeof (x.createdAt as any)?.toMillis === 'function'
              ? (x.createdAt as any).toMillis()
              : null;
        next.push({ id: d.id, uid, name, emoji, text, createdAtMs, flagged });
      });
      // 表示は常に「古い→新しい」に揃える（クエリ順や fallback に依存しない）
      next.sort((a, b) => {
        const am = typeof a.createdAtMs === 'number' ? a.createdAtMs : -1;
        const bm = typeof b.createdAtMs === 'number' ? b.createdAtMs : -1;
        if (am !== bm) return am - bm;
        return a.id.localeCompare(b.id);
      });
      setLobbyChat(next);
    };

    // 送信直後に serverTimestamp(createdAt) が未確定でも必ず表示されるよう createdAtMs を優先。
    // ただしルール/インデックス/古いデータ等で失敗した場合は createdAt へフォールバックする。
    // Keep a bit more history so "積み上がらない（すぐ消える）" を防ぐ。
    // 配信モードは邪魔にならないよう少なめのまま。
    // Keep reads small to avoid quota issues.
    // NOTE: 購読は 1 本に固定（fallback で購読が増えると 429 を悪化させやすい）
    const lobbyLimit = streamMode ? 6 : 10;
    // `createdAtMs` は古いデータで欠損しうるため、購読クエリは `createdAt` を基準にする
    // （表示順は createdAtMs/createdAt からローカルで整形済み）
    const qA = query(col, orderBy('createdAt', 'desc'), limit(lobbyLimit));
    const unsubA = onSnapshot(
      qA,
      (snap) => parseSnap(snap),
      (err) => {
        console.warn('[HundredWaitPanel] lobby_messages(createdAtMs) snapshot error', err);
        tripFirestoreCircuit(db as any, err);
        const code = (err as any)?.code;
        if (code === 'resource-exhausted') {
          setLobbyChatError('ロビーチャットが混雑で停止中です（429）。少し待ってから再試行してください。');
        } else if (code === 'permission-denied') {
          setLobbyChatError('ロビーチャットが利用できません（権限）。');
        } else {
          setLobbyChatError('ロビーチャットの取得に失敗しました（通信）。');
        }
        setLobbyChat([]);
      }
    );
    return () => {
      try {
        unsubA();
      } catch {}
    };
  }, [roomId, streamMode, joinOk, status]);

  // 新着が来たら末尾（最新）へスクロール
  // limit 付きクエリだと length が変わらないまま内容だけ差し替わることがあるため、
  // 最後のメッセージIDで検知する。
  const lobbyChatLastId = lobbyChat.length ? lobbyChat[lobbyChat.length - 1]?.id : null;
  useEffect(() => {
    const el = lobbyChatBoxRef.current;
    if (!el) return;
    const raf = window.requestAnimationFrame(() => {
      try {
        el.scrollTop = el.scrollHeight;
      } catch {
        /* ignore */
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [lobbyChatLastId]);

  const handleSendLobbyChat = useCallback(async () => {
    if (!roomId) return;
    if (status !== 'recruiting') return;
    // IMPORTANT: Firestore rules require `request.resource.data.uid == request.auth.uid`.
    // So we must use Firebase Auth uid (not app-local uid).
    if (!auth.currentUser) {
      try {
        await signInAnonymously(auth);
      } catch {
        window.alert('送信に失敗しました（ログインに失敗）。');
        return;
      }
    }
    const uid = auth.currentUser?.uid;
    if (!uid) {
      window.alert('送信に失敗しました（UID取得に失敗）。');
      return;
    }
    const raw = lobbyChatText.trim();
    if (!raw) return;
    if (raw.length > 80) {
      window.alert('メッセージは 80 文字までにしてください。');
      return;
    }
    const { text, flagged, matches } = maskOrBlockLobbyText(raw);
    // 空になりすぎる伏せ字は送信をブロック
    if (!text.replace(/\*/g, '').trim()) {
      window.alert('このメッセージは送信できません。');
      return;
    }
    try {
      setLobbyChatError(null);
      const fromUser = (nickname || '').trim() || 'ななし';
      const fromEmoji = (userEmoji || '').trim() || '💬';
      const createdAtMs = Date.now();
      const docRef = await addDoc(collection(db, 'hundred_rooms', roomId, 'lobby_messages'), {
        uid,
        name: fromUser,
        emoji: fromEmoji,
        text,
        flagged,
        matched: matches.slice(0, 8),
        createdAt: serverTimestamp(),
        createdAtMs,
      });
      // Optimistic UI: show immediately in the lobby chat box,
      // even if snapshot is delayed/paused (e.g. during 429 cooldown).
      setLobbyChat((prev) => {
        const next = prev.filter((m) => m.id !== docRef.id);
        next.push({
          id: docRef.id,
          uid,
          name: fromUser,
          emoji: fromEmoji,
          text,
          flagged,
          createdAtMs,
        });
        return next;
      });
      // Clear input only when the write succeeded.
      setLobbyChatText('');

      // NOTE: do not mirror lobby chat to renraku_private.
      // It increases Firestore writes and can trigger quota issues.
    } catch (e: any) {
      console.error('[HundredWaitPanel] send lobby chat failed', {
        code: e?.code,
        message: e?.message,
        error: e,
      });
      setLobbyChatError('送信に失敗しました（通信/権限）。');
      window.alert('送信に失敗しました。');
    }
  }, [
    roomId,
    status,
    effectiveUid,
    lobbyChatText,
    maskOrBlockLobbyText,
    nickname,
    userEmoji,
  ]);

  const handleCloseRecruitment = useCallback(() => {
    if (!onCloseRecruitment) return;
    if (problemsGenerating) return;
    if (
      !window.confirm('この募集を中止しますか？\n\n一覧から消え、参加中の方にも伝わります。')
    ) {
      return;
    }
    void Promise.resolve(onCloseRecruitment()).catch((e) => {
      console.warn('[HundredWaitPanel] onCloseRecruitment failed', e);
    });
  }, [onCloseRecruitment, problemsGenerating]);

  useEffect(() => {
    if (status !== 'cancelled') return;
    if (isHost) return;
    if (cancelRedirectedRef.current) return;
    cancelRedirectedRef.current = true;
    const modeLabel = isTileMatchRoom ? 'ペア探し' : 'ひと言探し';
    window.alert(`この募集は、ホストが中止しました。\n\n${modeLabel}の募集一覧へ移動します。`);
    window.location.assign(
      sanjuuRecruitBoardUrlForHundredRecruit({
        emoji: userEmoji,
        nickname: nickname || '',
        hundredMode: roomHundredMode ?? selectedHundred.hundredMode,
      })
    );
  }, [status, isHost, userEmoji, nickname, isTileMatchRoom, roomHundredMode, selectedHundred.hundredMode]);

  // NOTE: Manual reset button removed (auto reset runs before start).

  if (joinRoomFull) {
    return (
      <HundredFullRoomPanel
        nickname={nickname}
        userEmoji={userEmoji}
        hundredMode={roomHundredMode ?? selectedHundred.hundredMode}
        onBack={handleBack}
      />
    );
  }

  if (headless) {
    return (
      <HundredProblemGeneratingOverlay
        visible={problemsGenerating}
        onCancel={showCancelGeneration ? () => void handleCancelGeneration() : undefined}
      />
    );
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <button type="button" onClick={handleBack} className={btnGhost}>
        もどる
      </button>

      <div className="relative bg-rk-white rounded-xl p-4 shadow-sm border border-rk-slate-200 space-y-3">
        <HundredProblemGeneratingOverlay
          visible={problemsGenerating}
          onCancel={showCancelGeneration ? () => void handleCancelGeneration() : undefined}
        />
        <div className="text-xs font-black text-rk-slate-400 uppercase tracking-widest">
          {betweenRounds ? '探しもの — 次のお題を待っています' : '探しもの — 待機中'}
        </div>

        {isRoboLounge ? <RoboPickupLoungeGuide className="mt-2" /> : null}

        <div className="rounded-xl border border-rk-red-200 bg-rk-red-50 px-3 py-2.5 space-y-2">
          <p className="text-[11px] font-black text-rk-red-900/90 uppercase tracking-wide">
            参加を希望している人（{displayPlayers.length}人）
          </p>
          {status === 'recruiting' ? (
            <div className="flex flex-wrap gap-1.5 min-h-[2.25rem] items-center">
              {displayPlayers.length === 0 ? (
                <span className="text-xs text-rk-slate-500">まだだれもいません…</span>
              ) : (
                displayPlayers.map((p) => (
                  <span
                    key={p.uid}
                    title={p.name}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-xl shadow-sm ${
                      greenGateByUid[p.uid]
                        ? RK_GREEN_GATE_AVATAR_SHELL_CLASS
                        : 'border border-rk-red-200/90 bg-rk-white'
                    }`}
                  >
                    {p.emoji}
                  </span>
                ))
              )}
            </div>
          ) : (
            <div className="text-xs font-bold text-rk-slate-700">現在 {displayPlayers.length} 人が参加中です</div>
          )}
          <p className="text-[10px] font-medium text-rk-slate-600">
            {isRoboLounge
              ? `いま ${displayPlayers.length} 人がいます（常設・いつでも入れます）`
              : `最大 ${HUNDRED_MAX_PLAYERS} 人まで（現在 ${displayPlayers.length} 人）`}
          </p>
        </div>

        <div className="space-y-1">
          {betweenRounds ? (
            <div className="text-sm font-medium text-rk-slate-600">
              前のお題はおわりました。ホストが次を始めるまで、ここで待てます。
            </div>
          ) : (
            <div className="text-lg font-bold">
              {isTileMatchRoom
                ? `${TILE_MATCH_LABEL_JA}（${
                    TILE_MATCH_DIFFICULTY_LABELS_JA[
                      (selectedHundred.tileMatchDifficulty ?? 'normal') as TileMatchDifficultyId
                    ]
                  }）`
                : `探すことば：${selectedHundred.targetWord || ''}`}
            </div>
          )}
          {!betweenRounds ? (
            <div className="text-sm text-rk-slate-600">
              盤面サイズ：{formatBoardDimensions(selectedHundred)}
            </div>
          ) : null}
          {!isTileMatchRoom && selectedHundred.hintsEnabled === false ? (
            <div className="text-sm font-bold text-rk-slate-600">☝️ヒント：なし</div>
          ) : null}
        </div>

        {recruitCountdownLine ? (
          <p className="text-sm font-medium text-rk-slate-700">{recruitCountdownLine}</p>
        ) : null}

        <div className="text-sm text-rk-slate-400">
          {status === 'started' || status === 'playing'
            ? isRoboLounge
              ? '途中参加OK — まもなく盤面へ'
              : isHost
                ? '開始しました。切り替え中…'
                : '途中参加OK — まもなく盤面へ'
            : isRoboLounge
              ? 'いつでも入れます。まもなく盤面へ'
            : betweenRounds
                ? isHost
                  ? '次のお題の準備ができたら開始してください。はじめると一覧に載ります。'
                  : '次のお題はまだありません。もどってください。'
                : isHost
                  ? '準備ができたら開始してください。はじめると一覧に載ります。'
                  : 'この募集はまだ始まっていません。もどってください。'}
        </div>
        {joinError ? (
          <div className="mt-2 rounded-xl border border-rk-rose-200 bg-rk-rose-50 px-3 py-2 text-sm text-rk-rose-900">
            {joinError}
          </div>
        ) : null}
        {!joinError && !joinOk ? (
          <div className="mt-2 text-xs text-rk-slate-500 leading-snug">
            参加処理中…（通信状況により少し時間がかかることがあります）
            {joinStalled ? (
              <span className="block mt-1 text-rk-amber-800">
                まだこの画面のときは、壊れていません。下のボタンを押してください。
              </span>
            ) : null}
          </div>
        ) : null}

        {!joinOk && !joinError && joinStalled ? (
          <div className="flex flex-col gap-2 pt-1">
            <button type="button" className={btnPrimary} onClick={() => void retryJoin()}>
              参加をやり直す
            </button>
          </div>
        ) : null}

        {boardTransitionBusy ? (
          <div className="mt-2 rounded-xl border border-rk-sky-200 bg-rk-sky-50 px-3 py-2 text-sm text-rk-sky-900 leading-snug">
            盤面を読み込んでいます…（30秒ほどかかることがあります。壊れていません）
          </div>
        ) : null}

        {isRoboLounge && joinOk && !joinError && !roboBoardReady && !boardTransitionBusy ? (
          <div className="mt-2 text-xs text-rk-slate-500 leading-snug">
            お題・盤面を準備しています…（短いときもあります）
          </div>
        ) : null}

        {joinOk &&
        !joinError &&
        roomBoardReady &&
        (isRoboLounge || isHundredRoomInPlay(status)) ? (
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              className={btnPrimary}
              disabled={problemsGenerating || boardTransitionBusy}
              onClick={() => {
                if (!roomId) return;
                void startHundredWithMode(
                  roomId,
                  hundredStartOptsFromRoomData(latestRoomDataRef.current, selectedHundred.hundredMode),
                );
              }}
            >
              盤面へ進む
            </button>
            <p className="text-[10px] text-center text-rk-slate-500 leading-snug">
              自動で切り替わらないとき（4G・遅いWi-Fi）はこのボタンを押してください
            </p>
          </div>
        ) : null}

        {isHost ? (
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              className={btnPrimary}
              disabled={problemsGenerating}
              onClick={() => void handleStart()}
            >
              今すぐスタート！
            </button>
            {onCloseRecruitment ? (
              <button
                type="button"
                className={`${btnGhost} border border-rk-rose-300 bg-rk-rose-50 text-rk-rose-900 hover:bg-rk-rose-100`}
                disabled={problemsGenerating}
                onClick={handleCloseRecruitment}
              >
                募集を中止する
              </button>
            ) : null}
            {problemsGenerating ? (
              <p className="text-[10px] font-medium text-rk-slate-500 text-center leading-relaxed">
                問題を作成中は、上のオーバーレイの「キャンセル」で取り消してください。
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Lobby Chat（安全な短文のみ） */}
        <div className="pt-2 border-t border-rk-slate-100">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-black text-rk-slate-400 uppercase tracking-widest">ロビーチャット</div>
            <div className="text-[10px] font-medium text-rk-slate-400">待機中だけ送信できます</div>
          </div>
          {lobbyChatError ? (
            <div className="mt-2 rounded-xl border border-rk-rose-200 bg-rk-rose-50 px-3 py-2 text-xs text-rk-rose-900">
              {lobbyChatError}
            </div>
          ) : null}

          <div ref={lobbyChatBoxRef} className="mt-2 max-h-36 overflow-y-auto space-y-1 pr-1">
            {lobbyChat.length === 0 ? (
              <div className="text-xs text-rk-slate-500">まだメッセージがありません</div>
            ) : (
              lobbyChat.map((m) => (
                <div key={m.id} className="flex items-start gap-2 text-sm">
                  <span className="mt-[1px]">
                    <RakudaGreenGateEmoji size="inline" greenGate={greenGateByUid[m.uid]}>
                      {m.emoji}
                    </RakudaGreenGateEmoji>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-rk-slate-500">
                      <span className={`font-bold ${m.uid === effectiveUid ? RK_GATE_NICK_DISPLAY_CLASS : 'text-rk-slate-600'}`}>{m.name}</span>
                      {m.createdAtMs != null ? (
                        <span className="ml-2 tabular-nums">{new Date(m.createdAtMs).toLocaleTimeString('ja-JP')}</span>
                      ) : null}
                      {m.flagged ? <span className="ml-2 text-rk-rose-600 font-bold">filtered</span> : null}
                    </div>
                    <div className="text-sm text-rk-slate-700 break-words">{m.text}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={lobbyChatText}
              onChange={(e) => setLobbyChatText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSendLobbyChat();
                }
              }}
              disabled={status !== 'recruiting'}
              placeholder={status === 'recruiting' ? 'ひとこと…（80文字まで）' : '開始後は送信できません'}
              className="flex-1 h-11 px-3 rounded-xl border border-rk-slate-200 bg-rk-slate-50 text-sm focus:outline-none focus:border-rk-amber-200 disabled:opacity-60"
            />
            <button
              type="button"
              className={`${btnPrimary} h-11 px-4`}
              disabled={status !== 'recruiting' || !lobbyChatText.trim()}
              onClick={() => void handleSendLobbyChat()}
            >
              送信
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HundredWaitPanel;

