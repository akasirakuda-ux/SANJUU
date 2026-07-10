/** 探しもの（pickup）Worker のタイムアウト — 盤面セル数に応じて延長（10×15 等） */
export function hundredPickupWorkerTimeoutMs(cols: number, rows?: number): number {
  const cells = Math.max(1, cols * Math.max(1, rows ?? cols));
  return Math.min(45_000, 10_000 + cells * 100);
}
