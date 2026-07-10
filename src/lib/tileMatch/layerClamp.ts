import type { LayoutCoord } from './shrinkLayout';
import { TILE_MATCH_MAX_LAYER } from './config';
import { placeCoordAvoidingCollision } from './layoutCoordNudge';

/**
 * 牌山の積み上げを最大3段（layer 0〜2）にそろえる。
 */
export function enforceLayoutMaxLayers(
  coords: LayoutCoord[],
  maxLayer = TILE_MATCH_MAX_LAYER
): LayoutCoord[] {
  const used = new Set<string>();
  const sorted = [...coords].sort(
    (a, b) => a.layer - b.layer || a.y - b.y || a.x - b.x
  );
  const out: LayoutCoord[] = [];

  for (const c of sorted) {
    const layer = Math.min(Math.max(0, c.layer), maxLayer);
    out.push(placeCoordAvoidingCollision({ x: c.x, y: c.y, layer }, used, maxLayer));
  }

  return out;
}
