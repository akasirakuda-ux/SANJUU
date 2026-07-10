import { useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { firestoreLikeToMillis } from '../lib/firestoreTime';
import {
  isRoboLoungeRoundComplete,
  isRoboLoungeRoundIdle,
  resolveRoboLoungeIdleReferenceMs,
} from '../lib/roboPickupLoungeFound';
import {
  ROBO_PICKUP_STALE_HINT_MS,
  ROBO_PICKUP_STALE_REPLACE_MS,
  roboLoungeBoardSizeMismatch,
} from '../lib/roboPickupLoungeConfig';
import {
  fillRoboLoungeLastOccurrence,
  shouldRoboLoungeAutoFillLastOccurrence,
} from '../lib/roboPickupLoungeLastFill';
import { normalizeHundredFoundList } from '../lib/hundredFoundNormalize';
import {
  countPlacedWordOccurrences,
  countUniqueFoundOccurrences,
} from '../lib/hundredPickupOccurrences';
import {
  refreshRoboPickupLoungeAuto,
  refreshRoboPickupLoungeSeedIfNeeded,
  refreshRoboPickupLoungeBoardSizeIfNeeded,
  refreshRoboPickupLoungeStale,
} from '../lib/roboPickupLoungeRefresh';
import { isHundredJoinRetryableError } from '../lib/hundredRoomPlayer';
/**
 * らくだロボ / 絵文字ロボ常設 — お題クリア後・盤面未生成時・15分放置時に自動で次のお題を用意する。
 */
export function useRoboPickupLoungeAutoRefresh(
  enabled = true,
  notifyStaleReplace = false,
  roomId?: string | null,
) {
  const busyRef = useRef(false);
  const lastAttemptMsRef = useRef(0);
  const staleTimerRef = useRef<number | undefined>(undefined);
  const lastFillTimerRef = useRef<number | undefined>(undefined);
  const lastFillBusyRef = useRef(false);
  const loungeRoomId = (roomId || '').trim();

  useEffect(() => {
    if (!enabled || !loungeRoomId) return;

    const clearStaleTimer = () => {
      if (staleTimerRef.current != null) {
        window.clearTimeout(staleTimerRef.current);
        staleTimerRef.current = undefined;
      }
    };

    const clearLastFillTimer = () => {
      if (lastFillTimerRef.current != null) {
        window.clearTimeout(lastFillTimerRef.current);
        lastFillTimerRef.current = undefined;
      }
    };

    const roomRef = doc(db, 'hundred_rooms', loungeRoomId);

    const scheduleLastFillCheck = (d: Record<string, unknown>) => {
      clearLastFillTimer();
      if (d.problemsGenerating === true) return;

      const placedWords = d.words ?? d.placedWords;
      const total = countPlacedWordOccurrences(placedWords);
      const foundCount = countUniqueFoundOccurrences(normalizeHundredFoundList(d.foundWords));
      if (total <= 0 || foundCount !== total - 1) return;

      if (shouldRoboLoungeAutoFillLastOccurrence(d, Date.now())) {
        if (lastFillBusyRef.current) return;
        lastFillBusyRef.current = true;
        void fillRoboLoungeLastOccurrence(loungeRoomId)
          .catch(() => {})
          .finally(() => {
            lastFillBusyRef.current = false;
          });
        return;
      }

      const referenceMs = resolveRoboLoungeIdleReferenceMs(
        d.foundWords,
        placedWords,
        firestoreLikeToMillis(d.startedAt),
        firestoreLikeToMillis(d.lastFoundAt),
        firestoreLikeToMillis(d.updatedAt),
      );
      if (!referenceMs) return;

      const runLastFill = () => {
        if (lastFillBusyRef.current) return;
        lastFillBusyRef.current = true;
        void fillRoboLoungeLastOccurrence(loungeRoomId)
          .catch(() => {})
          .finally(() => {
            lastFillBusyRef.current = false;
          });
      };

      const remaining = ROBO_PICKUP_STALE_HINT_MS - (Date.now() - referenceMs);
      if (remaining <= 0) {
        runLastFill();
      } else {
        lastFillTimerRef.current = window.setTimeout(runLastFill, remaining);
      }
    };

    const scheduleStaleCheck = (d: Record<string, unknown>) => {
      clearStaleTimer();
      scheduleLastFillCheck(d);
      if (d.problemsGenerating === true) return;
      const targetWord = String(d.targetWord ?? '').trim();
      const hasGrid = Array.isArray(d.gridRows) && d.gridRows.length > 0;
      if (!targetWord || !hasGrid) return;

      const placedWords = d.words ?? d.placedWords;
      if (isRoboLoungeRoundComplete(d.foundWords, placedWords)) return;

      const startedMs = firestoreLikeToMillis(d.startedAt);
      const lastFoundMs = firestoreLikeToMillis(d.lastFoundAt);
      const updatedMs = firestoreLikeToMillis(d.updatedAt);
      const referenceMs = resolveRoboLoungeIdleReferenceMs(
        d.foundWords,
        placedWords,
        startedMs,
        lastFoundMs,
        updatedMs,
      );
      if (!referenceMs) return;

      const runStale = () => {
        if (busyRef.current) return;
        const now = Date.now();
        if (
          !isRoboLoungeRoundIdle(
            d.foundWords,
            placedWords,
            startedMs,
            lastFoundMs,
            now,
            ROBO_PICKUP_STALE_REPLACE_MS,
            updatedMs,
          )
        ) {
          return;
        }
        if (now - lastAttemptMsRef.current < 8000) return;
        lastAttemptMsRef.current = now;
        busyRef.current = true;
        if (notifyStaleReplace) {
          window.dispatchEvent(
            new CustomEvent('SHOW_TOAST', { detail: '新しい問題に差し替えます' }),
          );
        }
        void refreshRoboPickupLoungeStale(loungeRoomId)
          .catch((e) => {
            if (isHundredJoinRetryableError(e)) return;
            console.warn('[useRoboPickupLoungeAutoRefresh] stale', e);
          })
          .finally(() => {
            busyRef.current = false;
          });
      };

      const remaining = ROBO_PICKUP_STALE_REPLACE_MS - (Date.now() - referenceMs);
      if (remaining <= 0) {
        runStale();
      } else {
        staleTimerRef.current = window.setTimeout(runStale, remaining);
      }
    };

    const unsub = onSnapshot(
      roomRef,
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data() as Record<string, unknown>;
        scheduleStaleCheck(d);

        if (roboLoungeBoardSizeMismatch(d)) {
          if (busyRef.current) return;
          busyRef.current = true;
          void refreshRoboPickupLoungeBoardSizeIfNeeded(loungeRoomId)
            .catch((e) => {
              if (isHundredJoinRetryableError(e)) return;
              console.warn('[useRoboPickupLoungeAutoRefresh] board resize', e);
            })
            .finally(() => {
              busyRef.current = false;
            });
          return;
        }

        if (busyRef.current) return;
        if (d.problemsGenerating === true) {
          const updatedMs = firestoreLikeToMillis(d.updatedAt);
          const stale = !updatedMs || Date.now() - updatedMs > 2 * 60 * 1000;
          if (!stale) return;
        }

        const targetWord = String(d.targetWord ?? '').trim();
        const hasGrid = Array.isArray(d.gridRows) && d.gridRows.length > 0;
        const needsSeed = !targetWord || !hasGrid || d.problemsReady === false;
        const roundComplete = isRoboLoungeRoundComplete(d.foundWords, d.words ?? d.placedWords);

        if (!needsSeed && !roundComplete) return;

        const now = Date.now();
        const debounceMs = needsSeed ? 12000 : 8000;
        if (now - lastAttemptMsRef.current < debounceMs) return;
        lastAttemptMsRef.current = now;
        busyRef.current = true;

        const run = needsSeed
          ? () => refreshRoboPickupLoungeSeedIfNeeded(loungeRoomId)
          : () => refreshRoboPickupLoungeAuto(loungeRoomId);
        void run()
          .catch((e) => {
            if (isHundredJoinRetryableError(e)) return;
            console.warn('[useRoboPickupLoungeAutoRefresh]', e);
          })
          .finally(() => {
            busyRef.current = false;
          });
      },
      (err) => {
        console.warn('[useRoboPickupLoungeAutoRefresh] snapshot', err);
      },
    );

    return () => {
      unsub();
      clearStaleTimer();
      clearLastFillTimer();
    };
  }, [enabled, notifyStaleReplace, loungeRoomId]);
}
