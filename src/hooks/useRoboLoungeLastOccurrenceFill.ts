import { useEffect, useRef } from 'react';
import { firestoreLikeToMillis } from '../lib/firestoreTime';
import {
  fillRoboLoungeLastOccurrence,
  shouldRoboLoungeAutoFillLastOccurrence,
} from '../lib/roboPickupLoungeLastFill';
import { ROBO_PICKUP_STALE_HINT_MS } from '../lib/roboPickupLoungeConfig';
import { resolveRoboLoungeIdleReferenceMs } from '../lib/roboPickupLoungeFound';
import {
  countPlacedWordOccurrences,
  countUniqueFoundOccurrences,
} from '../lib/hundredPickupOccurrences';
import type { FoundWord, PlacedWord } from '../types';

type Options = {
  enabled: boolean;
  roomId: string | null | undefined;
  isFinished: boolean;
  placedWords: PlacedWord[];
  foundWords: FoundWord[];
  hundredRoomStartedAt: unknown;
  hundredRoomLastFoundAt: unknown;
  hundredRoomUpdatedAt: unknown;
  nowMs: number;
};

/**
 * ロボ常設 — 残り1つ・10分放置（ヒントと同タイミング）でロボが最後の正解を埋める。
 * 2人以上いても動く（協力クリア用）。
 */
export function useRoboLoungeLastOccurrenceFill(options: Options) {
  const {
    enabled,
    roomId,
    isFinished,
    placedWords,
    foundWords,
    hundredRoomStartedAt,
    hundredRoomLastFoundAt,
    hundredRoomUpdatedAt,
    nowMs,
  } = options;

  const timerRef = useRef<number | undefined>(undefined);
  const busyRef = useRef(false);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };

    const runFill = () => {
      if (busyRef.current || !roomId?.trim()) return;
      busyRef.current = true;
      void fillRoboLoungeLastOccurrence(roomId)
        .catch(() => {})
        .finally(() => {
          busyRef.current = false;
        });
    };

    if (!enabled || isFinished || !roomId?.trim() || !placedWords.length) {
      clearTimer();
      return;
    }

    const roomLike = {
      problemsGenerating: false,
      words: placedWords,
      foundWords,
      startedAt: hundredRoomStartedAt,
      lastFoundAt: hundredRoomLastFoundAt,
      updatedAt: hundredRoomUpdatedAt,
    };

    if (shouldRoboLoungeAutoFillLastOccurrence(roomLike, nowMs)) {
      clearTimer();
      runFill();
      return clearTimer;
    }

    const total = countPlacedWordOccurrences(placedWords);
    const foundCount = countUniqueFoundOccurrences(foundWords);
    if (total <= 0 || foundCount !== total - 1) {
      clearTimer();
      return clearTimer;
    }

    const referenceMs = resolveRoboLoungeIdleReferenceMs(
      foundWords,
      placedWords,
      firestoreLikeToMillis(hundredRoomStartedAt),
      firestoreLikeToMillis(hundredRoomLastFoundAt),
      firestoreLikeToMillis(hundredRoomUpdatedAt),
    );
    clearTimer();
    if (!referenceMs) return clearTimer;

    const remainingMs = ROBO_PICKUP_STALE_HINT_MS - (nowMs - referenceMs);
    if (remainingMs <= 0) return clearTimer;

    timerRef.current = window.setTimeout(runFill, remainingMs);
    return clearTimer;
  }, [
    enabled,
    roomId,
    isFinished,
    placedWords,
    foundWords,
    hundredRoomStartedAt,
    hundredRoomLastFoundAt,
    hundredRoomUpdatedAt,
    nowMs,
  ]);
}
