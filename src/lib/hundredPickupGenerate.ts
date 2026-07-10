import { PROHIBITED_WORDS } from '../constants';
import type { PickupCharset } from './hundredPickupCharset';
import { WORKER_CODE } from './puzzleWorker';

export type PickupGenerateParams = {
  cols: number;
  rows: number;
  targetWord: string;
  seed: number;
  pickupCharset: PickupCharset;
  prohibitedWords?: string[];
};

export type PickupGenerateResult = {
  grid: string[][]; 
  placedWords: unknown[];
  density?: number;
};

type WorkerPayload = {
  grid?: string[][];
  placedWords?: unknown[];
  density?: number;
};

const pickupSelf: {
  postMessage: (data: WorkerPayload) => void;
  onmessage: ((e: { data: unknown }) => void) | null;
  lastPayload: WorkerPayload | null;
} = {
  postMessage(data) {
    pickupSelf.lastPayload = data;
  },
  onmessage: null,
  lastPayload: null,
};

let pickupBootstrapped = false;

function ensurePickupBootstrapped(): void {
  if (pickupBootstrapped) return;
  const fn = new Function('self', WORKER_CODE);
  fn(pickupSelf);
  if (!pickupSelf.onmessage) throw new Error('pickup worker bootstrap failed');
  pickupBootstrapped = true;
}

/** 探しもの盤面を同期的に生成（10×15 等は通常 50ms 未満） */
export function runPickupGenerationSync(params: PickupGenerateParams): PickupGenerateResult | null {
  ensurePickupBootstrapped();
  const { cols, rows, targetWord, seed, pickupCharset } = params;
  const prohibitedWords =
    params.prohibitedWords ??
    (pickupCharset === 'hiragana' ? PROHIBITED_WORDS : []);

  pickupSelf.lastPayload = null;
  pickupSelf.onmessage!({
    data: {
      category: 'pickup',
      size: cols,
      cols,
      rows,
      dictionary: [targetWord],
      targetWord,
      prohibitedWords,
      isKanji: false,
      seed,
      isKatakana: false,
      pickupCharset,
    },
  });

  const data = pickupSelf.lastPayload;
  const grid = data?.grid;
  if (!Array.isArray(grid) || grid.length === 0) return null;

  return {
    grid,
    placedWords: Array.isArray(data.placedWords) ? data.placedWords : [],
    density: typeof data.density === 'number' ? data.density : undefined,
  };
}

/** Worker 起動コストを避ける — 15×20 まで sync 可 */
export function shouldRunPickupSync(cols: number, rows: number): boolean {
  return cols * rows <= 400;
}
