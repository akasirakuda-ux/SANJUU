import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { PROHIBITED_WORDS } from '../constants';
import { auth, db } from '../firebase';
import { pickAutoTargetWordForBoard } from './hundredAutoTargetWord';
import {
  countPlacedWordOccurrences,
  hundredPickupMinOccurrences,
} from './hundredPickupOccurrences';
import { firestoreSafeJson, gridToFirestoreRows } from './hundredRoomBoard';
import { WORKER_CODE } from './puzzleWorker';

const RK_LAST_AUTO_WORD_KEY = 'rk_hundred_last_auto_word';
const TARGET_COVERAGE = 0.85;
const MAX_ATTEMPTS = 24;

function readLastAutoWord(): string {
  try {
    return localStorage.getItem(RK_LAST_AUTO_WORD_KEY) || '';
  } catch {
    return '';
  }
}

function writeLastAutoWord(word: string): void {
  try {
    localStorage.setItem(RK_LAST_AUTO_WORD_KEY, word);
  } catch {
    /* ignore */
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: number | undefined;
  const timeout = new Promise<T>((_, reject) => {
    t = window.setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (t != null) window.clearTimeout(t);
  }
}

function runPickupWorkerOnce(
  cols: number,
  rows: number,
  targetWord: string,
  seed: number,
): Promise<{ grid: string[][]; placedWords: unknown[]; density?: number }> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    const cleanup = () => {
      try {
        worker.terminate();
      } catch {
        /* ignore */
      }
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('worker-timeout'));
    }, 12_000);

    worker.onmessage = (e) => {
      window.clearTimeout(timer);
      const result = e.data as {
        grid?: string[][];
        placedWords?: unknown[];
        density?: number;
      };
      const grid = result?.grid;
      if (!Array.isArray(grid) || grid.length === 0) {
        cleanup();
        reject(new Error('empty-grid'));
        return;
      }
      resolve({
        grid,
        placedWords: Array.isArray(result.placedWords) ? result.placedWords : [],
        density: typeof result.density === 'number' ? result.density : undefined,
      });
      cleanup();
    };
    worker.onerror = (err) => {
      window.clearTimeout(timer);
      cleanup();
      reject(err);
    };

    worker.postMessage({
      category: 'pickup',
      size: cols,
      cols,
      rows,
      dictionary: [targetWord],
      targetWord,
      prohibitedWords: PROHIBITED_WORDS,
      isKanji: false,
      seed,
      isKatakana: false,
    });
  });
}

function isValidPlacedWords(placedWords: unknown[]): boolean {
  if (!Array.isArray(placedWords) || placedWords.length === 0) return false;
  return placedWords.some(
    (pw) =>
      pw &&
      typeof pw === 'object' &&
      typeof (pw as { word?: unknown }).word === 'string' &&
      Array.isArray((pw as { occurrences?: unknown }).occurrences) &&
      ((pw as { occurrences: unknown[] }).occurrences.length ?? 0) > 0,
  );
}

async function generatePickupBoard(
  cols: number,
  rows: number,
  targetWord: string,
): Promise<{ grid: string[][]; placedWords: unknown[] } | null> {
  const minOccurrences = hundredPickupMinOccurrences(cols, targetWord, rows);
  let best: { grid: string[][]; placedWords: unknown[]; coverage: number; occurrences: number } | null =
    null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const seed = Math.floor(Math.random() * 1_000_000);
    let r: { grid: string[][]; placedWords: unknown[]; density?: number };
    try {
      r = await runPickupWorkerOnce(cols, rows, targetWord, seed);
    } catch {
      continue;
    }
    if (!isValidPlacedWords(r.placedWords)) continue;

    const coverage = typeof r.density === 'number' ? r.density : 0;
    const occurrences = countPlacedWordOccurrences(r.placedWords);
    if (
      !best ||
      occurrences > best.occurrences ||
      (occurrences === best.occurrences && coverage > best.coverage)
    ) {
      best = { grid: r.grid, placedWords: r.placedWords, coverage, occurrences };
    }
    if (coverage >= TARGET_COVERAGE && occurrences >= minOccurrences) {
      return { grid: r.grid, placedWords: r.placedWords };
    }
  }

  if (best && best.occurrences > 0) {
    return { grid: best.grid, placedWords: best.placedWords };
  }
  return null;
}

export type HundredRoboReplayResult =
  | { ok: true; targetWord: string }
  | { ok: false; message: string };

/**
 * クリア後「らくだロボでもう一回」: 同じ盤面サイズ・文字数で新しい探すことばを選び、hundred_rooms を差し替える。
 */
export async function replayHundredPickupWithRoboWord(params: {
  roomId: string;
  cols: number;
  rows: number;
  previousTargetWord: string;
}): Promise<HundredRoboReplayResult> {
  const { roomId, cols, rows, previousTargetWord } = params;

  if (!auth.currentUser?.uid) {
    return { ok: false, message: 'ログインが必要です' };
  }

  const prev = (previousTargetWord || '').trim();
  const wordLength = Math.max(1, Array.from(prev).length);
  const exclude = [prev, readLastAutoWord()].filter(Boolean);

  const targetWord = pickAutoTargetWordForBoard(cols, rows, wordLength, { exclude });
  if (!targetWord) {
    return {
      ok: false,
      message: `${wordLength}文字のことばが見つかりませんでした。盤面サイズを変えてお試しください。`,
    };
  }

  const roomRef = doc(db, 'hundred_rooms', roomId);
  await withTimeout(
    setDoc(roomRef, { problemsGenerating: true, problemsReady: false }, { merge: true }),
    8000,
    'set-problem-flag',
  );

  try {
    const board = await generatePickupBoard(cols, rows, targetWord);
    if (!board) {
      return { ok: false, message: '盤面の生成に失敗しました。もう一度お試しください。' };
    }

    const gridRows = gridToFirestoreRows(board.grid);
    if (gridRows.length === 0 || gridRows.some((row) => !row || row.length === 0)) {
      return { ok: false, message: '盤面データが不正です。もう一度お試しください。' };
    }

    const uid = auth.currentUser.uid;
    await withTimeout(
      setDoc(
        roomRef,
        {
          status: 'playing',
          hundredMode: 'pickup',
          gridRows,
          words: firestoreSafeJson(board.placedWords ?? []),
          targetWord,
          boardSize: cols,
          boardCols: cols,
          boardRows: rows,
          gameTimeLimitSec: 0,
          foundWords: [],
          endReason: null,
          endedAt: null,
          startedAt: serverTimestamp(),
          startedBy: uid,
          problemsGenerating: false,
          problemsReady: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
      12000,
      'set-playing-doc',
    );

    writeLastAutoWord(targetWord);
    return { ok: true, targetWord };
  } catch (e) {
    console.error('[hundredRoboReplay] failed', e);
    await setDoc(roomRef, { problemsGenerating: false }, { merge: true }).catch(() => {});
    return { ok: false, message: 'もう一回の準備に失敗しました' };
  }
}
