import type { FoundWord, Point } from '../types';
import { rkBandColorForOccurrenceKey } from './rkTheme';

function asPoint(v: unknown): Point | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const x = typeof o.x === 'number' ? o.x : Number(o.x);
  const y = typeof o.y === 'number' ? o.y : Number(o.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/** Firestore の foundWords 配列要素（短縮形 w,s,e,p,n または従来形）を FoundWord に統一 */
export function normalizeHundredFoundRaw(raw: unknown): FoundWord | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const word =
    typeof o.word === 'string' ? o.word : typeof o.w === 'string' ? o.w : '';
  const start = asPoint(o.start ?? o.s);
  const end = asPoint(o.end ?? o.e);
  if (!word || !start || !end) return null;
  const playerId = typeof o.playerId === 'string' ? o.playerId : typeof o.p === 'string' ? o.p : undefined;
  const userName =
    typeof o.userName === 'string'
      ? o.userName
      : typeof o.n === 'string'
        ? o.n
        : undefined;
  const userEmoji =
    typeof o.userEmoji === 'string'
      ? o.userEmoji
      : typeof o.m === 'string'
        ? o.m
        : undefined;
  const color =
    typeof o.color === 'string' && o.color
      ? o.color
      : typeof o.c === 'string' && o.c
        ? o.c
        : rkBandColorForOccurrenceKey(word, start, end);
  return {
    word,
    start,
    end,
    color,
    isHint: !!o.isHint,
    userName,
    userEmoji,
    playerId,
  };
}

export function normalizeHundredFoundList(raw: unknown): FoundWord[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeHundredFoundRaw).filter((x): x is FoundWord => x !== null);
}
