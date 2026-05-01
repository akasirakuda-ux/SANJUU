import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { decodeError, decodeFull, encodeJoin, encodePress, OPCODE } from './binary.js';
import { nowMs } from './util.js';

export type WorkerArgs = {
  url: string;
  roomIds: number[];
  clientsPerRoom: number;
  durationSec: number;
  pressEveryMs: number;
  warmupSec: number;
};

function decodeDiffFrames(buf: Uint8Array, onDiff: (n: number, v: 0 | 1) => void): boolean {
  if (buf.length < 1 || buf[0] !== OPCODE.DIFF) return false;
  if (buf.length % 3 !== 0) return true;
  for (let off = 0; off < buf.length; off += 3) {
    if (buf[off] !== OPCODE.DIFF) return true;
    const n = buf[off + 1];
    const v: 0 | 1 = buf[off + 2] ? 1 : 0;
    onDiff(n, v);
  }
  return true;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

export async function runWorker(args: WorkerArgs): Promise<{
  pressesSent: number;
  diffsRecv: number;
  samples: number;
  p50: number;
  p90: number;
  p99: number;
}> {
  const sockets: WebSocket[] = [];
  const leaderWsByRoom: WebSocket[] = [];
  const lastPressTsByRoom = new Map<number, number>();

  let pressesSent = 0;
  let diffsRecv = 0;
  const lats: number[] = [];

  for (let i = 0; i < args.roomIds.length; i++) {
    const roomId = args.roomIds[i]!;
    for (let j = 0; j < args.clientsPerRoom; j++) {
      const ws = new WebSocket(args.url, { perMessageDeflate: false });
      sockets.push(ws);
      ws.on('open', () => ws.send(encodeJoin(roomId), { binary: true }));
      ws.on('message', (data) => {
        if (typeof data === 'string') return;
        const buf =
          data instanceof Buffer ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data as ArrayBuffer);
        const handledDiff = decodeDiffFrames(buf, () => {
          diffsRecv++;
          if (ws === leaderWsByRoom[i]) {
            const t0 = lastPressTsByRoom.get(roomId);
            if (t0) lats.push(nowMs() - t0);
          }
        });
        if (handledDiff) return;
        if (decodeFull(buf)) return;
        if (decodeError(buf)) return;
      });
      if (j === 0) leaderWsByRoom[i] = ws;
    }
  }

  // connection settle
  await delay(2000);
  if (args.warmupSec > 0) await delay(args.warmupSec * 1000);

  const stopAt = nowMs() + args.durationSec * 1000;
  while (nowMs() < stopAt) {
    for (let i = 0; i < args.roomIds.length; i++) {
      const roomId = args.roomIds[i]!;
      const ws = leaderWsByRoom[i];
      if (!ws || ws.readyState !== ws.OPEN) continue;
      const n = 1 + ((Math.random() * 30) | 0);
      lastPressTsByRoom.set(roomId, nowMs());
      ws.send(encodePress(n), { binary: true });
      pressesSent++;
    }
    await delay(args.pressEveryMs);
  }

  for (const ws of sockets) {
    try {
      ws.close();
    } catch {}
  }

  lats.sort((a, b) => a - b);
  return {
    pressesSent,
    diffsRecv,
    samples: lats.length,
    p50: percentile(lats, 50),
    p90: percentile(lats, 90),
    p99: percentile(lats, 99),
  };
}

