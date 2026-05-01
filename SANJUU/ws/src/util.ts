import crypto from 'node:crypto';

export function randomId(bytes = 9): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256Base64Url(input: string): string {
  return crypto.createHash('sha256').update(input).digest('base64url');
}

export function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function nowMs(): number {
  return Date.now();
}

export function safeJsonParse<T>(s: string): T | undefined {
  try {
    return JSON.parse(s) as T;
  } catch {
    return undefined;
  }
}

