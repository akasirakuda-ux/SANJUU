export const PLAY_OPCODE = {
  // client -> server
  JOIN: 0x00,
  PRESS: 0x10,
  START: 0x11,
  REVEAL: 0x12,
  RESET: 0x13,
  SET_WORD: 0x14,

  // server -> client
  FULL: 0x01,
  DIFF: 0x02,
  ERROR: 0x7f,
} as const;

export type PlayFull = {
  t: 'full';
  started: boolean;
  revealed: boolean;
  clientsCount: number;
  bits: Uint8Array; // 900 (0/1)
  board: string[]; // 900 chars
  solutionBits?: Uint8Array; // 900 (0/1) only when revealed
};

export type PlayDiff = {
  t: 'diff';
  idx: number;
  /** 0/1=押下、2=語完成ライン（bits は 1） */
  v: 0 | 1 | 2;
  verdict: 0 | 1 | 2; // 0 miss, 1 hit, 2 wordComplete
};

export type PlayError = {
  t: 'error';
  code: number;
};

const PLAY_CELLS = 900;
const PLAY_BITS_BYTES = 113;

export function encodePlayJoin(roomId: number): Uint8Array {
  const b = new Uint8Array(5);
  b[0] = PLAY_OPCODE.JOIN;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  dv.setUint32(1, roomId >>> 0, false);
  return b;
}

export function encodePlayPress(idx: number): Uint8Array {
  const b = new Uint8Array(3);
  b[0] = PLAY_OPCODE.PRESS;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  dv.setUint16(1, idx & 0xffff, false);
  return b;
}

function encodeHostOp(op: number, hostKeyB64Url: string, extra?: Uint8Array) {
  const hostKey = base64UrlToBytes(hostKeyB64Url);
  const len = 1 + 16 + (extra?.byteLength ?? 0);
  const b = new Uint8Array(len);
  b[0] = op & 0xff;
  b.set(hostKey, 1);
  if (extra) b.set(extra, 17);
  return b;
}

export function encodePlayStart(hostKeyB64Url: string) {
  return encodeHostOp(PLAY_OPCODE.START, hostKeyB64Url);
}

export function encodePlayReveal(hostKeyB64Url: string) {
  return encodeHostOp(PLAY_OPCODE.REVEAL, hostKeyB64Url);
}

export function encodePlayReset(hostKeyB64Url: string) {
  return encodeHostOp(PLAY_OPCODE.RESET, hostKeyB64Url);
}

export function encodePlaySetWord(hostKeyB64Url: string, word: string) {
  const enc = new TextEncoder().encode(word);
  const extra = new Uint8Array(1 + enc.byteLength);
  extra[0] = enc.byteLength & 0xff;
  extra.set(enc, 1);
  return encodeHostOp(PLAY_OPCODE.SET_WORD, hostKeyB64Url, extra);
}

export function decodePlayFrames(ab: ArrayBuffer, onMsg: (m: PlayFull | PlayDiff | PlayError) => void) {
  const buf = new Uint8Array(ab);
  if (buf.length < 1) return;
  const op = buf[0]!;

  if (op === PLAY_OPCODE.ERROR) {
    if (buf.length >= 2) onMsg({ t: 'error', code: buf[1]! });
    return;
  }

  if (op === PLAY_OPCODE.DIFF) {
    // [0x02, idx u16, v u8, verdict u8] repeated
    for (let off = 1; off + 4 < buf.length; off += 5) {
      const dv = new DataView(buf.buffer, buf.byteOffset + off, 5);
      const idx = dv.getUint16(0, false);
      const rawV = buf[off + 2] ?? 0;
      const v = (rawV > 2 ? 2 : rawV) as 0 | 1 | 2;
      const verdict = (buf[off + 3] ?? 0) as 0 | 1 | 2;
      onMsg({ t: 'diff', idx, v, verdict });
    }
    return;
  }

  if (op === PLAY_OPCODE.FULL) {
    if (buf.length < 1 + 1 + 1 + 2 + PLAY_BITS_BYTES + 2) return;
    const started = buf[1] === 1;
    const revealed = buf[2] === 1;
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const clientsCount = dv.getUint16(3, false);
    const packed = buf.subarray(5, 5 + PLAY_BITS_BYTES);
    const bits = unpackBits(packed);
    const boardLen = dv.getUint16(5 + PLAY_BITS_BYTES, false);
    const boardStart = 7 + PLAY_BITS_BYTES;
    const boardEnd = boardStart + boardLen;
    if (boardEnd > buf.length) return;
    const boardBytes = buf.subarray(boardStart, boardEnd);
    const boardStr = new TextDecoder('utf-8').decode(boardBytes);
    const board = Array.from(boardStr);
    if (board.length !== PLAY_CELLS) return;
    if (revealed) {
      const solStart = boardEnd;
      const solEnd = solStart + PLAY_BITS_BYTES;
      if (solEnd > buf.length) return;
      const sol = unpackBits(buf.subarray(solStart, solEnd));
      onMsg({ t: 'full', started, revealed, clientsCount, bits, board, solutionBits: sol });
      return;
    }
    onMsg({ t: 'full', started, revealed, clientsCount, bits, board });
  }
}

export function unpackBits(packed113: Uint8Array): Uint8Array {
  const out = new Uint8Array(PLAY_CELLS);
  for (let i = 0; i < PLAY_CELLS; i++) {
    out[i] = (packed113[i >> 3]! >> (7 - (i & 7))) & 1;
  }
  return out;
}

function base64UrlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xff;
  return out;
}

