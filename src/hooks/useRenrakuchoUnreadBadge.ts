import { useEffect, useRef, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { firestoreLikeToMillis, isRenrakuEntryVisible } from '../lib/rakudaHubShell';

export const RK_RENRAKU_LAST_SEEN_MS_KEY = 'rk_renraku_last_seen_ms';

/** localStorage 未設定時はこのミリ秒を「最終閲覧」にする（1970-01-01 = それ以降の投稿をすべて未読候補に含める） */
const LAST_SEEN_INITIAL_MS = 0;

/** 一般: 一覧の先頭だけ見れば足りる。管理者の非公開は取りこぼし防止で多めに */
const LIMIT_PUB_REC = 20;
const LIMIT_PRV_ADMIN = 80;

function warnRenrakuBadge(label: string, err: unknown) {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: string }).code) : '';
  console.warn(`[useRenrakuchoUnreadBadge] ${label}${code ? ` (${code})` : ''}`, err);
}

/** localStorage の生値（未設定は null 扱いで 0） */
function readRawLastSeenMsFromStorage(): number {
  try {
    const raw = localStorage.getItem(RK_RENRAKU_LAST_SEEN_MS_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function normalizeStoredLastSeenMs(raw: number): number {
  if (!Number.isFinite(raw) || raw < 0) return LAST_SEEN_INITIAL_MS;
  return raw;
}

function getInitialLastSeenMs(): number {
  if (typeof window === 'undefined') return LAST_SEEN_INITIAL_MS;
  return normalizeStoredLastSeenMs(readRawLastSeenMsFromStorage());
}

/**
 * 連絡帳を最後に開いた時刻より新しい投稿があるか（メインハブの未読バッジ用）。
 * 一般: public_messages + renraku_public。管理者はさらに renraku_private。
 * 未読件数（表示可能ドキュメント）の合計が 1 件以上のときだけ true（テスト用の強制表示は行わない）。
 *
 * 初回（localStorage 未設定）は lastSeen=0 とし、古い投稿もクエリ対象に含めて未読を拾いやすくする。
 */
export function useRenrakuchoUnreadBadge(isRenrakuAdminUser: boolean, isAuthReady: boolean): boolean {
  const [hasUnread, setHasUnread] = useState(false);
  const [lastSeenMs, setLastSeenMs] = useState(() => getInitialLastSeenMs());
  const countsRef = useRef({ pub: 0, rec: 0, prv: 0 });

  useEffect(() => {
    const handler = () => {
      const n = Date.now();
      try {
        localStorage.setItem(RK_RENRAKU_LAST_SEEN_MS_KEY, String(n));
      } catch {
        /* ignore */
      }
      setLastSeenMs(n);
      countsRef.current = { pub: 0, rec: 0, prv: 0 };
      setHasUnread(false);
    };
    window.addEventListener('rk-renraku-seen', handler);
    return () => window.removeEventListener('rk-renraku-seen', handler);
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;

    const ts = Timestamp.fromMillis(lastSeenMs);
    countsRef.current = { pub: 0, rec: 0, prv: 0 };

    const recompute = () => {
      const c = countsRef.current;
      const currentCount = c.pub + c.rec + (isRenrakuAdminUser ? c.prv : 0);
      setHasUnread(currentCount > 0);
    };

    const qPub = query(
      collection(db, 'public_messages'),
      where('createdAt', '>', ts),
      orderBy('createdAt', 'desc'),
      limit(LIMIT_PUB_REC)
    );
    const qRec = query(
      collection(db, 'renraku_public'),
      where('createdAt', '>', ts),
      orderBy('createdAt', 'desc'),
      limit(LIMIT_PUB_REC)
    );
    // 管理者の伝言: 複合インデックス不要のため全件近傍を取得しクライアントで lastSeen 比較
    const qPrv = isRenrakuAdminUser ? query(collection(db, 'renraku_private'), limit(LIMIT_PRV_ADMIN)) : null;

    const unsubPub = onSnapshot(
      qPub,
      (snap) => {
        const vis = snap.docs.filter((d) => isRenrakuEntryVisible(d.data()));
        countsRef.current.pub = vis.length;
        recompute();
      },
      (err) => {
        warnRenrakuBadge('public_messages 購読', err);
        countsRef.current.pub = 0;
        recompute();
      }
    );

    const unsubRec = onSnapshot(
      qRec,
      (snap) => {
        const vis = snap.docs.filter((d) => isRenrakuEntryVisible(d.data()));
        countsRef.current.rec = vis.length;
        recompute();
      },
      (err) => {
        warnRenrakuBadge('renraku_public 購読', err);
        countsRef.current.rec = 0;
        recompute();
      }
    );

    const unsubPrv =
      qPrv != null
        ? onSnapshot(
            qPrv,
            (snap) => {
              const vis = snap.docs.filter((d) => {
                const data = d.data();
                if (!isRenrakuEntryVisible(data)) return false;
                const ms = firestoreLikeToMillis(data.createdAt);
                return ms != null && ms > lastSeenMs;
              });
              countsRef.current.prv = vis.length;
              recompute();
            },
            (err) => {
              warnRenrakuBadge('renraku_private 購読', err);
              countsRef.current.prv = 0;
              recompute();
            }
          )
        : null;

    return () => {
      unsubPub();
      unsubRec();
      unsubPrv?.();
    };
  }, [lastSeenMs, isAuthReady, isRenrakuAdminUser]);

  return hasUnread;
}
