/* global Buffer, process */
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';

const OPCODE = {
  DIFF: 0x11,
  FULL: 0x12,
  ERROR: 0x13,
  JOIN: 0x01,
  PRESS: 0x02,
  TAG: 0x03,
};

function nowMs() {
  return Date.now();
}

function encodeJoin(roomId) {
  const buf = new Uint8Array(5);
  buf[0] = OPCODE.JOIN;
  new DataView(buf.buffer).setUint32(1, roomId >>> 0, false);
  return buf;
}

function encodePress(n) {
  const buf = new Uint8Array(2);
  buf[0] = OPCODE.PRESS;
  buf[1] = n & 0xff;
  return buf;
}

function encodeTag(tag) {
  const buf = new Uint8Array(2);
  buf[0] = OPCODE.TAG;
  buf[1] = tag & 0xff;
  return buf;
}

function decodeDiffFrames(buf, onDiff) {
  if (buf.length < 1 || buf[0] !== OPCODE.DIFF) return false;
  if (buf.length % 3 !== 0) return true;
  for (let off = 0; off < buf.length; off += 3) {
    if (buf[off] !== OPCODE.DIFF) return true;
    const n = buf[off + 1];
    const v = buf[off + 2] ? 1 : 0;
    onDiff(n, v);
  }
  return true;
}

function isFull(buf) {
  return buf.length === 5 && buf[0] === OPCODE.FULL;
}
function isError(buf) {
  return buf.length === 2 && buf[0] === OPCODE.ERROR;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

async function runWorker(args) {
  const sockets = [];
  const normalLeaderWsByRoom = [];
  const slowLeaderWsByRoom = [];
  const lastPressTsNormal = new Map();
  const lastPressTsSlow = new Map();
  const lastPressTsSpam = new Map();
  const spammerWsByRoom = [];

  let pressesSent = 0;
  let diffsRecv = 0;
  const normalRTT = [];
  const slowRTT = [];
  const spamRTT = [];
  const freezeRTT = [];
  const latsByRoom = new Map(); // normal leader only: roomId -> number[]

  const slowPerRoom = Math.max(0, Math.min(args.slowRecvPerRoom ?? 0, args.clientsPerRoom));
  const freezePerRoom = Math.max(0, Math.min(args.freezeRecvPerRoom ?? 0, args.clientsPerRoom));
  const spamRoomsPct = Math.max(0, Math.min(args.spamRoomsPct ?? 0, 100));
  const spamEveryMs = Math.max(1, Math.min(args.spamPressEveryMs ?? 10, 1000));

  let created = 0;
  for (let i = 0; i < args.roomIds.length; i++) {
    const roomId = args.roomIds[i] >>> 0;
    const spamRoom = (Math.random() * 100) < spamRoomsPct;
    for (let j = 0; j < args.clientsPerRoom; j++) {
      const ws = new WebSocket(args.url, { perMessageDeflate: false });
      sockets.push(ws);
      // Prevent unhandled error from killing the worker
      ws.on('error', () => {});
      ws.on('open', () => ws.send(encodeJoin(roomId), { binary: true }));

      // Client types:
      // - freezeRecv: never read from socket => server backpressure forced
      // - slowRecv: pause socket for 50-200ms on each message => bandwidth limit
      const isFreeze = j < freezePerRoom;
      const isSlow = !isFreeze && j < (freezePerRoom + slowPerRoom);
      const isCandidateNormal = !isFreeze && !isSlow;

      if (isFreeze) {
        ws.on('open', () => {
          ws.send(encodeTag(2), { binary: true });
          try {
            ws._socket?.pause?.();
          } catch {
            // ignore
          }
        });
      } else if (isSlow) {
        ws.on('open', () => ws.send(encodeTag(1), { binary: true }));
        ws.on('message', () => {
          try {
            ws._socket?.pause?.();
          } catch {
            // ignore
          }
          const wait = 50 + ((Math.random() * 150) | 0);
          globalThis.setTimeout(() => {
            try {
              ws._socket?.resume?.();
            } catch {
              // ignore
            }
          }, wait);
        });
      }

      // Normal decode path (including leaders) still runs; for slow clients we still decode but the socket is throttled.
      ws.on('message', (data) => {
        if (typeof data === 'string') return;
        const buf = data instanceof Buffer ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data);
        const handledDiff = decodeDiffFrames(buf, () => {
          diffsRecv++;
          if (ws === normalLeaderWsByRoom[i]) {
            const t0 = lastPressTsNormal.get(roomId);
            if (t0) {
              const dt = nowMs() - t0;
              normalRTT.push(dt);
              let arr = latsByRoom.get(roomId);
              if (!arr) {
                arr = [];
                latsByRoom.set(roomId, arr);
              }
              arr.push(dt);
            }
          } else if (ws === slowLeaderWsByRoom[i]) {
            const t0 = lastPressTsSlow.get(roomId);
            if (t0) slowRTT.push(nowMs() - t0);
          } else if (ws === spammerWsByRoom[i]) {
            const t0 = lastPressTsSpam.get(roomId);
            if (t0) spamRTT.push(nowMs() - t0);
          }
        });
        if (handledDiff) return;
        if (isFull(buf)) return;
        if (isError(buf)) return;
      });

      if (isSlow && !slowLeaderWsByRoom[i]) slowLeaderWsByRoom[i] = ws;

      // Spammer: choose one normal client (non-freeze/slow) per spam room
      if (spamRoom && !spammerWsByRoom[i] && isCandidateNormal) {
        spammerWsByRoom[i] = ws;
        ws.on('open', () => ws.send(encodeTag(3), { binary: true }));
      }

      // normal leader: strictly normal, not spammer
      if (!normalLeaderWsByRoom[i] && isCandidateNormal && ws !== spammerWsByRoom[i]) {
        normalLeaderWsByRoom[i] = ws;
      }

      // Throttle connection bursts to reduce SYN backlog/ECONNREFUSED spikes
      created++;
      if (created % 100 === 0) await delay(5);
    }
  }

  await delay(2000);
  if (args.warmupSec > 0) await delay(args.warmupSec * 1000);

  const stopAt = nowMs() + args.durationSec * 1000;
  let lastSpam = 0;
  while (nowMs() < stopAt) {
    const tNow = nowMs();
    for (let i = 0; i < args.roomIds.length; i++) {
      const roomId = args.roomIds[i] >>> 0;
      const ws = normalLeaderWsByRoom[i];
      if (ws && ws.readyState === ws.OPEN) {
        const n = 1 + ((Math.random() * 30) | 0);
        lastPressTsNormal.set(roomId, nowMs());
        ws.send(encodePress(n), { binary: true });
        pressesSent++;
      }

      const sws = slowLeaderWsByRoom[i];
      if (sws && sws.readyState === sws.OPEN) {
        const n = 1 + ((Math.random() * 30) | 0);
        lastPressTsSlow.set(roomId, nowMs());
        sws.send(encodePress(n), { binary: true });
      }
    }

    if (tNow - lastSpam >= spamEveryMs) {
      lastSpam = tNow;
      for (let i = 0; i < args.roomIds.length; i++) {
        const ws = spammerWsByRoom[i];
        if (!ws || ws.readyState !== ws.OPEN) continue;
        const n = 1 + ((Math.random() * 30) | 0);
        lastPressTsSpam.set(args.roomIds[i] >>> 0, nowMs());
        ws.send(encodePress(n), { binary: true });
      }
    }

    await delay(args.pressEveryMs);
  }

  for (const ws of sockets) {
    try {
      ws.close();
    } catch {
      // ignore
    }
  }

  normalRTT.sort((a, b) => a - b);
  slowRTT.sort((a, b) => a - b);
  spamRTT.sort((a, b) => a - b);
  freezeRTT.sort((a, b) => a - b);
  const roomStats = {};
  for (const [rid, arr] of latsByRoom.entries()) {
    arr.sort((a, b) => a - b);
    roomStats[rid] = {
      samples: arr.length,
      p50: percentile(arr, 50),
      p90: percentile(arr, 90),
      p99: percentile(arr, 99),
    };
  }
  return {
    pressesSent,
    diffsRecv,
    samples: normalRTT.length,
    p50: percentile(normalRTT, 50),
    p90: percentile(normalRTT, 90),
    p99: percentile(normalRTT, 99),
    roomStats,
    rtt: {
      normal: { samples: normalRTT.length, p50: percentile(normalRTT, 50), p90: percentile(normalRTT, 90), p99: percentile(normalRTT, 99) },
      slow: { samples: slowRTT.length, p50: percentile(slowRTT, 50), p90: percentile(slowRTT, 90), p99: percentile(slowRTT, 99) },
      freeze: { samples: freezeRTT.length, p50: percentile(freezeRTT, 50), p90: percentile(freezeRTT, 90), p99: percentile(freezeRTT, 99) },
      spam: { samples: spamRTT.length, p50: percentile(spamRTT, 50), p90: percentile(spamRTT, 90), p99: percentile(spamRTT, 99) },
    },
    inject: {
      slowRecv: slowPerRoom * args.roomIds.length,
      freezeRecv: freezePerRoom * args.roomIds.length,
      spamRooms: spammerWsByRoom.filter(Boolean).length,
      spamPressEveryMs: spamEveryMs,
    },
  };
}

async function main() {
  const raw = process.argv[2];
  if (!raw) throw new Error('missing args json');
  const args = JSON.parse(raw);
  const res = await runWorker(args);
  process.stdout.write(JSON.stringify(res));
}

main().catch((e) => {
  process.stderr.write(String(e?.stack ?? e) + '\n');
  process.exitCode = 1;
});

