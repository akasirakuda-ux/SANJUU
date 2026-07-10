import { deleteField, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { clampPickupTargetWordLength, pickAutoTargetWordForBoard } from './hundredAutoTargetWord';
import {
  inferPickupCharsetFromWord,
  normalizePickupCharset,
  pickAutoTargetWordForPickupCharset,
  robReplayTargetLength,
  type PickupCharset,
} from './hundredPickupCharset';
import { firestoreSafeJson, gridToFirestoreRows } from './hundredRoomBoard';
import { generatePickupBoardReliable } from './hundredPickupFeasibility';
import { clearHundredRoomPlayersForNewRound } from './hundredRoomPlayer';
import { syncHundredPublicForNewRound } from './hundredPublicRoundSync';

const RK_LAST_AUTO_WORD_KEY = 'rk_hundred_last_auto_word';

function readLastAutoWord(charset: PickupCharset): string {
  try {
    return localStorage.getItem(`${RK_LAST_AUTO_WORD_KEY}_${charset}`) || '';
  } catch {
    return '';
  }
}

function writeLastAutoWord(charset: PickupCharset, word: string): void {
  try {
    localStorage.setItem(`${RK_LAST_AUTO_WORD_KEY}_${charset}`, word);
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

async function generatePickupBoard(
  cols: number,
  rows: number,
  targetWord: string,
  pickupCharset: PickupCharset,
): Promise<{ grid: string[][]; placedWords: unknown[] } | null> {
  const r = generatePickupBoardReliable(cols, rows, targetWord, pickupCharset, {
    maxAttempts: 48,
  });
  if (!r) return null;
  return { grid: r.grid, placedWords: r.placedWords };
}

function pickRoboReplayTargetWord(
  pickupCharset: PickupCharset,
  cols: number,
  rows: number,
  previousTargetWord: string,
  exclude: string[],
): string | null {
  const wordLength = robReplayTargetLength(pickupCharset, previousTargetWord);
  if (pickupCharset === 'hiragana') {
    return pickAutoTargetWordForBoard(cols, rows, clampPickupTargetWordLength(wordLength), { exclude });
  }
  return pickAutoTargetWordForPickupCharset(pickupCharset, cols, rows, wordLength, { exclude });
}

export type HundredRoboReplayResult =
  | { ok: true; targetWord: string }
  | { ok: false; message: string };

/**
 * クリア後「らくだロボでもう一回」: 同じ盤面サイズ・文字種で新しい探すことばを選び、hundred_rooms を差し替える。
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

  const roomRef = doc(db, 'hundred_rooms', roomId);
  const roomSnap = await getDoc(roomRef);
  const roomData = roomSnap.exists() ? (roomSnap.data() as Record<string, unknown>) : null;
  const storedCharset = normalizePickupCharset(roomData?.pickupCharset);
  const inferredCharset = inferPickupCharsetFromWord(previousTargetWord);
  const pickupCharset = inferredCharset ?? storedCharset;

  const prev = (previousTargetWord || '').trim();
  const exclude = [prev, readLastAutoWord(pickupCharset)].filter(Boolean);

  const targetWord = pickRoboReplayTargetWord(pickupCharset, cols, rows, prev, exclude);
  if (!targetWord) {
    const unit = pickupCharset === 'digit' ? '桁' : '文字';
    const len = robReplayTargetLength(pickupCharset, prev);
    return {
      ok: false,
      message: `${len}${unit}のことばが見つかりませんでした。盤面サイズを変えてお試しください。`,
    };
  }

  await withTimeout(
    setDoc(roomRef, { problemsGenerating: true, problemsReady: false }, { merge: true }),
    8000,
    'set-problem-flag',
  );

  try {
    const board = await generatePickupBoard(cols, rows, targetWord, pickupCharset);
    if (!board) {
      return { ok: false, message: '盤面の生成に失敗しました。もう一度お試しください。' };
    }

    const gridRows = gridToFirestoreRows(board.grid, pickupCharset);
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
          pickupCharset,
          gridRows,
          words: firestoreSafeJson(board.placedWords ?? []),
          targetWord,
          boardSize: cols,
          boardCols: cols,
          boardRows: rows,
          gameTimeLimitSec: 0,
          foundWords: [],
          endReason: deleteField(),
          endedAt: deleteField(),
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

    writeLastAutoWord(pickupCharset, targetWord);
    await syncHundredPublicForNewRound({
      roomId,
      targetWord,
      boardCols: cols,
      boardRows: rows,
      pickupCharset,
    }).catch((e) => {
      console.warn('[hundredRoboReplay] sync hundred_public failed', e);
    });
    await clearHundredRoomPlayersForNewRound(roomId).catch((e) => {
      console.warn('[hundredRoboReplay] clear players for new round failed', e);
    });
    return { ok: true, targetWord };
  } catch (e) {
    console.error('[hundredRoboReplay] failed', e);
    await setDoc(roomRef, { problemsGenerating: false }, { merge: true }).catch(() => {});
    return { ok: false, message: 'もう一回の準備に失敗しました' };
  }
}
