import type { TileMatchDifficultyId } from './config';
import { TILE_MATCH_DIFFICULTY_TILE_COUNTS } from './config';
import { enforceLayoutMaxLayers } from './layerClamp';
import { preparePortraitLayoutCoords } from './portraitLayout';
import { fitLayoutCoords, type LayoutCoord } from './shrinkLayout';

/** 牌山は最大3段（layer 0〜2） */
const MAX_STACK_LAYER = 2;
import turtle144Raw from './turtle144.coords.txt?raw';

function rect(z: number, x0: number, y0: number, x1: number, y1: number, step = 2): LayoutCoord[] {
  const out: LayoutCoord[] = [];
  for (let x = x0; x <= x1; x += step) {
    for (let y = y0; y <= y1; y += step) {
      out.push({ x, y, layer: z });
    }
  }
  return out;
}

function ring(z: number, x0: number, y0: number, x1: number, y1: number): LayoutCoord[] {
  const all = rect(z, x0, y0, x1, y1);
  const innerX0 = x0 + 4;
  const innerY0 = y0 + 4;
  const innerX1 = x1 - 4;
  const innerY1 = y1 - 4;
  if (innerX0 > innerX1 || innerY0 > innerY1) return all;
  return all.filter(
    (c) => c.x <= innerX0 || c.x >= innerX1 || c.y <= innerY0 || c.y >= innerY1
  );
}

function parseTurtleRaw(raw: string): LayoutCoord[] {
  return raw
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [x, y, z] = s.split(',').map(Number);
      return { x, y, layer: z };
    });
}

function buildTurtle(): LayoutCoord[] {
  return parseTurtleRaw(turtle144Raw);
}

/** 中央が高くなるピラミッド */
function buildPyramid(): LayoutCoord[] {
  return [
    ...rect(0, 4, 0, 24, 14),
    ...rect(1, 8, 2, 20, 12),
    ...rect(2, 10, 4, 18, 10),
    { x: 13, y: 7, layer: MAX_STACK_LAYER },
  ];
}

/** 縦長のダイヤモンド（マンハッタン距離） */
function buildDiamond(): LayoutCoord[] {
  const cx = 14;
  const cy = 8;
  const out: LayoutCoord[] = [];
  for (let z = 0; z <= MAX_STACK_LAYER; z++) {
    const r = 3 - z;
    for (let gx = -r; gx <= r; gx++) {
      for (let gy = -r; gy <= r; gy++) {
        if (Math.abs(gx) + Math.abs(gy) <= r) {
          out.push({ x: cx + gx * 2, y: cy + gy * 2, layer: z });
        }
      }
    }
  }
  return out;
}

/** 十字型 */
function buildCross(): LayoutCoord[] {
  return [
    ...rect(0, 2, 6, 26, 8),
    ...rect(0, 8, 0, 20, 14),
    ...rect(1, 6, 2, 22, 12),
    ...rect(2, 10, 4, 18, 10),
    { x: 13, y: 7, layer: MAX_STACK_LAYER },
  ];
}

/** 中空の城壁＋内側の塔 */
function buildFortress(): LayoutCoord[] {
  return [
    ...ring(0, 2, 0, 26, 14),
    ...rect(1, 8, 3, 20, 11),
    ...rect(2, 10, 5, 18, 9),
    { x: 13, y: 7, layer: MAX_STACK_LAYER },
  ];
}

/** 左右の峰（双塔） */
function buildTwinPeaks(): LayoutCoord[] {
  const left = [
    ...rect(0, 2, 2, 12, 12),
    ...rect(1, 4, 4, 10, 10),
    ...rect(2, 6, 6, 8, 8),
    { x: 7, y: 7, layer: MAX_STACK_LAYER },
  ];
  const right = [
    ...rect(0, 16, 2, 26, 12),
    ...rect(1, 18, 4, 24, 10),
    ...rect(2, 20, 6, 22, 8),
    { x: 21, y: 7, layer: MAX_STACK_LAYER },
  ];
  const bridge = rect(0, 12, 6, 16, 8);
  return [...left, ...right, ...bridge, { x: 13, y: 7, layer: MAX_STACK_LAYER }];
}

/** 階段状に段々 */
function buildStairs(): LayoutCoord[] {
  const out: LayoutCoord[] = [];
  for (let z = 0; z <= MAX_STACK_LAYER; z++) {
    out.push(...rect(z, 4 + z * 2, 2 + z * 2, 24 - z * 2, 12 - z * 2));
  }
  return out;
}

/** 段々テラス（旧・柱型は縦に細長く見えるため廃止） */
function buildColumns(): LayoutCoord[] {
  const out: LayoutCoord[] = [];
  for (let z = 0; z <= MAX_STACK_LAYER; z++) {
    out.push(...rect(z, 2 + z * 2, 2 + z * 2, 26 - z * 2, 14 - z * 2));
  }
  return out;
}

/** 扇形（下辺が広い山） */
function buildFan(): LayoutCoord[] {
  const out: LayoutCoord[] = [];
  for (let z = 0; z <= MAX_STACK_LAYER; z++) {
    const w = 11 - z;
    for (let i = 0; i < w; i++) {
      out.push({ x: 2 + i * 2, y: 14 - z * 2, layer: z });
    }
    out.push(...rect(z, 6 + z * 2, 2, 22 - z * 2, 12 - z * 2));
  }
  return out;
}

/** 中央の門＋左右の翼 */
function buildGate(): LayoutCoord[] {
  const wings = [
    ...rect(0, 0, 2, 8, 12),
    ...rect(0, 20, 2, 28, 12),
    ...rect(1, 2, 4, 6, 10),
    ...rect(1, 22, 4, 26, 10),
  ];
  const gate = [
    ...rect(0, 10, 0, 18, 14),
    ...rect(1, 12, 2, 16, 12),
    ...rect(2, 12, 4, 16, 10),
    { x: 13, y: 7, layer: MAX_STACK_LAYER },
  ];
  return [...wings, ...gate];
}

/** 細長い龍の背骨 */
function buildDragon(): LayoutCoord[] {
  const spine = [
    { x: 2, y: 7, layer: 0 },
    { x: 6, y: 5, layer: 0 },
    { x: 10, y: 7, layer: 0 },
    { x: 14, y: 5, layer: 0 },
    { x: 18, y: 7, layer: 0 },
    { x: 22, y: 5, layer: 0 },
    { x: 26, y: 7, layer: 0 },
  ];
  const body = [
    ...rect(0, 4, 3, 24, 11),
    ...rect(1, 6, 4, 22, 10),
    ...rect(2, 8, 5, 20, 9),
    { x: 13, y: 7, layer: MAX_STACK_LAYER },
  ];
  return [...spine, ...body];
}

export interface TileMatchLayoutDef {
  id: string;
  labelJa: string;
  buildMaster: () => LayoutCoord[];
}

/** 牌山の形バリエーション（10種） */
export const TILE_MATCH_LAYOUTS: TileMatchLayoutDef[] = [
  { id: 'turtle', labelJa: '亀', buildMaster: buildTurtle },
  { id: 'pyramid', labelJa: 'ピラミッド', buildMaster: buildPyramid },
  { id: 'diamond', labelJa: 'ダイヤ', buildMaster: buildDiamond },
  { id: 'cross', labelJa: '十字', buildMaster: buildCross },
  { id: 'fortress', labelJa: '城', buildMaster: buildFortress },
  { id: 'twin-peaks', labelJa: '双塔', buildMaster: buildTwinPeaks },
  { id: 'stairs', labelJa: '階段', buildMaster: buildStairs },
  { id: 'columns', labelJa: '柱', buildMaster: buildColumns },
  { id: 'fan', labelJa: '扇', buildMaster: buildFan },
  { id: 'gate', labelJa: '門', buildMaster: buildGate },
];

export const TILE_MATCH_LAYOUT_COUNT = TILE_MATCH_LAYOUTS.length;

export function pickLayoutIndex(seed: number): number {
  return Math.abs(seed >>> 0) % TILE_MATCH_LAYOUTS.length;
}

export function getLayoutDef(index: number): TileMatchLayoutDef {
  return TILE_MATCH_LAYOUTS[index % TILE_MATCH_LAYOUTS.length];
}

export function buildLayoutForGame(
  difficulty: TileMatchDifficultyId,
  seed: number
): {
  slots: Array<{ id: number; x: number; y: number; layer: number }>;
  layoutId: string;
  layoutLabelJa: string;
} {
  // 亀（turtle）を基準形に。他形は衝突解消で縦一列化しやすいため当面固定
  const def = getLayoutDef(0);
  pickLayoutIndex(seed);
  const target = TILE_MATCH_DIFFICULTY_TILE_COUNTS[difficulty];
  const layered = enforceLayoutMaxLayers(def.buildMaster());
  const fitted = fitLayoutCoords(preparePortraitLayoutCoords(layered), target);
  const slots = fitted.map((c, id) => ({
    id,
    x: c.x,
    y: c.y,
    layer: c.layer,
  }));
  return { slots, layoutId: def.id, layoutLabelJa: def.labelJa };
}
