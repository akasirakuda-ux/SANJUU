
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  WordCategory, ScreenType, GameState, UserAccount, Point, FoundWord
} from '../types';
import { 
  PROHIBITED_WORDS, MASTER, convertToHiragana, convertToKatakana,
  BODY_GROUP_EXCLUDED_WORDS,
  FISH_GROUP_EXCLUDED_WORDS, resolveCategoryDictionary,
  isWordCategoryPaused, FISH_GROUP_PAUSED_MESSAGE,
} from '../constants';
import { db, auth } from '../firebase';
import { 
  doc, 
  setDoc, 
  onSnapshot, 
  collection, 
  getDoc, 
  getDocs,
  deleteDoc,
  addDoc,
  increment,
  arrayUnion,
  serverTimestamp,
  deleteField,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { WORKER_CODE } from '../lib/puzzleWorker';
import { generatePickupBoardReliable } from '../lib/hundredPickupFeasibility';
import {
  inferPickupCharsetFromWord,
  normalizePickupCharset,
  type PickupCharset,
} from '../lib/hundredPickupCharset';
import { gridRowsFromFirestore, hundredRoomCanEnterGame } from '../lib/hundredRoomBoard';
import { resolveBoardCols, resolveBoardRows } from '../lib/boardDimensions';
import { archiveHundredSessionToProblemHistory } from '../lib/hundredProblemHistory';
import { deleteHundredPublicForFinishedRoom } from '../lib/hundredRecruitCancel';
import {
  hasHundredAdvancedPastFinishRound,
  isHundredOpenRecruitDeadline,
  firestoreLikeToMillis,
} from '../lib/firestoreTime';
import { normalizeHundredFoundList } from '../lib/hundredFoundNormalize';
import {
  canonicalOccurrenceKey,
  countPlacedWordOccurrences,
} from '../lib/hundredPickupOccurrences';
import { replayHundredPickupWithRoboWord } from '../lib/hundredRoboReplay';
import { clearHundredRoomPlayersForNewRound, reconcileHundredRoomPlayerCount } from '../lib/hundredRoomPlayer';
import { isRoboPickupLoungeRoomId, roboLoungeBoardSizeMismatch } from '../lib/roboPickupLoungeConfig';
import { shouldDeferRoboLoungeRoomSync } from '../lib/roboPickupLoungeResultsHold';
import type { HundredRosterPlayer } from '../lib/hundredPlayerPresence';
import { HUNDRED_PLAYER_HEARTBEAT_MS } from '../lib/hundredPlayerPresence';
import { refreshRoboPickupLoungeManual, refreshRoboPickupLoungeAuto, refreshRoboPickupLoungeBoardSizeIfNeeded } from '../lib/roboPickupLoungeRefresh';
import { RAKUDA_ROBO_EMOJI, RAKUDA_ROBO_NAME, RAKUDA_ROBO_PLAYER_ID } from '../lib/reversiConfig';
import { tripFirestoreCircuit } from '../lib/firestoreCircuit';
import { geminiService } from '../services/geminiService';
import { stringToSeed } from '../lib/utils';
import { useSyncRoom } from './useSyncRoom';
import { pickRandomBandColor } from '../lib/rkTheme';
import { TILE_MATCH_HUNDRED_MODE } from '../lib/tileMatch/config';
import { hundredBoardKeySignature } from '../lib/hundredBoardSync';

const PUZZLE_SIZE_HINT_JA = '問題のサイズを大きくして作ってみてね';

function mergeFoundWords(prevList: any[], remoteList: any[]): any[] {
  const a = Array.isArray(prevList) ? prevList : [];
  const b = Array.isArray(remoteList) ? remoteList : [];
  const keyOf = (fw: any) => {
    const s = fw?.start;
    const e = fw?.end;
    const w = typeof fw?.word === 'string' ? fw.word : '';
    const sx = typeof s?.x === 'number' ? s.x : -1;
    const sy = typeof s?.y === 'number' ? s.y : -1;
    const ex = typeof e?.x === 'number' ? e.x : -1;
    const ey = typeof e?.y === 'number' ? e.y : -1;
    return `${w}|${sx},${sy}-${ex},${ey}`;
  };
  const seen = new Set<string>();
  const out: any[] = [];
  // Prefer remote ordering, then keep any local-only optimistic entries.
  for (const fw of b) {
    const k = keyOf(fw);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(fw);
  }
  for (const fw of a) {
    const k = keyOf(fw);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(fw);
  }
  // Safety cap: keep recent-ish items only.
  if (out.length > 600) return out.slice(0, 600);
  return out;
}

function filterCategoryPlacedWords(category: string, placedWords: GameState['placedWords']) {
  const excluded =
    category === 'fish_group'
      ? FISH_GROUP_EXCLUDED_WORDS
      : category === 'からだ'
        ? BODY_GROUP_EXCLUDED_WORDS
        : null;
  if (!excluded) return placedWords;
  const excludedSet = new Set<string>(excluded);
  return placedWords.filter((pw) => !excludedSet.has(pw.word));
}

function puzzleProhibitedWords(category: string) {
  if (category === 'fish_group') return [...PROHIBITED_WORDS, ...FISH_GROUP_EXCLUDED_WORDS];
  if (category === 'からだ') return [...PROHIBITED_WORDS, ...BODY_GROUP_EXCLUDED_WORDS];
  return PROHIBITED_WORDS;
}

function isUnplayablePuzzleResult(result: { grid?: string[][]; placedWords?: unknown[] } | null | undefined) {
  const gridEmpty = !result?.grid?.length;
  const noPlaced = !result?.placedWords?.length;
  return gridEmpty || noPlaced;
}

export const useGame = (
  user: UserAccount,
  setUser: any,
  nickname: string,
  language: string,
  setNotification: (msg: string | null) => void,
  handleFirestoreError: any,
  firebaseUser: any,
  isAuthReady: boolean,
  ensureAuth: () => Promise<void>,
  userEmoji: string,
  showPuzzleSizeHint?: (message: string) => void
) => {
  const [screen, setScreen] = useState<ScreenType>('seat-selection');
  const [difficulty, setDifficulty] = useState(9);
  const [isMultiplay, setIsMultiplay] = useState(false);
  const [isSyncMode, setIsSyncMode] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [narration, setNarration] = useState<string>('');
  const [seed, setSeed] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const generatingSinceMsRef = useRef<number | null>(null);
  const gridLenRef = useRef(0);
  const syncFromHundredRoomsRef = useRef(false);
  const roomIdRef = useRef<string | null>(null);
  const screenRef = useRef<ScreenType>('seat-selection');
  const [roomId, setRoomId] = useState<string | null>(null);
  /** みんなであそぶ: 盤面・進捗は hundred_rooms/{roomId} を購読（syncRooms ではない） */
  const [syncFromHundredRooms, setSyncFromHundredRooms] = useState(false);
  /** みんなであそぶ: players サブコレ（盤面絵文字は lastActiveAt で在室フィルタ） */
  const [hundredRoster, setHundredRoster] = useState<HundredRosterPlayer[]>([]);
  const hundredRoomApplyTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const hundredRoomLastAppliedAtMsRef = useRef(0);
  const roboBoardResizeBusyRef = useRef(false);
  /** デバウンス中の最新スナップショット（patch と foundWords は常にセットで保持） */
  const hundredRoomPendingApplyRef = useRef<{
    patch: Partial<GameState>;
    foundWordsRaw: unknown;
    totalOccurrences: number;
    boardKey: string;
  } | null>(null);
  /** 同一お題中の foundWords だけの更新を即反映するための盤面キー */
  const hundredRoomBoardKeyRef = useRef('');
  /** hundred_rooms の hostUid（ゲーム画面でホスト離脱時の確認に使用） */
  const [hundredRoomHostUid, setHundredRoomHostUid] = useState<string | null>(null);
  /** 現行お題の開始（ロボ常設の参加者フィルタ用） */
  const [hundredRoomStartedAt, setHundredRoomStartedAt] = useState<unknown>(null);
  /** ロボ常設: 最後に誰かが見つけた時刻（ヒント／差し替え用） */
  const [hundredRoomLastFoundAt, setHundredRoomLastFoundAt] = useState<unknown>(null);
  const [hundredRoomUpdatedAt, setHundredRoomUpdatedAt] = useState<unknown>(null);
  const hundredRoomStartedAtMsRef = useRef<number | null>(null);
  const [syncShareRoomId, setSyncShareRoomId] = useState<string | null>(null);
  const [pendingRoomId, setPendingRoomId] = useState<{ id: string; isSync: boolean } | null>(null);
  const [roomStartTime, setRoomStartTime] = useState<number | null>(null);

  const [gameState, setGameState] = useState<GameState>({
    grid: [],
    placedWords: [],
    foundWords: [],
    difficulty: difficulty,
    isKatakana: false,
    category: MASTER.categories[0] // Ensure default category is always present
  });

  const workerRef = useRef<Worker | null>(null);
  const { subscribeRoom, createRoom } = useSyncRoom();

  useEffect(() => {
    gridLenRef.current = gameState.grid?.length ?? 0;
  }, [gameState.grid]);
  useEffect(() => {
    syncFromHundredRoomsRef.current = syncFromHundredRooms;
  }, [syncFromHundredRooms]);
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  // Safety: if "generating" gets stuck (iPad/Safari/worker issues), auto-recover.
  useEffect(() => {
    if (!isGenerating) {
      generatingSinceMsRef.current = null;
      return;
    }
    const started = Date.now();
    generatingSinceMsRef.current = started;
    const tid = window.setTimeout(() => {
      if (generatingSinceMsRef.current !== started) return;

      void (async () => {
        const rid = roomIdRef.current;
        if (syncFromHundredRoomsRef.current && rid && gridLenRef.current === 0) {
          try {
            const snap = await getDoc(doc(db, 'hundred_rooms', rid));
            if (snap.exists()) {
              const d = snap.data() as Record<string, unknown>;
              const grid = gridRowsFromFirestore(d);
              if (grid?.length) {
                const words = Array.isArray(d.words) ? d.words : [];
                setGameState((prev) => ({
                  ...prev,
                  grid,
                  placedWords: words as GameState['placedWords'],
                }));
                setIsGenerating(false);
                return;
              }
              if (d.problemsGenerating === true) {
                setNotification(
                  language === 'ja'
                    ? 'ホストが盤面を作成中です。あと少々お待ちください'
                    : 'Host is still creating the board. Please wait.',
                );
                setIsGenerating(false);
                return;
              }
              const roomStatus = typeof d.status === 'string' ? d.status : '';
              // ホストの「はじめる」待ち・お題間は追い出さない（待機室非表示化後の誤タイムアウト防止）
              if (roomStatus === 'recruiting') {
                setIsGenerating(false);
                return;
              }
            }
          } catch {
            /* fall through */
          }
          if (screenRef.current === 'game') {
            setSyncFromHundredRooms(false);
            setRoomId(null);
            setGameState((prev) => ({ ...prev, grid: [], placedWords: [], foundWords: [] }));
            setScreen('seat-selection');
            setNotification(
              language === 'ja'
                ? '盤面を読み込めませんでした。募集からもう一度参加してください。'
                : 'Could not load the board. Please rejoin from the recruit list.',
            );
            setIsGenerating(false);
            return;
          }
        }

        setIsGenerating(false);
        setNotification(
          language === 'ja'
            ? '生成が長いのでいったん復帰しました（もう一度お試しください）'
            : 'Generation took too long. Please try again.',
        );
      })();
    }, 25_000);
    return () => window.clearTimeout(tid);
  }, [isGenerating, language, setNotification, setScreen]);

  // Prevent double-sends of the same found occurrence (e.g. pointerup double-fire / network retry UX)
  const recentHundredFoundKeysRef = useRef<Set<string>>(new Set());
  /** 同一正解の再送時に色だけ揃える（ランダム色の idempotent 送信） */
  const recentHundredFoundColorsRef = useRef<Map<string, string>>(new Map());
  /** みんなであそぶ: 正解の Firestore 書き込みを短くまとめる（20人同時タップ対策） */
  const HUNDRED_FOUND_WRITE_BATCH_MS = 200;
  type HundredFoundPendingWrite = {
    word: string;
    start: Point;
    end: Point;
    color: string;
    currentUid: string;
    shortName: string;
    shortEmoji: string;
    writerUid: string;
    isRobo: boolean;
  };
  const hundredFoundWriteQueueRef = useRef<HundredFoundPendingWrite[]>([]);
  const hundredFoundWriteTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const hundredFoundFlushInFlightRef = useRef(false);

  const flushHundredFoundWrites = useCallback(async () => {
    const rid = roomIdRef.current;
    if (!rid || !syncFromHundredRoomsRef.current) return;
    if (hundredFoundFlushInFlightRef.current) return;

    const batch = hundredFoundWriteQueueRef.current.splice(0);
    if (!batch.length) return;

    hundredFoundFlushInFlightRef.current = true;
    try {
      const unionItems = batch.map((item) => ({
        w: item.word,
        s: item.start,
        e: item.end,
        c: item.color,
        p: item.currentUid,
        n: item.shortName,
        m: item.shortEmoji,
      }));
      await setDoc(
        doc(db, 'hundred_rooms', rid),
        {
          foundWords: arrayUnion(...unionItems),
          updatedAt: serverTimestamp(),
          ...(isRoboPickupLoungeRoomId(rid) ? { lastFoundAt: serverTimestamp() } : {}),
        },
        { merge: true },
      );

      const countsByUid = new Map<string, { count: number; shortName: string; emoji: string }>();
      for (const item of batch) {
        if (item.isRobo) continue;
        const prev = countsByUid.get(item.writerUid);
        if (prev) {
          prev.count += 1;
        } else {
          countsByUid.set(item.writerUid, {
            count: 1,
            shortName: item.shortName,
            emoji: item.shortEmoji,
          });
        }
      }
      await Promise.all(
        Array.from(countsByUid.entries()).map(([uid, meta]) =>
          setDoc(
            doc(db, 'hundred_rooms', rid, 'players', uid),
            {
              uid,
              foundCount: increment(meta.count),
              name: meta.shortName,
              emoji: meta.emoji,
              lastActiveAt: serverTimestamp(),
            },
            { merge: true },
          ),
        ),
      );
    } catch (error) {
      console.error('Error syncing batched found words (hundred_rooms):', error);
    } finally {
      hundredFoundFlushInFlightRef.current = false;
      if (hundredFoundWriteQueueRef.current.length > 0) {
        void flushHundredFoundWrites();
      }
    }
  }, []);

  const scheduleHundredFoundWrite = useCallback(
    (entry: HundredFoundPendingWrite) => {
      hundredFoundWriteQueueRef.current.push(entry);
      if (hundredFoundWriteTimerRef.current != null) {
        window.clearTimeout(hundredFoundWriteTimerRef.current);
      }
      hundredFoundWriteTimerRef.current = window.setTimeout(() => {
        hundredFoundWriteTimerRef.current = null;
        void flushHundredFoundWrites();
      }, HUNDRED_FOUND_WRITE_BATCH_MS);
    },
    [flushHundredFoundWrites],
  );

  const resetHundredRoundSyncState = useCallback(() => {
    hundredRoomBoardKeyRef.current = '';
    if (hundredRoomApplyTimerRef.current != null) {
      window.clearTimeout(hundredRoomApplyTimerRef.current);
      hundredRoomApplyTimerRef.current = null;
    }
    hundredRoomPendingApplyRef.current = null;
    if (hundredFoundWriteTimerRef.current != null) {
      window.clearTimeout(hundredFoundWriteTimerRef.current);
      hundredFoundWriteTimerRef.current = null;
    }
    hundredFoundWriteQueueRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      if (hundredFoundWriteTimerRef.current != null) {
        window.clearTimeout(hundredFoundWriteTimerRef.current);
        hundredFoundWriteTimerRef.current = null;
      }
      if (hundredFoundWriteQueueRef.current.length > 0) {
        void flushHundredFoundWrites();
      }
      hundredFoundWriteQueueRef.current = [];
    };
  }, [roomId, flushHundredFoundWrites]);

  const hundredOccurrenceKey = useCallback((word: string, start: Point, end: Point) => {
    const ax = start.x | 0;
    const ay = start.y | 0;
    const bx = end.x | 0;
    const by = end.y | 0;
    const k1 = `${word}|${ax},${ay}-${bx},${by}`;
    const k2 = `${word}|${bx},${by}-${ax},${ay}`;
    return k1 < k2 ? k1 : k2;
  }, []);

  useEffect(() => {
    setSyncShareRoomId(null);
  }, [roomId]);

  useEffect(() => {
    if (!roomId) {
      setSyncFromHundredRooms(false);
      setHundredRoomHostUid(null);
    }
  }, [roomId]);

  useEffect(() => {
    const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
    workerRef.current = new Worker(URL.createObjectURL(blob));
    return () => workerRef.current?.terminate();
  }, []);

  /** @returns 盤面生成に成功したら true。出題不可などは false（reject しないので Promise エラーにならない） */
  const startNewGame = useCallback((cat: WordCategory, forcedSeed?: number, forcedDiff?: number, isKatakana?: boolean, isFromSync = false): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      if (isWordCategoryPaused(cat.category)) {
        setNotification(FISH_GROUP_PAUSED_MESSAGE);
        resolve(false);
        return;
      }
      const diff = forcedDiff || difficulty;
      const actualSeed = forcedSeed !== undefined ? forcedSeed : Math.floor(Math.random() * 1000000);
      
      setIsGenerating(true);
      
      const dictionary = resolveCategoryDictionary(cat.category, cat.words);
      const isKanji =
        !!cat.isKanji || cat.category === 'kanji' || cat.category === 'yojijukugo';

      workerRef.current!.onmessage = async (e) => {
        try {
          const result = e.data;
          if (!result || isUnplayablePuzzleResult(result)) {
            console.warn('Worker returned unplayable puzzle', { category: cat.category, hasGrid: !!result?.grid?.length, words: result?.placedWords?.length });
            setIsGenerating(false);
            if (showPuzzleSizeHint) {
              showPuzzleSizeHint(PUZZLE_SIZE_HINT_JA);
            } else {
              setNotification(language === 'ja' ? 'パズルの生成に失敗しました。' : 'Failed to generate puzzle.');
            }
            resolve(false);
            return;
          }

          const placedWords = filterCategoryPlacedWords(cat.category, result.placedWords);

          // 4. rooms/{roomId}/board に盤面データを保存
          if (isMultiplay && roomId && !isFromSync) {
            try {
              const boardRef = doc(db, `rooms/${roomId}/board/data`);
              await setDoc(boardRef, {
                grid: result.grid,
                words: placedWords,
                category: cat.category, // Store category ID
                difficulty: diff,
                isKatakana: !!isKatakana,
                actualSeed: actualSeed
              });
              
              // Reset progress for new game
              const progressRef = doc(db, `rooms/${roomId}/progress/data`);
              await setDoc(progressRef, { answers: {} });
            } catch (err) {
              console.error("Error saving board to Firestore:", err);
              setIsGenerating(false);
              reject(err);
              return;
            }

            try {
              const newRoomId = await createRoom(result.grid);
              setSyncShareRoomId(newRoomId);
            } catch (err) {
              console.error("Error creating sync room:", err);
            }
          }

          setGameState({
            grid: result.grid,
            placedWords,
            foundWords: [],
            category: cat,
            difficulty: diff,
            actualSeed: actualSeed,
            isKatakana: !!isKatakana,
            gameMode: 'normal',
            searchTimeLimitSec: undefined,
            targetWord: undefined,
          });
          setIsGenerating(false);
          if (!isMultiplay) {
            setScreen('game');
          }
          resolve(true);
        } catch (err) {
          console.error("Unexpected error in worker onmessage:", err);
          setIsGenerating(false);
          reject(err);
        }
      };

      workerRef.current!.onerror = (err) => {
        console.error("Worker error:", err);
        setIsGenerating(false);
        setNotification("パズルの生成中にエラーが発生しました。");
        reject(err);
      };

      workerRef.current!.postMessage({
        category: cat.category,
        size: diff,
        dictionary,
        prohibitedWords: puzzleProhibitedWords(cat.category),
        isKanji,
        seed: actualSeed,
        isKatakana: !!isKatakana
      });
    });
  }, [difficulty, isMultiplay, roomId, setNotification, createRoom, showPuzzleSizeHint, language]);

  /** @returns 盤面生成に成功したら true。出題不可などは false */
  const startSearchGame = useCallback((targetWord: string, diff: number, maxWords = 20, forcedSeed?: number, isKatakana?: boolean, isFromSync = false): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      setIsGenerating(true);
      const actualSeed = forcedSeed !== undefined ? forcedSeed : Math.floor(Math.random() * 1000000);

      workerRef.current!.onmessage = async (e) => {
        try {
          const result = e.data;
          if (!result || isUnplayablePuzzleResult(result)) {
            console.warn('Worker returned unplayable puzzle (search mode)');
            setIsGenerating(false);
            if (showPuzzleSizeHint) {
              showPuzzleSizeHint(PUZZLE_SIZE_HINT_JA);
            } else {
              setNotification(language === 'ja' ? 'パズルの生成に失敗しました。' : 'Failed to generate puzzle.');
            }
            resolve(false);
            return;
          }

          const searchCat = { title: `「${targetWord}」をさがせ！`, category: 'search', emoji: '🔍', words: [targetWord] };

          // 4. rooms/{roomId}/board に盤面データを保存
          if (isMultiplay && roomId && !isFromSync) {
            try {
              const boardRef = doc(db, `rooms/${roomId}/board/data`);
              await setDoc(boardRef, {
                grid: result.grid,
                words: result.placedWords,
                category: 'search',
                difficulty: diff,
                isKatakana: !!isKatakana,
                actualSeed: actualSeed,
                targetWord: targetWord
              });
              
              // Reset progress for new game
              const progressRef = doc(db, `rooms/${roomId}/progress/data`);
              await setDoc(progressRef, { answers: {} });
            } catch (err) {
              console.error("Error saving search board to Firestore:", err);
              setIsGenerating(false);
              reject(err);
              return;
            }

            try {
              const newRoomId = await createRoom(result.grid);
              setSyncShareRoomId(newRoomId);
            } catch (err) {
              console.error("Error creating sync room:", err);
            }
          }

          setGameState({
            grid: result.grid,
            placedWords: result.placedWords,
            foundWords: [],
            category: searchCat,
            difficulty: diff,
            actualSeed: actualSeed,
            isKatakana: !!isKatakana,
            gameMode: 'search',
            targetWord,
            searchTimeLimitSec: 0,
          });
          setIsGenerating(false);
          if (!isMultiplay) setScreen('game');
          resolve(true);
        } catch (err) {
          console.error("Unexpected error in worker onmessage (search mode):", err);
          setIsGenerating(false);
          reject(err);
        }
      };

      workerRef.current!.onerror = (err) => {
        console.error("Worker error (search mode):", err);
        setIsGenerating(false);
        setNotification("パズルの生成中にエラーが発生しました。");
        reject(err);
      };

      workerRef.current!.postMessage({
        category: 'search',
        size: diff,
        dictionary: [targetWord],
        targetWord,
        prohibitedWords: PROHIBITED_WORDS,
        isKanji: false,
        seed: actualSeed,
        isKatakana: !!isKatakana
      });
    });
  }, [isMultiplay, roomId, setNotification, createRoom, showPuzzleSizeHint, language]);

  /** ひと言探し（pickup）— 共有 URL から大人・周囲が同じお題をソロで開く */
  const startPickupSoloGame = useCallback(
    (
      targetWord: string,
      diff: number,
      forcedSeed: number,
      pickupCharsetRaw?: PickupCharset | string | null,
      forcedCols?: number,
      forcedRows?: number,
    ): Promise<boolean> => {
      const word = String(targetWord ?? '').trim();
      if (!word) {
        setNotification('お題を読み込めませんでした。');
        return Promise.resolve(false);
      }
      const charset = normalizePickupCharset(
        pickupCharsetRaw ?? inferPickupCharsetFromWord(word) ?? 'hiragana',
      );
      const cols = forcedCols && forcedCols > 0 ? forcedCols : diff;
      const rows = forcedRows && forcedRows > 0 ? forcedRows : diff;

      setIsGenerating(true);
      const result = generatePickupBoardReliable(cols, rows, word, charset, {
        maxAttempts: 24,
        baseSeed: forcedSeed,
      });

      if (!result) {
        setIsGenerating(false);
        setNotification(language === 'ja' ? 'パズルの生成に失敗しました。' : 'Failed to generate puzzle.');
        return Promise.resolve(false);
      }

      const cat: WordCategory = {
        title: `探しもの：「${word}」`,
        category: 'pickup',
        emoji: '🧺',
        words: [word],
      };

      setGameState({
        grid: result.grid,
        placedWords: result.placedWords,
        foundWords: [],
        category: cat,
        difficulty: diff,
        boardCols: cols,
        boardRows: rows,
        actualSeed: forcedSeed,
        isKatakana: false,
        gameMode: 'search',
        targetWord: word,
        searchTimeLimitSec: 0,
      });
      setIsGenerating(false);
      setScreen('game');
      return Promise.resolve(true);
    },
    [language, setNotification],
  );

  // Room synchronization logic (rooms/{roomId} 系)
  // NOTE: 「みんなであそぶ(hundred_rooms)」中は rooms/board/progress を購読しない（429対策 + 取り違え防止）
  useEffect(() => {
    if (!roomId || !isMultiplay) return;
    if (syncFromHundredRooms) return;

    const roomRef = doc(db, 'rooms', roomId);
    const unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
      const data = snapshot.data();
      if (!data) return;

      setRoomStartTime(data.startTime || null);

      // 10. 部屋の状態管理（status）
      // status changes are handled by the UI or other effects
    });

    // 6. board の購読
    const boardRef = doc(db, `rooms/${roomId}/board/data`);
    const unsubscribeBoard = onSnapshot(boardRef, (snapshot) => {
      const board = snapshot.data();
      if (board && board.grid) {
        // Find category object from ID
        let catObj: WordCategory | undefined;
        if (board.category === 'search') {
          catObj = { title: `「${board.targetWord || ''}」をさがせ！`, category: 'search', emoji: '🔍', words: [board.targetWord || ''] };
        } else if (board.category === 'pickup') {
          catObj = { title: `探しもの：「${board.targetWord || ''}」をさがそう！`, category: 'pickup', emoji: '🧺', words: [board.targetWord || ''] };
        } else {
          catObj = MASTER.categories.find(c => c.category === board.category) || 
                   MASTER.categories.flatMap(c => c.subCategories || []).find(c => c.category === board.category);
        }

        setGameState(prev => ({
          ...prev,
          grid: board.grid,
          placedWords: board.words || [],
          category: catObj || prev.category,
          difficulty: board.difficulty || prev.difficulty,
          isKatakana: board.isKatakana !== undefined ? board.isKatakana : prev.isKatakana,
          actualSeed: board.actualSeed || prev.actualSeed,
          // 盤面が切り替わったら前の foundWords（帯）を持ち越さない
          foundWords: board.actualSeed && board.actualSeed !== prev.actualSeed ? [] : prev.foundWords
        }));
        
        // 同期で盤面を受け取ったら生成中フラグを下ろす
        setIsGenerating(false);
      }
    });

    // 7. progress の購読（色分け B 方式）
    const progressRef = doc(db, `rooms/${roomId}/progress/data`);
    const unsubscribeProgress = onSnapshot(progressRef, (snapshot) => {
      const progress = snapshot.data();
      if (progress && progress.answers) {
        // Map answers to foundWords format
        const allFoundWords: any[] = [];
        Object.entries(progress.answers).forEach(([pid, words]: [string, any]) => {
          words.forEach((w: any) => {
            allFoundWords.push({
              word: w.word,
              start: w.start,
              end: w.end,
              color: w.color,
              playerId: pid
            });
          });
        });
        setGameState(prev => ({
          ...prev,
          foundWords: allFoundWords
        }));
      } else {
        // answers が空/未作成になったときも、前の帯を残さない
        setGameState((prev) => ({ ...prev, foundWords: [] }));
      }
    });

    return () => {
      unsubscribeRoom();
      unsubscribeBoard();
      unsubscribeProgress();
    };
  }, [roomId, isMultiplay, screen, syncFromHundredRooms]);

    // みんなであそぶ: hundred_rooms に保存された grid / words / foundWords を購読 → GameScreen と同一データ
  useEffect(() => {
    if (!roomId || !syncFromHundredRooms) return;
    const ref = doc(db, 'hundred_rooms', roomId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          console.warn('[useGame] hundred_rooms missing', { roomId });
          return;
        }
        const d = snap.data() as Record<string, unknown>;
        const hundredMode =
          typeof d.hundredMode === 'string' ? String(d.hundredMode) : '';
        const hostUidRaw = (d as { hostUid?: unknown }).hostUid;
        setHundredRoomHostUid(typeof hostUidRaw === 'string' && hostUidRaw ? hostUidRaw : null);
        const startedAtRaw = d.startedAt;
        setHundredRoomStartedAt(startedAtRaw ?? null);
        setHundredRoomLastFoundAt(d.lastFoundAt ?? null);
        setHundredRoomUpdatedAt(d.updatedAt ?? null);
        if (startedAtRaw == null) {
          if (hundredRoomStartedAtMsRef.current != null) {
            hundredRoomStartedAtMsRef.current = null;
            resetHundredRoundSyncState();
          }
        } else {
          const nextStartedMs = firestoreLikeToMillis(startedAtRaw);
          const prevStartedMs = hundredRoomStartedAtMsRef.current;
          if (nextStartedMs != null && prevStartedMs != null && nextStartedMs !== prevStartedMs) {
            resetHundredRoundSyncState();
            hundredRoomStartedAtMsRef.current = nextStartedMs;
            if (isRoboPickupLoungeRoomId(roomId)) {
              void clearHundredRoomPlayersForNewRound(roomId).catch((e) => {
                console.warn('[useGame] clear robo lounge players after new round', e);
              });
            } else {
              // ひと言探し共同: 在室者はそのまま。playerCount だけ players 実数に揃える
              void reconcileHundredRoomPlayerCount(roomId).catch((e) => {
                console.warn('[useGame] reconcile hundred players after new round', e);
              });
            }
          } else if (nextStartedMs != null) {
            hundredRoomStartedAtMsRef.current = nextStartedMs;
          }
        }

        // ペア探し共同は tileMatch フィールド＋ TileMatchGame。grid 待ちにしない
        if (hundredMode === TILE_MATCH_HUNDRED_MODE) {
          setIsGenerating(false);
          return;
        }

        if (isRoboPickupLoungeRoomId(roomId) && roboLoungeBoardSizeMismatch(d)) {
          setIsGenerating(true);
          if (!roboBoardResizeBusyRef.current) {
            roboBoardResizeBusyRef.current = true;
            void refreshRoboPickupLoungeBoardSizeIfNeeded(roomId)
              .catch((e) => console.warn('[useGame] robo lounge board resize', e))
              .finally(() => {
                roboBoardResizeBusyRef.current = false;
              });
          }
          return;
        }

        const grid = gridRowsFromFirestore(d);
        if (!grid || !Array.isArray(grid) || grid.length === 0) {
          const roomStatus = typeof d.status === 'string' ? d.status : '';
          const stillCreating = d.problemsGenerating === true;
          // ホストが今まさに盤面生成中のときだけ待ちスピナー
          if (stillCreating) {
            setGameState((prev) =>
              prev.grid?.length ? prev : { ...prev, grid: [], placedWords: [], foundWords: [] },
            );
            setIsGenerating(true);
            return;
          }
          // 一問クリア後のお題間（recruiting・盤面なし）は「作成中」ではない。
          // ローカル盤面はクリア画面用に残し、待ちスピナーで結果を塞がない。
          if (roomStatus === 'recruiting') {
            resetHundredRoundSyncState();
            setIsGenerating(false);
            return;
          }
          if (hundredRoomCanEnterGame(d, roomId)) {
            setIsGenerating(true);
            return;
          }
          setIsGenerating(false);
          setNotification(
            language === 'ja'
              ? '盤面データがありません。ホストが「はじめる」を押すまでお待ちください。'
              : 'Board data is missing. Please wait for the host to start.',
          );
          return;
        }
        const targetWord = String(d.targetWord ?? '').trim();
        if (isRoboPickupLoungeRoomId(roomId) && shouldDeferRoboLoungeRoomSync(targetWord)) {
          setIsGenerating(false);
          return;
        }
        const boardSize = typeof d.boardSize === 'number' ? d.boardSize : Number(d.boardSize) || 10;
        const boardCols = resolveBoardCols({ boardCols: d.boardCols as number | undefined, boardSize, grid });
        const boardRows = resolveBoardRows({ boardRows: d.boardRows as number | undefined, boardSize, grid });
        const words = Array.isArray(d.words) ? d.words : [];
        // みんなであそぶはプレイに時間制限を設けない（終了はクリア／ルーム終了のみ）。タイマー用は常に 0。
        const searchTimeLimitSec = 0;
        const hintsEnabled = d.hintsEnabled !== false;
        const patch: Partial<GameState> = {
          grid,
          placedWords: words as GameState['placedWords'],
          targetWord,
          searchTimeLimitSec,
          hintsEnabled,
          category: {
            title:
              hundredMode === 'pickup'
                ? `探しもの：「${targetWord}」をさがそう！`
                : `「${targetWord}」をさがせ！`,
            category: hundredMode === 'pickup' ? 'pickup' : 'search',
            emoji: hundredMode === 'pickup' ? '🧺' : '🔍',
            words: [targetWord],
          },
          difficulty: boardCols,
          boardCols,
          boardRows,
          gameMode: 'search',
          isKatakana: false,
        };

        const uniqueByOccurrence = (list: FoundWord[]) => {
          const out: FoundWord[] = [];
          const seen = new Set<string>();
          for (const fw of Array.isArray(list) ? list : []) {
            const s = fw?.start;
            const e = fw?.end;
            if (!s || !e) continue;
            const k = canonicalOccurrenceKey(
              { x: Number(s.x), y: Number(s.y) },
              { x: Number(e.x), y: Number(e.y) },
            );
            if (!k || seen.has(k)) continue;
            seen.add(k);
            out.push(fw);
          }
          return out;
        };

        const clampFoundWordsForRoom = (foundWordsRaw: unknown, total: number): FoundWord[] => {
          const remoteFound = uniqueByOccurrence(normalizeHundredFoundList(foundWordsRaw));
          return total > 0 && remoteFound.length > total ? remoteFound.slice(0, total) : remoteFound;
        };

        const applyHundredRoomSnapshot = (
          snapshotPatch: Partial<GameState>,
          foundWordsRaw: unknown,
          total: number,
          boardKey: string,
        ) => {
          const clamped = clampFoundWordsForRoom(foundWordsRaw, total);
          setGameState((prev) => ({
            ...prev,
            ...snapshotPatch,
            foundWords: clamped,
          }));
          hundredRoomBoardKeyRef.current = boardKey;
        };

        const startedMs = firestoreLikeToMillis(startedAtRaw) ?? 0;
        const boardKey = `${startedMs}|${targetWord}|${boardCols}|${boardRows}|${words.length}|${grid.length}|${hundredBoardKeySignature(grid)}`;
        const totalOccurrences = countPlacedWordOccurrences(words);
        const pendingApply = {
          patch,
          foundWordsRaw: d.foundWords,
          totalOccurrences,
          boardKey,
        };

        // 盤面が同じときは foundWords だけ即反映（「ドバッと一括」になりにくくする）
        const isFoundWordsOnly =
          hundredRoomBoardKeyRef.current !== '' && boardKey === hundredRoomBoardKeyRef.current;
        if (isFoundWordsOnly) {
          const clamped = clampFoundWordsForRoom(d.foundWords, totalOccurrences);
          // Firestore 反映待ちの自分の正解も残す（他端末の帯と揃える）
          setGameState((prev) => ({
            ...prev,
            foundWords: mergeFoundWords(clamped, prev.foundWords),
            hintsEnabled,
          }));
          if (hundredRoomPendingApplyRef.current) {
            hundredRoomPendingApplyRef.current = {
              ...hundredRoomPendingApplyRef.current,
              foundWordsRaw: d.foundWords,
              totalOccurrences,
              patch: { ...hundredRoomPendingApplyRef.current.patch, hintsEnabled },
            };
          }
          setIsGenerating(false);
          return;
        }

        // Heavy rooms can emit frequent updates (foundWords / status).
        // Coalesce updates so low-memory devices don't thrash React renders.
        const applyNow = () => {
          hundredRoomPendingApplyRef.current = null;
          if (hundredRoomApplyTimerRef.current != null) {
            window.clearTimeout(hundredRoomApplyTimerRef.current);
            hundredRoomApplyTimerRef.current = null;
          }
          hundredRoomLastAppliedAtMsRef.current = Date.now();
          applyHundredRoomSnapshot(patch, d.foundWords, totalOccurrences, boardKey);
        };

        const nowMs = Date.now();
        const minIntervalMs = 300; // keep play responsive, but cap render thrash
        if (nowMs - hundredRoomLastAppliedAtMsRef.current >= minIntervalMs) {
          applyNow();
          setIsGenerating(false);
          return;
        }

        // タイマー発火時は常に「直近スナップショット」一式を適用（古い foundWords 混在を防ぐ）
        hundredRoomPendingApplyRef.current = pendingApply;
        if (!hundredRoomApplyTimerRef.current) {
          const delay = Math.max(0, minIntervalMs - (nowMs - hundredRoomLastAppliedAtMsRef.current));
          hundredRoomApplyTimerRef.current = window.setTimeout(() => {
            const p = hundredRoomPendingApplyRef.current;
            hundredRoomPendingApplyRef.current = null;
            hundredRoomApplyTimerRef.current = null;
            hundredRoomLastAppliedAtMsRef.current = Date.now();
            if (p) {
              applyHundredRoomSnapshot(p.patch, p.foundWordsRaw, p.totalOccurrences, p.boardKey);
            }
            setIsGenerating(false);
          }, delay);
        }
        setIsGenerating(false);
      },
      (err) => {
        tripFirestoreCircuit(db as any, err);
        console.error('[useGame] hundred_rooms subscribe error', { roomId, err });
      }
    );
    return () => {
      unsub();
      if (hundredRoomApplyTimerRef.current) {
        window.clearTimeout(hundredRoomApplyTimerRef.current);
        hundredRoomApplyTimerRef.current = null;
      }
      hundredRoomPendingApplyRef.current = null;
      hundredRoomBoardKeyRef.current = '';
    };
  }, [roomId, syncFromHundredRooms, resetHundredRoundSyncState]);

  useEffect(() => {
    if (!roomId || !syncFromHundredRooms) {
      setHundredRoster([]);
      setHundredRoomHostUid(null);
      setHundredRoomStartedAt(null);
      setHundredRoomLastFoundAt(null);
      setHundredRoomUpdatedAt(null);
      hundredRoomStartedAtMsRef.current = null;
      return;
    }
    const col = collection(db, 'hundred_rooms', roomId, 'players');
    // Keep the subscription lightweight at scale: we only need a slice for UI/auto-compact.
    const q = query(col, orderBy('foundCount', 'desc'), limit(40));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((docSnap) => {
          const x = docSnap.data() as Record<string, unknown>;
          return {
            uid: docSnap.id,
            name: typeof x.name === 'string' && x.name.trim() ? x.name : 'ななし',
            emoji: typeof x.emoji === 'string' ? x.emoji : '🌸',
            foundCount: typeof x.foundCount === 'number' ? x.foundCount : 0,
            lastActiveAt: x.lastActiveAt,
            joinedAt: x.joinedAt,
          };
        });
        list.sort((a, b) => b.foundCount - a.foundCount || a.name.localeCompare(b.name, 'ja'));
        setHundredRoster(list);
      },
      (err) => {
        tripFirestoreCircuit(db as any, err);
      }
    );
    return () => unsub();
  }, [roomId, syncFromHundredRooms]);

  const touchHundredPlayerPresence = useCallback(() => {
    const uid = firebaseUser?.uid || auth.currentUser?.uid;
    if (!uid || !roomId || !syncFromHundredRooms) return;
    const name = (nickname || '').trim() || 'ななし';
    const emoji = (userEmoji || '').trim() || '🌸';
    void setDoc(
      doc(db, 'hundred_rooms', roomId, 'players', uid),
      { uid, name, emoji, lastActiveAt: serverTimestamp() },
      { merge: true },
    ).catch(() => {});
  }, [roomId, syncFromHundredRooms, nickname, userEmoji, firebaseUser?.uid]);

  // プレイ中も席の絵文字・ニックを players/{uid} に同期（現場の表示と揃える）
  useEffect(() => {
    touchHundredPlayerPresence();
  }, [touchHundredPlayerPresence]);

  // 盤面の在室表示用 — 操作中も lastActiveAt を更新
  useEffect(() => {
    if (!roomId || !syncFromHundredRooms) return;
    const id = window.setInterval(() => touchHundredPlayerPresence(), HUNDRED_PLAYER_HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [roomId, syncFromHundredRooms, touchHundredPlayerPresence]);

  useEffect(() => {
    if (!roomId || !syncFromHundredRooms) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') touchHundredPlayerPresence();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [roomId, syncFromHundredRooms, touchHundredPlayerPresence]);

  useEffect(() => {
    if (!roomId || syncFromHundredRooms) return;
    const unsub = subscribeRoom(roomId, (data) => {
      if (!data) {
        console.warn('[useGame] syncRooms update is null', { roomId });
        return;
      }
      if (!(data as any).board) {
        console.warn('[useGame] syncRooms has no board field', { roomId, keys: Object.keys(data as any) });
        return;
      }
      // syncRooms: board (grid) + optional wordSearch meta
      setGameState((prev) => {
        const next: any = { ...prev, grid: (data as any).board as any };
        const ws: any = (data as any)?.wordSearch;
        if (ws && typeof ws === 'object') {
          const targetWord = typeof ws.targetWord === 'string' ? ws.targetWord : '';
          const diff = typeof ws.difficulty === 'number' ? ws.difficulty : prev.difficulty;
          const placedWords = Array.isArray(ws.placedWords) ? ws.placedWords : prev.placedWords;
          const foundWords = Array.isArray(ws.foundWords) ? ws.foundWords : prev.foundWords;
          next.category = { title: `「${targetWord}」をさがせ！`, category: 'search', emoji: '🔍', words: [targetWord] };
          next.difficulty = diff;
          next.placedWords = placedWords;
          next.foundWords = foundWords;
          next.gameMode = 'search';
        }
        return next;
      });
      setIsGenerating(false);
    });
    return () => unsub();
  }, [roomId, syncFromHundredRooms, subscribeRoom]);

  // Narration logic removed as it depends on room state now managed by useMultiplayer

  const handleRecordFinish = useCallback(async () => {
    if (isMultiplay && roomId) {
      const currentUid = firebaseUser?.uid || auth.currentUser?.uid;
      if (currentUid) {
        const playerRef = doc(db, 'rooms', roomId, 'players', currentUid);
        const finishTime = Math.floor((Date.now() - (roomStartTime || Date.now())) / 1000);
        try {
          await setDoc(playerRef, {
            isFinished: true,
            finishTime: finishTime,
            lastActive: serverTimestamp()
          }, { merge: true });
        } catch (error) {
          console.error('Error recording finish time:', error);
        }
      }
    }
  }, [isMultiplay, roomId, firebaseUser, roomStartTime]);

  const onRakudaRoboReplay = useCallback(async (): Promise<boolean> => {
    if (!roomId || !syncFromHundredRooms) return false;
    const uid = firebaseUser?.uid || auth.currentUser?.uid;
    if (!uid || uid !== hundredRoomHostUid) {
      setNotification('ホストだけがもう一回を開始できます');
      return false;
    }

    const cols = resolveBoardCols(gameState);
    const rows = resolveBoardRows(gameState);
    const previousTargetWord =
      (gameState.targetWord || gameState.category?.words?.[0] || '').trim();
    if (!previousTargetWord) {
      setNotification('探すことばが見つかりませんでした');
      return false;
    }

    setIsGenerating(true);
    try {
      const result = await replayHundredPickupWithRoboWord({
        roomId,
        cols,
        rows,
        previousTargetWord,
      });
      if (result.ok) {
        try {
          const snap = await getDoc(doc(db, 'hundred_rooms', roomId));
          if (snap.exists()) {
            const d = snap.data() as Record<string, unknown>;
            const grid = gridRowsFromFirestore(d);
            const words = Array.isArray(d.words) ? d.words : [];
            if (grid?.length) {
              setGameState((prev) => ({
                ...prev,
                grid,
                placedWords: words as GameState['placedWords'],
                foundWords: [],
                targetWord: result.targetWord,
              }));
            }
          }
        } catch {
          /* snapshot が追いつく */
        }
        setNotification(`探すことば（${RAKUDA_ROBO_NAME}）: ${result.targetWord}`);
        return true;
      }
      setNotification(result.message);
      return false;
    } catch (e) {
      console.error('[useGame] onRakudaRoboReplay', e);
      setNotification('もう一回の準備に失敗しました');
      return false;
    } finally {
      setIsGenerating(false);
    }
  }, [
    roomId,
    syncFromHundredRooms,
    firebaseUser,
    hundredRoomHostUid,
    gameState,
    setNotification,
  ]);

  const onRoboPickupLoungeAutoRefresh = useCallback(async (): Promise<void> => {
    if (!roomId || !isRoboPickupLoungeRoomId(roomId)) return;
    try {
      await refreshRoboPickupLoungeAuto(roomId);
    } catch (e) {
      console.warn('[useGame] onRoboPickupLoungeAutoRefresh', e);
    }
  }, [roomId]);

  const onRoboPickupLoungeNext = useCallback(async (): Promise<boolean> => {
    if (!roomId || !syncFromHundredRooms || !isRoboPickupLoungeRoomId(roomId)) return false;
    setIsGenerating(true);
    try {
      const result = await refreshRoboPickupLoungeManual(roomId);
      if (result.ok) {
        setNotification(`次のお題: ${result.targetWord}`);
        return true;
      }
      setNotification(result.message);
      return false;
    } catch (e) {
      console.error('[useGame] onRoboPickupLoungeNext', e);
      setNotification('次のお題の準備に失敗しました');
      return false;
    } finally {
      setIsGenerating(false);
    }
  }, [roomId, syncFromHundredRooms, setNotification]);

  const onHundredRoomFinished = useCallback(
    async (reason: 'timeout' | 'cleared') => {
      if (!roomId || !syncFromHundredRooms) return;
      if (isRoboPickupLoungeRoomId(roomId)) return;
      try {
        if (hundredFoundWriteTimerRef.current != null) {
          window.clearTimeout(hundredFoundWriteTimerRef.current);
          hundredFoundWriteTimerRef.current = null;
        }
        await flushHundredFoundWrites();

        const roomSnap = await getDoc(doc(db, 'hundred_rooms', roomId));
        const roomData = roomSnap.exists()
          ? (roomSnap.data() as {
              publicRecruitId?: unknown;
              recruitDeadlineAt?: unknown;
              startedAt?: unknown;
            })
          : null;
        const finishedRoundStartedAtMs = firestoreLikeToMillis(roomData?.startedAt);
        const isOpenRecruit = isHundredOpenRecruitDeadline(roomData?.recruitDeadlineAt);

        try {
          await archiveHundredSessionToProblemHistory(roomId, reason);
        } catch (e) {
          console.warn('[useGame] archive hundred problem history failed', e);
        }

        const freshSnap = await getDoc(doc(db, 'hundred_rooms', roomId));
        const freshRoom = freshSnap.exists()
          ? (freshSnap.data() as Parameters<typeof hasHundredAdvancedPastFinishRound>[1])
          : undefined;
        if (hasHundredAdvancedPastFinishRound(finishedRoundStartedAtMs, freshRoom)) {
          return;
        }

        if (isOpenRecruit) {
          // 締切なし募集: お題終了後は掲示を外す（ホストが次を始めるまで一覧に出さない）。
          // 次のお題開始時に HundredWaitPanel が syncHundredPublicForNewRound で再作成する。
          setIsGenerating(false);
          await setDoc(
            doc(db, 'hundred_rooms', roomId),
            {
              status: 'recruiting',
              endReason: reason,
              endedAt: serverTimestamp(),
              foundWords: [],
              gridRows: deleteField(),
              words: deleteField(),
              startedAt: deleteField(),
              problemsGenerating: false,
            },
            { merge: true },
          );
          try {
            const publicRecruitId =
              typeof roomData?.publicRecruitId === 'string' ? roomData.publicRecruitId.trim() : '';
            await deleteHundredPublicForFinishedRoom(roomId, publicRecruitId || undefined);
          } catch (e) {
            console.warn('[useGame] close hundred_public between rounds failed', e);
          }
          return;
        }

        await setDoc(
          doc(db, 'hundred_rooms', roomId),
          {
            status: 'finished',
            endReason: reason,
            endedAt: serverTimestamp(),
          },
          { merge: true },
        );

        try {
          const publicRecruitId =
            typeof roomData?.publicRecruitId === 'string' ? roomData.publicRecruitId.trim() : '';
          await deleteHundredPublicForFinishedRoom(roomId, publicRecruitId || undefined);
        } catch (e) {
          console.warn('[useGame] close hundred_public on finish failed', e);
        }
      } catch (e) {
        console.error('[useGame] onHundredRoomFinished', e);
      }
    },
    [roomId, syncFromHundredRooms, firebaseUser, setIsGenerating, flushHundredFoundWrites],
  );

  const onUpdateFound = useCallback(async (
    word: string,
    start: Point,
    end: Point,
    isHint?: boolean,
    options?: { robo?: boolean },
  ) => {
    const isRobo = options?.robo === true;
    /**
     * Solo play must work even when the user isn't logged in.
     * Multiplayer / hundred coop still rely on Firebase Auth uid for writing progress to Firestore.
     */
    const firebaseUid = firebaseUser?.uid || auth.currentUser?.uid;
    const requiresFirebaseUid = !!(
      (isMultiplay && roomId) ||
      (!isMultiplay && isSyncMode && roomId && syncFromHundredRooms)
    );
    // Always allow local counting even if Firebase Auth uid is missing temporarily.
    // (Hundred coop sync writes will be skipped until firebaseUid is available.)
    const localUid = firebaseUid || user.user_id;
    if (!localUid && !isRobo) return;
    const currentUid = isRobo ? RAKUDA_ROBO_PLAYER_ID : (requiresFirebaseUid ? localUid : localUid);

    // 正解の帯（リボン）色: 10 色パレットからランダム（見つけた瞬間に決めて Firestore に保存）
    const hundredKey = hundredOccurrenceKey(word, start, end);
    let assignedColor = pickRandomBandColor();
    if (!isMultiplay && isSyncMode && roomId && syncFromHundredRooms) {
      const cached = recentHundredFoundColorsRef.current.get(hundredKey);
      if (cached) assignedColor = cached;
      else recentHundredFoundColorsRef.current.set(hundredKey, assignedColor);
    }
    const displayName = isRobo ? RAKUDA_ROBO_NAME : ((nickname || '').trim() || 'ななし');

    setGameState(prev => {
      if (prev.foundWords.some(fw => 
        fw.word === word && 
        fw.start && fw.start.x === start.x && fw.start.y === start.y && 
        fw.end && fw.end.x === end.x && fw.end.y === end.y
      )) return prev;
      return {
        ...prev,
        foundWords: [
          ...prev.foundWords,
          {
            word,
            start,
            end,
            isHint,
            color: assignedColor,
            playerId: currentUid,
            userName: displayName,
            userEmoji: isRobo ? RAKUDA_ROBO_EMOJI : (userEmoji || '🌸'),
          },
        ],
      };
    });

    if (isMultiplay && roomId) {
      if (!firebaseUid) return;
      try {
        const progressRef = doc(db, `rooms/${roomId}/progress/data`);

        // 9. 進捗更新（色つき回答）
        await setDoc(progressRef, {
          [`answers.${firebaseUid}`]: arrayUnion({
            word: word,
            start: start,
            end: end,
            color: assignedColor
          })
        }, { merge: true });
      } catch (error) {
        console.error('Error adding found word:', error);
      }
    }
    // みんなであそぶ: 盤面用は短縮フィールド + 正解数は players/{uid}.foundCount のみ増分（負荷軽減）
    if (!isMultiplay && isSyncMode && roomId && syncFromHundredRooms) {
      if (!firebaseUid && !isRobo) return;
      try {
        // De-dupe "same occurrence" bursts at the sender too.
        // This avoids duplicate arrayUnion entries even if caller fires twice before Firestore sync catches up.
        const k = hundredKey;
        if (recentHundredFoundKeysRef.current.has(k)) return;
        recentHundredFoundKeysRef.current.add(k);
        window.setTimeout(() => {
          try {
            recentHundredFoundKeysRef.current.delete(k);
            recentHundredFoundColorsRef.current.delete(k);
          } catch {
            /* ignore */
          }
        }, 8000);

        const shortName = displayName.slice(0, 32);
        const shortEmoji = (isRobo ? RAKUDA_ROBO_EMOJI : userEmoji || '🌸').slice(0, 8);
        const writerUid = firebaseUid || auth.currentUser?.uid;
        if (!writerUid) return;
        scheduleHundredFoundWrite({
          word,
          start,
          end,
          color: assignedColor,
          currentUid,
          shortName,
          shortEmoji,
          writerUid,
          isRobo,
        });
      } catch (error) {
        console.error('Error syncing found word (hundred_rooms):', error);
      }
    } else if (!isMultiplay && isSyncMode && roomId && !syncFromHundredRooms) {
      try {
        const syncRef = doc(db, 'syncRooms', roomId);
        await setDoc(
          syncRef,
          {
            wordSearch: {
              foundWords: arrayUnion({ word, start, end, isHint: !!isHint, color: assignedColor, playerId: currentUid }),
              updatedAt: serverTimestamp(),
            },
          },
          { merge: true }
        );
      } catch (error) {
        console.error('Error syncing found word (syncRooms):', error);
      }
    }
  }, [isMultiplay, isSyncMode, roomId, syncFromHundredRooms, firebaseUser, nickname, userEmoji, user.user_id, scheduleHundredFoundWrite]);

  return {
    screen, setScreen,
    difficulty, setDifficulty,
    isMultiplay, setIsMultiplay,
    isSyncMode, setIsSyncMode,
    isReady, setIsReady,
    narration,
    seed, setSeed,
    isGenerating,
    setIsGenerating,
    roomId, setRoomId,
    syncShareRoomId,
    pendingRoomId, setPendingRoomId,
    roomStartTime, setRoomStartTime,
    gameState, setGameState,
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
  };
};
