import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { collection, doc, getDoc, getDocs, type Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { cardClass } from '../../ui/policy';

type GreenGateDoc = {
  uid: string;
  greenUntilMs: number;
  status: string;
  contractAtMs: number;
  currentPeriodStartMs: number;
  updatedAtMs: number | null;
};

export type GreenGateMemberRow = GreenGateDoc & {
  nickname: string;
  userEmoji: string;
  isActive: boolean;
};

function readGreenUntilMs(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function readOptionalMs(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function readFirestoreTimeMs(raw: unknown): number | null {
  if (raw && typeof raw === 'object' && 'toMillis' in raw && typeof (raw as Timestamp).toMillis === 'function') {
    const ms = (raw as Timestamp).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  if (raw && typeof raw === 'object' && 'seconds' in raw) {
    const sec = Number((raw as { seconds?: unknown }).seconds);
    return Number.isFinite(sec) ? sec * 1000 : null;
  }
  return null;
}

function formatDateJa(ms: number): string {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

function statusLabel(row: GreenGateMemberRow): string {
  if (row.isActive && row.status === 'gift') return '感謝パス';
  if (row.isActive) return '有効';
  const s = row.status.trim().toLowerCase();
  if (s === 'canceled' || s === 'cancelled') return '解約済';
  if (s === 'gift') return '感謝パス終了';
  return '終了';
}

async function loadGreenGateMembers(): Promise<GreenGateMemberRow[]> {
  const snap = await getDocs(collection(db, 'rk_green_gate'));
  const now = Date.now();
  const docs: GreenGateDoc[] = snap.docs.map((d) => {
    const data = d.data();
    const updatedAtMs = readFirestoreTimeMs(data.updatedAt);
    const currentPeriodStartMs = readOptionalMs(data.currentPeriodStartMs);
    const contractAtMs = readOptionalMs(data.contractAtMs);
    return {
      uid: d.id,
      greenUntilMs: readGreenUntilMs(data.greenUntilMs),
      status: typeof data.status === 'string' ? data.status : '',
      contractAtMs: contractAtMs || currentPeriodStartMs || readGreenUntilMs(data.greenUntilMs),
      currentPeriodStartMs: currentPeriodStartMs || updatedAtMs || contractAtMs,
      updatedAtMs,
    };
  });

  const rows = await Promise.all(
    docs.map(async (g) => {
      let nickname = '';
      let userEmoji = '';
      try {
        const userSnap = await getDoc(doc(db, 'rk_users', g.uid));
        if (userSnap.exists()) {
          const u = userSnap.data();
          nickname = typeof u.nickname === 'string' ? u.nickname.trim() : '';
          userEmoji = typeof u.userEmoji === 'string' ? u.userEmoji.trim() : '';
        }
      } catch {
        /* ignore */
      }
      const isActive = g.greenUntilMs > now;
      return { ...g, nickname, userEmoji, isActive };
    }),
  );

  rows.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return b.greenUntilMs - a.greenUntilMs;
  });
  return rows;
}

const GreenGateMemberList: React.FC = () => {
  const [rows, setRows] = useState<GreenGateMemberRow[]>([]);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ok' | 'denied' | 'error'>('idle');

  const reload = useCallback(async () => {
    setLoadState('loading');
    try {
      const list = await loadGreenGateMembers();
      setRows(list);
      setLoadState('ok');
    } catch (e: unknown) {
      const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: string }).code) : '';
      setLoadState(code === 'permission-denied' ? 'denied' : 'error');
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const counts = useMemo(() => {
    const active = rows.filter((r) => r.isActive).length;
    return { active, total: rows.length, past: rows.length - active };
  }, [rows]);

  return (
    <section
      className={`${cardClass} space-y-3 border-2 border-rk-success-500 bg-rk-success-50/40 shadow-sm ring-1 ring-rk-success-200/80`}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-sm font-black text-rk-slate-400 uppercase tracking-widest flex items-center gap-2 min-w-0">
          <Users size={16} className="text-rk-success-700" /> 緑ゲート会員
        </h3>
        <button type="button" onClick={() => void reload()} className="text-[10px] font-bold text-rk-slate-600 underline">
          再読み込み
        </button>
      </div>

      <p className="text-[11px] font-bold text-rk-slate-600 leading-relaxed">
        有効 {counts.active} 人 / 過去含む {counts.total} 人
        {counts.past > 0 ? `（過去 ${counts.past} 人）` : ''}
        <span className="block mt-1 text-[10px] font-medium text-rk-slate-500">
          同じ Google ログイン（Firebase UID）なら、ニックネームが変わっても同一人物として記録されます。
        </span>
      </p>

      {loadState === 'loading' ? <p className="text-center py-4 text-rk-slate-400 text-xs font-bold">読み込み中…</p> : null}

      {loadState === 'denied' ? (
        <p className="text-xs font-bold text-rk-red-800 leading-relaxed">
          一覧を読めませんでした。管理者ログインと Firestore ルールを確認してください。
        </p>
      ) : null}

      {loadState === 'error' ? (
        <p className="text-xs font-bold text-rk-red-800 leading-relaxed">読み込みに失敗しました。</p>
      ) : null}

      {loadState === 'ok' && rows.length === 0 ? (
        <p className="text-center py-4 text-rk-slate-400 text-xs font-bold">まだ記録がありません。</p>
      ) : null}

      {rows.length > 0 ? (
        <ul className="space-y-2 max-h-[min(50vh,420px)] overflow-y-auto custom-scrollbar">
          {rows.map((row) => (
            <li
              key={row.uid}
              className={`rounded-xl border px-3 py-2.5 text-xs ${
                row.isActive
                  ? 'border-rk-success-300 bg-rk-success-50/80'
                  : 'border-rk-slate-200 bg-rk-slate-50/90'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-black text-rk-slate-800 min-w-0 break-words">
                  {row.userEmoji ? `${row.userEmoji} ` : ''}
                  {row.nickname || '（ニック未設定）'}
                </p>
                <span
                  className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full ${
                    row.isActive ? 'bg-rk-success-600 text-rk-white' : 'bg-rk-slate-300 text-rk-slate-700'
                  }`}
                >
                  {statusLabel(row)}
                </span>
              </div>
              <dl className="mt-2 space-y-0.5 text-[10px] font-bold text-rk-slate-600">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-rk-slate-500 shrink-0">契約日</dt>
                  <dd>{formatDateJa(row.contractAtMs)}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-rk-slate-500 shrink-0">更新日</dt>
                  <dd>{formatDateJa(row.currentPeriodStartMs)}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-rk-slate-500 shrink-0">失効日</dt>
                  <dd>{formatDateJa(row.greenUntilMs)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};

export default GreenGateMemberList;
