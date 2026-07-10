import React, { useCallback, useEffect, useState } from 'react';
import { sanjuuHttpApiOrigin, sanjuuWebOrigin } from '../../lib/rakudaHubShell';

export type SanjuuPlayRoomListing = {
  roomId: number;
  embedWord: string;
  clientsCount: number;
  createdAt: number;
  started: boolean;
};

function playApi(path: string): string {
  const base = sanjuuHttpApiOrigin();
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

function goPlay(roomId: number, hostKey?: string) {
  const q = new URLSearchParams({ room: String(roomId >>> 0) });
  if (hostKey) q.set('host', hostKey);
  window.location.assign(`${sanjuuWebOrigin().replace(/\/+$/, '')}/play?${q.toString()}`);
}

/**
 * 連絡帳（掲示板）内の 30SANJUU：募集一覧・参加（SANJUU `/play` へ）
 */
const POLL_OK_MS = 20_000;
const POLL_FAIL_MS = 30_000;
const MAX_CONSECUTIVE_FAILURES = 3;

const RenrakuchoSanjuuPlaySection: React.FC = () => {
  const [rooms, setRooms] = useState<SanjuuPlayRoomListing[]>([]);
  const [recruitBusy, setRecruitBusy] = useState(false);

  const fetchRooms = useCallback(async (): Promise<boolean> => {
    try {
      const r = await fetch(playApi('/api/play/rooms'), { cache: 'no-store' });
      if (!r.ok) return false;
      const j: unknown = await r.json();
      if (!Array.isArray(j)) return false;
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
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = 0;
    let consecutiveFailures = 0;
    const schedule = (delayMs: number) => {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => void tick(), delayMs);
    };
    const tick = async () => {
      if (cancelled) return;
      const ok = await fetchRooms();
      if (cancelled) return;
      if (ok) {
        consecutiveFailures = 0;
        schedule(POLL_OK_MS);
        return;
      }
      consecutiveFailures += 1;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        return;
      }
      schedule(POLL_FAIL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [fetchRooms]);

  const recruiting = rooms.filter((x) => !x.started);

  const recruit = async () => {
    setRecruitBusy(true);
    try {
      const r = await fetch(playApi('/api/play/room'), {
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
      className="mb-4 space-y-3 rounded-xl border-2 border-rk-sky-400/40 bg-gradient-to-b from-rk-sky-50 to-rk-white px-3 py-4 shadow-sm"
      aria-labelledby="sanjuu-play-section-title"
    >
      <h2
        id="sanjuu-play-section-title"
        className="text-center text-xl sm:text-2xl font-black text-rk-sky-950 tracking-tight font-[family-name:var(--font-rounded)]"
      >
        ひと言探し
      </h2>
      <p className="text-center text-[11px] font-bold text-rk-slate-500">【ひと言探し】ひらがな900マス</p>

      <div className="flex justify-center">
        <button
          type="button"
          disabled={recruitBusy}
          onClick={() => void recruit()}
          className="rounded-xl bg-rk-blue-500 px-4 py-2.5 text-sm font-black text-rk-white shadow-sm transition-transform active:scale-[0.99] disabled:opacity-50"
        >
          あそびを募集する
        </button>
      </div>
      {recruiting.length === 0 ? (
        <p className="text-center text-xs font-bold text-rk-slate-600">いま募集中の部屋はありません。</p>
      ) : (
        <ul className="space-y-2">
          {recruiting.map((room) => (
            <li key={room.roomId}>
              <div className="flex gap-3 rounded-xl border border-rk-sky-200 bg-rk-white shadow-sm items-stretch min-h-[4.5rem]">
                <div className="min-w-0 flex-1 py-3 pl-3 pr-1 flex flex-col justify-center">
                  <p className="text-base font-black text-rk-slate-900 leading-snug">『{room.embedWord}』をさがせ！</p>
                  <p className="mt-1 text-xs font-bold text-rk-slate-600">
                    ルーム {String(room.roomId)} ／ 参加 {room.clientsCount} / 30 にん
                  </p>
                </div>
                <div className="flex flex-col justify-center gap-2 shrink-0 py-3 pr-3 pl-3 border-l border-rk-sky-100">
                  <button
                    type="button"
                    onClick={() => goPlay(room.roomId)}
                    className="rounded-lg border border-rk-sky-400 bg-rk-sky-50 px-3 py-2 text-[12px] font-black text-rk-sky-900 whitespace-nowrap shadow-sm transition-transform active:scale-[0.98]"
                  >
                    参加
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default RenrakuchoSanjuuPlaySection;
