/** 9×9 各マスの候補 — 例 "137" */
export type SudokuNotesGrid = string[][];

export function emptySudokuNotesGrid(): SudokuNotesGrid {
  return Array.from({ length: 9 }, () => Array(9).fill(''));
}

export function cloneSudokuNotesGrid(notes: SudokuNotesGrid): SudokuNotesGrid {
  return notes.map((row) => [...row]);
}

export function hasSudokuNote(notes: SudokuNotesGrid, row: number, col: number, digit: number): boolean {
  if (digit < 1 || digit > 9) return false;
  return (notes[row]?.[col] ?? '').includes(String(digit));
}

export function toggleSudokuNote(notes: SudokuNotesGrid, row: number, col: number, digit: number): SudokuNotesGrid {
  if (digit < 1 || digit > 9) return notes;
  const next = cloneSudokuNotesGrid(notes);
  const d = String(digit);
  const cur = next[row][col] ?? '';
  next[row][col] = cur.includes(d)
    ? cur
        .split('')
        .filter((c) => c !== d)
        .sort((a, b) => Number(a) - Number(b))
        .join('')
    : (cur + d)
        .split('')
        .sort((a, b) => Number(a) - Number(b))
        .join('');
  return next;
}

export function clearSudokuCellNotes(notes: SudokuNotesGrid, row: number, col: number): SudokuNotesGrid {
  const next = cloneSudokuNotesGrid(notes);
  next[row][col] = '';
  return next;
}

export function cellHasSudokuNotes(notes: SudokuNotesGrid, row: number, col: number): boolean {
  return (notes[row]?.[col] ?? '').length > 0;
}

/** 1〜9 をマス内 3×3 の位置（0-based） — 1左上、9右下 */
export function sudokuMemoSubCell(digit: number): { subR: number; subC: number } {
  const i = digit - 1;
  return { subR: Math.floor(i / 3), subC: i % 3 };
}
