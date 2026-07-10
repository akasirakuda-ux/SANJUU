import type { LayoutCoord } from './shrinkLayout';

/** 2刻みグリッド上の衝突回避（縦一列に積まないよう x/y 両方） */
export const LAYOUT_COORD_NUDGES: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 2, dy: 0 },
  { dx: 0, dy: 2 },
  { dx: 2, dy: 2 },
  { dx: -2, dy: 0 },
  { dx: 0, dy: -2 },
  { dx: -2, dy: 2 },
  { dx: 4, dy: 0 },
  { dx: 0, dy: 4 },
  { dx: -4, dy: 0 },
  { dx: 0, dy: -4 },
  { dx: 4, dy: 2 },
  { dx: -4, dy: 2 },
];

export function coordKey(c: LayoutCoord): string {
  return `${c.x},${c.y},${c.layer}`;
}

export function placeCoordAvoidingCollision(
  c: LayoutCoord,
  used: Set<string>,
  maxLayer: number
): LayoutCoord {
  let { x, y, layer } = c;
  layer = Math.min(Math.max(0, layer), maxLayer);
  let guard = 0;

  while (used.has(coordKey({ x, y, layer })) && guard < 72) {
    if (guard < 6 && layer < maxLayer) {
      layer += 1;
    } else {
      // guard < 6 かつ layer が上限のとき (guard-6) が負になり u.dx で落ちるのを防ぐ
      const n = LAYOUT_COORD_NUDGES[guard % LAYOUT_COORD_NUDGES.length];
      x += n.dx;
      y += n.dy;
    }
    guard += 1;
  }

  const placed = { x, y, layer };
  used.add(coordKey(placed));
  return placed;
}
