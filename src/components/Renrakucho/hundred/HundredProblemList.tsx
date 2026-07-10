import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, type Unsubscribe } from 'firebase/firestore';
import { db } from '../../../firebase';

export type HundredProblemRow = {
  id: string;
  order: number;
  title: string;
  isCorrect: boolean | null;
  answerHistory: string[];
};

const HundredProblemList: React.FC<{ roomId: string; className?: string }> = ({ roomId, className = '' }) => {
  const [rows, setRows] = useState<HundredProblemRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;
    const q = query(collection(db, 'hundred_rooms', roomId, 'problems'), orderBy('order', 'asc'));
    const unsub: Unsubscribe = onSnapshot(
      q,
      (snap) => {
        setLoadError(null);
        const next: HundredProblemRow[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as Record<string, unknown>;
          const rawTitle = d.title ?? d.label;
          const title = typeof rawTitle === 'string' ? rawTitle : '';
          let isCorrect: boolean | null = null;
          if ('isCorrect' in d) {
            if (d.isCorrect === null || d.isCorrect === undefined) isCorrect = null;
            else isCorrect = Boolean(d.isCorrect);
          }
          const rawHist = d.answerHistory;
          const answerHistory = Array.isArray(rawHist) ? rawHist.map((x) => String(x)) : [];
          next.push({
            id: docSnap.id,
            order: typeof d.order === 'number' ? d.order : next.length + 1,
            title,
            isCorrect,
            answerHistory,
          });
        });
        setRows(next);
      },
      (err) => {
        console.error('[HundredProblemList]', err);
        setLoadError('問題一覧の読み込みに失敗しました。');
        setRows([]);
      }
    );
    return () => unsub();
  }, [roomId]);

  if (loadError) {
    return <p className="text-sm text-rk-rose-600">{loadError}</p>;
  }

  if (rows.length === 0) {
    return <p className="text-sm text-rk-slate-500">問題一覧はまだありません。</p>;
  }

  return (
    <div
      className={`overflow-x-auto ${className}`}
      style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}
    >
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-rk-slate-200 text-left text-xs font-black uppercase tracking-wide text-rk-slate-400">
            <th className="py-2 pr-3 whitespace-nowrap">No.</th>
            <th className="py-2 pr-3 min-w-[8rem]">内容</th>
            <th className="py-2 pr-3 whitespace-nowrap">正誤</th>
            <th className="py-2">回答履歴</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-rk-slate-100 text-rk-slate-700">
              <td className="py-2 pr-3 align-top tabular-nums">{r.order}</td>
              <td className="py-2 pr-3 align-top">{r.title || '—'}</td>
              <td className="py-2 pr-3 align-top whitespace-nowrap">
                {r.isCorrect === null ? '—' : r.isCorrect ? '○' : '×'}
              </td>
              <td className="py-2 align-top text-xs">
                {r.answerHistory.length ? r.answerHistory.join('、') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HundredProblemList;
