const RK_PRIMARY_FALLBACK = 'rgb(0 200 116)';
const RK_HUB_BARK_FALLBACK = 'rgb(90 61 40)';

/** `--rk-band-0` … と同順・同値（CSS 未適用時・TEST 用。canvas は `rgb()` 可） */
const RK_BAND_FALLBACKS = [
  'rgb(255 107 107)',
  'rgb(78 205 196)',
  'rgb(69 183 209)',
  'rgb(255 165 2)',
  'rgb(123 237 159)',
  'rgb(112 161 255)',
  'rgb(255 127 80)',
  'rgb(162 155 254)',
  'rgb(232 67 147)',
  'rgb(46 213 115)',
] as const;

const RK_BAND_COUNT = RK_BAND_FALLBACKS.length;

function readRootVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** 任意の `:root` 色（canvas / QR / stroke 用）。未設定時は fallback */
export function rkCssColor(varName: string, fallback: string): string {
  return readRootVar(varName, fallback);
}

/** 盤面 canvas 等：`index.css` の `--rk-accent-primary` を解決（未設定時は `rgb()` フォールバック） */
export function rkResolvedAccentPrimary(): string {
  return readRootVar('--rk-accent-primary', RK_PRIMARY_FALLBACK);
}

/** QR・canvas 等：`index.css` の `--rk-hub-bark` を解決 */
export function rkResolvedHubBark(): string {
  return readRootVar('--rk-hub-bark', RK_HUB_BARK_FALLBACK);
}

/** マルチ帯・パーティクル（canvas は `var(...)` 不可のため解決済み色文字列を返す） */
export function rkResolvedBandColor(index: number): string {
  const n = ((index % RK_BAND_COUNT) + RK_BAND_COUNT) % RK_BAND_COUNT;
  return readRootVar(`--rk-band-${n}`, RK_BAND_FALLBACKS[n]!);
}

export function rkBandColorCount(): number {
  return RK_BAND_COUNT;
}

/** 正解帯用: 10 色パレットからランダムに 1 色 */
export function pickRandomBandColor(): string {
  return rkResolvedBandColor(Math.floor(Math.random() * RK_BAND_COUNT));
}

function bandColorFromOccurrenceKey(
  word: string,
  start: { x: number; y: number },
  end: { x: number; y: number }
): string {
  const ax = start.x | 0;
  const ay = start.y | 0;
  const bx = end.x | 0;
  const by = end.y | 0;
  const k1 = `${word}|${ax},${ay}-${bx},${by}`;
  const k2 = `${word}|${bx},${by}-${ax},${ay}`;
  const key = k1 < k2 ? k1 : k2;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return rkResolvedBandColor(Math.abs(h) % RK_BAND_COUNT);
}

/** Firestore に色が無い古い foundWords 用（10 色パレットから座標で分散） */
export function rkBandColorForOccurrenceKey(
  word: string,
  start: { x: number; y: number },
  end: { x: number; y: number }
): string {
  return bandColorFromOccurrenceKey(word, start, end);
}
