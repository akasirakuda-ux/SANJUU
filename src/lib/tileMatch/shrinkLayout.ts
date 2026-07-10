import { TILE_MATCH_MAX_LAYER } from './config';
import { coordKey, placeCoordAvoidingCollision } from './layoutCoordNudge';

export interface LayoutCoord {
  x: number;
  y: number;
  layer: number;
}

export { coordKey } from './layoutCoordNudge';

function layoutBounds(coords: LayoutCoord[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const c of coords) {
    minX = Math.min(minX, c.x);
    maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y);
    maxY = Math.max(maxY, c.y);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
  return { minX, maxX, minY, maxY };
}

/** 同じ (x,y,layer) の重なりを x/y 両方向にずらして解消（縦一列化を防ぐ） */
export function resolveLayoutCoordCollisions(coords: LayoutCoord[]): LayoutCoord[] {
  const used = new Set<string>();
  const out: LayoutCoord[] = [];
  for (const c of coords) {
    out.push(placeCoordAvoidingCollision(c, used, TILE_MATCH_MAX_LAYER));
  }
  return out;
}

export function dedupeLayoutCoords(coords: LayoutCoord[]): LayoutCoord[] {
  const seen = new Set<string>();
  const out: LayoutCoord[] = [];
  for (const c of coords) {
    const k = coordKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

function edgeScore(c: LayoutCoord, bounds: { maxX: number; maxY: number }): number {
  return Math.min(c.x, bounds.maxX - c.x, c.y, bounds.maxY - c.y) + c.layer * 0.35;
}

/** 外側の牌から削って枚数を合わせる（形をなるべく保つ） */
export function shrinkLayoutCoords(coords: LayoutCoord[], target: number): LayoutCoord[] {
  let kept = dedupeLayoutCoords(coords);
  if (kept.length <= target) return kept.slice(0, target);

  const maxX = Math.max(...kept.map((c) => c.x));
  const maxY = Math.max(...kept.map((c) => c.y));
  const bounds = { maxX, maxY };
  const order = [...kept].sort((a, b) => edgeScore(a, bounds) - edgeScore(b, bounds));

  for (const t of order) {
    if (kept.length <= target) break;
    kept = kept.filter((p) => !(p.x === t.x && p.y === t.y && p.layer === t.layer));
  }
  return kept;
}

/** 足りない枚数を、既存の牌山の近くに追加する */
export function growLayoutCoords(coords: LayoutCoord[], target: number): LayoutCoord[] {
  let kept = dedupeLayoutCoords(coords);
  if (kept.length >= target) return kept;

  const used = new Set(kept.map(coordKey));
  const { minX, maxX, minY, maxY } = layoutBounds(kept);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  for (let pad = 2; pad <= 48 && kept.length < target; pad += 2) {
    const candidates: Array<{ c: LayoutCoord; score: number }> = [];
    for (let x = minX - pad; x <= maxX + pad; x += 2) {
      for (let y = minY - pad; y <= maxY + pad; y += 2) {
        for (let layer = 0; layer <= TILE_MATCH_MAX_LAYER; layer += 1) {
          const c = { x, y, layer };
          const k = coordKey(c);
          if (used.has(k)) continue;
          const score = Math.abs(x - cx) + Math.abs(y - cy) + layer * 0.6;
          candidates.push({ c, score });
        }
      }
    }
    candidates.sort((a, b) => a.score - b.score);
    for (const { c } of candidates) {
      if (kept.length >= target) break;
      const k = coordKey(c);
      if (used.has(k)) continue;
      used.add(k);
      kept.push(c);
    }
  }

  // 最後の手段: 牌山の外周に layer 0 を追加（ゲーム進行を止めない）
  let x = minX - 2;
  let y = minY - 2;
  let guard = 0;
  while (kept.length < target && guard < 8000) {
    guard += 1;
    const c = { x, y, layer: 0 };
    const k = coordKey(c);
    if (!used.has(k)) {
      used.add(k);
      kept.push(c);
    }
    x += 2;
    if (x > maxX + 48) {
      x = minX - 2;
      y += 2;
    }
    if (y > maxY + 48) {
      y = minY - 2;
      x = minX + ((kept.length % 20) * 2);
    }
  }
  return kept;
}

export function fitLayoutCoords(coords: LayoutCoord[], target: number): LayoutCoord[] {
  const unique = resolveLayoutCoordCollisions(dedupeLayoutCoords(coords));
  if (unique.length < target) {
    return growLayoutCoords(unique, target);
  }
  if (unique.length === target) return unique;
  return shrinkLayoutCoords(unique, target);
}
