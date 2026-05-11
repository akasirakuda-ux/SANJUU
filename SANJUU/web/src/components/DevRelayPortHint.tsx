'use client';

import { useEffect, useState } from 'react';

/** `SANJUU/scripts/dev.mjs` の表側ポート（リレー）と揃える */
const EXPECT_PUBLIC =
  (typeof process.env.NEXT_PUBLIC_DEV_RELAY_PUBLIC_PORT === 'string' &&
    process.env.NEXT_PUBLIC_DEV_RELAY_PUBLIC_PORT.trim()) ||
  '3000';

export default function DevRelayPortHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (process.env.NEXT_PUBLIC_DEV_WS_RELAY !== '1') return;
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') return;

    const port = window.location.port;
    const effectivePort = port || (window.location.protocol === 'https:' ? '443' : '80');

    /** リレーを使うときは公開ポートだけ。`:3001` は Next の内側のみで WS ルートが効かないことがある */
    if (effectivePort !== EXPECT_PUBLIC) setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div
      role="status"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 99999,
        padding: '10px 14px',
        background: '#7c2d12',
        color: '#fef2f2',
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1.45,
      }}
    >
      開発用: 今の URL では WebSocket リレー（<code>/_engine/ws</code>）に届かないことがあります。SANJUU ルートで{' '}
      <code>npm run dev</code> を動かしたうえで{' '}
      <code>
        http://localhost:{EXPECT_PUBLIC}
      </code>{' '}
      を開いてください。
    </div>
  );
}
