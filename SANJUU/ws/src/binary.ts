export const OPCODE = {
  // client -> server
  JOIN: 0x01,
  PRESS: 0x02,
  TAG: 0x03,

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

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

export function encodeJoin(roomId: number): Uint8Array {
  const buf = new Uint8Array(5);
  buf[0] = OPCODE.JOIN;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  dv.setUint32(1, roomId >>> 0, false);
  return buf;
}

export function decodeJoin(buf: Uint8Array): { roomId: number } | undefined {
  if (buf.length !== 5 || buf[0] !== OPCODE.JOIN) return undefined;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return { roomId: dv.getUint32(1, false) >>> 0 };
}

export function encodePress(n: number): Uint8Array {
  const buf = new Uint8Array(2);
  buf[0] = OPCODE.PRESS;
  buf[1] = n & 0xff;
  return buf;
}

export function decodePress(buf: Uint8Array): { n: number } | undefined {
  if (buf.length !== 2 || buf[0] !== OPCODE.PRESS) return undefined;
  return { n: buf[1] };
}

export function encodeDiff(n: number, v: 0 | 1): Uint8Array {
  const buf = new Uint8Array(3);
  buf[0] = OPCODE.DIFF;
  buf[1] = n & 0xff;
  buf[2] = v & 0xff;
  return buf;
}

export function decodeDiff(buf: Uint8Array): { n: number; v: 0 | 1 } | undefined {
  if (buf.length !== 3 || buf[0] !== OPCODE.DIFF) return undefined;
  const v: 0 | 1 = buf[2] ? 1 : 0;
  return { n: buf[1], v };
}

export function encodeFull(mask: number): Uint8Array {
  const buf = new Uint8Array(5);
  buf[0] = OPCODE.FULL;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  dv.setUint32(1, mask >>> 0, false);
  return buf;
}

export function decodeFull(buf: Uint8Array): { mask: number } | undefined {
  if (buf.length !== 5 || buf[0] !== OPCODE.FULL) return undefined;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return { mask: dv.getUint32(1, false) >>> 0 };
}

export function encodeError(code: ErrorCode): Uint8Array {
  const buf = new Uint8Array(2);
  buf[0] = OPCODE.ERROR;
  buf[1] = code & 0xff;
  return buf;
}

export function decodeError(buf: Uint8Array): { code: ErrorCode } | undefined {
  if (buf.length !== 2 || buf[0] !== OPCODE.ERROR) return undefined;
  return { code: buf[1] as ErrorCode };
}

