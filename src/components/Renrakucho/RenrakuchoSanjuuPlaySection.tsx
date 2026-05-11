import React, { useCallback, useEffect, useState } from 'react';
import { sanjuuWebOrigin } from '../../lib/sanjuuWebOrigin';
import SanjuuBrandHeading from '../SanjuuBrandHeading';

export type SanjuuPlayRoomListing = {
  roomId: number;
  embedWord: string;
  clientsCount: number;
  createdAt: number;
  started: boolean;
};

function sanjuuHttpBase(): string {
  const v = (import.meta.env.VITE_SANJUU_HTTP_BASE as string | undefined)?.trim();
  return v || 'http://localhost:8080';
}

function goPlay(roomId: number, hostKey?: string) {
  const q = new URLSearchParams({ room: String(roomId >>> 0) });
  if (hostKey) q.set('host', hostKey);
  window.location.assign(`${sanjuuWebOrigin().replace(/\/+$/, '')}/play?${q.toString()}`);
}

/**
 * 連絡帳（掲示板）内の 30SANJUU：募集一覧・参加（SANJUU /play へ。Firebase 非依存）
 */
const RenrakuchoSanjuuPlaySection: React.FC = () => {
  const [rooms, setRooms] = useState<SanjuuPlayRoomListing[]>([]);
  const [recruitBusy, setRecruitBusy] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const r = await fetch(`${sanjuuHttpBase()}/api/play/rooms`, { cache: 'no-store' });
      if (!r.ok) return;
      const j: unknown = await r.json();
      if (!Array.isArray(j)) return;
      const list: SanjuuPlayRoomListing[] = [];
      for (const row of j) {
        if (typeof row !== 'object' || !row) continue;
        const rec = row as Record<string, unknown>;
        const roomId = Number(rec.roomId);
        if (!Number.isFinite(roomId)) continue;
        list.push({
          roomId: roomId >>> 0,
          embedWord: typeof rec.embedWord === 'string' ? rec.embedWord : 'さくら',
          clientsCount: typeof rec.clientsCount === 'number' ? rec.clientsCount : 0,
          createdAt: typeof rec.createdAt === 'number' ? rec.createdAt : 0,
          started: !!rec.started,
        });
      }
      setRooms(list);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void fetchRooms();
    const id = window.setInterval(() => void fetchRooms(), 1000);
    return () => window.clearInterval(id);
  }, [fetchRooms]);

  const recruiting = rooms.filter((x) => !x.started);

  const recruit = async () => {
    setRecruitBusy(true);
    try {
      const r = await fetch(`${sanjuuHttpBase()}/api/play/room`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ word: 'さくら' }),
      });
      const j: unknown = await r.json();
      const rec = typeof j === 'object' && j ? (j as Record<string, unknown>) : {};
      const roomId = typeof rec.roomId === 'number' ? rec.roomId : Number(rec.roomId);
      if (!Number.isFinite(roomId) || roomId <= 0) return;
      const hostKey = typeof rec.hostKey === 'string' ? rec.hostKey : '';
      goPlay(roomId >>> 0, hostKey || undefined);
    } finally {
      setRecruitBusy(false);
    }
  };

  return (
    <section
      className="mb-4 space-y-3 rounded-xl border-2 border-sky-400/40 bg-gradient-to-b from-sky-50 to-white px-3 py-4 shadow-sm"
      aria-labelledby="sanjuu-play-section-title"
    >
      <div id="sanjuu-play-section-title">
        <SanjuuBrandHeading as="h2" />
      </div>
      <p className="text-center text-[13px] font-black uppercase tracking-widest text-sky-800/90">募集中のあそび</p>
      <div className="flex justify-center">
        <button
          type="button"
          disabled={recruitBusy}
          onClick={() => void recruit()}
          className="rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-black text-white shadow-sm transition-transform active:scale-[0.99] disabled:opacity-50"
        >
          あそびを募集する
        </button>
      </div>
      {recruiting.length === 0 ? (
        <p className="text-center text-xs font-bold text-slate-600">いま募集中の部屋はありません。</p>
      ) : (
        <ul className="space-y-2">
          {recruiting.map((room) => (
            <li key={room.roomId}>
              <button
                type="button"
                onClick={() => goPlay(room.roomId)}
                className="w-full rounded-xl border border-sky-200 bg-white px-3 py-3 text-left shadow-sm transition-transform active:scale-[0.99]"
              >
                <p className="text-base font-black text-slate-900">『{room.embedWord}』をさがせ！</p>
                <p className="mt-1 text-xs font-bold text-slate-600">
                  ルーム {String(room.roomId)} ／ 参加 {room.clientsCount} / 30 にん
                </p>
                <span className="mt-2 inline-block rounded-lg border border-sky-300 bg-sky-50 px-2 py-1 text-[11px] font-black text-sky-900">
                  この募集に参加する
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default RenrakuchoSanjuuPlaySection;
