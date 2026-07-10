import { isPickupEmojiWordOnly, pickupEmojiGraphemeCount } from './pickupEmojiSymbols';

/** 探しもの（pickup）盤面で目指す最低正解出現数 */

export function hundredPickupMinOccurrences(
  boardCols: number,
  targetWord: string,
  boardRows?: number,
): number {
  const trimmed = (targetWord || '').trim();
  const wordLen = Math.max(
    1,
    isPickupEmojiWordOnly(trimmed) ? pickupEmojiGraphemeCount(trimmed) : Array.from(trimmed).length,
  );
  const cols = Math.max(1, boardCols);
  const rows = Math.max(1, boardRows ?? boardCols);
  const cells = Math.max(1, cols * rows);

  const coverageCells = cells * 0.85;
  // 1出現あたり平均で wordLen/1.75 マスを新規に埋める想定（長い語ほど必要出現数は減る）
  const minForCoverage = Math.max(2, Math.ceil(coverageCells / (wordLen * 1.75)));
  // 完全非重複でもこれ以上は不可能な上限
  const geometricCeiling = Math.max(2, Math.floor(cells / wordLen));

  return Math.min(minForCoverage, geometricCeiling);
}



type OccPoint = { x: number; y: number };



/** 同一マス・同一スパン（方向違い）を1つにまとめるキー */

export function canonicalOccurrenceKey(start: OccPoint, end: OccPoint): string {

  const ax = Number(start.x);

  const ay = Number(start.y);

  const bx = Number(end.x);

  const by = Number(end.y);

  if (![ax, ay, bx, by].every(Number.isFinite)) return '';

  const k1 = `${ax},${ay}-${bx},${by}`;

  const k2 = `${bx},${by}-${ax},${ay}`;

  return k1 < k2 ? k1 : k2;

}



function occurrencesFromPlacedWords(placedWords: unknown): Array<{ start?: OccPoint; end?: OccPoint }> {

  if (!Array.isArray(placedWords)) return [];

  const out: Array<{ start?: OccPoint; end?: OccPoint }> = [];

  for (const pw of placedWords) {

    const occs =

      pw && typeof pw === 'object' && Array.isArray((pw as { occurrences?: unknown }).occurrences)

        ? (pw as { occurrences: unknown[] }).occurrences

        : [];

    for (const occ of occs) {

      if (occ && typeof occ === 'object') out.push(occ as { start?: OccPoint; end?: OccPoint });

    }

  }

  return out;

}



/** 盤面上の正解スパン数（方向重複を除く） */

export function countPlacedWordOccurrences(placedWords: unknown): number {

  const seen = new Set<string>();

  for (const occ of occurrencesFromPlacedWords(placedWords)) {

    if (!occ.start || !occ.end) continue;

    const k = canonicalOccurrenceKey(occ.start, occ.end);

    if (!k) continue;

    seen.add(k);

  }

  return seen.size;

}



/** 見つけた正解スパン数（方向重複を除く） */

export function countUniqueFoundOccurrences(

  foundWords: Array<{ start?: OccPoint; end?: OccPoint }> | undefined

): number {

  const seen = new Set<string>();

  for (const fw of foundWords ?? []) {

    if (!fw?.start || !fw?.end) continue;

    const k = canonicalOccurrenceKey(fw.start, fw.end);

    if (!k) continue;

    seen.add(k);

  }

  return seen.size;

}

export type HundredRoundRankingPlayer = {
  uid: string;
  name: string;
  emoji: string;
  foundCount: number;
};

/** この局の foundWords だけから、参加者ごとの見つけた数（出現単位・方向重複除く） */
export function buildHundredRoundRanking(
  foundWords: Array<{
    start?: OccPoint;
    end?: OccPoint;
    playerId?: string;
    userName?: string;
    userEmoji?: string;
  }> | undefined,
  roster: Array<{ uid: string; name: string; emoji: string }>
): HundredRoundRankingPlayer[] {
  const occKeysByUid = new Map<string, Set<string>>();
  const nameByUid = new Map<string, string>();
  const emojiByUid = new Map<string, string>();
  const nameToUid = new Map<string, string>();
  for (const p of roster) {
    const name = p.name.trim();
    if (name) nameToUid.set(name, p.uid);
    occKeysByUid.set(p.uid, new Set());
  }

  for (const fw of foundWords ?? []) {
    if (!fw?.start || !fw?.end) continue;
    const occKey = canonicalOccurrenceKey(fw.start, fw.end);
    if (!occKey) continue;
    const uid =
      (typeof fw.playerId === 'string' && fw.playerId.trim()) ||
      nameToUid.get((fw.userName || '').trim()) ||
      '';
    if (!uid) continue;
    const name = (fw.userName || '').trim();
    if (name) nameByUid.set(uid, name);
    const em = (fw.userEmoji || '').trim();
    if (em) emojiByUid.set(uid, em);
    let keys = occKeysByUid.get(uid);
    if (!keys) {
      keys = new Set();
      occKeysByUid.set(uid, keys);
    }
    keys.add(occKey);
  }

  const rosterByUid = new Map(roster.map((p) => [p.uid, p]));
  const out: HundredRoundRankingPlayer[] = [];
  for (const [uid, keys] of occKeysByUid) {
    if (keys.size <= 0) continue;
    const p = rosterByUid.get(uid);
    const name = p?.name?.trim() || nameByUid.get(uid) || 'ななし';
    const emoji = (p?.emoji || emojiByUid.get(uid) || '🌸').trim() || '🌸';
    out.push({
      uid,
      name,
      emoji,
      foundCount: keys.size,
    });
  }
  return out.sort((a, b) => b.foundCount - a.foundCount || a.name.localeCompare(b.name, 'ja'));
}


