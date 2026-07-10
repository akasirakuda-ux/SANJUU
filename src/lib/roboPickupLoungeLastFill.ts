import { arrayUnion, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { firestoreLikeToMillis } from './firestoreTime';
import { normalizeHundredFoundList } from './hundredFoundNormalize';
import { listUnfoundOccurrences } from './kotobaRoboIdle/unfoundOccurrences';
import {
  countPlacedWordOccurrences,
  countUniqueFoundOccurrences,
} from './hundredPickupOccurrences';
import {
  isRoboLoungeRoundComplete,
  isRoboLoungeRoundIdle,
} from './roboPickupLoungeFound';
import { ROBO_PICKUP_STALE_HINT_MS } from './roboPickupLoungeConfig';
import { RAKUDA_ROBO_EMOJI, RAKUDA_ROBO_NAME, RAKUDA_ROBO_PLAYER_ID } from './reversiConfig';
import { pickRandomBandColor } from './rkTheme';
import type { PlacedWord } from '../types';

const FILL_DEBOUNCE_MS = 8000;
let lastFillAttemptMs = 0;

function placedWordsFromRoom(d: Record<string, unknown>): PlacedWord[] {
  const raw = d.words ?? d.placedWords;
  if (!Array.isArray(raw)) return [];
  return raw as PlacedWord[];
}

/** 残り1つ・ヒント待ちと同じ放置時間 — ロボが最後の正解を埋める */
export function shouldRoboLoungeAutoFillLastOccurrence(
  d: Record<string, unknown>,
  nowMs = Date.now(),
): boolean {
  if (d.problemsGenerating === true) return false;

  const placedWords = placedWordsFromRoom(d);
  if (isRoboLoungeRoundComplete(d.foundWords, placedWords)) return false;

  const total = countPlacedWordOccurrences(placedWords);
  const foundCount = countUniqueFoundOccurrences(normalizeHundredFoundList(d.foundWords));
  if (total <= 0 || foundCount !== total - 1) return false;

  return isRoboLoungeRoundIdle(
    d.foundWords,
    placedWords,
    firestoreLikeToMillis(d.startedAt),
    firestoreLikeToMillis(d.lastFoundAt),
    nowMs,
    ROBO_PICKUP_STALE_HINT_MS,
    firestoreLikeToMillis(d.updatedAt),
  );
}

export type RoboLoungeLastFillResult = 'filled' | 'skipped' | 'no_auth' | 'error';

/** 協力ロボ常設 — 残り1つを Firestore に書き込む（2人以上でも可） */
export async function fillRoboLoungeLastOccurrence(roomId: string): Promise<RoboLoungeLastFillResult> {
  const id = (roomId || '').trim();
  if (!id) return 'skipped';

  const uid = auth.currentUser?.uid;
  if (!uid) return 'no_auth';

  const now = Date.now();
  if (now - lastFillAttemptMs < FILL_DEBOUNCE_MS) return 'skipped';
  lastFillAttemptMs = now;

  const roomRef = doc(db, 'hundred_rooms', id);

  try {
    const filled = await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) return false;

      const d = snap.data() as Record<string, unknown>;
      if (!shouldRoboLoungeAutoFillLastOccurrence(d, Date.now())) return false;

      const placedWords = placedWordsFromRoom(d);
      const foundWords = normalizeHundredFoundList(d.foundWords);
      const remaining = listUnfoundOccurrences(placedWords, foundWords, true);
      if (remaining.length !== 1) return false;

      const next = remaining[0]!;
      const color = pickRandomBandColor();
      tx.set(
        roomRef,
        {
          foundWords: arrayUnion({
            w: next.word,
            s: next.start,
            e: next.end,
            c: color,
            p: RAKUDA_ROBO_PLAYER_ID,
            n: RAKUDA_ROBO_NAME.slice(0, 32),
            m: RAKUDA_ROBO_EMOJI.slice(0, 8),
          }),
          lastFoundAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      return true;
    });

    if (filled) {
      window.dispatchEvent(
        new CustomEvent('SHOW_TOAST', {
          detail: `${RAKUDA_ROBO_EMOJI} ${RAKUDA_ROBO_NAME}が最後の1つを見つけました`,
        }),
      );
      return 'filled';
    }
    return 'skipped';
  } catch (e) {
    console.warn('[roboPickupLoungeLastFill]', e);
    return 'error';
  }
}
