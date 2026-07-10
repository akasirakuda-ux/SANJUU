import { doc, increment, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const HUB_VISITOR_TOTAL_DOC_PATH = ['system', 'hub_visitor_total'] as const;

/** GA アクティブユーザー（2026/6/1〜6/28 · リニューアル起点28日） */
export const HUB_VISITOR_GA_BASELINE = 1729;

const HUB_VISITOR_SESSION_KEY = 'rk_hub_visit_counted_v1';
const HUB_VISITOR_LOCAL_KEY = 'rk_hub_visitor_total_local_v1';

/** localStorage 不可時のフォールバック */
let memoryHubVisitorTotal = 0;

export function formatHubVisitorTotal(n: number): string {
  return Math.max(0, Math.floor(n)).toLocaleString('ja-JP');
}

/** 表示用累計（GA起点を床にする） */
export function hubVisitorTotalForDisplay(n: number): number {
  return Math.max(HUB_VISITOR_GA_BASELINE, Math.max(0, Math.floor(n)));
}

export function readLocalHubVisitorTotal(): number {
  let stored = 0;
  try {
    const raw = window.localStorage.getItem(HUB_VISITOR_LOCAL_KEY);
    const n = Number.parseInt(String(raw ?? ''), 10);
    if (Number.isFinite(n) && n >= 0) stored = n;
  } catch {
    /* ignore */
  }
  return Math.max(memoryHubVisitorTotal, stored);
}

function writeLocalHubVisitorTotal(n: number): void {
  memoryHubVisitorTotal = Math.max(0, Math.floor(n));
  try {
    window.localStorage.setItem(HUB_VISITOR_LOCAL_KEY, String(memoryHubVisitorTotal));
  } catch {
    /* ignore */
  }
}

/** 端末内累計 +1（Firestore 失敗時も表示用に残す） */
export function bumpLocalHubVisitorTotal(): number {
  const next = readLocalHubVisitorTotal() + 1;
  writeLocalHubVisitorTotal(next);
  return next;
}

export function mergeHubVisitorTotals(remote?: number): number {
  const local = readLocalHubVisitorTotal();
  const merged = Math.max(local, typeof remote === 'number' && remote >= 0 ? remote : 0);
  if (merged > local) writeLocalHubVisitorTotal(merged);
  return merged;
}

export function subscribeHubVisitorTotal(
  onValue: (total: number | undefined) => void,
  onError?: (e: unknown) => void,
): () => void {
  const ref = doc(db, ...HUB_VISITOR_TOTAL_DOC_PATH);
  return onSnapshot(
    ref,
    (snap) => {
      const raw = snap.data()?.totalCount;
      if (typeof raw === 'number' && raw >= 0) {
        onValue(mergeHubVisitorTotals(raw));
        return;
      }
      onValue(snap.exists() ? mergeHubVisitorTotals(0) : mergeHubVisitorTotals(undefined));
    },
    (err) => {
      console.warn('[hubVisitorStats] onSnapshot failed', err);
      onValue(mergeHubVisitorTotals(undefined));
      onError?.(err);
    },
  );
}

async function syncHubVisitorTotalToFirestore(): Promise<void> {
  const ref = doc(db, ...HUB_VISITOR_TOTAL_DOC_PATH);
  await setDoc(
    ref,
    {
      totalCount: increment(1),
      updatedAtMs: Date.now(),
    },
    { merge: true },
  );
}

/** トップ訪問を1セッション1回だけ累計に加算 */
export async function recordHubVisitOncePerSession(): Promise<number> {
  if (typeof window === 'undefined') return readLocalHubVisitorTotal();

  let total = readLocalHubVisitorTotal();
  const already = window.sessionStorage.getItem(HUB_VISITOR_SESSION_KEY) === '1';

  if (!already) {
    total = bumpLocalHubVisitorTotal();
    window.sessionStorage.setItem(HUB_VISITOR_SESSION_KEY, '1');
    try {
      await syncHubVisitorTotalToFirestore();
    } catch (e) {
      console.warn('[hubVisitorStats] record visit failed', e);
    }
    return total;
  }

  if (total < 1) {
    total = bumpLocalHubVisitorTotal();
    try {
      await syncHubVisitorTotalToFirestore();
    } catch (e) {
      console.warn('[hubVisitorStats] record visit failed', e);
    }
  }

  return total;
}
