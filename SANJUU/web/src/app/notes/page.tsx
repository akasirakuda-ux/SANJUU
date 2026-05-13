'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import SanjuuBrandHeading from '../../components/SanjuuBrandHeading';
import styles from './page.module.css';

const MEMO_KEY = 'sanjuu-notes-memo-v1';
const HTTP_BASE = () => process.env.NEXT_PUBLIC_HTTP_URL ?? 'http://localhost:8080';

export type PlayRoomListing = {
  roomId: number;
  embedWord: string;
  clientsCount: number;
  createdAt: number;
  started: boolean;
};

export default function NotesPage() {
  const router = useRouter();
  const [memo, setMemo] = useState('');
  const [rooms, setRooms] = useState<PlayRoomListing[]>([]);
  const [recruitBusy, setRecruitBusy] = useState(false);

  useEffect(() => {
    try {
      setMemo(window.localStorage.getItem(MEMO_KEY) ?? '');
    } catch {
      /* ignore */
    }
  }, []);

  const persistMemo = useCallback((v: string) => {
    setMemo(v);
    try {
      window.localStorage.setItem(MEMO_KEY, v);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      const r = await fetch(`${HTTP_BASE()}/api/play/rooms`, { cache: 'no-store' });
      if (!r.ok) return;
      const j: unknown = await r.json();
      if (!Array.isArray(j)) return;
      const list: PlayRoomListing[] = [];
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
      const r = await fetch(`${HTTP_BASE()}/api/play/room`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ word: 'さくら' }),
      });
      const j: unknown = await r.json();
      const rec = typeof j === 'object' && j ? (j as Record<string, unknown>) : {};
      const roomId = typeof rec.roomId === 'number' ? rec.roomId : Number(rec.roomId);
      if (!Number.isFinite(roomId) || roomId <= 0) return;
      const hostKey = typeof rec.hostKey === 'string' ? rec.hostKey : '';
      const q = new URLSearchParams({ room: String(roomId >>> 0) });
      if (hostKey) q.set('host', hostKey);
      router.push(`/play?${q.toString()}`);
    } finally {
      setRecruitBusy(false);
    }
  };

  const joinRoom = (roomId: number) => {
    router.push(`/play?room=${roomId >>> 0}`);
  };

  return (
    <div className={styles.page}>
      <p className={styles.back}>
        <Link href="/sanjuu">← SANJUU トップ</Link>
      </p>
      <SanjuuBrandHeading as="h1" />
      <h2 className={styles.h1}>連絡帳</h2>

      <section className={styles.section} aria-labelledby="play-recruit-heading">
        <SanjuuBrandHeading as="h2" />
        <h2 id="play-recruit-heading" className={styles.sectionTitle}>
          募集中のあそび
        </h2>
        <div className={styles.row}>
          <button type="button" className={styles.btnPrimary} disabled={recruitBusy} onClick={() => void recruit()}>
            あそびを募集する
          </button>
        </div>
        {recruiting.length === 0 ? (
          <p className={styles.muted}>いま募集中の部屋はありません。</p>
        ) : (
          <div className={styles.cards}>
            {recruiting.map((room) => (
              <div
                key={room.roomId}
                role="button"
                tabIndex={0}
                className={styles.card}
                onClick={() => joinRoom(room.roomId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    joinRoom(room.roomId);
                  }
                }}
              >
                <p className={styles.cardTitle}>『{room.embedWord}』をさがせ！</p>
                <p className={styles.cardMeta}>
                  ルーム {String(room.roomId)} ／ 参加人数 {room.clientsCount} / 30 にん
                </p>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={(e) => {
                    e.stopPropagation();
                    joinRoom(room.roomId);
                  }}
                >
                  この募集に参加する
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="memo-heading">
        <h2 id="memo-heading" className={styles.sectionTitle}>
          メモ
        </h2>
        <textarea
          className={styles.memo}
          value={memo}
          onChange={(e) => persistMemo(e.target.value)}
          placeholder="ここにメモを書けます（この端末にだけ保存されます）"
          spellCheck={false}
        />
      </section>
    </div>
  );
}
