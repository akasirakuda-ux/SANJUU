
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  WordCategory, ScreenType, GameState, UserAccount, Point
} from '../types';
import { 
  PROHIBITED_WORDS, MASTER, convertToHiragana, convertToKatakana
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
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { WORKER_CODE } from '../lib/puzzleWorker';
import { gridRowsFromFirestore } from '../lib/hundredRoomBoard';
import { normalizeHundredFoundList } from '../lib/hundredFoundNormalize';
import { geminiService } from '../services/geminiService';
import { stringToSeed } from '../lib/utils';
import { useSyncRoom } from './useSyncRoom';

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
  const [screen, setScreen] = useState<ScreenType>('entrance');
  const [difficulty, setDifficulty] = useState(3);
  const [isMultiplay, setIsMultiplay] = useState(false);
  const [isSyncMode, setIsSyncMode] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [narration, setNarration] = useState<string>('');
  const [seed, setSeed] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const generatingSinceMsRef = useRef<number | null>(null);

  // Safety: if "generating" gets stuck (iPad/Safari/worker issues), auto-recover.
  useEffect(() => {
    if (!isGenerating) {
      generatingSinceMsRef.current = null;
      return;
    }
    const started = Date.now();
    generatingSinceMsRef.current = started;
    const tid = window.setTimeout(() => {
      // Only cancel if it's still the same generating session.
      if (generatingSinceMsRef.current !== started) return;
      setIsGenerating(false);
      setNotification(language === 'ja' ? '生成が長いのでいったん復帰しました（もう一度お試しください）' : 'Generation took too long. Please try again.');
    }, 25_000);
    return () => window.clearTimeout(tid);
  }, [isGenerating, language, setNotification]);
  const [roomId, setRoomId] = useState<string | null>(null);
  /** みんなであそぶ: 盤面・進捗は hundred_rooms/{roomId} を購読（syncRooms ではない） */
  const [syncFromHundredRooms, setSyncFromHundredRooms] = useState(false);
  /** みんなであそぶ: players サブコレのランキング用（離脱後もドキュメントが残れば表示可能） */
  const [hundredRoster, setHundredRoster] = useState<
    { uid: string; name: string; emoji: string; foundCount: number }[]
  >([]);
  const hundredRoomApplyTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const hundredRoomLastAppliedAtMsRef = useRef(0);
  const hundredRoomPendingPatchRef = useRef<Partial<GameState> | null>(null);
  /** hundred_rooms の hostUid（ゲーム画面でホスト離脱時の確認に使用） */
  const [hundredRoomHostUid, setHundredRoomHostUid] = useState<string | null>(null);
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
      const diff = forcedDiff || difficulty;
      const actualSeed = forcedSeed !== undefined ? forcedSeed : Math.floor(Math.random() * 1000000);
      
      setIsGenerating(true);
      
      const dictionary = cat.words;
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

          // 4. rooms/{roomId}/board に盤面データを保存
          if (isMultiplay && roomId && !isFromSync) {
            try {
              const boardRef = doc(db, `rooms/${roomId}/board/data`);
              await setDoc(boardRef, {
                grid: result.grid,
                words: result.placedWords,
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
            placedWords: result.placedWords,
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
        prohibitedWords: PROHIBITED_WORDS,
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

  // Room synchronization logic
  useEffect(() => {
    if (!roomId || !isMultiplay) return;

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
  }, [roomId, isMultiplay, screen]);

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
        const grid = gridRowsFromFirestore(d);
        if (!grid || !Array.isArray(grid) || grid.length === 0) return;
        const targetWord = String(d.targetWord ?? '').trim();
        const boardSize = typeof d.boardSize === 'number' ? d.boardSize : Number(d.boardSize) || 10;
        const words = Array.isArray(d.words) ? d.words : [];
        const hundredMode = typeof (d as any).hundredMode === 'string' ? String((d as any).hundredMode) : '';
        // みんなであそぶはプレイに時間制限を設けない（終了はクリア／ルーム終了のみ）。タイマー用は常に 0。
        const searchTimeLimitSec = 0;
        const hostUidRaw = (d as { hostUid?: unknown }).hostUid;
        setHundredRoomHostUid(typeof hostUidRaw === 'string' && hostUidRaw ? hostUidRaw : null);
        const patch: Partial<GameState> = {
          grid,
          placedWords: words as GameState['placedWords'],
          targetWord,
          searchTimeLimitSec,
          category: {
            title:
              hundredMode === 'pickup'
                ? `探しもの：「${targetWord}」をさがそう！`
                : `「${targetWord}」をさがせ！`,
            category: hundredMode === 'pickup' ? 'pickup' : 'search',
            emoji: hundredMode === 'pickup' ? '🧺' : '🔍',
            words: [targetWord],
          },
          difficulty: boardSize,
          gameMode: 'search',
          isKatakana: false,
        };

        // Heavy rooms can emit frequent updates (foundWords / status).
        // Coalesce updates so low-memory devices don't thrash React renders.
        const applyNow = () => {
          hundredRoomPendingPatchRef.current = null;
          hundredRoomApplyTimerRef.current = null;
          hundredRoomLastAppliedAtMsRef.current = Date.now();
          const remoteFound = normalizeHundredFoundList(d.foundWords);
          // hundred_rooms は foundWords を room 全体で管理するため、クライアント側の前状態とマージしない。
          // （前のゲームの foundWords が残ると、入室直後に「既にクリア」扱いになる事故を防ぐ）
          setGameState((prev) => ({ ...prev, ...patch, foundWords: remoteFound as any }));
        };

        const nowMs = Date.now();
        const minIntervalMs = 300; // keep play responsive, but cap render thrash
        if (nowMs - hundredRoomLastAppliedAtMsRef.current >= minIntervalMs) {
          applyNow();
          setIsGenerating(false);
          return;
        }

        hundredRoomPendingPatchRef.current = patch;
        if (!hundredRoomApplyTimerRef.current) {
          const delay = Math.max(0, minIntervalMs - (nowMs - hundredRoomLastAppliedAtMsRef.current));
          hundredRoomApplyTimerRef.current = window.setTimeout(() => {
            const p = hundredRoomPendingPatchRef.current;
            hundredRoomPendingPatchRef.current = null;
            hundredRoomApplyTimerRef.current = null;
            hundredRoomLastAppliedAtMsRef.current = Date.now();
            if (p) {
              const remoteFound = normalizeHundredFoundList(d.foundWords);
              setGameState((prev) => ({ ...prev, ...p, foundWords: remoteFound as any }));
            }
            setIsGenerating(false);
          }, delay);
        }
        setIsGenerating(false);
      },
      (err) => console.error('[useGame] hundred_rooms subscribe error', { roomId, err })
    );
    return () => {
      unsub();
      if (hundredRoomApplyTimerRef.current) {
        window.clearTimeout(hundredRoomApplyTimerRef.current);
        hundredRoomApplyTimerRef.current = null;
      }
      hundredRoomPendingPatchRef.current = null;
    };
  }, [roomId, syncFromHundredRooms]);

  useEffect(() => {
    if (!roomId || !syncFromHundredRooms) {
      setHundredRoster([]);
      setHundredRoomHostUid(null);
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
          };
        });
        list.sort((a, b) => b.foundCount - a.foundCount || a.name.localeCompare(b.name, 'ja'));
        setHundredRoster(list);
      },
      () => {}
    );
    return () => unsub();
  }, [roomId, syncFromHundredRooms]);

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

  const onHundredRoomFinished = useCallback(
    async (reason: 'timeout' | 'cleared') => {
      if (!roomId || !syncFromHundredRooms) return;
      try {
        await setDoc(
          doc(db, 'hundred_rooms', roomId),
          {
            status: 'finished',
            endReason: reason,
            endedAt: serverTimestamp(),
          },
          { merge: true }
        );

        // Close the public recruitment entry so the board doesn't keep showing "募集中" after finish.
        // Only the host should do this cleanup.
        try {
          const uid = firebaseUser?.uid || auth.currentUser?.uid;
          if (!uid) return;
          const snap = await getDoc(doc(db, 'hundred_rooms', roomId));
          const d = snap.exists() ? (snap.data() as any) : null;
          const hostUid = typeof d?.hostUid === 'string' ? d.hostUid : '';
          if (!hostUid || hostUid !== uid) return;
          const publicRecruitId = typeof d?.publicRecruitId === 'string' ? d.publicRecruitId : '';
          if (!publicRecruitId) return;
          await deleteDoc(doc(db, 'hundred_public', publicRecruitId)).catch(() => {});
        } catch (e) {
          console.warn('[useGame] close hundred_public on finish failed', e);
        }
      } catch (e) {
        console.error('[useGame] onHundredRoomFinished', e);
      }
    },
    [roomId, syncFromHundredRooms, firebaseUser]
  );

  const onUpdateFound = useCallback(async (word: string, start: Point, end: Point, isHint?: boolean) => {
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
    if (!localUid) return;
    const currentUid = requiresFirebaseUid ? localUid : localUid;

    // 正解の帯（リボン）色: 10色から毎回ランダム（プレイヤー固定ではない）
    const ribbonColors = [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#FFA502',
      '#7BED9F',
      '#70A1FF',
      '#FF7F50',
      '#A29BFE',
      '#E84393',
      '#2ED573',
    ];
    const assignedColor = ribbonColors[Math.floor(Math.random() * ribbonColors.length)];
    const displayName = (nickname || '').trim() || 'ななし';

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
      if (!firebaseUid) return;
      try {
        const shortName = displayName.slice(0, 32);
        await setDoc(
          doc(db, 'hundred_rooms', roomId),
          {
            foundWords: arrayUnion({
              w: word,
              s: start,
              e: end,
              c: assignedColor,
              p: firebaseUid,
              n: shortName,
            }),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        await setDoc(
          doc(db, 'hundred_rooms', roomId, 'players', firebaseUid),
          {
            uid: firebaseUid,
            foundCount: increment(1),
            name: shortName,
            emoji: userEmoji || '🌸',
            lastActiveAt: serverTimestamp(),
          },
          { merge: true }
        );
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
  }, [isMultiplay, isSyncMode, roomId, syncFromHundredRooms, firebaseUser, nickname, userEmoji, user.user_id]);

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
    handleRecordFinish,
    onUpdateFound,
    setSyncFromHundredRooms,
    syncFromHundredRooms,
    hundredRoster,
    hundredRoomHostUid,
    onHundredRoomFinished,
  };
};
