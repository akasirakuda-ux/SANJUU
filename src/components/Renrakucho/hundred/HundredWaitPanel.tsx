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
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { applyHostCancelledHundredGeneration } from '../../../lib/hundredRecruitCancel';
import { WORKER_CODE } from '../../../lib/puzzleWorker';
import { PROHIBITED_WORDS } from '../../../constants';
import { firestoreSafeJson, gridToFirestoreRows } from '../../../lib/hundredRoomBoard';
import { hundredDisplayDeadlineMs } from '../../../lib/firestoreTime';
import { RENRAKU_STATUS_ACTIVE } from '../../../lib/renrakuVisibility';
import HundredProblemGeneratingOverlay from './HundredProblemGeneratingOverlay';

type RoomPlayer = { uid: string; name: string; emoji: string };
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
  onStartHundred: (roomId: string) => void;
  /** ホストが生成キャンセルで募集を閉じたあと（一覧へ戻す等） */
  onGenerationCancelled?: () => void;
  /** 募集を閉じる（`hundred_public` 削除など）。詳細画面の「募集をとじる」と同じ経路 */
  onCloseRecruitment?: () => void | Promise<void>;
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
}) => {
  const roomId = selectedHundred.roomId || '';
  const roomRef = useMemo(() => (roomId ? doc(db, 'hundred_rooms', roomId) : null), [roomId]);
  const [status, setStatus] = useState<string>('recruiting');
  const [hostUid, setHostUid] = useState<string>('');
  const [authUid, setAuthUid] = useState<string | undefined>(() => auth.currentUser?.uid ?? undefined);
  const [problemsGenerating, setProblemsGenerating] = useState(false);
  /** `hundred_rooms` にある場合は一覧・詳細と同じ優先度で締切に使う */
  const [roomRecruitDeadlineAt, setRoomRecruitDeadlineAt] = useState<unknown>(undefined);
  /** 1秒ごとに更新（募集残り時間表示・締切自動開始） */
  const [nowMs, setNowMs] = useState(() => Date.now());
  /** `hundred_rooms/{roomId}/players` — 参加表明済み（ホスト含む） */
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayer[]>([]);
  const [lobbyChat, setLobbyChat] = useState<LobbyChatMessage[]>([]);
  const [lobbyChatText, setLobbyChatText] = useState('');
  const [lobbyChatError, setLobbyChatError] = useState<string | null>(null);
  const lobbyChatBoxRef = useRef<HTMLDivElement | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinOk, setJoinOk] = useState(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setAuthUid(u?.uid));
    return () => unsub();
  }, []);

  /** hundred_rooms の hostUid 購読前でも、募集データの hostUid でホスト判定できるようにする */
  const effectiveUid = authUid ?? currentUid;
  const isHost =
    !!effectiveUid &&
    (effectiveUid === hostUid || (!!selectedHundred.hostUid && effectiveUid === selectedHundred.hostUid));

  /** キャンセルは Auth の UID で判定（親の currentUid より先に確定することがある） */
  const showCancelGeneration =
    problemsGenerating &&
    !!effectiveUid &&
    (effectiveUid === hostUid || (!!selectedHundred.hostUid && effectiveUid === selectedHundred.hostUid));
  const startInFlightRef = useRef(false);
  /** foundWords 更新で onSnapshot が再発火しても Game へ多重遷移しない */
  const hundredGameOpenedRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);
  /** 盤面生成 Promise をキャンセルするときに reject する */
  const rejectGenerationRef = useRef<((reason?: unknown) => void) | null>(null);
  /** 募集締切による自動開始は1回だけ（room 切り替えでリセット） */
  const autoStartByDeadlineRef = useRef(false);
  /** room doc 欠損時の backfill は1回だけ（無限ループ/無駄な書き込み防止） */
  const didBackfillRoomDocRef = useRef(false);
  // NOTE: Start button has `startInFlightRef` already.
  // Keeping a persistent "did reset" flag can break reset on the next round.
  const handleStartRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    setRoomRecruitDeadlineAt(undefined);
    autoStartByDeadlineRef.current = false;
    didBackfillRoomDocRef.current = false;
  }, [roomId]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), streamMode ? 5000 : 1000);
    return () => window.clearInterval(id);
  }, [streamMode]);

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
      await applyHostCancelledHundredGeneration({ roomId, hundredPublicDocId: selectedHundred.id });
    }
    onGenerationCancelled?.();
  }, [roomId, selectedHundred.id, onGenerationCancelled]);

  // Ensure signed in + join as a player
  useEffect(() => {
    if (!roomId) return;

    let cancelled = false;
    void (async () => {
      setJoinError(null);
      setJoinOk(false);
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

      const didSet = await setDoc(
        playerRef,
        {
          uid,
          name: nickname || 'ななし',
          emoji: userEmoji || '🌸',
          joinedAt: serverTimestamp(),
          lastActiveAt: serverTimestamp(),
        },
        { merge: true }
      )
        .then(() => true)
        .catch((e: any) => {
          console.warn('[HundredWaitPanel] join player setDoc failed', e);
          setJoinError('参加に失敗しました（権限/通信のエラー）。');
          return false;
        });
      if (!didSet) return;

      // NOTE: Avoid extra reads/writes here to prevent Firestore quota errors (429).
      // playerCount is "nice to have" but not required for core flow; room snapshot drives status.
      setJoinOk(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [roomId, nickname, userEmoji]);

  // Subscribe to room status; if started -> switch everyone to GameScreen（1回だけ）
  useEffect(() => {
    hundredGameOpenedRef.current = false;
  }, [roomId]);

  useEffect(() => {
    if (!roomRef) return;
    // 入室できるまで room doc を購読しない（429対策）
    if (!joinOk) return;
    const unsub = onSnapshot(
      roomRef,
      async (snap) => {
        if (!snap.exists()) {
          // ドキュメント欠損時も全クライアントで生成オーバーレイを閉じる（ホスト離脱・削除など）
          setProblemsGenerating(false);
          setHostUid('');
          setStatus('recruiting');
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
                gameTimeLimitSec: 0,
              },
              { merge: true }
            ).catch(() => {});
          }
          return;
        }
        const data = snap.data() as any;
        const nextStatus = typeof data?.status === 'string' ? data.status : 'recruiting';
        setStatus(nextStatus);
        setHostUid(typeof data?.hostUid === 'string' ? data.hostUid : '');
        if (data?.recruitDeadlineAt != null) {
          setRoomRecruitDeadlineAt(data.recruitDeadlineAt);
        }
        // Firestore の真偽のみ反映（ホストがキャンセルして false になったら全員のオーバーレイが閉じる）
        setProblemsGenerating(data?.problemsGenerating === true);
        if ((nextStatus === 'started' || nextStatus === 'playing') && roomId && !hundredGameOpenedRef.current) {
          hundredGameOpenedRef.current = true;
          onStartHundred(roomId);
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
    onStartHundred,
    selectedHundred.boardSize,
    selectedHundred.targetWord,
    joinOk,
    isHost,
  ]);

  // 参加者一覧（参加ボタン／入室と同じ players サブコレ）をリアルタイム表示
  useEffect(() => {
    // 募集中だけ絵文字表示が必要。開始後は人数だけで十分なので購読を止めて負荷を下げる。
    if (!roomId) return;
    if (status !== 'recruiting') return;
    const col = collection(db, 'hundred_rooms', roomId, 'players');
    const q = query(col, limit(30));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: RoomPlayer[] = [];
        snap.forEach((d) => {
          const x = d.data() as Record<string, unknown>;
          const name = typeof x.name === 'string' && x.name.trim() ? x.name.trim() : 'ななし';
          const emoji = typeof x.emoji === 'string' && x.emoji.trim() ? x.emoji.trim() : '🌸';
          next.push({ uid: d.id, name, emoji });
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
    if (!h) return [...roomPlayers].sort(byName);
    const hostRow = roomPlayers.find((p) => p.uid === h);
    const rest = roomPlayers.filter((p) => p.uid !== h).sort(byName);
    return hostRow ? [hostRow, ...rest] : rest;
  }, [roomPlayers, selectedHundred.hostUid, hostUid]);

  const recruitDeadlineMs = useMemo(
    () =>
      hundredDisplayDeadlineMs({
        roomRecruitDeadlineAt,
        itemRecruitDeadlineAt: selectedHundred.recruitDeadlineAt,
        itemCreatedAt: selectedHundred.createdAt,
      }),
    [roomRecruitDeadlineAt, selectedHundred.recruitDeadlineAt, selectedHundred.createdAt]
  );

  const recruitRemainingSec =
    recruitDeadlineMs == null ? null : Math.max(0, Math.floor((recruitDeadlineMs - nowMs) / 1000));

  const recruitCountdownLine = useMemo(() => {
    if (status === 'started') return '募集の残り時間：—';
    if (recruitDeadlineMs == null) return '募集の残り時間：—';
    if (recruitRemainingSec == null) return '募集の残り時間：—';
    const m = Math.floor(recruitRemainingSec / 60);
    const s = recruitRemainingSec % 60;
    return `募集の残り時間：あと ${m}分${s}秒`;
  }, [status, recruitDeadlineMs, recruitRemainingSec]);

  /** 10秒以下（0秒＝タイムアップ直後の待機中も含む）で赤太字 */
  const recruitCountdownUrgent =
    recruitRemainingSec != null &&
    recruitRemainingSec <= 10 &&
    status === 'recruiting';

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

      // 探しもの（単語1つを大量配置）の盤面を生成し、hundred_rooms に保存して GameScreen へ遷移
      // `hundred_public` / HundredCreate と同じ number（正方形の一辺）。欠損時は作成画面の既定 50
      const size = Number(selectedHundred.boardSize) || 50;
      const targetWord = (selectedHundred.targetWord || '').trim();
      if (!targetWord) {
        window.alert('「探すことば」が空です。募集を作り直すか、別の部屋を選んでください。');
        return;
      }
      if (Array.from(targetWord).length > size) {
        window.alert(`「探すことば」が盤面サイズ（${size}×${size}）より長いです。募集を作り直してください。`);
        return;
      }
      const dictionary = [targetWord];

      const roomDocRef = doc(db, 'hundred_rooms', roomId);
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

          const timeoutMs = 12_000;
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
            size,
            dictionary,
            targetWord,
            prohibitedWords: PROHIBITED_WORDS,
            isKanji: false,
            seed,
            isKatakana: false,
          });
        });

      const isValidPlacedWords = (placedWords: any[]) => {
        if (!Array.isArray(placedWords) || placedWords.length === 0) return false;
        return placedWords.some((pw) => pw && typeof pw.word === 'string' && Array.isArray(pw.occurrences) && pw.occurrences.length > 0);
      };

      // 要件: 盤面の正解帯（＝配置時に塗ったセル）が一定割合で覆われること。
      // pickup の正解は targetWord のみで、placedWords（再スキャン）は「正解単語の成立箇所」なので
      // 被覆率判定は worker が返す density（配置セル比率）を正とする。
      const TARGET_COVERAGE = 0.7;
      const MAX_ATTEMPTS = 24;

      // 答え0個の盤面は出題禁止。さらに被覆率が足りない場合もseedを変えて再生成する。
      let gridAndWords: { grid: string[][]; placedWords: any[]; density?: number } | null = null;
      let best: { grid: string[][]; placedWords: any[]; coverage: number } | null = null;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const seed = Math.floor(Math.random() * 1000000);
        let r: { grid: string[][]; placedWords: any[]; density?: number } | null = null;
        try {
          r = await runWorkerOnce(seed);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes('worker-timeout')) {
            console.warn('[HundredWaitPanel] worker timeout', { attempt, size, targetWord });
            continue;
          }
          throw e;
        }
        if (!r) continue;
        if (!isValidPlacedWords(r.placedWords)) {
          continue;
        }
        const coverage = typeof r.density === 'number' ? r.density : 0;
        if (!best || coverage > best.coverage) {
          best = { ...r, coverage };
        }
        if (coverage >= TARGET_COVERAGE) {
          gridAndWords = r;
          break;
        }
      }
      if (!gridAndWords) {
        await clearProblemGenFlag();
        const bestPct = best ? Math.round(best.coverage * 100) : 0;
        window.alert(
          `盤面の生成に失敗しました（正解帯の被覆率が不足）。\n目標: 70% / 最高: ${bestPct}%\nことばや盤面サイズを変えてお試しください。`
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
            gridRows,
            words: wordsPayload,
            targetWord,
            boardSize: size,
            gameTimeLimitSec,
            foundWords: [],
            startedAt: serverTimestamp(),
            startedBy: uid,
            problemsGenerating: false,
            problemsReady: true,
          },
          { merge: true }
        ),
        12000,
        'set-playing-doc'
      );

      // スナップショット待ちだとホスト側で遷移が遅れたり取りこぼすため、成功直後に必ず遷移
      hundredGameOpenedRef.current = true;
      didStartGame = true;
      onStartHundred(roomId);

      // problems 記録は遷移後に非同期で（失敗しても遷移は止めない）
      void addDoc(collection(db, 'hundred_rooms', roomId, 'problems'), {
        order: 1,
        title: `探しもの：「${targetWord}」をさがそう！`,
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

  // 募集締切の瞬間にホストのみ自動で問題生成（handleStart）を開始（生成中は二重起動しない）
  useEffect(() => {
    if (!isHost) return;
    if (status !== 'recruiting') return;
    if (problemsGenerating) return;
    if (startInFlightRef.current) return;
    if (recruitDeadlineMs == null) return;
    if (nowMs < recruitDeadlineMs) return;
    if (autoStartByDeadlineRef.current) return;
    autoStartByDeadlineRef.current = true;
    void handleStartRef.current();
  }, [isHost, status, problemsGenerating, recruitDeadlineMs, nowMs]);

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

  // NOTE: Manual reset button removed (auto reset runs before start).

  if (status === 'cancelled' && !isHost) {
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <button type="button" onClick={onBack} className={btnGhost}>
          もどる
        </button>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 space-y-2">
          <div className="text-xs font-black text-slate-400 uppercase tracking-widest">探しもの</div>
          <p className="text-sm text-slate-700 leading-relaxed">
            この募集は、ホストがあそびの準備を取り消しました。掲示板の一覧からも消えています。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <button type="button" onClick={onBack} className={btnGhost}>
        もどる
      </button>

      <div className="relative bg-white rounded-xl p-4 shadow-sm border border-slate-200 space-y-3">
        <HundredProblemGeneratingOverlay
          visible={problemsGenerating}
          onCancel={showCancelGeneration ? () => void handleCancelGeneration() : undefined}
        />
        <div className="text-xs font-black text-slate-400 uppercase tracking-widest">探しもの — 待機中</div>

        <div className="rounded-xl border border-red-200/80 bg-red-50/90 px-3 py-2.5 space-y-2">
          <p className="text-[11px] font-black text-red-900/90 uppercase tracking-wide">
            参加を希望している人（{displayPlayers.length}人）
          </p>
          {status === 'recruiting' ? (
            <div className="flex flex-wrap gap-1.5 min-h-[2.25rem] items-center">
              {displayPlayers.length === 0 ? (
                <span className="text-xs text-slate-500">まだだれもいません…</span>
              ) : (
                displayPlayers.map((p) => (
                  <span
                    key={p.uid}
                    title={p.name}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200/90 bg-white text-xl shadow-sm"
                  >
                    {p.emoji}
                  </span>
                ))
              )}
            </div>
          ) : (
            <div className="text-xs font-bold text-slate-700">現在 {displayPlayers.length} 人が参加中です</div>
          )}
          <p className="text-[10px] font-medium text-slate-600">最大 30 人まで（現在 {displayPlayers.length} 人）</p>
        </div>

        <div className="space-y-1">
          <div className="text-lg font-bold">探すことば：{selectedHundred.targetWord || ''}</div>
          <div className="text-sm text-slate-600">
            盤面サイズ：{Number(selectedHundred.boardSize) || 0} × {Number(selectedHundred.boardSize) || 0}
          </div>
        </div>

        {/* 締切は Firestore の recruitDeadlineAt（room 優先）とクライアント時刻の差分を 1 秒ごと更新 */}
        <p
          className={`text-sm tabular-nums ${
            recruitCountdownUrgent ? 'font-extrabold text-red-600' : 'font-medium text-slate-700'
          }`}
        >
          {recruitCountdownLine}
        </p>

        <div className="text-sm text-slate-400">
          {status === 'started' ? '開始しました。切り替え中…' : isHost ? '準備ができたら開始してください。' : 'ホストの開始を待っています…'}
        </div>
        {joinError ? (
          <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {joinError}
          </div>
        ) : null}
        {!joinError && !joinOk ? (
          <div className="mt-2 text-xs text-slate-500">参加処理中…（通信状況により少し時間がかかることがあります）</div>
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
                className={`${btnGhost} border border-rose-300 bg-rose-50 text-rose-900 hover:bg-rose-100`}
                disabled={problemsGenerating}
                onClick={handleCloseRecruitment}
              >
                募集を中止する
              </button>
            ) : null}
            {problemsGenerating ? (
              <p className="text-[10px] font-medium text-slate-500 text-center leading-relaxed">
                問題を作成中は、上のオーバーレイの「キャンセル」で取り消してください。
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Lobby Chat（安全な短文のみ） */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">ロビーチャット</div>
            <div className="text-[10px] font-medium text-slate-400">待機中だけ送信できます</div>
          </div>
          {lobbyChatError ? (
            <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
              {lobbyChatError}
            </div>
          ) : null}

          <div ref={lobbyChatBoxRef} className="mt-2 max-h-36 overflow-y-auto space-y-1 pr-1">
            {lobbyChat.length === 0 ? (
              <div className="text-xs text-slate-500">まだメッセージがありません</div>
            ) : (
              lobbyChat.map((m) => (
                <div key={m.id} className="flex items-start gap-2 text-sm">
                  <span className="mt-[1px]">{m.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-slate-500">
                      <span className="font-bold text-slate-600">{m.name}</span>
                      {m.createdAtMs != null ? (
                        <span className="ml-2 tabular-nums">{new Date(m.createdAtMs).toLocaleTimeString('ja-JP')}</span>
                      ) : null}
                      {m.flagged ? <span className="ml-2 text-rose-600 font-bold">filtered</span> : null}
                    </div>
                    <div className="text-sm text-slate-700 break-words">{m.text}</div>
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
              className="flex-1 h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-amber-200 disabled:opacity-60"
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

