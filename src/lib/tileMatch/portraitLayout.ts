import type { LayoutCoord } from './shrinkLayout';
import { resolveLayoutCoordCollisions } from './shrinkLayout';

/** 半グリッド（layouts.TILE_GRID_SPAN と同値） */
const GRID_SPAN = 2;

/** 半グリッド上の牌山中心（縦長スマホ向け） */
export const PORTRAIT_LAYOUT_CENTER_X = 14;
export const PORTRAIT_LAYOUT_CENTER_Y = 16;

/** 横長とみなす閾値（幅 ÷ 高さ）。これ未満なら90°回転して縦長牌山に */
const PORTRAIT_TRANSPOSE_ASPECT = 1.15;

function coordSpan(coords: LayoutCoord[]): { spanX: number; spanY: number; minX: number; minY: number } {
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
    return { spanX: 0, spanY: 0, minX: 0, minY: 0 };
  }
  return { spanX: maxX - minX, spanY: maxY - minY, minX, minY };
}

function snapHalfGrid(n: number): number {
  return Math.round(n / 2) * 2;
}

/**
 * 牌山の縦横バランスを整える（細長い縦列・横一列は 90° 回転）。
 */
export function orientLayoutForPortrait(coords: LayoutCoord[]): LayoutCoord[] {
  if (coords.length === 0) return coords;
  const { spanX, spanY } = coordSpan(coords);
  if (spanY > spanX * PORTRAIT_TRANSPOSE_ASPECT || spanX > spanY * PORTRAIT_TRANSPOSE_ASPECT) {
    return coords.map((c) => ({ x: c.y, y: c.x, layer: c.layer }));
  }
  return coords;
}

/** 牌山を縦長フィールドの中央へ寄せる（2刻みグリッドにスナップ） */
export function centerLayoutCoords(coords: LayoutCoord[]): LayoutCoord[] {
  if (coords.length === 0) return coords;
  const { minX, minY, spanX, spanY } = coordSpan(coords);
  const cx = minX + spanX / 2;
  const cy = minY + spanY / 2;
  const dx = snapHalfGrid(PORTRAIT_LAYOUT_CENTER_X - cx);
  const dy = snapHalfGrid(PORTRAIT_LAYOUT_CENTER_Y - cy);
  if (dx === 0 && dy === 0) return coords;
  return coords.map((c) => ({
    x: c.x + dx,
    y: c.y + dy,
    layer: c.layer,
  }));
}

/**
 * 論理座標に上海型の一段ずらし（横・縦に半マス）。
 * 上の段は下の段の「合い目」に乗る。横並びは hPitch 調整で隙間なく接する。
 */
export function applyShanghaiBrickStagger(coords: LayoutCoord[]): LayoutCoord[] {
  return coords.map((c) => {
    const row = Math.floor(c.y / GRID_SPAN);
    if (row % 2 !== 1) return c;
    return { x: c.x + 1, y: c.y + 1, layer: c.layer };
  });
}

/** 論理座標の重心をフィールド中央へ（見た目の安定感） */
export function centerLayoutCoordsByMass(coords: LayoutCoord[]): LayoutCoord[] {
  if (coords.length === 0) return coords;
  let sumX = 0;
  let sumY = 0;
  for (const c of coords) {
    sumX += c.x;
    sumY += c.y;
  }
  const cx = sumX / coords.length;
  const cy = sumY / coords.length;
  const dx = snapHalfGrid(PORTRAIT_LAYOUT_CENTER_X - cx);
  const dy = snapHalfGrid(PORTRAIT_LAYOUT_CENTER_Y - cy);
  if (dx === 0 && dy === 0) return coords;
  return coords.map((c) => ({ x: c.x + dx, y: c.y + dy, layer: c.layer }));
}

/** 配牌前のマスター座標をスマホ縦画面向けに整える（段ずらしは描画側で適用） */
export function preparePortraitLayoutCoords(coords: LayoutCoord[]): LayoutCoord[] {
  const oriented = orientLayoutForPortrait(coords);
  const centered = centerLayoutCoordsByMass(centerLayoutCoords(oriented));
  return resolveLayoutCoordCollisions(centered);
}
