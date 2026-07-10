import type { TileMatchDifficultyId } from './config';
import { TILE_MATCH_MAX_LAYER } from './config';

/** 上海型レイアウト：x,y は半牌幅グリッド（2刻み）、layer は z */
export interface TileSlot {
  id: number;
  x: number;
  y: number;
  layer: number;
}

export {
  buildLayoutForGame,
  getLayoutDef,
  pickLayoutIndex,
  TILE_MATCH_LAYOUT_COUNT,
  TILE_MATCH_LAYOUTS,
} from './layoutCatalog';
export type { TileMatchLayoutDef } from './layoutCatalog';

/** トランプ型カードの縦横比（幅:高さ ≒ 5:7） */
export const PLAYING_CARD_ASPECT_RATIO = '5 / 7' as const;

/** @deprecated トランプ型へ移行。`PLAYING_CARD_ASPECT_RATIO` を使用 */
export const MAHJONG_TILE_ASPECT_RATIO = PLAYING_CARD_ASPECT_RATIO;

/** 1牌の幅（半グリッド2 = 1牌） */
export const TILE_GRID_SPAN = 2;

export const TILE_LAYER_SHIFT_PX = 2;
export const TILE_BOARD_PAD_PX = 3;

/** 牌面 border 2px が隣と重なる分（横・縦ともくっつける） */
export const TILE_FACE_BORDER_PX = 2;

/** 画面いっぱいに牌山を載せる目標比率 */
/** 牌山を表示領域いっぱいに（iPad 縦画面で下の空白を残さない） */
export const TILE_MATCH_VIEWPORT_FILL = 1;

/** 1段上の牌は真上ではなく、横・縦に半牌ずらして重なる（上海型） */
export function tileLayerStackOffsetPx(
  cell: number,
  layer: number
): { dx: number; dy: number } {
  if (layer <= 0) return { dx: 0, dy: 0 };
  const { w, h } = playingCardPixelSize(cell);
  const clampedLayer = Math.min(layer, TILE_MATCH_MAX_LAYER);
  return {
    dx: Math.round((clampedLayer * w) / 2),
    dy: Math.round((clampedLayer * h) / 2),
  };
}

/** トランプ型カードのピクセル寸法（立体の厚みは使わない） */
export function playingCardPixelSize(cell: number): {
  w: number;
  h: number;
  colPitch: number;
  rowPitch: number;
} {
  const w = Math.max(cell, 18);
  const h = Math.max(Math.round((w * 7) / 5), w + 4);
  return { w, h, colPitch: w, rowPitch: h };
}

/** @deprecated `playingCardPixelSize` を使用 */
export function mahjongTilePixelSize(cell: number): {
  w: number;
  h: number;
  colPitch: number;
  rowPitch: number;
  depth: number;
} {
  const { w, h, colPitch, rowPitch } = playingCardPixelSize(cell);
  return { w, h, colPitch, rowPitch, depth: 0 };
}

/** 横方向の中心間隔（隣の牌面が隙間なく接する） */
export function tileHorizontalPitchPx(cell: number): number {
  const { w } = mahjongTilePixelSize(cell);
  return w - TILE_FACE_BORDER_PX * 2;
}

/** 縦方向の段間隔（牌面どうしが接する） */
export function tileVerticalPitchPx(cell: number): number {
  const { h } = mahjongTilePixelSize(cell);
  return h - TILE_FACE_BORDER_PX * 2;
}

export function tileMatchBoardPixelSize(
  slots: TileSlot[],
  _difficulty: TileMatchDifficultyId,
  cell = 28,
  pad = TILE_BOARD_PAD_PX
): { width: number; height: number; cell: number; maxLayer: number; pad: number } {
  const { maxX, maxY, maxLayer } = layoutBounds(slots);
  const cols = maxX / TILE_GRID_SPAN + 1;
  const rows = maxY / TILE_GRID_SPAN + 1;
  const hPitch = tileHorizontalPitchPx(cell);
  const vPitch = tileVerticalPitchPx(cell);
  return {
    cell,
    maxLayer,
    pad,
    rowPitch: vPitch,
    colPitch: hPitch,
    width:
      pad * 2 +
      cols * hPitch +
      tileLayerStackOffsetPx(cell, maxLayer).dx,
    height:
      pad * 2 +
      rows * vPitch +
      tileLayerStackOffsetPx(cell, maxLayer).dy,
  };
}

export function layoutBounds(slots: TileSlot[]): { maxX: number; maxY: number; maxLayer: number } {
  let maxX = 0;
  let maxY = 0;
  let maxLayer = 0;
  for (const s of slots) {
    if (s.x > maxX) maxX = s.x;
    if (s.y > maxY) maxY = s.y;
    if (s.layer > maxLayer) maxLayer = s.layer;
  }
  return { maxX, maxY, maxLayer };
}

/** 横はくっつけ、層は半牌ずらしで重ねる（一段ずらしは論理座標側） */
export function slotDisplayPx(
  slot: TileSlot,
  cell: number,
  pad = TILE_BOARD_PAD_PX
): { left: number; top: number } {
  const stack = tileLayerStackOffsetPx(cell, slot.layer);
  const hPitch = tileHorizontalPitchPx(cell);
  const vPitch = tileVerticalPitchPx(cell);
  return {
    left: pad + (slot.x / TILE_GRID_SPAN) * hPitch + stack.dx,
    top: pad + (slot.y / TILE_GRID_SPAN) * vPitch + stack.dy,
  };
}

/** 牌1枚の描画矩形（3D厚み込み） */
export function tileShellBoundsPx(
  slot: TileSlot,
  cell: number,
  pad = TILE_BOARD_PAD_PX
): { left: number; top: number; width: number; height: number } {
  const pos = slotDisplayPx(slot, cell, pad);
  const { w, h } = playingCardPixelSize(cell);
  return { left: pos.left, top: pos.top, width: w, height: h };
}

/** 牌の実占有矩形（扇・亀など空白セル分を除く）— 卓内の視覚中心用 */
export function layoutContentPixelBounds(
  slots: TileSlot[],
  cell: number,
  pad = TILE_BOARD_PAD_PX
): { minLeft: number; minTop: number; width: number; height: number } {
  let minLeft = Infinity;
  let minTop = Infinity;
  let maxRight = 0;
  let maxBottom = 0;
  for (const slot of slots) {
    const b = tileShellBoundsPx(slot, cell, pad);
    minLeft = Math.min(minLeft, b.left);
    minTop = Math.min(minTop, b.top);
    maxRight = Math.max(maxRight, b.left + b.width);
    maxBottom = Math.max(maxBottom, b.top + b.height);
  }
  if (!Number.isFinite(minLeft)) {
    return { minLeft: 0, minTop: 0, width: 0, height: 0 };
  }
  return {
    minLeft,
    minTop,
    width: maxRight - minLeft,
    height: maxBottom - minTop,
  };
}

/** 親領域いっぱいに収める緑卓サイズ（px）。縦画面は高さ優先 */
export function fitMahjongBoardFramePx(
  containerW: number,
  containerH: number
): { w: number; h: number } {
  const cw = Math.max(1, containerW);
  const ch = Math.max(1, containerH);
  const portrait = ch > cw * 1.05;
  if (portrait) {
    const h = Math.floor(ch);
    const w = Math.min(Math.floor(cw), Math.floor(h * 0.82));
    return { w, h };
  }
  const byWidth = { w: cw, h: (cw * 4) / 3 };
  if (byWidth.h <= ch) return { w: Math.floor(byWidth.w), h: Math.floor(byWidth.h) };
  const byHeight = { w: (ch * 3) / 4, h: ch };
  return { w: Math.floor(byHeight.w), h: Math.floor(byHeight.h) };
}

export interface TileMatchDisplayLayout {
  cell: number;
  pad: number;
  /** 牌山ラッパーへの transform scale（牌の縦横比は維持） */
  scale: number;
  width: number;
  height: number;
  contentMinLeft: number;
  contentMinTop: number;
  contentW: number;
  contentH: number;
  scaledContentW: number;
  scaledContentH: number;
}

/**
 * 牌の実矩形に合わせてセルサイズ・拡大率を決める（空白グリッドで縮まない）。
 */
export function computeTileMatchDisplayLayout(
  slots: TileSlot[],
  availW: number,
  availH: number,
  isRemoved: (slotId: number) => boolean
): TileMatchDisplayLayout {
  const pad = TILE_BOARD_PAD_PX;
  const activeSlots = slots.filter((s) => !isRemoved(s.id));
  const measureSlots = activeSlots.length > 0 ? activeSlots : slots;

  let cell = 28;
  let content = layoutContentPixelBounds(measureSlots, cell, pad);
  for (let i = 0; i < 4; i++) {
    const scaleW = (availW * TILE_MATCH_VIEWPORT_FILL) / Math.max(1, content.width);
    const scaleH = (availH * TILE_MATCH_VIEWPORT_FILL) / Math.max(1, content.height);
    const scale = Math.min(scaleW, scaleH);
    const nextCell = Math.max(18, Math.min(80, Math.floor(cell * scale)));
    if (nextCell === cell) break;
    cell = nextCell;
    content = layoutContentPixelBounds(measureSlots, cell, pad);
  }

  const base = tileMatchBoardPixelSize(slots, 'hard', cell, pad);
  const scaleW = (availW * TILE_MATCH_VIEWPORT_FILL) / Math.max(1, content.width);
  const scaleH = (availH * TILE_MATCH_VIEWPORT_FILL) / Math.max(1, content.height);
  let scale = scaleW;
  if (content.height * scale > availH * TILE_MATCH_VIEWPORT_FILL) {
    scale = scaleH;
  }
  scale = Math.min(Math.max(scale, 0.35), 6);
  const scaledContentW = content.width * scale;
  const scaledContentH = content.height * scale;

  return {
    cell,
    pad,
    scale,
    width: base.width,
    height: base.height,
    contentMinLeft: content.minLeft,
    contentMinTop: content.minTop,
    contentW: content.width,
    contentH: content.height,
    scaledContentW,
    scaledContentH,
  };
}
