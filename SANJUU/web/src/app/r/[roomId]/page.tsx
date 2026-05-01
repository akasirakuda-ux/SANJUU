'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SanjuuWsClient } from '@/lib/wsClient';
import { ERROR_CODE, roomIdStringToUint32 } from '@/lib/binary';
import styles from './page.module.css';

function bitOn(mask: number, n: number): boolean {
  const bit = 1 << (n - 1);
  return (mask & bit) !== 0;
}

export default function RoomPage({ params }: { params: { roomId: string } }) {
  const roomIdStr = params.roomId;
  const roomId = roomIdStringToUint32(roomIdStr);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<number | null>(null);
  const [mask, setMask] = useState(0);

  const clientRef = useRef<SanjuuWsClient | null>(null);

  const wsUrl = useMemo(() => process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080/ws', []);

  useEffect(() => {
    return () => clientRef.current?.stop();
  }, []);

  const onMsg = (msg: { t: 'diff'; n: number; v: 0 | 1 } | { t: 'full'; mask: number } | { t: 'error'; code: number }) => {
    if (msg.t === 'error') return setError(msg.code);
    setError(null);
    if (msg.t === 'full') return setMask(msg.mask);
    if (msg.t === 'diff') {
      setMask((prev) => {
        const bit = 1 << (msg.n - 1);
        return msg.v ? prev | bit : prev & ~bit;
      });
    }
  };

  const connect = () => {
    clientRef.current?.stop();
    setError(null);
    if (!roomId) return;
    const client = new SanjuuWsClient({
      url: wsUrl,
      roomId,
      handlers: {
        onMessage: onMsg,
        onStatus: ({ connected }) => setConnected(connected),
      },
    });
    clientRef.current = client;
    client.start();
  };

  const press = (n: number) => {
    clientRef.current?.press(n);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.top}>
        <div>
          <div>
            ルーム: <code>{roomIdStr}</code>
          </div>
          <div className={styles.status}>
            {connected ? '接続中' : '未接続'}
            {error != null ? ` / error: ${error}` : ''}
          </div>
        </div>
      </div>

      {!connected && (
        <div className={styles.panel}>
          <div>接続</div>
          <button onClick={connect} disabled={!roomId}>
            接続する
          </button>
          <div className={styles.status}>
            {roomId ? 'OK' : '不正なルームID'}
            {error === ERROR_CODE.FULL ? ' / 満員' : ''}
            {error === ERROR_CODE.NO_ROOM ? ' / ルームがありません' : ''}
          </div>
        </div>
      )}

      <div className={styles.grid} aria-label="numbers">
        {Array.from({ length: 30 }, (_, i) => {
          const n = i + 1;
          const on = bitOn(mask, n);
          return (
            <button
              key={n}
              className={`${styles.cell} ${on ? styles.on : ''}`}
              onClick={() => press(n)}
              disabled={!connected}
              aria-pressed={on}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

