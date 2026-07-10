/** 9×9数字パズル — この端末だけの見た目（localStorage） */

export type SudokuViewPrefs = {
  userDigitColor: string;
  memoDigitColor: string;
};

export const SUDOKU_DEFAULT_VIEW_PREFS: SudokuViewPrefs = {
  userDigitColor: '#065f46',
  memoDigitColor: '#047857',
};

const STORAGE_KEY = 'rk_sudoku_view_prefs_v1';

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function loadSudokuViewPrefs(): SudokuViewPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...SUDOKU_DEFAULT_VIEW_PREFS };
    const parsed = JSON.parse(raw) as Partial<SudokuViewPrefs>;
    return {
      userDigitColor: isHexColor(parsed.userDigitColor)
        ? parsed.userDigitColor
        : SUDOKU_DEFAULT_VIEW_PREFS.userDigitColor,
      memoDigitColor: isHexColor(parsed.memoDigitColor)
        ? parsed.memoDigitColor
        : SUDOKU_DEFAULT_VIEW_PREFS.memoDigitColor,
    };
  } catch {
    return { ...SUDOKU_DEFAULT_VIEW_PREFS };
  }
}

export function saveSudokuViewPrefs(prefs: SudokuViewPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}
