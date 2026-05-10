'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import { SanjuuWsClient } from '@/lib/wsClient';
import { ERROR_CODE, roomIdStringToUint32 } from '@/lib/binary';
import { browserSanjuuWsUrl } from '@/lib/sanjuuUrls';
import { useStableConnectedUi } from '@/lib/useStableConnectedUi';
import styles from './page.module.css';

function bitOn(mask: number, n: number): boolean {
  const bit = 1 << (n - 1);
  return (mask & bit) !== 0;
}

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId: roomIdStr } = use(params);
  const roomId = roomIdStringToUint32(roomIdStr);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<number | null>(null);
  const [transportErr, setTransportErr] = useState<string | null>(null);
  const [mask, setMask] = useState(0);
  const steadyUi = useStableConnectedUi(connected);
  /** 一度でも安定接続になったら、あとからの瞬断で URL パネルをまた出さない（チカチカ防止） */
  const [hideWsDetailPanel, setHideWsDetailPanel] = useState(false);

  const clientRef = useRef<SanjuuWsClient | null>(null);
  const lastTransportToastAtRef = useRef(0);
  type ServerMsg =
    | { t: 'diff'; n: number; v: 0 | 1 }
    | { t: 'full'; mask: number }
    | { t: 'error'; code: number };
  const onMsgRef = useRef<(msg: ServerMsg) => void>(() => {});
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  useEffect(() => {
    setWsUrl(browserSanjuuWsUrl(process.env.NEXT_PUBLIC_WS_URL));
  }, []);

  useEffect(() => {
    if (steadyUi) setHideWsDetailPanel(true);
  }, [steadyUi]);

  useEffect(() => {
    setHideWsDetailPanel(false);
  }, [roomId, wsUrl]);

  onMsgRef.current = (msg: ServerMsg) => {
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

  const connect = useCallback(() => {
    clientRef.current?.stop();
    setError(null);
    setTransportErr(null);
    if (!roomId || !wsUrl) return;
    const client = new SanjuuWsClient({
      url: wsUrl,
      roomId,
      handlers: {
        onMessage: (m) => onMsgRef.current(m),
        onStatus: ({ connected }) => setConnected(connected),
        onTransportError: (d) => {
          const now = Date.now();
          if (now - lastTransportToastAtRef.current < 5000) return;
          lastTransportToastAtRef.current = now;
          setTransportErr(d);
        },
      },
    });
    clientRef.current = client;
    client.start();
  }, [roomId, wsUrl]);

  // Auto-connect on initial load / room change（アンマウント・roomId 変更時は必ず止める）
  useEffect(() => {
    if (!roomId || !wsUrl) return;
    connect();
    return () => {
      setConnected(false);
      clientRef.current?.stop();
    };
  }, [roomId, wsUrl, connect]);

  useEffect(() => {
    if (connected) setTransportErr(null);
  }, [connected]);

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
            {steadyUi ? '接続済み' : '接続を試行中…'}
            {error != null ? ` / error: ${error}` : ''}
            {transportErr ? ` / ${transportErr}` : ''}
          </div>
        </div>
      </div>

      {!steadyUi && !hideWsDetailPanel && (
        <div className={styles.panel}>
          <div>エンジンへ接続しています…</div>
          <div className={styles.status}>
            {roomId ? (wsUrl ? `WS: ${wsUrl}` : '接続先を決定中…') : '不正なルームID'}
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

