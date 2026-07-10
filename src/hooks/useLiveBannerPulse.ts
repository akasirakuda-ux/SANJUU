import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { tripFirestoreCircuit } from '../lib/firestoreCircuit';
import {
  RK_LIVE_BANNER_DISPLAY_MS,
  RK_LIVE_BANNER_PULSE_FRESH_MS,
  firestoreLiveBannerPulseMs,
  markLiveBannerSeenPulseMs,
  readLiveBannerSeenPulseMs,
  RK_LIVE_BANNER_DOC_PATH,
} from '../lib/rakudaLiveBannerPulse';

/**
 * Firestore の liveBannerPulseAtMs 更新を購読し、主要画面では約3秒バナーを出す。
 */
export function useLiveBannerPulse(eligible: boolean): boolean {
  const [visible, setVisible] = useState(false);
  const pulseMsRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const tryShow = useCallback(
    (pulseMs: number) => {
      if (!eligible) return;
      if (!Number.isFinite(pulseMs)) return;
      if (Date.now() - pulseMs > RK_LIVE_BANNER_PULSE_FRESH_MS) return;
      if (readLiveBannerSeenPulseMs() === pulseMs) return;

      markLiveBannerSeenPulseMs(pulseMs);
      setVisible(true);
      if (hideTimerRef.current != null) {
        window.clearTimeout(hideTimerRef.current);
      }
      hideTimerRef.current = window.setTimeout(() => {
        setVisible(false);
        hideTimerRef.current = null;
      }, RK_LIVE_BANNER_DISPLAY_MS);
    },
    [eligible],
  );

  useEffect(() => {
    const ref = doc(db, RK_LIVE_BANNER_DOC_PATH[0], RK_LIVE_BANNER_DOC_PATH[1]);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const pulseMs = firestoreLiveBannerPulseMs(
          snap.exists() ? (snap.data() as Record<string, unknown>) : undefined,
        );
        if (pulseMs == null) return;
        pulseMsRef.current = pulseMs;
        tryShow(pulseMs);
      },
      (err) => {
        tripFirestoreCircuit(db, err, { cooldownMs: 10_000 });
      },
    );
    return () => {
      unsub();
      if (hideTimerRef.current != null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [tryShow]);

  useEffect(() => {
    const pulseMs = pulseMsRef.current;
    if (pulseMs != null) tryShow(pulseMs);
  }, [eligible, tryShow]);

  return visible;
}
