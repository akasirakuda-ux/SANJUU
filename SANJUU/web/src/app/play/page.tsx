'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SanjuuBrandHeading from '../../components/SanjuuBrandHeading';
import styles from './page.module.css';
import type { PlayDiff, PlayFull } from '@/lib/playBinary';
import { browserSanjuuHttpUrl, browserSanjuuPlayWsUrl } from '@/lib/sanjuuUrls';
import { PlayWsClient } from '@/lib/playWsClient';
import { useStableConnectedUi } from '@/lib/useStableConnectedUi';

const CELLS = 900;
const HTTP_BASE = () => browserSanjuuHttpUrl();

/** 数字のみは10進 roomId、英字を含む場合は base36（従来の roomCode） */
function parsePlayRoomId(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  if (/[a-z]/i.test(t)) {
    const n = Number.parseInt(t, 36);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n >>> 0;
  }
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n >>> 0;
}

declare global {
  interface Window {
    __PLAY_PRESS__?: (idx: number) => void;
  }
}

class BoardStore {
  bits = new Uint8Array(CELLS);
  /** 語完成ライン（v=2 のセル） */
  lineBits = new Uint8Array(CELLS);
  flashes = new Uint8Array(CELLS); // 0 none, 1 hit, 2 miss
  reveal = new Uint8Array(CELLS); // 0/1 outline hint
  board: string[] = Array.from({ length: CELLS }, () => '・');
  listeners: Array<Set<() => void>> = Array.from({ length: CELLS }, () => new Set());

  setFull(msg: PlayFull) {
    this.bits.set(msg.bits);
    this.lineBits.fill(0);
    this.board = msg.board;
    this.reveal.fill(0);
    if (msg.revealed && msg.solutionBits) this.reveal.set(msg.solutionBits);
    // notify all (full is rare)
    for (let i = 0; i < CELLS; i++) this.listeners[i]!.forEach((fn) => fn());
  }

  setDiff(d: PlayDiff) {
    if (d.idx < 0 || d.idx >= CELLS) return;
    if (d.v === 2) {
      this.bits[d.idx] = 1;
      this.lineBits[d.idx] = 1;
    } else {
      this.bits[d.idx] = d.v as 0 | 1;
    }
    this.listeners[d.idx]!.forEach((fn) => fn());
  }

  flash(idx: number, kind: 1 | 2) {
    if (idx < 0 || idx >= CELLS) return;
    this.flashes[idx] = kind;
    this.listeners[idx]!.forEach((fn) => fn());
    window.setTimeout(() => {
      if (this.flashes[idx] !== kind) return;
      this.flashes[idx] = 0;
      this.listeners[idx]!.forEach((fn) => fn());
    }, 200);
  }

  subscribe(idx: number, fn: () => void) {
    this.listeners[idx]!.add(fn);
    return () => {
      void this.listeners[idx]!.delete(fn);
    };
  }
}

function Cell({ idx, store, disabled }: { idx: number; store: BoardStore; disabled: boolean }) {
  const [, force] = useState(0);
  useEffect(() => store.subscribe(idx, () => force((x) => (x + 1) | 0)), [idx, store]);
  const pressed = store.bits[idx] === 1;
  const line = store.lineBits[idx] === 1;
  const flash = store.flashes[idx];
  const reveal = store.reveal[idx] === 1;
  const ch = store.board[idx] ?? '・';

  let cls = styles.cell;
  if (pressed) cls += ` ${styles.pressed}`;
  if (line) cls += ` ${styles.lineWord}`;
  if (flash === 1) cls += ` ${styles.flashHit}`;
  if (flash === 2) cls += ` ${styles.flashMiss}`;
  if (reveal) cls += ` ${styles.revealLine}`;

  return (
    <button className={cls} disabled={disabled} onClick={() => window.__PLAY_PRESS__?.(idx)} aria-pressed={pressed}>
      {ch}
    </button>
  );
}

export default function PlayPage() {
  const [connected, setConnected] = useState(false);
  const steadyConnectedUi = useStableConnectedUi(connected);
  const [status, setStatus] = useState<{ started: boolean; revealed: boolean; clientsCount: number }>({
    started: false,
    revealed: false,
    clientsCount: 0,
  });
  const [hasBoard, setHasBoard] = useState(false);
  const [lobbyCount, setLobbyCount] = useState(0);
  const [roomCode, setRoomCode] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URL(window.location.href).searchParams.get('room') ?? '';
  });
  const [hostKey, setHostKey] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URL(window.location.href).searchParams.get('host') ?? '';
  });
  const [word, setWord] = useState('');
  const [error, setError] = useState<number | null>(null);
  const [shake, setShake] = useState(false);

  const store = useMemo(() => new BoardStore(), []);

  const clientRef = useRef<PlayWsClient | null>(null);
  const autoConnectDone = useRef(false);
  const pendingAfterCreateRef = useRef<{ rid: number; host: string } | null>(null);

  const [wsUrl, setWsUrl] = useState<string | null>(null);

  useEffect(() => {
    setWsUrl(browserSanjuuPlayWsUrl(process.env.NEXT_PUBLIC_PLAY_WS_URL, process.env.NEXT_PUBLIC_WS_URL));
  }, []);

  // lightweight "world shake" based on healthz normalRTT p99
  useEffect(() => {
    let t: number | undefined;
    let stop = false;
    const loop = async () => {
      while (!stop) {
        try {
          const r = await fetch(`${HTTP_BASE()}/healthz`, { cache: 'no-store' });
          const j: unknown = await r.json();
          const nr = typeof j === 'object' && j && 'nr' in j ? (j as Record<string, unknown>).nr : null;
          const nrP99 = Array.isArray(nr) ? Number(nr[2] ?? 0) : 0;
          setShake(nrP99 >= 60);
        } catch {
          setShake(false);
        }
        await new Promise((res) => (t = window.setTimeout(res, 1000)));
      }
    };
    loop();
    return () => {
      stop = true;
      if (t) window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    return () => clientRef.current?.stop();
  }, []);

  const onMsg = useCallback((m: PlayDiff | PlayFull | { t: 'error'; code: number }) => {
    if (m.t === 'error') {
      setError(m.code);
      return;
    }
    setError(null);
    if (m.t === 'full') {
      const msg = m as PlayFull;
      setStatus({ started: msg.started, revealed: msg.revealed, clientsCount: msg.clientsCount });
      store.setFull(msg);
      setLobbyCount(msg.clientsCount);
      setHasBoard(true);
      return;
    }
    if (m.t === 'diff') {
      const d = m as PlayDiff;
      store.setDiff(d);
      if (d.v === 2 && d.verdict === 2) return;
      store.flash(d.idx, d.verdict === 0 ? 2 : 1);
    }
  }, [store]);

  const startClientWithRoom = useCallback(
    (rid: number, hk: string) => {
      if (!wsUrl) return;
      clientRef.current?.stop();
      setHasBoard(false);
      setError(null);
      const client = new PlayWsClient({
        url: wsUrl,
        roomId: rid >>> 0,
        hostKey: hk.trim() || undefined,
        handlers: { onMessage: onMsg, onStatus: ({ connected }) => setConnected(connected) },
      });
      clientRef.current = client;
      window.__PLAY_PRESS__ = (idx: number) => clientRef.current?.press(idx);
      client.start();
    },
    [onMsg, wsUrl]
  );

  useEffect(() => {
    if (!wsUrl) return;
    const pend = pendingAfterCreateRef.current;
    if (pend) {
      pendingAfterCreateRef.current = null;
      queueMicrotask(() => startClientWithRoom(pend.rid, pend.host));
      return;
    }
    const u = new URL(window.location.href);
    const r = u.searchParams.get('room') ?? '';
    const h = u.searchParams.get('host') ?? '';
    if (r) setRoomCode(r);
    if (h) setHostKey(h);
    const rid = parsePlayRoomId(r);
    if (!rid || autoConnectDone.current) return;
    autoConnectDone.current = true;
    queueMicrotask(() => startClientWithRoom(rid, h));
  }, [wsUrl, startClientWithRoom]);

  const validRoomId = parsePlayRoomId(roomCode);

  useEffect(() => {
    if (hasBoard || validRoomId == null) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`${HTTP_BASE()}/api/play/rooms`, { cache: 'no-store' });
        if (!res.ok) return;
        const j: unknown = await res.json();
        if (!Array.isArray(j) || cancelled) return;
        for (const row of j) {
          if (typeof row !== 'object' || !row) continue;
          const rec = row as Record<string, unknown>;
          const id = Number(rec.roomId);
          if (!Number.isFinite(id)) continue;
          if ((id >>> 0) === (validRoomId >>> 0)) {
            const c = rec.clientsCount;
            if (typeof c === 'number') setLobbyCount(c);
            return;
          }
        }
      } catch {
        /* ignore */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [hasBoard, validRoomId]);

  const connect = () => {
    const rid = parsePlayRoomId(roomCode);
    if (rid == null || !wsUrl) return;
    startClientWithRoom(rid, hostKey);
  };

  const create = async () => {
    const r = await fetch(`${HTTP_BASE()}/api/play/room`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ word: word.trim() || undefined }),
    });
    const j: unknown = await r.json();
    const rec = typeof j === 'object' && j ? (j as Record<string, unknown>) : {};
    const room = typeof rec.roomCode === 'string' ? rec.roomCode : String(rec.roomCode ?? '');
    const host = typeof rec.hostKey === 'string' ? rec.hostKey : String(rec.hostKey ?? '');
    const u = new URL(window.location.href);
    u.searchParams.set('room', room);
    u.searchParams.set('host', host);
    window.history.replaceState(null, '', u.toString());
    setRoomCode(room);
    setHostKey(host);
    setHasBoard(false);
    autoConnectDone.current = true;
    const rid = parsePlayRoomId(room);
    if (rid != null) {
      if (wsUrl) queueMicrotask(() => startClientWithRoom(rid, host));
      else pendingAfterCreateRef.current = { rid, host };
    }
  };

  const isHost = hostKey.trim().length > 0;
  const showBoard = hasBoard;
  const showLobbyWait = validRoomId != null && !hasBoard;

  return (
    <div className={`${styles.wrap} ${shake ? styles.shake : ''}`}>
      <div className={styles.top}>
        <div>
          <SanjuuBrandHeading as="h1" />
          <div style={{ fontWeight: 900, fontSize: 16, textAlign: 'center' }}>『さくら』をさがせ！</div>
          <div>
            /play room: <code>{roomCode || '(none)'}</code>
          </div>
          <div className={styles.status}>
            {steadyConnectedUi ? '接続中' : '未接続'} / players: {status.clientsCount} / started: {status.started ? '1' : '0'} / revealed:{' '}
            {status.revealed ? '1' : '0'}
            {error != null ? ` / error:${error}` : ''}
          </div>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.row}>
          <input className={styles.input} value={roomCode} onChange={(e) => setRoomCode(e.target.value)} placeholder="room (base36)" />
          <input className={styles.input} value={hostKey} onChange={(e) => setHostKey(e.target.value)} placeholder="hostKey (optional)" />
          <button onClick={connect}>接続</button>
        </div>
        <div className={styles.row}>
          <input className={styles.input} value={word} onChange={(e) => setWord(e.target.value)} placeholder="ひらがな問題語（任意）" />
          <button onClick={create}>部屋を作る</button>
        </div>
        {isHost && (
          <div className={styles.row}>
            <button onClick={() => clientRef.current?.startGame()} disabled={!connected}>
              start
            </button>
            <button onClick={() => clientRef.current?.reveal()} disabled={!connected}>
              reveal
            </button>
            <button onClick={() => clientRef.current?.reset()} disabled={!connected}>
              reset
            </button>
            <button
              onClick={() => clientRef.current?.setWord(word.trim())}
              disabled={!connected || word.trim().length === 0}
              title="問題語で盤面を再生成"
            >
              set word
            </button>
          </div>
        )}
      </div>

      {showLobbyWait ? (
        <div className={styles.wait} role="status">
          参加待機中…（いま {lobbyCount} にん）
        </div>
      ) : showBoard ? (
        <div className={styles.grid} aria-label="board">
          {Array.from({ length: CELLS }, (_, idx) => (
            <Cell key={idx} idx={idx} store={store} disabled={!connected} />
          ))}
        </div>
      ) : (
        <p className={styles.mutedHint}>ルーム番号を入力して「接続」すると、ここに盤面が表示されます。</p>
      )}
    </div>
  );
}

