/** 同サイズでも中身が違う盤面を同一扱いしない（端末ごと別盤面のまま同期されないのを防ぐ） */
export function hundredBoardKeySignature(grid: string[][]): string {
  if (!grid?.length || !grid[0]?.length) return '0';
  const r0 = grid[0].join('');
  const rLast = grid[grid.length - 1].join('');
  return `${grid.length}x${grid[0].length}:${r0.slice(0, 12)}:${rLast.slice(-12)}`;
}

export function hundredGridsContentEqual(a: string[][] | undefined, b: string[][] | undefined): boolean {
  if (!a?.length || !b?.length) return false;
  return hundredBoardKeySignature(a) === hundredBoardKeySignature(b);
}
