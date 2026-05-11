import http from 'node:http';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { WebSocketServer, type WebSocket } from 'ws';
import { hasNgWord } from './ngWords.js';
import type { CreateRoomRequest, CreateRoomResponse } from './protocol.js';
import { ERROR_CODE, OPCODE, encodeError } from './binary.js';
import { clampInt, nowMs, safeJsonParse, sha256Base64Url } from './util.js';
import crypto from 'node:crypto';
import { TextDecoder, TextEncoder } from 'node:util';

type ClientMeta = {
  roomId?: number;
  isAlive: boolean;
  /** 連続して pong が返らなかった回数（プロキシ越し WS でも切られにくくする） */
  pingMiss: number;
};

type Room = {
  id: number;
  passwordHash: string;
  createdAt: number;
  lastActiveAt: number;
  mask: number; // 30bit
  clients: Set<WebSocket>;
  disconnectCount: number; // backpressure disconnects
  lastPressAt: number;
  lastNormalPressAt: number;
  normalRttBuf: number[]; // recent press->flush ms (normal clients only)

  // diff batching
  pendingBits: number; // 30bit; set when number changed within current tick
  diffBufA: Uint8Array; // 90 bytes (3 * 30)
  diffBufB: Uint8Array;
  diffViewsA: Uint8Array[]; // index=k => view length 3*k
  diffViewsB: Uint8Array[];
  useA: boolean;
  fullBufA: Uint8Array; // 5 bytes
  fullBufB: Uint8Array;
  useFullA: boolean;
};

const PORT = Number(process.env.PORT ?? 8080);
const WS_PATH = process.env.WS_PATH ?? '/ws';
const PLAY_WS_PATH = process.env.PLAY_WS_PATH ?? '/playws';
const MAX_ROOMS = clampInt(Number(process.env.MAX_ROOMS ?? 100), 1, 1000);
const ROOM_CAPACITY = 30;
const CLEANUP_IDLE_MS = clampInt(Number(process.env.CLEANUP_IDLE_MS ?? 15 * 60_000), 60_000, 24 * 60 * 60_000);
const DIFF_TICK_MS = clampInt(Number(process.env.DIFF_TICK_MS ?? 5), 1, 50);
const WS_PING_MS = clampInt(Number(process.env.WS_PING_MS ?? 45_000), 15_000, 120_000);
const WS_PING_MAX_MISS = clampInt(Number(process.env.WS_PING_MAX_MISS ?? 4), 2, 12);

// /play (900bit) config
const PLAY_SIZE = 30;
const PLAY_CELLS = PLAY_SIZE * PLAY_SIZE; // 900
const PLAY_BITS_BYTES = Math.ceil(PLAY_CELLS / 8); // 113
const PLAY_ROOM_CAPACITY = 30;

const utf8 = new TextEncoder();
const utf8dec = new TextDecoder('utf-8');

const PLAY_PROBLEMS = ['さくら', 'ねこ', 'はな', 'やま', 'うみ', 'ひこうき', 'ふうせん', 'おにぎり', 'ひまわり', 'ほし'];
const HIRAGANA = Array.from('あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわん');

/** 8方向: 0=↖ … 7=↘（dir 0–7） */
const PLAY_DIRS8: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

type PlayClient = {
  ws: WebSocket;
  roomId?: number;
  isAlive: boolean;
  pingMiss: number;
  tag: 0 | 1 | 2 | 3; // 0 normal, 1 slow, 2 freeze, 3 spam
};

/** 埋め込み語の開始セル・8方向(0–7)・長さ */
export type WordPatternSpec = { start: number; dir: number; len: number };

type PlayWordPattern = {
  word: string;
  spec: WordPatternSpec;
  idxs: number[]; // indices in 0..899
};

type PlayRoom = {
  id: number;
  hostKey: Uint8Array; // 16 bytes
  createdAt: number;
  lastActiveAt: number;
  started: boolean;
  revealed: boolean;
  /** 主に埋め込む語（reset 時に再利用） */
  embedWord: string;
  bits: Uint8Array; // 900 bytes 0/1 (pressed)
  packedBitsA: Uint8Array; // 113
  packedBitsB: Uint8Array;
  usePackedA: boolean;
  /** 900文字のひらがな盤面（UTF-16 1コードポイント想定） */
  boardChars: string;
  boardUtf8: Uint8Array; // cached
  solutionBits: Uint8Array; // 900 0/1
  packedSolution: Uint8Array; // 113
  /** 埋め込み語の配置（start + dir0–7 + len） */
  wordPatterns: WordPatternSpec[];
  patterns: PlayWordPattern[];
  completed: boolean[]; // per pattern
  cellToPatterns: number[][]; // 900 -> pattern indices
  clients: Set<WebSocket>;
  /** v: 0/1=押下状態、2=語完成ライン用ハイライト（bits は 1 のまま） */
  pending: Array<{ idx: number; v: 0 | 1 | 2; verdict: 0 | 1 | 2 }>;
  lastNormalPressAt: number;
  diffBufA: Uint8Array;
  diffBufB: Uint8Array;
  useDiffA: boolean;
};

const playRooms = new Map<number, PlayRoom>();
const playClientMeta = new WeakMap<WebSocket, PlayClient>();

function pack900BitsInto(out: Uint8Array, bits900: Uint8Array) {
  out.fill(0);
  for (let i = 0; i < PLAY_CELLS; i++) {
    if (bits900[i] & 1) out[i >> 3] |= 1 << (7 - (i & 7));
  }
}

function normalizePlayEmbedWord(word?: string): string {
  const w = (word ?? '').trim();
  if (w.length >= 1 && w.length <= 12 && /^[ぁ-ゖー]+$/.test(w)) return w;
  return 'さくら';
}

function createPlayRoom(word?: string) {
  let roomId = crypto.randomBytes(4).readUInt32BE(0) >>> 0;
  if (roomId === 0) roomId = 1;
  while (playRooms.has(roomId) || rooms.has(roomId)) {
    roomId = crypto.randomBytes(4).readUInt32BE(0) >>> 0;
    if (roomId === 0) roomId = 1;
  }
  const hostKey = crypto.randomBytes(16);
  const embedWord = normalizePlayEmbedWord(word);
  const letters = Array.from(embedWord);
  const L = letters.length;

  const board = Array.from({ length: PLAY_CELLS }, () => HIRAGANA[(Math.random() * HIRAGANA.length) | 0]!);
  const patterns: PlayWordPattern[] = [];
  const wordPatterns: WordPatternSpec[] = [];

  const tryPlace = (): boolean => {
    if (L < 1) return false;
    for (let t = 0; t < 400; t++) {
      const dir = (Math.random() * 8) | 0;
      const [dr, dc] = PLAY_DIRS8[dir]!;
      const r0 = (Math.random() * PLAY_SIZE) | 0;
      const c0 = (Math.random() * PLAY_SIZE) | 0;
      const rEnd = r0 + dr * (L - 1);
      const cEnd = c0 + dc * (L - 1);
      if (rEnd < 0 || rEnd >= PLAY_SIZE || cEnd < 0 || cEnd >= PLAY_SIZE) continue;
      const idxs: number[] = [];
      for (let i = 0; i < L; i++) {
        const rr = r0 + dr * i;
        const cc = c0 + dc * i;
        idxs.push(rr * PLAY_SIZE + cc);
      }
      const start = idxs[0]!;
      for (let i = 0; i < L; i++) board[idxs[i]!] = letters[i]!;
      wordPatterns.push({ start, dir, len: L });
      patterns.push({ word: embedWord, spec: { start, dir, len: L }, idxs });
      return true;
    }
    return false;
  };

  const targetPlacements = 8 + ((Math.random() * 5) | 0);
  let guard = 0;
  while (patterns.length < targetPlacements && guard++ < 10_000) tryPlace();

  if (patterns.length === 0) {
    // 極端に短い盤などのフォールバック：中央付近で右方向
    const dir = 4; // (0,1)
    const [dr, dc] = PLAY_DIRS8[dir]!;
    const r0 = (PLAY_SIZE / 2) | 0;
    const c0 = Math.max(0, Math.min(PLAY_SIZE - L, ((PLAY_SIZE - L) / 2) | 0));
    const idxs: number[] = [];
    for (let i = 0; i < L; i++) idxs.push((r0 + dr * i) * PLAY_SIZE + (c0 + dc * i));
    const start = idxs[0]!;
    for (let i = 0; i < L; i++) board[idxs[i]!] = letters[i]!;
    wordPatterns.push({ start, dir, len: L });
    patterns.push({ word: embedWord, spec: { start, dir, len: L }, idxs });
  }

  const solution = new Uint8Array(PLAY_CELLS);
  for (const p of patterns) for (const idx of p.idxs) solution[idx] = 1;

  const completed = patterns.map(() => false);
  const cellToPatterns: number[][] = Array.from({ length: PLAY_CELLS }, () => []);
  patterns.forEach((p, pi) => p.idxs.forEach((idx) => cellToPatterns[idx]!.push(pi)));

  const boardChars = board.join('');
  const boardUtf8 = utf8.encode(boardChars);
  const packedSolution = new Uint8Array(PLAY_BITS_BYTES);
  pack900BitsInto(packedSolution, solution);

  const room: PlayRoom = {
    id: roomId,
    hostKey: new Uint8Array(hostKey),
    createdAt: nowMs(),
    lastActiveAt: nowMs(),
    started: false,
    revealed: false,
    embedWord,
    bits: new Uint8Array(PLAY_CELLS),
    packedBitsA: new Uint8Array(PLAY_BITS_BYTES),
    packedBitsB: new Uint8Array(PLAY_BITS_BYTES),
    usePackedA: true,
    boardChars,
    boardUtf8,
    solutionBits: solution,
    packedSolution,
    wordPatterns,
    patterns,
    completed,
    cellToPatterns,
    clients: new Set(),
    pending: [],
    lastNormalPressAt: 0,
    diffBufA: new Uint8Array(1 + 5 * 512),
    diffBufB: new Uint8Array(1 + 5 * 512),
    useDiffA: true,
  };
  playRooms.set(roomId, room);
  return { roomId, hostKey: hostKey.toString('base64url') };
}

function playFullFrame(room: PlayRoom): Uint8Array {
  const packed = room.usePackedA ? room.packedBitsA : room.packedBitsB;
  room.usePackedA = !room.usePackedA;
  pack900BitsInto(packed, room.bits);

  const boardLen = room.boardUtf8.byteLength;
  const extra = 1 + 1 + 2 + PLAY_BITS_BYTES + 2 + boardLen + (room.revealed ? PLAY_BITS_BYTES : 0);
  const out = new Uint8Array(1 + extra);
  out[0] = 0x01;
  out[1] = room.started ? 1 : 0;
  out[2] = room.revealed ? 1 : 0;
  const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
  dv.setUint16(3, room.clients.size, false);
  out.set(packed, 5);
  dv.setUint16(5 + PLAY_BITS_BYTES, boardLen, false);
  out.set(room.boardUtf8, 7 + PLAY_BITS_BYTES);
  if (room.revealed) out.set(room.packedSolution, 7 + PLAY_BITS_BYTES + boardLen);
  return out;
}

function playBroadcast(room: PlayRoom, payload: Uint8Array) {
  for (const ws of room.clients) {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(payload, { binary: true });
      } catch {}
    }
  }
}

function playFlushRoom(room: PlayRoom) {
  if (room.pending.length === 0) return;
  if (room.lastNormalPressAt) {
    const dt = nowMs() - room.lastNormalPressAt;
    playPressToFlushSamples.push(dt);
    room.lastNormalPressAt = 0;
  }
  const buf = room.useDiffA ? room.diffBufA : room.diffBufB;
  room.useDiffA = !room.useDiffA;
  buf[0] = 0x02;
  let k = 0;
  for (const d of room.pending) {
    const off = 1 + 5 * k;
    const dv = new DataView(buf.buffer, buf.byteOffset + off, 5);
    dv.setUint16(0, d.idx, false);
    buf[off + 2] = d.v;
    buf[off + 3] = d.verdict;
    k++;
    if (k >= 512) break;
  }
  room.pending.length = 0;
  playBroadcast(room, buf.subarray(0, 1 + 5 * k));
}

function tuneDefaults(mode: string) {
  const m = (mode ?? 'standard').toLowerCase();
  if (m === 'strict') return { maxBuffered: 1024, maxConsecutive: 3, mode: 'strict' as const };
  if (m === 'lenient') return { maxBuffered: 256 * 1024, maxConsecutive: 10, mode: 'lenient' as const };
  return { maxBuffered: 64 * 1024, maxConsecutive: 5, mode: 'standard' as const };
}

let tuneMode = (process.env.TUNE ?? 'standard').toLowerCase();
const initial = tuneDefaults(tuneMode);
let maxBufferedAmount = clampInt(Number(process.env.MAX_BUFFERED_AMOUNT ?? initial.maxBuffered), 256, 1024 * 1024);
let backpressureMaxConsecutive = clampInt(
  Number(process.env.BACKPRESSURE_MAX_CONSECUTIVE ?? initial.maxConsecutive),
  1,
  100
);

// Debug/experiment: repeat diff frames to amplify outbound traffic without changing protocol.
// 1 = normal. Larger values help reproduce backpressure isolation in tests.
const DIFF_REPEAT_MAX = 20;
let diffRepeat = clampInt(Number(process.env.DIFF_REPEAT ?? 1), 1, DIFF_REPEAT_MAX);

const rooms = new Map<number, Room>();
const clientMeta = new WeakMap<WebSocket, ClientMeta>();
const bpConsecutive = new WeakMap<WebSocket, number>();
const clientTag = new WeakMap<WebSocket, 0 | 1 | 2 | 3>(); // 1=slow,2=freeze,3=spam (loadtest only)

let globalDisconnectCount = 0;

const loopDelay = monitorEventLoopDelay({ resolution: 10 });
loopDelay.enable();
loopDelay.reset();

let pressToFlushSamples: number[] = [];
let pressToFlushP50Ms = 0;
let pressToFlushP90Ms = 0;
let pressToFlushP99Ms = 0;

// /play metrics (server-side press->flush proxy + connections)
let playPressToFlushSamples: number[] = [];
let playRttP50Ms = 0;
let playRttP95Ms = 0;
let playRttP99Ms = 0;
let playConnections = 0; // active WS connections (not necessarily joined)
let playDisconnects = 0;
let playErrors = 0;

let lastMetrics: {
  at: number;
  rooms: number;
  eldMs: { p50: number; p90: number; p99: number };
  mem: { rss: number; heapUsed: number; external: number };
} = {
  at: nowMs(),
  rooms: 0,
  eldMs: { p50: 0, p90: 0, p99: 0 },
  mem: { rss: 0, heapUsed: 0, external: 0 },
};

let healthzCachedBody =
  '{"ok":1,"r":0,"t":0,"tm":"standard","e":[0,0,0],"m":[0,0,0],"dc":0,"bp":[0,0,0],"nr":[0,0,0]}';
let healthzCachedKvBody = '';

function getEldMs() {
  // monitorEventLoopDelay values are in nanoseconds
  return {
    p50: Number(loopDelay.percentile(50) / 1e6),
    p90: Number(loopDelay.percentile(90) / 1e6),
    p99: Number(loopDelay.percentile(99) / 1e6),
  };
}

function getEldMsP95() {
  return {
    p50: Number(loopDelay.percentile(50) / 1e6),
    p95: Number(loopDelay.percentile(95) / 1e6),
    p99: Number(loopDelay.percentile(99) / 1e6),
  };
}

function getMem() {
  const mem = process.memoryUsage();
  return {
    rss: mem.rss,
    heapUsed: mem.heapUsed,
    external: mem.external,
  };
}

function okJson(res: http.ServerResponse, status: number, obj: unknown) {
  const body = JSON.stringify(obj);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('content-length', Buffer.byteLength(body));
  res.end(body);
}

function okJsonCached(res: http.ServerResponse, status: number, body: string) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('content-length', Buffer.byteLength(body));
  res.end(body);
}

function okTextCached(res: http.ServerResponse, status: number, body: string) {
  res.statusCode = status;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.setHeader('content-length', Buffer.byteLength(body));
  res.end(body);
}

function badJson(res: http.ServerResponse, status: number, code: string, message?: string) {
  okJson(res, status, { error: { code, message } });
}

function getRoomOrUndefined(roomId: number): Room | undefined {
  return rooms.get(roomId);
}

/** サンジュー30マスルームのバッファ初期化込みオブジェクトを作る（create と dev seed 共通） */
function buildSanjuuRoom(id: number, passwordPlain: string): Room {
  const room: Room = {
    id,
    passwordHash: sha256Base64Url(passwordPlain),
    createdAt: nowMs(),
    lastActiveAt: nowMs(),
    mask: 0,
    clients: new Set(),
    disconnectCount: 0,
    lastPressAt: 0,
    lastNormalPressAt: 0,
    normalRttBuf: [],

    pendingBits: 0,
    diffBufA: new Uint8Array(3 * 30 * DIFF_REPEAT_MAX),
    diffBufB: new Uint8Array(3 * 30 * DIFF_REPEAT_MAX),
    diffViewsA: [],
    diffViewsB: [],
    useA: true,
    fullBufA: new Uint8Array(5),
    fullBufB: new Uint8Array(5),
    useFullA: true,
  };
  room.diffViewsA[0] = room.diffBufA.subarray(0, 0);
  room.diffViewsB[0] = room.diffBufB.subarray(0, 0);
  for (let k = 1; k <= 30; k++) {
    room.diffViewsA[k] = room.diffBufA.subarray(0, 3 * k * DIFF_REPEAT_MAX);
    room.diffViewsB[k] = room.diffBufB.subarray(0, 3 * k * DIFF_REPEAT_MAX);
  }
  return room;
}

/** トップの「例の参加ページ」/r/demo が即接続できるよう、非本番のみ固定ルームを用意 */
function seedDevDemoRoom() {
  if (process.env.NODE_ENV === 'production') return;
  const slug = 'demo';
  const id = Number.parseInt(slug, 36) >>> 0;
  if (id === 0 || rooms.has(id)) return;
  rooms.set(id, buildSanjuuRoom(id, 'demo'));
  console.log(`[sanjuu-ws] dev: seeded /r/${slug} (id=${id})`);
}

function createRoom(req: CreateRoomRequest): CreateRoomResponse | { error: { code: string; message?: string } } {
  if (rooms.size >= MAX_ROOMS) return { error: { code: 'rooms_limit' } };
  const password = String(req.password ?? '');
  if (password.length < 1 || password.length > 64) return { error: { code: 'bad_password' } };
  if (req.roomName && hasNgWord(req.roomName)) return { error: { code: 'ng_word' } };

  // roomId: uint32 (URLはbase36)
  let roomId = crypto.randomBytes(4).readUInt32BE(0) >>> 0;
  if (roomId === 0) roomId = 1;
  while (rooms.has(roomId)) {
    roomId = crypto.randomBytes(4).readUInt32BE(0) >>> 0;
    if (roomId === 0) roomId = 1;
  }

  rooms.set(roomId, buildSanjuuRoom(roomId, password));
  return { roomId: roomId.toString(10), joinUrlPath: `/r/${roomId.toString(36)}` };
}

function send(ws: WebSocket, bytes: Uint8Array) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(bytes, { binary: true });
}

function writeFullInto(buf: Uint8Array, mask: number) {
  buf[0] = OPCODE.FULL;
  new DataView(buf.buffer, buf.byteOffset, buf.byteLength).setUint32(1, mask >>> 0, false);
}

const ERROR_FRAMES: Record<number, Uint8Array> = {
  [ERROR_CODE.BAD_MSG]: encodeError(ERROR_CODE.BAD_MSG),
  [ERROR_CODE.NO_ROOM]: encodeError(ERROR_CODE.NO_ROOM),
  [ERROR_CODE.FULL]: encodeError(ERROR_CODE.FULL),
  [ERROR_CODE.NOT_JOINED]: encodeError(ERROR_CODE.NOT_JOINED),
  [ERROR_CODE.BAD_N]: encodeError(ERROR_CODE.BAD_N),
};

function sendErr(ws: WebSocket, code: number) {
  const frame = ERROR_FRAMES[code] ?? ERROR_FRAMES[ERROR_CODE.BAD_MSG]!;
  send(ws, frame);
}

function noteBackpressure(ws: WebSocket, room: Room): boolean {
  const next = (bpConsecutive.get(ws) ?? 0) + 1;
  bpConsecutive.set(ws, next);
  if (next >= backpressureMaxConsecutive) {
    globalDisconnectCount++;
    room.disconnectCount++;
    room.clients.delete(ws);
    try {
      ws.terminate();
    } catch {}
    return true;
  }
  return false;
}

function clearBackpressure(ws: WebSocket) {
  if (bpConsecutive.get(ws)) bpConsecutive.set(ws, 0);
}

function bufferedAmount(ws: WebSocket): number {
  const anyWs = ws as any;
  const sock = anyWs?._socket;
  const wl = typeof sock?.writableLength === 'number' ? sock.writableLength : 0;
  const ba = typeof (ws as any).bufferedAmount === 'number' ? (ws as any).bufferedAmount : 0;
  return Math.max(ba, wl);
}

function effectiveMaxBuffered(ws: WebSocket): number {
  const tag = clientTag.get(ws) ?? 0;
  if (tag === 2) return 0; // freeze handled explicitly
  if (tag === 1) return Math.max(256, Math.floor(maxBufferedAmount / 8)); // slow => stricter
  return maxBufferedAmount;
}

function flushRoomDiffs(room: Room) {
  const bits = room.pendingBits >>> 0;
  if (bits === 0) return;
  room.pendingBits = 0;

  // normalRTT proxy: only presses from normal-tagged clients (tag=0)
  if (room.lastNormalPressAt) {
    const dt = nowMs() - room.lastNormalPressAt;
    pressToFlushSamples.push(dt);
    room.normalRttBuf.push(dt);
    if (room.normalRttBuf.length > 120) room.normalRttBuf.splice(0, room.normalRttBuf.length - 120);
    room.lastNormalPressAt = 0;
  }
  room.lastPressAt = 0;

  const outBuf = room.useA ? room.diffBufA : room.diffBufB;
  const views = room.useA ? room.diffViewsA : room.diffViewsB;
  room.useA = !room.useA;

  // encode DIFF frames into outBuf: [0x11, n, v] repeated
  let k = 0;
  for (let n = 1; n <= 30; n++) {
    const bit = 1 << (n - 1);
    if ((bits & bit) === 0) continue;
    const v: 0 | 1 = (room.mask & bit) !== 0 ? 1 : 0;
    const off = 3 * k;
    outBuf[off] = OPCODE.DIFF;
    outBuf[off + 1] = n;
    outBuf[off + 2] = v;
    k++;
  }
  const baseLen = 3 * k;
  // Repeat encoded diffs to increase outbound payload for experiments.
  // Still valid protocol because it's just multiple DIFF frames concatenated.
  for (let rep = 1; rep < diffRepeat; rep++) {
    outBuf.set(outBuf.subarray(0, baseLen), rep * baseLen);
  }
  const payload = views[k]!.subarray(0, baseLen * diffRepeat);

  for (const ws of room.clients) {
    if (ws.readyState !== ws.OPEN) continue;
    if ((clientTag.get(ws) ?? 0) === 2) {
      // freeze client: always backpressured in experiments
      noteBackpressure(ws, room);
      continue;
    }
    if (bufferedAmount(ws) > effectiveMaxBuffered(ws)) {
      // backpressure: drop diffs for this client; it will catch up on later diffs / reconnect-full
      noteBackpressure(ws, room);
      continue;
    }
    clearBackpressure(ws);
    try {
      ws.send(payload, { binary: true });
    } catch {}
  }
}

function sendFull(ws: WebSocket, room: Room) {
  // full is never dropped; if client is persistently backpressured, disconnect it.
  const buf = room.useFullA ? room.fullBufA : room.fullBufB;
  room.useFullA = !room.useFullA;
  writeFullInto(buf, room.mask);
  try {
    ws.send(buf, { binary: true });
  } catch {}
  if ((clientTag.get(ws) ?? 0) === 2) {
    noteBackpressure(ws, room);
    return;
  }
  if (bufferedAmount(ws) > effectiveMaxBuffered(ws)) {
    noteBackpressure(ws, room);
  } else {
    clearBackpressure(ws);
  }
}

function join(ws: WebSocket, roomId: number) {
  const room = getRoomOrUndefined(roomId);
  if (!room) return sendErr(ws, ERROR_CODE.NO_ROOM);

  // already in room
  const meta = clientMeta.get(ws);
  if (!meta) return;
  if (meta.roomId === roomId) {
    return sendFull(ws, room);
  }

  if (room.clients.size >= ROOM_CAPACITY) return sendErr(ws, ERROR_CODE.FULL);

  // leave previous
  if (meta.roomId) {
    const prev = rooms.get(meta.roomId);
    prev?.clients.delete(ws);
  }

  meta.roomId = roomId;
  room.clients.add(ws);
  room.lastActiveAt = nowMs();
  sendFull(ws, room);
}

function press(ws: WebSocket, n: number) {
  const meta = clientMeta.get(ws);
  const roomId = meta?.roomId;
  if (!roomId) return sendErr(ws, ERROR_CODE.NOT_JOINED);
  const room = rooms.get(roomId);
  if (!room) return sendErr(ws, ERROR_CODE.NO_ROOM);
  if (n < 1 || n > 30) return sendErr(ws, ERROR_CODE.BAD_N);

  const bit = 1 << (n - 1);
  const nextMask = room.mask ^ bit;
  room.mask = nextMask;
  room.lastActiveAt = nowMs();
  room.lastPressAt = room.lastActiveAt;
  if ((clientTag.get(ws) ?? 0) === 0) {
    room.lastNormalPressAt = room.lastActiveAt;
  }

  // batch diffs per-room; multiple presses in same tick become "latest state"
  room.pendingBits |= bit;
}

const server = http.createServer((req, res) => {
  // 超軽量: RESTは「ルーム作成」だけ（初回のみ）
  const origin = String(req.headers.origin ?? '');
  const allowList = new Set(
    String(process.env.CORS_ALLOW_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
  // defaults: local dev + production frontends
  allowList.add('http://localhost:3000');
  allowList.add('http://127.0.0.1:3000');
  allowList.add('http://localhost:3001');
  allowList.add('http://127.0.0.1:3001');
  allowList.add('http://localhost:5173');
  allowList.add('http://localhost:8080');
  allowList.add('http://127.0.0.1:8080');
  allowList.add('https://rakuda.coffee');
  allowList.add('https://rakuda.coffee/');
  allowList.add('https://sanjuu.vercel.app');
  allowList.add('https://sanjuu.vercel.app/');

  const allowOrigin = allowList.has(origin) ? origin : '*';
  res.setHeader('access-control-allow-origin', allowOrigin);
  res.setHeader('vary', 'origin');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // dev only: reset rooms for loadtest iterations
  if (req.method === 'POST' && req.url === '/api/dev/reset') {
    if (process.env.NODE_ENV === 'production') return badJson(res, 403, 'forbidden');
    rooms.clear();
    globalDisconnectCount = 0;
    pressToFlushSamples = [];
    pressToFlushP50Ms = 0;
    pressToFlushP90Ms = 0;
    pressToFlushP99Ms = 0;
    okJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/dev/tune') {
    if (process.env.NODE_ENV === 'production') return badJson(res, 403, 'forbidden');
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const body =
        safeJsonParse<{ mode?: string; maxBufferedAmount?: number; backpressureMaxConsecutive?: number; diffRepeat?: number }>(raw) ?? {};
      if (typeof body.mode === 'string') tuneMode = body.mode;
      const d = tuneDefaults(tuneMode);
      tuneMode = d.mode;
      maxBufferedAmount = clampInt(Number(body.maxBufferedAmount ?? d.maxBuffered), 256, 1024 * 1024);
      backpressureMaxConsecutive = clampInt(Number(body.backpressureMaxConsecutive ?? d.maxConsecutive), 1, 100);
      if (body.diffRepeat != null) diffRepeat = clampInt(Number(body.diffRepeat), 1, DIFF_REPEAT_MAX);
      okJson(res, 200, { ok: true, mode: d.mode, maxBufferedAmount, backpressureMaxConsecutive, diffRepeat });
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/dev/rooms') {
    if (process.env.NODE_ENV === 'production') return badJson(res, 403, 'forbidden');
    const pct = (sorted: number[], p: number) => {
      if (sorted.length === 0) return 0;
      const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
      return sorted[idx] ?? 0;
    };
    const out = Array.from(rooms.values()).map((r) => {
      const sorted = [...r.normalRttBuf].sort((a, b) => a - b);
      return {
        id: r.id,
        clients: r.clients.size,
        dc: r.disconnectCount,
        p: {
          samples: sorted.length,
          p50: pct(sorted, 50),
          p90: pct(sorted, 90),
          p99: pct(sorted, 99),
        },
      };
    });
    okJson(res, 200, { rooms: out, globalDc: globalDisconnectCount });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/dev/play/rooms') {
    if (process.env.NODE_ENV === 'production') return badJson(res, 403, 'forbidden');
    const out = Array.from(playRooms.values()).map((r) => ({ id: r.id, clients: r.clients.size }));
    okJson(res, 200, { rooms: out });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/dev/rooms/kill') {
    if (process.env.NODE_ENV === 'production') return badJson(res, 403, 'forbidden');
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const body = safeJsonParse<{ id?: number }>(raw);
      const id = Number(body?.id);
      if (!Number.isFinite(id)) return badJson(res, 400, 'bad_id');
      const roomId = (id >>> 0) as number;
      const room = rooms.get(roomId);
      if (!room) return badJson(res, 404, 'no_room');
      for (const ws of room.clients) {
        try {
          ws.terminate();
        } catch {}
      }
      rooms.delete(roomId);
      okJson(res, 200, { ok: true, id: roomId });
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/room') {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const body = safeJsonParse<CreateRoomRequest>(raw);
      if (!body) return badJson(res, 400, 'bad_json');
      const out = createRoom(body);
      if ('error' in out) return badJson(res, 400, out.error.code, out.error.message);
      okJson(res, 200, out);
    });
    return;
  }

  // /play: 募集中一覧（連絡帳・ロビー用）
  if (req.method === 'GET' && req.url?.split('?')[0] === '/api/play/rooms') {
    const arr = Array.from(playRooms.values()).map((r) => ({
      roomId: r.id >>> 0,
      embedWord: r.embedWord,
      clientsCount: r.clients.size,
      createdAt: r.createdAt,
      started: r.started,
    }));
    okJson(res, 200, arr);
    return;
  }

  // /play: room creation (returns roomId + hostKey)
  if (req.method === 'POST' && req.url === '/api/play/room') {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const body = safeJsonParse<{ word?: string }>(raw) ?? {};
      const word = typeof body.word === 'string' ? body.word.trim() : '';
      const out = createPlayRoom(word.length ? word : 'さくら');
      okJson(res, 200, { roomId: out.roomId, roomCode: out.roomId.toString(36), hostKey: out.hostKey });
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/play/problems') {
    okJson(res, 200, { problems: PLAY_PROBLEMS });
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/healthz')) {
    // default: JSON (used by /world). Optional: key=value lines for dashboards/log scraping.
    if (req.url.includes('fmt=kv')) return okTextCached(res, 200, healthzCachedKvBody);
    return okJsonCached(res, 200, healthzCachedBody);
  }

  res.statusCode = 404;
  res.end('not found');
});

const wss = new WebSocketServer({
  server,
  path: WS_PATH,
  perMessageDeflate: false,
  clientTracking: false,
});

const playWss = new WebSocketServer({
  server,
  path: PLAY_WS_PATH,
  perMessageDeflate: false,
  clientTracking: false,
});

function playSendError(ws: WebSocket, code: number) {
  // [0x7f, code]
  try {
    const b = new Uint8Array(2);
    b[0] = 0x7f;
    b[1] = code & 0xff;
    ws.send(b, { binary: true });
  } catch {}
  playErrors++;
}

function playAuthOk(room: PlayRoom, key: Uint8Array) {
  if (key.length !== 16) return false;
  // constant time
  let x = 0;
  for (let i = 0; i < 16; i++) x |= room.hostKey[i]! ^ key[i]!;
  return x === 0;
}

function playJoin(ws: WebSocket, roomId: number) {
  const room = playRooms.get(roomId);
  if (!room) return playSendError(ws, 2);
  if (room.clients.size >= PLAY_ROOM_CAPACITY) return playSendError(ws, 3);
  const meta = playClientMeta.get(ws);
  if (!meta) return;
  meta.roomId = roomId;
  room.clients.add(ws);
  room.lastActiveAt = nowMs();
  const full = playFullFrame(room);
  try {
    ws.send(full, { binary: true });
  } catch {}
}

function playPress(ws: WebSocket, idx: number) {
  const meta = playClientMeta.get(ws);
  const roomId = meta?.roomId;
  if (!roomId) return playSendError(ws, 4);
  const room = playRooms.get(roomId);
  if (!room) return playSendError(ws, 2);
  if (idx < 0 || idx >= PLAY_CELLS) return playSendError(ws, 1);

  room.lastActiveAt = nowMs();
  if ((meta?.tag ?? 0) === 0) room.lastNormalPressAt = room.lastActiveAt;
  if (room.bits[idx] === 1) return; // idempotent
  room.bits[idx] = 1;

  const ps = room.cellToPatterns[idx]!;
  const hit = ps.length > 0;
  const completedNow: number[] = [];

  for (const pi of ps) {
    if (room.completed[pi]) continue;
    const pat = room.patterns[pi]!;
    let ok = true;
    for (const c of pat.idxs) {
      if (room.bits[c] !== 1) {
        ok = false;
        break;
      }
    }
    if (ok) {
      room.completed[pi] = true;
      completedNow.push(pi);
    }
  }

  if (completedNow.length) {
    const seen = new Set<number>();
    for (const pi of completedNow) {
      for (const j of room.patterns[pi]!.idxs) {
        if (seen.has(j)) continue;
        seen.add(j);
        room.pending.push({ idx: j, v: 2, verdict: 2 });
      }
    }
  } else {
    const verdict: 0 | 1 = hit ? 1 : 0;
    room.pending.push({ idx, v: 1, verdict });
  }
}

function playHostCommand(ws: WebSocket, op: number, payload: Uint8Array) {
  const meta = playClientMeta.get(ws);
  const roomId = meta?.roomId;
  if (!roomId) return playSendError(ws, 4);
  const room = playRooms.get(roomId);
  if (!room) return playSendError(ws, 2);

  const key = payload.subarray(0, 16);
  if (!playAuthOk(room, key)) return playSendError(ws, 5);

  if (op === 0x11) {
    room.started = true;
    room.lastActiveAt = nowMs();
    return playBroadcast(room, playFullFrame(room));
  }
  if (op === 0x12) {
    room.revealed = true;
    room.lastActiveAt = nowMs();
    return playBroadcast(room, playFullFrame(room));
  }
  if (op === 0x13) {
    // reset: 同じ embedWord で盤面再生成
    const newRoom = createPlayRoom(room.embedWord);
    const next = playRooms.get(newRoom.roomId)!;
    // keep id/hostKey stable by swapping into existing room object
    room.started = false;
    room.revealed = false;
    room.bits.fill(0);
    room.embedWord = next.embedWord;
    room.wordPatterns = next.wordPatterns;
    room.patterns = next.patterns;
    room.completed = next.completed;
    room.cellToPatterns = next.cellToPatterns;
    room.boardChars = next.boardChars;
    room.boardUtf8 = next.boardUtf8;
    room.solutionBits = next.solutionBits;
    room.packedSolution = next.packedSolution;
    playRooms.delete(newRoom.roomId);
    room.lastActiveAt = nowMs();
    return playBroadcast(room, playFullFrame(room));
  }
  if (op === 0x14) {
    const len = payload[16] ?? 0;
    const wordBytes = payload.subarray(17, 17 + len);
    const word = utf8dec.decode(wordBytes).trim();
    if (!/^[ぁ-ゖー]+$/.test(word) || word.length < 1 || word.length > 12) return playSendError(ws, 6);
    const newRoom = createPlayRoom(word);
    const next = playRooms.get(newRoom.roomId)!;
    room.started = false;
    room.revealed = false;
    room.bits.fill(0);
    room.embedWord = next.embedWord;
    room.wordPatterns = next.wordPatterns;
    room.patterns = next.patterns;
    room.completed = next.completed;
    room.cellToPatterns = next.cellToPatterns;
    room.boardChars = next.boardChars;
    room.boardUtf8 = next.boardUtf8;
    room.solutionBits = next.solutionBits;
    room.packedSolution = next.packedSolution;
    playRooms.delete(newRoom.roomId);
    room.lastActiveAt = nowMs();
    return playBroadcast(room, playFullFrame(room));
  }
}

wss.on('connection', (ws) => {
  const meta: ClientMeta = { isAlive: true, pingMiss: 0 };
  clientMeta.set(ws, meta);
  clientTag.set(ws, 0);

  ws.on('pong', () => {
    const m = clientMeta.get(ws);
    if (m) m.isAlive = true;
  });

  ws.on('message', (data) => {
    if (typeof data === 'string') return sendErr(ws, ERROR_CODE.BAD_MSG);
    const buf = data instanceof Buffer ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data as ArrayBuffer);
    if (buf.length < 1) return sendErr(ws, ERROR_CODE.BAD_MSG);

    const op = buf[0];
    if (op === OPCODE.JOIN) {
      if (buf.length !== 5) return sendErr(ws, ERROR_CODE.BAD_MSG);
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      const roomId = dv.getUint32(1, false) >>> 0;
      return join(ws, roomId);
    }
    if (op === OPCODE.TAG) {
      if (buf.length !== 2) return sendErr(ws, ERROR_CODE.BAD_MSG);
      const tag = buf[1] as 0 | 1 | 2 | 3;
      if (tag === 0 || tag === 1 || tag === 2 || tag === 3) clientTag.set(ws, tag);
      return;
    }
    if (op === OPCODE.PRESS) {
      if (buf.length !== 2) return sendErr(ws, ERROR_CODE.BAD_MSG);
      return press(ws, buf[1]);
    }
    return sendErr(ws, ERROR_CODE.BAD_MSG);
  });

  ws.on('close', () => {
    const m = clientMeta.get(ws);
    const roomId = m?.roomId;
    if (roomId) rooms.get(roomId)?.clients.delete(ws);
  });
});

playWss.on('connection', (ws) => {
  playConnections++;
  const meta: PlayClient = { ws, isAlive: true, pingMiss: 0, tag: 0 };
  playClientMeta.set(ws, meta);

  ws.on('pong', () => {
    const m = playClientMeta.get(ws);
    if (m) m.isAlive = true;
  });

  ws.on('error', () => {
    playErrors++;
  });

  ws.on('message', (data) => {
    if (typeof data === 'string') return playSendError(ws, 1);
    const buf = data instanceof Buffer ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data as ArrayBuffer);
    if (buf.length < 1) return playSendError(ws, 1);
    const op = buf[0]!;

    // join: [0x00, roomId u32]
    if (op === 0x00) {
      if (buf.length !== 5) return playSendError(ws, 1);
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      const roomId = dv.getUint32(1, false) >>> 0;
      return playJoin(ws, roomId);
    }
    // press: [0x10, idx u16]
    if (op === 0x10) {
      if (buf.length !== 3) return playSendError(ws, 1);
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      const idx = dv.getUint16(1, false);
      return playPress(ws, idx);
    }
    // host commands: [op, hostKey(16), ...]
    if (op === 0x11 || op === 0x12 || op === 0x13 || op === 0x14) {
      if (buf.length < 1 + 16) return playSendError(ws, 1);
      return playHostCommand(ws, op, buf.subarray(1));
    }
    return playSendError(ws, 1);
  });

  ws.on('close', () => {
    playConnections = Math.max(0, playConnections - 1);
    playDisconnects++;
    const m = playClientMeta.get(ws);
    const roomId = m?.roomId;
    if (roomId) playRooms.get(roomId)?.clients.delete(ws);
  });
});

// Keepalive: pong がプロキシ越しで遅れたときに切らないよう、複数ラウンド許容する
function sweepClients(
  iterate: Iterable<WebSocket>,
  getMeta: (ws: WebSocket) => ClientMeta | PlayClient | undefined,
  detach: (ws: WebSocket) => void,
) {
  for (const ws of iterate) {
    const meta = getMeta(ws);
    if (!meta) continue;

    if (!meta.isAlive) {
      meta.pingMiss++;
      if (meta.pingMiss >= WS_PING_MAX_MISS) {
        detach(ws);
        try {
          ws.terminate();
        } catch {}
        continue;
      }
    } else {
      meta.pingMiss = 0;
    }

    meta.isAlive = false;
    try {
      ws.ping();
    } catch {}
  }
}

// Keepalive: dead connection cleanup
setInterval(() => {
  for (const room of rooms.values()) {
    sweepClients(room.clients, (ws) => clientMeta.get(ws), (dead) => {
      room.clients.delete(dead);
    });
  }
  for (const room of playRooms.values()) {
    sweepClients(room.clients, (ws) => playClientMeta.get(ws), (dead) => {
      room.clients.delete(dead);
    });
  }
}, WS_PING_MS).unref();

// Idle room cleanup
setInterval(() => {
  const t = nowMs();
  for (const [id, room] of rooms.entries()) {
    const idle = room.clients.size === 0 && t - room.lastActiveAt > CLEANUP_IDLE_MS;
    if (idle) rooms.delete(id);
  }
}, 60_000).unref();

// Global diff tick: flush pending diffs for all rooms
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.pendingBits !== 0) flushRoomDiffs(room);
  }
  for (const room of playRooms.values()) {
    playFlushRoom(room);
  }
}, DIFF_TICK_MS).unref();

// Continuous metrics: 1s windowed ELD percentiles + memory
setInterval(() => {
  const eld = getEldMs();
  const eldPlay = getEldMsP95();
  const mem = getMem();
  // window reset so next tick becomes "last ~1s"
  loopDelay.reset();

  const out = {
    t: nowMs(),
    rooms: rooms.size,
    eldMs: {
      p50: Math.round(eld.p50 * 1000) / 1000,
      p90: Math.round(eld.p90 * 1000) / 1000,
      p99: Math.round(eld.p99 * 1000) / 1000,
    },
    mem,
  };
  lastMetrics = { at: out.t, rooms: out.rooms, eldMs: out.eldMs, mem: out.mem };

  // normalRTT proxy: press->flush (server-side) percentiles in last 1s (normal clients only)
  if (pressToFlushSamples.length > 0) {
    pressToFlushSamples.sort((a, b) => a - b);
    const n = pressToFlushSamples.length;
    const idx50 = Math.min(n - 1, Math.floor(0.5 * (n - 1)));
    const idx90 = Math.min(n - 1, Math.floor(0.9 * (n - 1)));
    const idx99 = Math.min(n - 1, Math.floor(0.99 * (n - 1)));
    pressToFlushP50Ms = pressToFlushSamples[idx50] ?? 0;
    pressToFlushP90Ms = pressToFlushSamples[idx90] ?? 0;
    pressToFlushP99Ms = pressToFlushSamples[idx99] ?? 0;
    pressToFlushSamples = [];
  } else {
    pressToFlushP50Ms = 0;
    pressToFlushP90Ms = 0;
    pressToFlushP99Ms = 0;
  }

  // play RTT proxy: press->flush percentiles (last ~1s, normal-tagged only)
  if (playPressToFlushSamples.length > 0) {
    playPressToFlushSamples.sort((a, b) => a - b);
    const n = playPressToFlushSamples.length;
    const idx50 = Math.min(n - 1, Math.floor(0.5 * (n - 1)));
    const idx95 = Math.min(n - 1, Math.floor(0.95 * (n - 1)));
    const idx99 = Math.min(n - 1, Math.floor(0.99 * (n - 1)));
    playRttP50Ms = playPressToFlushSamples[idx50] ?? 0;
    playRttP95Ms = playPressToFlushSamples[idx95] ?? 0;
    playRttP99Ms = playPressToFlushSamples[idx99] ?? 0;
    playPressToFlushSamples = [];
  } else {
    playRttP50Ms = 0;
    playRttP95Ms = 0;
    playRttP99Ms = 0;
  }

  const playRoomsCount = playRooms.size;
  let playClientsTotal = 0;
  for (const r of playRooms.values()) playClientsTotal += r.clients.size;

  // minimal fixed-shape JSON; stringify once per second, reused by /healthz handler
  healthzCachedBody = JSON.stringify({
    ok: 1,
    r: out.rooms,
    t: out.t,
    tm: tuneDefaults(tuneMode).mode,
    e: [out.eldMs.p50, out.eldMs.p90, out.eldMs.p99],
    m: [mem.rss, mem.heapUsed, mem.external],
    dc: globalDisconnectCount,
    bp: [maxBufferedAmount, backpressureMaxConsecutive, diffRepeat],
    nr: [pressToFlushP50Ms, pressToFlushP90Ms, pressToFlushP99Ms],

    // play_* (additional keys; existing world keys unchanged)
    play_rtt_p50: playRttP50Ms,
    play_rtt_p95: playRttP95Ms,
    play_rtt_p99: playRttP99Ms,
    play_eld_p50: Math.round(eldPlay.p50 * 1000) / 1000,
    play_eld_p95: Math.round(eldPlay.p95 * 1000) / 1000,
    play_eld_p99: Math.round(eldPlay.p99 * 1000) / 1000,
    play_mem_rss_mb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
    play_mem_heap_mb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
    play_connections: playConnections,
    play_disconnects: playDisconnects,
    play_errors: playErrors,
    play_rooms: playRoomsCount,
    play_clients_total: playClientsTotal,
  });

  // key=value lines (used by /healthz?fmt=kv)
  healthzCachedKvBody =
    [
      `ok=${1}`,
      `r=${out.rooms}`,
      `t=${out.t}`,
      `tm=${tuneDefaults(tuneMode).mode}`,
      `eld_p50=${out.eldMs.p50}`,
      `eld_p90=${out.eldMs.p90}`,
      `eld_p99=${out.eldMs.p99}`,
      `mem_rss_mb=${Math.round((mem.rss / 1024 / 1024) * 10) / 10}`,
      `mem_heap_mb=${Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10}`,
      `mem_ext_mb=${Math.round((mem.external / 1024 / 1024) * 10) / 10}`,
      `dc=${globalDisconnectCount}`,
      `bp_maxBufferedAmount=${maxBufferedAmount}`,
      `bp_backpressureMaxConsecutive=${backpressureMaxConsecutive}`,
      `bp_diffRepeat=${diffRepeat}`,
      `nr_p50=${pressToFlushP50Ms}`,
      `nr_p90=${pressToFlushP90Ms}`,
      `nr_p99=${pressToFlushP99Ms}`,

      `play_rtt_p50=${playRttP50Ms}`,
      `play_rtt_p95=${playRttP95Ms}`,
      `play_rtt_p99=${playRttP99Ms}`,
      `play_eld_p50=${Math.round(eldPlay.p50 * 1000) / 1000}`,
      `play_eld_p95=${Math.round(eldPlay.p95 * 1000) / 1000}`,
      `play_eld_p99=${Math.round(eldPlay.p99 * 1000) / 1000}`,
      `play_mem_rss_mb=${Math.round((mem.rss / 1024 / 1024) * 10) / 10}`,
      `play_mem_heap_mb=${Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10}`,
      `play_connections=${playConnections}`,
      `play_disconnects=${playDisconnects}`,
      `play_errors=${playErrors}`,
      `play_rooms=${playRoomsCount}`,
      `play_clients_total=${playClientsTotal}`,
    ].join('\n') + '\n';

  console.log(`[metrics] ${JSON.stringify(out)}`);
}, 1000).unref();

// IPv4 の 127.0.0.1 / 0.0.0.0 からの接続を確実に受ける（listen(PORT) だけだと :: のみになり、127.0.0.1 の WS が張れない環境がある）
server.listen(PORT, '0.0.0.0', () => {
  seedDevDemoRoom();
  console.log(
    `[sanjuu-ws] listening http://127.0.0.1:${PORT} (ws ${WS_PATH}, playws ${PLAY_WS_PATH}) — bound 0.0.0.0:${PORT}`
  );
});

