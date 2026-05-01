/* global Buffer, process */
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';

const OPCODE = {
  // c -> s
  JOIN: 0x00,
  PRESS: 0x10,
  // s -> c
  FULL: 0x01,
  DIFF: 0x02,
  ERROR: 0x7f,
};

function nowMs() {
  return Date.now();
}

function encodeJoin(roomId) {
  const b = new Uint8Array(5);
  b[0] = OPCODE.JOIN;
  new DataView(b.buffer).setUint32(1, roomId >>> 0, false);
  return b;
}

function encodePress(idx) {
  const b = new Uint8Array(3);
  b[0] = OPCODE.PRESS;
  new DataView(b.buffer).setUint16(1, idx & 0xffff, false);
  return b;
}

function decodeDiffFrames(buf, onDiff) {
  if (buf.length < 1 || buf[0] !== OPCODE.DIFF) return false;
  // [0x02, idx u16, v u8, verdict u8] repeated => chunk 5
  if ((buf.length - 1) % 5 !== 0) return true;
  for (let off = 1; off + 4 < buf.length; off += 5) {
    const dv = new DataView(buf.buffer, buf.byteOffset + off, 5);
    const idx = dv.getUint16(0, false);
    const v = buf[off + 2] ?? 0;
    const verdict = buf[off + 3] ?? 0;
    onDiff(idx, v, verdict);
  }
  return true;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[idx] ?? 0;
}

function randInt(min, max) {
  // inclusive
  return min + ((Math.random() * (max - min + 1)) | 0);
}

async function runWorker(args) {
  const sockets = [];
  const states = new Map(); // ws -> { type, pendingIdx, pendingTs, nextPressAt }
  let connects = 0;
  let opens = 0;
  let disconnects = 0;
  let errors = 0;

  let pressesSent = 0;
  let diffsRecv = 0;

  const rttNormal = [];
  const rttSlow = [];
  const rttSpam = [];

  const normalPerRoom = Math.max(0, Math.min(args.normalPerRoom ?? 26, args.clientsPerRoom));
  const slowPerRoom = Math.max(0, Math.min(args.slowPerRoom ?? 2, args.clientsPerRoom));
  const freezePerRoom = Math.max(0, Math.min(args.freezePerRoom ?? 1, args.clientsPerRoom));
  const spamPerRoom = Math.max(0, Math.min(args.spamPerRoom ?? 1, args.clientsPerRoom));
  const freezeRecv = !!args.freezeRecv;

  const normMin = Math.max(200, args.normalPressMinMs ?? 1000);
  const normMax = Math.max(normMin, args.normalPressMaxMs ?? 2000);
  const slowMin = Math.max(1000, args.slowPressMinMs ?? 5000);
  const slowMax = Math.max(slowMin, args.slowPressMaxMs ?? 10000);
  const spamMin = Math.max(20, args.spamPressMinMs ?? 100);
  const spamMax = Math.max(spamMin, args.spamPressMaxMs ?? 200);

  let created = 0;
  for (let i = 0; i < args.roomIds.length; i++) {
    const roomId = args.roomIds[i] >>> 0;
    for (let j = 0; j < args.clientsPerRoom; j++) {
      const type =
        j < spamPerRoom
          ? 'spam'
          : j < spamPerRoom + freezePerRoom
            ? 'freeze'
            : j < spamPerRoom + freezePerRoom + slowPerRoom
              ? 'slow'
              : 'normal';

      const ws = new WebSocket(args.url, { perMessageDeflate: false });
      sockets.push(ws);
      states.set(ws, { type, pendingIdx: -1, pendingTs: 0, nextPressAt: 0 });
      connects++;

      ws.on('error', () => {
        errors++;
      });
      ws.on('open', () => {
        opens++;
        ws.send(encodeJoin(roomId), { binary: true });
        if (type === 'freeze' && freezeRecv) {
          try {
            ws._socket?.pause?.();
          } catch {
            // ignore
          }
        }
      });

      ws.on('close', () => {
        disconnects++;
      });

      ws.on('message', (data) => {
        if (typeof data === 'string') return;
        const buf = data instanceof Buffer ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data);

        const handled = decodeDiffFrames(buf, (idx) => {
          diffsRecv++;
          const st = states.get(ws);
          if (!st) return;
          if (st.pendingIdx === idx && st.pendingTs) {
            const dt = nowMs() - st.pendingTs;
            st.pendingIdx = -1;
            st.pendingTs = 0;
            if (st.type === 'normal') rttNormal.push(dt);
            else if (st.type === 'slow') rttSlow.push(dt);
            else if (st.type === 'spam') rttSpam.push(dt);
          }
        });
        if (handled) return;
        // full/error are ignored for RTT (full is large but rare)
      });

      created++;
      if (created % 100 === 0) await delay(5);
    }
  }

  // settle + warmup
  await delay(2000);
  // wait a bit more if nothing connected yet
  const openDeadline = nowMs() + 10_000;
  while (opens === 0 && nowMs() < openDeadline) await delay(250);
  if (args.warmupSec > 0) await delay(args.warmupSec * 1000);

  const stopAt = nowMs() + args.durationSec * 1000;
  while (nowMs() < stopAt) {
    const t = nowMs();
    for (const ws of sockets) {
      const st = states.get(ws);
      if (!st) continue;
      if (ws.readyState !== WebSocket.OPEN) continue;

      if (st.type === 'freeze') continue;

      if (st.nextPressAt === 0) st.nextPressAt = t + randInt(0, 1000);
      if (t < st.nextPressAt) continue;

      const idx = (Math.random() * 900) | 0;
      st.pendingIdx = idx;
      st.pendingTs = t;
      ws.send(encodePress(idx), { binary: true });
      pressesSent++;

      if (st.type === 'normal') st.nextPressAt = t + randInt(normMin, normMax);
      else if (st.type === 'slow') st.nextPressAt = t + randInt(slowMin, slowMax);
      else if (st.type === 'spam') st.nextPressAt = t + randInt(spamMin, spamMax);
    }
    await delay(25);
  }

  for (const ws of sockets) {
    try {
      ws.close();
    } catch {
      // ignore
    }
  }

  rttNormal.sort((a, b) => a - b);
  rttSlow.sort((a, b) => a - b);
  rttSpam.sort((a, b) => a - b);

  const pack = (arr) => ({
    samples: arr.length,
    p50: percentile(arr, 50),
    p90: percentile(arr, 90),
    p95: percentile(arr, 95),
    p99: percentile(arr, 99),
  });

  const normalPacked = pack(rttNormal);
  return {
    pressesSent,
    diffsRecv,
    samples: normalPacked.samples,
    p50: normalPacked.p50,
    p90: normalPacked.p90,
    p99: normalPacked.p99,
    connects,
    opens,
    disconnects,
    errors,
    rtt: {
      normal: normalPacked,
      slow: pack(rttSlow),
      spam: pack(rttSpam),
      freeze: { samples: 0, p50: 0, p90: 0, p95: 0, p99: 0 },
    },
    scenario: {
      normalPerRoom,
      slowPerRoom,
      freezePerRoom,
      spamPerRoom,
      normalPressMs: [normMin, normMax],
      slowPressMs: [slowMin, slowMax],
      spamPressMs: [spamMin, spamMax],
      freezeRecv: !!freezeRecv,
    },
  };
}

async function main() {
  const raw = process.argv[2];
  if (!raw) throw new Error('missing args');
  const args = JSON.parse(raw);
  const out = await runWorker(args);
  process.stdout.write(JSON.stringify(out));
}

main().catch((e) => {
  process.stderr.write(String(e?.stack ?? e));
  process.exit(1);
});

