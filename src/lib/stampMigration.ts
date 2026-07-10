export type StampMigrationResult = {
  /** YYYY-MM-DD */
  completedDates: string[];
  /** YYYY-MM-DD (>=3 clears) */
  specialDates: string[];
  /** 2枚以上クリアした日の枚数 */
  dailyClearCounts: Record<string, number>;
  /** inclusive range covered by logs */
  range: { min: string; max: string } | null;
};

function normalizeDateKeyFromLogTimestamp(timestamp: string): string | null {
  // Expected: "YYYY.MM.DD HH:mm:ss"
  // We only need the date part and treat it as local day (JST in this app).
  const t = String(timestamp || '').trim();
  if (t.length < 10) return null;
  const datePart = t.slice(0, 10); // "YYYY.MM.DD"
  const m = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(datePart);
  if (!m) return null;
  const y = m[1];
  const mo = m[2];
  const d = m[3];
  return `${y}-${mo}-${d}`;
}

export function computeStampsFromLogs(params: {
  logs: Array<{ timestamp?: string; type?: unknown; tag?: unknown; message?: unknown }>;
}): StampMigrationResult {
  const counts = new Map<string, number>();

  for (const log of params.logs || []) {
    const type = typeof log?.type === 'string' ? log.type : '';
    const tag = typeof log?.tag === 'string' ? log.tag : '';
    const message = typeof log?.message === 'string' ? log.message : '';

    // This app writes clear logs as `type = 'game_clear'` (legacy typing allows it).
    // Keep it permissive to cover older data.
    const looksLikeClear =
      type === 'game_clear' ||
      type === 'GAME_CLEAR' ||
      (tag === 'SUCCESS' && (message.includes('クリア') || message.toLowerCase().includes('clear')));

    if (!looksLikeClear) continue;

    const key = normalizeDateKeyFromLogTimestamp(String(log?.timestamp ?? ''));
    if (!key) continue;

    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const completedDates = Array.from(counts.keys()).sort();
  const dailyClearCounts: Record<string, number> = {};
  const specialDates: string[] = [];

  const range =
    completedDates.length > 0
      ? { min: completedDates[0]!, max: completedDates[completedDates.length - 1]! }
      : null;

  return { completedDates, specialDates, dailyClearCounts, range };
}

function uniqSorted(dates: string[]): string[] {
  const s = new Set<string>();
  for (const d of dates) {
    const k = String(d || '').trim();
    if (k) s.add(k);
  }
  return Array.from(s).sort();
}

export function migrateStampArrays(params: {
  existingCompletedDates: string[] | undefined;
  existingSpecialDates: string[] | undefined;
  existingDailyClearCounts?: Record<string, number> | undefined;
  computedCompletedDates: string[];
  computedSpecialDates: string[];
  computedDailyClearCounts: Record<string, number>;
  computedRange: { min: string; max: string } | null;
}): {
  completedDates: string[];
  specialDates: string[];
  dailyClearCounts: Record<string, number>;
  changed: boolean;
} {
  const existingCompleted = Array.isArray(params.existingCompletedDates) ? params.existingCompletedDates : [];
  const existingSpecial = Array.isArray(params.existingSpecialDates) ? params.existingSpecialDates : [];
  const existingDaily = { ...(params.existingDailyClearCounts ?? {}) };

  // If we couldn't compute anything, do nothing.
  if (!params.computedRange) {
    return {
      completedDates: uniqSorted(existingCompleted),
      specialDates: uniqSorted(existingSpecial),
      dailyClearCounts: existingDaily,
      changed: false,
    };
  }

  const { min, max } = params.computedRange;
  const outside = (d: string) => d < min || d > max;

  // Replace only the range we actually have logs for; keep everything outside untouched.
  const nextCompleted = uniqSorted([
    ...existingCompleted.filter(outside),
    ...params.computedCompletedDates,
  ]);
  const nextSpecial = uniqSorted([
    ...existingSpecial.filter(outside),
    ...params.computedSpecialDates,
  ]);
  const nextDaily: Record<string, number> = {};
  for (const [key, value] of Object.entries(existingDaily)) {
    if (outside(key)) nextDaily[key] = value;
  }
  for (const [key, value] of Object.entries(params.computedDailyClearCounts)) {
    nextDaily[key] = value;
  }

  const prevCompleted = uniqSorted(existingCompleted);
  const prevSpecial = uniqSorted(existingSpecial);
  const prevDailyJson = JSON.stringify(existingDaily);
  const nextDailyJson = JSON.stringify(nextDaily);
  const changed =
    prevCompleted.join(',') !== nextCompleted.join(',') ||
    prevSpecial.join(',') !== nextSpecial.join(',') ||
    prevDailyJson !== nextDailyJson;

  return { completedDates: nextCompleted, specialDates: nextSpecial, dailyClearCounts: nextDaily, changed };
}
