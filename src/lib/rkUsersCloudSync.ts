/** JST 日付キー（しゅっせき簿） */
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface RkUsersCloudPayload {
  uid: string;
  nickname: string;
  userEmoji: string;
  totalPoints: number;
  completedDates: string[];
  specialDates: string[];
  dailyClearCounts: Record<string, number>;
  updatedAtMs: number;
}

function cleanDateKeys(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    const key = String(item ?? '').trim();
    if (!DATE_KEY_RE.test(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= 500) break;
  }
  return out.sort();
}

function cleanDailyClearCounts(obj: unknown): Record<string, number> {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const out: Record<string, number> = {};
  for (const [rawKey, rawVal] of Object.entries(obj as Record<string, unknown>)) {
    const key = String(rawKey).trim();
    if (!DATE_KEY_RE.test(key)) continue;
    const n = typeof rawVal === 'number' ? rawVal : Number(rawVal);
    if (!Number.isFinite(n) || n < 0 || n > 9999) continue;
    out[key] = Math.floor(n);
  }
  return out;
}

/** Firestore commit 400 (invalid-argument) を防ぐ — undefined・NaN・不正キーを除去 */
export function sanitizeRkUsersCloudPayload(
  raw: Partial<RkUsersCloudPayload> & { uid: string }
): RkUsersCloudPayload {
  const uid = String(raw.uid ?? '').trim();
  return {
    uid: uid.slice(0, 128),
    nickname: String(raw.nickname ?? '').trim().slice(0, 64),
    userEmoji: String(raw.userEmoji ?? '').trim().slice(0, 32),
    totalPoints: Math.max(
      0,
      Math.min(999_999_999, Math.floor(Number(raw.totalPoints) || 0))
    ),
    completedDates: cleanDateKeys(raw.completedDates),
    specialDates: cleanDateKeys(raw.specialDates),
    dailyClearCounts: cleanDailyClearCounts(raw.dailyClearCounts),
    updatedAtMs: Math.floor(Number(raw.updatedAtMs) || Date.now()),
  };
}
