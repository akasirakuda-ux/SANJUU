import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { cardClass } from '../../ui/policy';
import { RK_GATE_NICK_DISPLAY_CLASS } from '../../lib/rakudaGate';
import { loadShussekiRankingRows, type ShussekiRankingRow } from '../../lib/shussekiRanking';

const TOP_N_OPTIONS = [10, 30, 50] as const;

/** しゅっせき同期バグ修正以降（2026-06-19 JST）— これより前は誤同期が多い */
const SHUSSEKI_RANKING_TRUSTED_AFTER_MS = Date.parse('2026-06-19T00:00:00+09:00');

export type { ShussekiRankingRow };

function formatSyncJa(ms: number): string {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

const ShussekiRankingList: React.FC = () => {
  const [rows, setRows] = useState<ShussekiRankingRow[]>([]);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ok' | 'denied' | 'error'>('idle');
  const [topN, setTopN] = useState<(typeof TOP_N_OPTIONS)[number]>(30);
  const [hideStaleSync, setHideStaleSync] = useState(true);

  const reload = useCallback(async () => {
    setLoadState('loading');
    try {
      const list = await loadShussekiRankingRows();
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

  const rankedRows = useMemo(() => {
    if (!hideStaleSync) return rows;
    return rows.filter((row) => row.updatedAtMs >= SHUSSEKI_RANKING_TRUSTED_AFTER_MS);
  }, [rows, hideStaleSync]);

  const visibleRows = useMemo(() => rankedRows.slice(0, topN), [rankedRows, topN]);

  return (
    <section
      className={`${cardClass} space-y-3 border-2 border-rk-amber-400 bg-rk-amber-50/50 shadow-sm ring-1 ring-rk-amber-200/80`}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-sm font-black text-rk-slate-400 uppercase tracking-widest flex items-center gap-2 min-w-0">
          <Trophy size={16} className="text-rk-amber-700" /> しゅっせきランキング
        </h3>
        <button type="button" onClick={() => void reload()} className="text-[10px] font-bold text-rk-slate-600 underline">
          再読み込み
        </button>
      </div>

      <p className="text-[11px] font-bold text-rk-slate-600 leading-relaxed">
        しゅっせき簿の「出席した日」と同じ数え方です（Google ログインで同期した人）。
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="shusseki-ranking-top-n" className="text-[10px] font-black text-rk-slate-500 uppercase tracking-widest">
          表示件数
        </label>
        <select
          id="shusseki-ranking-top-n"
          value={topN}
          onChange={(e) => setTopN(Number(e.target.value) as (typeof TOP_N_OPTIONS)[number])}
          className="text-xs font-bold rounded-lg border border-rk-amber-300 bg-rk-white px-2 py-1"
        >
          {TOP_N_OPTIONS.map((n) => (
            <option key={n} value={n}>
              上位 {n} 人
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[10px] font-bold text-rk-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={hideStaleSync}
            onChange={(e) => setHideStaleSync(e.target.checked)}
            className="rounded border-rk-amber-400"
          />
          古い同期を隠す
        </label>
      </div>

      {loadState === 'loading' ? (
        <p className="text-center py-6 text-rk-slate-400 text-xs font-bold">読み込み中…</p>
      ) : null}
      {loadState === 'denied' ? (
        <div className="rounded-xl border-2 border-rk-red-500 bg-rk-red-50 px-3 py-4 text-xs font-bold text-rk-red-900 leading-relaxed">
          ランキングを取得できません。管理者の Google ログインを確認してください。
        </div>
      ) : null}
      {loadState === 'error' ? (
        <p className="text-center py-6 text-rk-rose-700 text-xs font-bold">読み込みに失敗しました</p>
      ) : null}

      {loadState === 'ok' && visibleRows.length > 0 ? (
        <ol className="space-y-2">
          {visibleRows.map((row, index) => (
            <li
              key={row.uid}
              className="flex gap-3 rounded-xl border border-rk-amber-200 bg-rk-white/80 px-3 py-2.5 shadow-sm"
            >
              <span className="text-lg font-black text-rk-amber-700 tabular-nums w-8 shrink-0 text-center">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`font-black text-rk-slate-800 break-words ${RK_GATE_NICK_DISPLAY_CLASS}`}>
                  {row.userEmoji ? `${row.userEmoji} ` : ''}
                  {row.nickname || '（ニック未設定）'}
                </p>
                <p className="mt-1 text-[10px] font-bold text-rk-slate-600">
                  出席した日{' '}
                  <span className="text-sm font-black text-rk-amber-800 tabular-nums">{row.totalStamps}</span> 日
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-rk-slate-400">
                  最終同期：{formatSyncJa(row.updatedAtMs)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
};

export default ShussekiRankingList;
