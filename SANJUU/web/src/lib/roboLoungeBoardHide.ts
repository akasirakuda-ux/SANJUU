/** 三十募集板 — らくだロボお題クリア後の非表示（本体 `src/lib/hundredRecruitBoardVisibility.ts` と同じ判定） */

type OccPoint = { x: number; y: number };

const ROBO_PICKUP_LOUNGE_ROOM_IDS = ['robo-pickup-lounge', 'robo-pickup-lounge-emoji'];

function isRoboPickupLoungeRecruit(item: { roboPickupLounge?: boolean; roomId?: string }): boolean {
  if (item.roboPickupLounge === true) return true;
  const id = (item.roomId || '').trim();
  return ROBO_PICKUP_LOUNGE_ROOM_IDS.includes(id);
}

function asPoint(v: unknown): OccPoint | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const x = typeof o.x === 'number' ? o.x : Number(o.x);
  const y = typeof o.y === 'number' ? o.y : Number(o.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function canonicalOccurrenceKey(start: OccPoint, end: OccPoint): string {
  const ax = Number(start.x);
  const ay = Number(start.y);
  const bx = Number(end.x);
  const by = Number(end.y);
  if (![ax, ay, bx, by].every(Number.isFinite)) return '';
  const k1 = `${ax},${ay}-${bx},${by}`;
  const k2 = `${bx},${by}-${ax},${ay}`;
  return k1 < k2 ? k1 : k2;
}

function normalizeFoundList(foundWords: unknown): Array<{ start?: OccPoint; end?: OccPoint }> {
  if (!Array.isArray(foundWords)) return [];
  const out: Array<{ start?: OccPoint; end?: OccPoint }> = [];
  for (const raw of foundWords) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const start = asPoint(o.start ?? o.s);
    const end = asPoint(o.end ?? o.e);
    if (!start || !end) continue;
    out.push({ start, end });
  }
  return out;
}

function countPlacedWordOccurrences(placedWords: unknown): number {
  if (!Array.isArray(placedWords)) return 0;
  const seen = new Set<string>();
  for (const pw of placedWords) {
    const occs =
      pw && typeof pw === 'object' && Array.isArray((pw as { occurrences?: unknown }).occurrences)
        ? (pw as { occurrences: unknown[] }).occurrences
        : [];
    for (const occ of occs) {
      if (!occ || typeof occ !== 'object') continue;
      const start = asPoint((occ as Record<string, unknown>).start);
      const end = asPoint((occ as Record<string, unknown>).end);
      if (!start || !end) continue;
      const k = canonicalOccurrenceKey(start, end);
      if (k) seen.add(k);
    }
  }
  return seen.size;
}

function countUniqueFoundOccurrences(
  foundWords: Array<{ start?: OccPoint; end?: OccPoint }> | undefined,
): number {
  const seen = new Set<string>();
  for (const fw of foundWords ?? []) {
    if (!fw?.start || !fw?.end) continue;
    const k = canonicalOccurrenceKey(fw.start, fw.end);
    if (k) seen.add(k);
  }
  return seen.size;
}

export function isRoboLoungeRoundComplete(foundWords: unknown, placedWords: unknown): boolean {
  const total = countPlacedWordOccurrences(placedWords);
  if (total <= 0) {
    return normalizeFoundList(foundWords).length > 0;
  }
  const found = countUniqueFoundOccurrences(normalizeFoundList(foundWords));
  return found >= total;
}

export type RoboLoungeBoardRoomMeta = {
  foundWords?: unknown;
  words?: unknown;
  placedWords?: unknown;
  problemsGenerating?: boolean;
};

export function shouldHideRoboPickupLoungeFromRecruitBoard(
  item: { roboPickupLounge?: boolean; roomId?: string },
  room: RoboLoungeBoardRoomMeta | undefined,
): boolean {
  if (!isRoboPickupLoungeRecruit(item)) return false;
  if (!room) return false;
  if (room.problemsGenerating === true) return true;
  return isRoboLoungeRoundComplete(room.foundWords, room.words ?? room.placedWords);
}
