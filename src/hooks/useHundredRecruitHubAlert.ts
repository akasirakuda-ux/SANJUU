import { useEffect, useRef, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { firestoreLikeToMillis, shouldHideFromSanjuuRecruitBoard } from '../lib/rakudaHubShell';
import { fetchHundredRoomMetaByIds } from '../lib/hundredRoomListMeta';

export const RK_HUNDRED_RECRUIT_LAST_SEEN_MS_KEY = 'rk_hundred_recruit_last_seen_ms';

function readLastSeenMs(): number {
  try {
    const raw = localStorage.getItem(RK_HUNDRED_RECRUIT_LAST_SEEN_MS_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** トップハブで hundred 募集を「確認済み」にする（一覧を開いた・ポップアップを閉じた等） */
export function markHundredRecruitSeenNow(): void {
  const n = Date.now();
  try {
    localStorage.setItem(RK_HUNDRED_RECRUIT_LAST_SEEN_MS_KEY, String(n));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('rk-hundred-recruit-seen', { detail: n }));
}

/**
 * メインハブ（seat-selection）・スライドパズル向け: 三十募集一覧と同じ基準で募集中・新着を検知。
 * 連絡帳オーバー中は購読しない（トップに戻ったタイミングで再評価）。
 */
export function useHundredRecruitHubAlert(enabled: boolean): {
  hasActiveRecruits: boolean;
  hasNewRecruits: boolean;
  markSeen: () => void;
} {
  const [hasActiveRecruits, setHasActiveRecruits] = useState(false);
  const [hasNewRecruits, setHasNewRecruits] = useState(false);
  const [lastSeenMs, setLastSeenMs] = useState(() => readLastSeenMs());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const publicItemsRef = useRef<
    {
      id: string;
      createdAt?: unknown;
      recruitDeadlineAt?: unknown;
      roomId?: string;
      hundredMode?: string;
    }[]
  >([]);
  const roomMetaRef = useRef<Record<string, HundredRoomListMeta>>({});
  const missingRoomIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handler = () => setLastSeenMs(readLastSeenMs());
    window.addEventListener('rk-hundred-recruit-seen', handler);
    return () => window.removeEventListener('rk-hundred-recruit-seen', handler);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [enabled]);

  const recompute = (now: number, seenMs: number) => {
    let active = false;
    let newest = false;
    for (const item of publicItemsRef.current) {
      if (item.hundredMode === 'tile_match') continue;
      const room = item.roomId ? roomMetaRef.current[item.roomId] : undefined;
      const roomDocMissing = !!(item.roomId && missingRoomIdsRef.current.has(item.roomId));
      if (shouldHideFromSanjuuRecruitBoard(item, room, now, { roomDocMissing })) continue;
      active = true;
      const cm = firestoreLikeToMillis(item.createdAt);
      if (cm != null && cm > seenMs) newest = true;
    }
    setHasActiveRecruits(active);
    setHasNewRecruits(newest);
  };

  useEffect(() => {
    if (!enabled) {
      publicItemsRef.current = [];
      roomMetaRef.current = {};
      missingRoomIdsRef.current = new Set();
      setHasActiveRecruits(false);
      setHasNewRecruits(false);
      return;
    }

    recompute(nowMs, lastSeenMs);

    const qPub = query(collection(db, 'hundred_public'), orderBy('createdAt', 'desc'), limit(40));

    const loadRoomMeta = async () => {
      const roomIds = [
        ...new Set(
          publicItemsRef.current
            .map((item) => (typeof item.roomId === 'string' ? item.roomId.trim() : ''))
            .filter(Boolean)
        ),
      ];
      if (roomIds.length === 0) {
        roomMetaRef.current = {};
        missingRoomIdsRef.current = new Set();
        recompute(Date.now(), lastSeenMs);
        return;
      }
      try {
        const { byRoomId, missingRoomIds } = await fetchHundredRoomMetaByIds(db, roomIds);
        roomMetaRef.current = byRoomId;
        missingRoomIdsRef.current = missingRoomIds;
      } catch (err) {
        console.warn('[useHundredRecruitHubAlert] hundred_rooms by id', err);
      }
      recompute(Date.now(), lastSeenMs);
    };

    const unsubPub = onSnapshot(
      qPub,
      (snap) => {
        publicItemsRef.current = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            createdAt: data.createdAt,
            recruitDeadlineAt: data.recruitDeadlineAt,
            roomId: typeof data.roomId === 'string' ? data.roomId : undefined,
            hundredMode: typeof data.hundredMode === 'string' ? data.hundredMode : undefined,
          };
        });
        void loadRoomMeta();
      },
      (err) => {
        console.warn('[useHundredRecruitHubAlert] hundred_public 購読', err);
        publicItemsRef.current = [];
        setHasActiveRecruits(false);
        setHasNewRecruits(false);
      }
    );

    void loadRoomMeta();
    const roomPoll = window.setInterval(() => void loadRoomMeta(), 15_000);

    return () => {
      unsubPub();
      window.clearInterval(roomPoll);
    };
  }, [enabled, lastSeenMs]);

  useEffect(() => {
    if (!enabled) return;
    recompute(nowMs, lastSeenMs);
  }, [enabled, nowMs, lastSeenMs]);

  return { hasActiveRecruits, hasNewRecruits, markSeen: markHundredRecruitSeenNow };
}
