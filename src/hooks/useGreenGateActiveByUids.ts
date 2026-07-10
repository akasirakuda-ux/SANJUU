import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { isGreenGateActiveFromUntil } from '../lib/greenGateEmoji';

/** 表示中の UID について `rk_green_gate` を読み、緑枠表示用の map を返す */
export function useGreenGateActiveByUids(
  uids: (string | null | undefined)[],
  /** 省略時は fetch 時点の時刻（毎 render で変えない — 無限更新防止） */
  nowMs?: number
): Record<string, boolean> {
  const key = useMemo(
    () =>
      [...new Set(uids.map((u) => (u || '').trim()).filter(Boolean))].sort().join(','),
    [uids]
  );

  const [byUid, setByUid] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const list = key ? key.split(',') : [];
    if (list.length === 0) {
      setByUid((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    const resolvedNow = typeof nowMs === 'number' ? nowMs : Date.now();
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        list.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, 'rk_green_gate', uid));
            const until = snap.data()?.greenUntilMs;
            const ms = typeof until === 'number' && Number.isFinite(until) ? until : null;
            return [uid, isGreenGateActiveFromUntil(ms, resolvedNow)] as const;
          } catch {
            return [uid, false] as const;
          }
        })
      );
      if (!cancelled) {
        setByUid(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, nowMs]);

  return byUid;
}
