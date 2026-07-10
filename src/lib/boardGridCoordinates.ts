/** 配信向け盤面座標: 列 A, B, … Z, AA … */
export function boardGridColumnLabel(index: number): string {
  let n = index;
  let label = '';
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

export type CoordGutterMetrics = {
  left: number;
  top: number;
  fontSize: number;
};

/** 行番号（最大2桁）・列アルファベットが収まる余白 */
export function measureCoordGutter(cellSize: number): CoordGutterMetrics {
  const base = Math.min(14, Math.max(9, cellSize * 0.45));
  const fontSize = Math.min(21, base * 1.5);
  return {
    left: Math.max(22, fontSize * 1.35),
    top: Math.max(16, fontSize * 1.05),
    fontSize,
  };
}
