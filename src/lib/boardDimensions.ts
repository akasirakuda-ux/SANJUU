/** 盤面の列・行（正方形は cols === rows） */

import { isPickupEmojiWordOnly, pickupEmojiGraphemeCount } from './pickupEmojiSymbols';

export function resolveBoardCols(
  source: { boardCols?: number; boardSize?: number; grid?: string[][] } | undefined,
): number {
  if (!source) return 10;
  if (typeof source.boardCols === 'number' && source.boardCols > 0) return source.boardCols;
  const fromGrid = source.grid?.[0]?.length;
  if (typeof fromGrid === 'number' && fromGrid > 0) return fromGrid;
  const size = typeof source.boardSize === 'number' ? source.boardSize : Number(source.boardSize) || 10;
  return size > 0 ? size : 10;
}

export function resolveBoardRows(
  source: { boardRows?: number; boardSize?: number; grid?: string[][] } | undefined,
): number {
  if (!source) return 10;
  if (typeof source.boardRows === 'number' && source.boardRows > 0) return source.boardRows;
  const fromGrid = source.grid?.length;
  if (typeof fromGrid === 'number' && fromGrid > 0) return fromGrid;
  const size = typeof source.boardSize === 'number' ? source.boardSize : Number(source.boardSize) || 10;
  return size > 0 ? size : 10;
}

export function formatBoardDimensions(
  source: { boardCols?: number; boardRows?: number; boardSize?: number } | undefined,
): string {
  const cols = resolveBoardCols(source);
  const rows = resolveBoardRows(source);
  return `${cols}×${rows}`;
}

/** 探すことばが盤面に収まるか（横・縦のどちらかに載れば OK） */
export function targetWordFitsBoard(targetWord: string, cols: number, rows: number): boolean {
  const trimmed = (targetWord || '').trim();
  const len = isPickupEmojiWordOnly(trimmed)
    ? pickupEmojiGraphemeCount(trimmed)
    : Array.from(trimmed).length;
  if (len <= 0) return false;
  return len <= cols || len <= rows;
}
