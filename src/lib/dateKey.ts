/**
 * YYYY-MM-DD key in a specific IANA time zone.
 *
 * Important: do NOT use Date#toISOString().split('T')[0] for "today" keys.
 * That yields a UTC date and will shift around local midnight (e.g. JST).
 */
export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  // sv-SE formats as "YYYY-MM-DD" reliably.
  // We intentionally avoid locale-dependent ordering like ja-JP.
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function todayKeyJst(now: Date = new Date()): string {
  return dateKeyInTimeZone(now, 'Asia/Tokyo');
}
