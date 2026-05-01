export const OPCODE = {
  // client -> server
  JOIN: 0x01,
  PRESS: 0x02,

  // server -> client
  DIFF: 0x11,
  FULL: 0x12,
  ERROR: 0x13,
} as const;

export const ERROR_CODE = {
  BAD_MSG: 1,
  NO_ROOM: 2,
  FULL: 3,
  NOT_JOINED: 4,
  BAD_N: 5,
} as const;

export function encodeJoin(roomId: number): Uint8Array {
  const buf = new Uint8Array(5);
  buf[0] = OPCODE.JOIN;
  new DataView(buf.buffer).setUint32(1, roomId >>> 0, false);
  return buf;
}

export function encodePress(n: number): Uint8Array {
  const buf = new Uint8Array(2);
  buf[0] = OPCODE.PRESS;
  buf[1] = n & 0xff;
  return buf;
}

export type Decoded =
  | { t: 'diff'; n: number; v: 0 | 1 }
  | { t: 'full'; mask: number }
  | { t: 'error'; code: number };

export function decodeServerFrames(frame: ArrayBuffer, onMsg: (m: Decoded) => void): void {
  const buf = new Uint8Array(frame);
  if (buf.length < 1) return;
  const op = buf[0];

  if (op === OPCODE.DIFF) {
    if (buf.length % 3 !== 0) return;
    for (let off = 0; off < buf.length; off += 3) {
      if (buf[off] !== OPCODE.DIFF) return;
      const v: 0 | 1 = buf[off + 2] ? 1 : 0;
      onMsg({ t: 'diff', n: buf[off + 1], v });
    }
    return;
  }
  if (op === OPCODE.FULL) {
    if (buf.length !== 5) return;
    const mask = new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint32(1, false) >>> 0;
    onMsg({ t: 'full', mask });
    return;
  }
  if (op === OPCODE.ERROR) {
    if (buf.length !== 2) return;
    onMsg({ t: 'error', code: buf[1] });
    return;
  }
}

export function roomIdStringToUint32(roomId: string): number | undefined {
  const s = String(roomId ?? '').trim().toLowerCase();
  if (!/^[0-9a-z]+$/.test(s)) return undefined;
  const n = Number.parseInt(s, 36);
  if (!Number.isFinite(n) || n <= 0 || n > 0xffffffff) return undefined;
  return n >>> 0;
}

