import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Eraser, Grid3x3, Lightbulb, Pencil, Settings2, Undo2 } from 'lucide-react';
import {
  SUDOKU_DIFFICULTY_HINT,
  SUDOKU_DIFFICULTY_LABEL,
  emptySudokuGrid,
  findSudokuConflictKeys,
  generateSudokuPuzzle,
  initialUserGridFromPuzzle,
  isSudokuSolved,
  pickSudokuHintCell,
  sudokuCellKey,
  type SudokuDifficulty,
  type SudokuGrid,
  type SudokuPuzzle,
} from '../../lib/sudokuLogic';
import {
  cellHasSudokuNotes,
  emptySudokuNotesGrid,
  hasSudokuNote,
  sudokuMemoSubCell,
  toggleSudokuNote,
  type SudokuNotesGrid,
} from '../../lib/sudokuNotes';
import { RK19QuietRoomBackButton, RK02PrimaryTouchButton, RK03GhostTouchButton } from '../../ui/baselineParts';
import {
  btnGhostTouch,
  btnPrimaryTouch,
  immersiveContentWidth,
  immersiveHeader,
  immersiveKicker,
  immersiveSubtitle,
  immersiveTitle,
} from '../../ui/policy';
import { vibrate } from '../../lib/utils';
import {
  loadSudokuViewPrefs,
  saveSudokuViewPrefs,
  SUDOKU_DEFAULT_VIEW_PREFS,
  type SudokuViewPrefs,
} from '../../lib/sudokuPrefs';
import { appendSudokuClearLog, loadSudokuClearLogs, type SudokuClearLog } from '../../lib/sudokuLog';
import LiveClearReportSoloPanel from '../../components/LiveClearReportSoloPanel';

const TUTORIAL_KEY = 'rk_sudoku_tutorial_v1';
const NOTICE_MS = 1800;
const SUDOKU_MENU_GHOST_BORDER = 'border border-rk-slate-300/80';
const SUDOKU_MENU_GHOST_NARROW = 'w-[calc(100%-2ch)] mx-auto self-center';

type SudokuView = 'menu' | 'tutorial' | 'play' | 'my-settings' | 'logs';

interface SudokuGameProps {
  onBack: () => void;
  /** 1問クリアの区切り（全面広告・最小60秒間隔） */
  onClearInterstitial?: () => void | Promise<void>;
}

function readTutorialSeen(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === '1';
  } catch {
    return false;
  }
}

function markTutorialSeen(): void {
  try {
    localStorage.setItem(TUTORIAL_KEY, '1');
  } catch {
    /* ignore */
  }
}

function cloneSudokuGrid(grid: SudokuGrid): SudokuGrid {
  return grid.map((row) => [...row]);
}

const MAX_UNDO_STEPS = 50;

/** 最初から入っている数字（丸ゴシック） */
const SUDOKU_FONT_GIVEN = '"M PLUS Rounded 1c", Meiryo, sans-serif';
/** 自分で入れた数字・メモ候補（角ゴシック — 未確定/入力分と区別） */
const SUDOKU_FONT_EDITABLE = '"Noto Sans JP", "Hiragino Sans", Meiryo, sans-serif';

const SudokuGame: React.FC<SudokuGameProps> = ({ onBack, onClearInterstitial }) => {
  const clearInterstitialFiredRef = useRef(false);
  const [view, setView] = useState<SudokuView>(() => (readTutorialSeen() ? 'menu' : 'tutorial'));
  const [puzzlePack, setPuzzlePack] = useState<SudokuPuzzle | null>(null);
  const [userGrid, setUserGrid] = useState<SudokuGrid>(() => emptySudokuGrid());
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [hintNotice, setHintNotice] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<SudokuGrid[]>([]);
  const [notesGrid, setNotesGrid] = useState<SudokuNotesGrid>(() => emptySudokuNotesGrid());
  const [memoMode, setMemoMode] = useState(true);
  const [viewPrefs, setViewPrefs] = useState<SudokuViewPrefs>(() => loadSudokuViewPrefs());
  const [clearLogs, setClearLogs] = useState<SudokuClearLog[]>(() => loadSudokuClearLogs());
  const [showInterruptConfirm, setShowInterruptConfirm] = useState(false);
  const userGridRef = useRef(userGrid);
  const memoModeRef = useRef(memoMode);
  const noticeTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    userGridRef.current = userGrid;
  }, [userGrid]);
  useEffect(() => {
    memoModeRef.current = memoMode;
  }, [memoMode]);

  const showNotice = useCallback((message: string) => {
    setHintNotice(message);
    if (noticeTimerRef.current != null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => {
      setHintNotice(null);
      noticeTimerRef.current = undefined;
    }, NOTICE_MS);
  }, []);

  const difficulty = puzzlePack?.difficulty ?? 'easy';
  const fixed = puzzlePack?.fixed ?? [];
  const solution = puzzlePack?.solution ?? userGrid;

  const conflictKeys = useMemo(() => findSudokuConflictKeys(userGrid), [userGrid]);

  const startPuzzle = useCallback((level: SudokuDifficulty) => {
    clearInterstitialFiredRef.current = false;
    const pack = generateSudokuPuzzle(level);
    setPuzzlePack(pack);
    setUserGrid(initialUserGridFromPuzzle(pack));
    setSelected(null);
    setShowClearModal(false);
    setHintNotice(null);
    setUndoStack([]);
    setNotesGrid(emptySudokuNotesGrid());
    setMemoMode(true);
    setView('play');
  }, []);

  const notifyPuzzleClear = useCallback(() => {
    if (clearInterstitialFiredRef.current) return;
    clearInterstitialFiredRef.current = true;
    if (puzzlePack) {
      appendSudokuClearLog(puzzlePack.difficulty);
      setClearLogs(loadSudokuClearLogs());
    }
    setShowClearModal(true);
    void onClearInterstitial?.();
  }, [onClearInterstitial, puzzlePack]);

  const mutateUserGrid = useCallback(
    (mutate: (prev: SudokuGrid) => SudokuGrid, recordUndo = true) => {
      setUserGrid((prev) => {
        const next = mutate(prev);
        if (next === prev) return prev;
        if (recordUndo) {
          setUndoStack((stack) => [...stack.slice(-(MAX_UNDO_STEPS - 1)), cloneSudokuGrid(prev)]);
        }
        if (puzzlePack && isSudokuSolved(next)) {
          window.setTimeout(() => notifyPuzzleClear(), 0);
        }
        return next;
      });
    },
    [notifyPuzzleClear, puzzlePack],
  );

  const handleBack = useCallback(() => {
    vibrate(10);
    if (view === 'play') {
      setView('menu');
      return;
    }
    if (view === 'my-settings' || view === 'logs') {
      setView('menu');
      return;
    }
    onBack();
  }, [onBack, view]);

  const confirmInterrupt = useCallback(() => {
    vibrate(10);
    setShowInterruptConfirm(false);
    setSelected(null);
    setView('menu');
  }, []);

  const handleCellTap = useCallback(
    (row: number, col: number) => {
      if (!puzzlePack) return;
      if (fixed[row]?.[col]) {
        showNotice('最初から入っている数字は消せません');
        return;
      }
      vibrate(5);
      setSelected({ row, col });
    },
    [fixed, puzzlePack, showNotice],
  );

  const applyDigit = useCallback(
    (digit: number) => {
      if (!puzzlePack) return;
      if (!selected) {
        showNotice('マスを選んでから数字を押してください');
        return;
      }
      const { row, col } = selected;
      if (fixed[row][col]) return;
      vibrate(5);

      if (memoModeRef.current) {
        const cellValue = userGridRef.current[row]?.[col] ?? 0;
        if (cellValue !== 0) {
          showNotice('数字が入っています。「消す」で消してからメモを入れてください');
          return;
        }
        const hadNote = hasSudokuNote(notesGrid, row, col, digit);
        setNotesGrid((prev) => toggleSudokuNote(prev, row, col, digit));
        showNotice(hadNote ? `メモ ${digit} を外しました` : `メモ ${digit} を付けました`);
        return;
      }

      mutateUserGrid((prev) => {
        if (prev[row][col] === digit) return prev;
        const next = prev.map((r) => [...r]);
        next[row][col] = digit;
        return next;
      });
      setNotesGrid((prev) => {
        const next = prev.map((r) => [...r]);
        next[row][col] = '';
        return next;
      });
    },
    [fixed, mutateUserGrid, notesGrid, puzzlePack, selected, showNotice],
  );

  const handleClearCell = useCallback(() => {
    if (!selected || !puzzlePack) return;
    const { row, col } = selected;
    if (fixed[row][col]) return;
    const hadValue = userGrid[row][col] !== 0;
    const hadNotes = cellHasSudokuNotes(notesGrid, row, col);
    if (!hadValue && !hadNotes) return;
    if (hadValue) {
      mutateUserGrid((prev) => {
        const next = prev.map((r) => [...r]);
        next[row][col] = 0;
        return next;
      });
    }
    if (hadNotes) {
      setNotesGrid((prev) => {
        const next = prev.map((r) => [...r]);
        next[row][col] = '';
        return next;
      });
    }
  }, [fixed, mutateUserGrid, notesGrid, puzzlePack, selected, userGrid]);

  const handleHint = useCallback(() => {
    if (!puzzlePack) return;
    const hint = pickSudokuHintCell(userGrid, puzzlePack.solution, puzzlePack.fixed);
    if (!hint) {
      setHintNotice('ヒントできるマスはありません');
      window.setTimeout(() => setHintNotice(null), 2200);
      return;
    }
    vibrate(8);
    mutateUserGrid((prev) => {
      const next = prev.map((r) => [...r]);
      next[hint.row][hint.col] = hint.value;
      return next;
    });
    setNotesGrid((prev) => {
      const next = prev.map((r) => [...r]);
      next[hint.row][hint.col] = '';
      return next;
    });
    setSelected({ row: hint.row, col: hint.col });
  }, [mutateUserGrid, puzzlePack, userGrid]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    vibrate(5);
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((stack) => stack.slice(0, -1));
    setUserGrid(cloneSudokuGrid(previous));
    if (puzzlePack && !isSudokuSolved(previous)) {
      setShowClearModal(false);
      clearInterstitialFiredRef.current = false;
    }
  }, [puzzlePack, undoStack]);

  const handleNextPuzzle = useCallback(() => {
    if (!puzzlePack) return;
    startPuzzle(puzzlePack.difficulty);
  }, [puzzlePack, startPuzzle]);

  const finishTutorial = useCallback(() => {
    markTutorialSeen();
    setView('menu');
  }, []);

  const shellClass =
    'absolute inset-0 z-40 h-full max-h-[100dvh] overflow-hidden flex flex-col items-center px-1.5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] text-[clamp(0.9375rem,3.6vw,1.0625rem)] bg-gradient-to-b from-rk-indigo-100 via-rk-sky-50 to-rk-indigo-100 text-rk-indigo-950';

  const compactPlayChrome = view === 'play';

  return (
    <div className={shellClass}>
      <header className={`${immersiveHeader} ${compactPlayChrome ? 'mb-0.5' : ''}`}>
        <RK19QuietRoomBackButton onClick={handleBack} aria-label="戻る" />
        <p className={`${immersiveKicker} ${compactPlayChrome ? 'text-[0.72em]' : ''}`}>らくだ珈琲</p>
        <h1
          className={`${immersiveTitle} flex items-center justify-center gap-1.5 ${compactPlayChrome ? 'text-[1em] mt-0' : ''}`}
        >
          <Grid3x3 className="w-5 h-5 shrink-0 opacity-90" aria-hidden />
          9×9数字パズル
        </h1>
        {!compactPlayChrome ? (
          <p className={`${immersiveSubtitle} text-rk-indigo-900/75`}>1〜9を並べるパズル</p>
        ) : null}
      </header>

      {view === 'tutorial' ? (
        <div className={`${immersiveContentWidth} flex-1 min-h-0 flex flex-col gap-3 py-2 overflow-y-auto`}>
          <div className="rounded-xl border border-rk-indigo-200 bg-rk-white/95 p-4 space-y-3 shadow-sm">
            <p className="text-sm font-black text-rk-indigo-950 leading-relaxed">9×9数字パズルの遊び方</p>
            <ul className="text-[13px] font-medium text-rk-indigo-950/90 space-y-2 leading-relaxed list-disc pl-4">
              <li>9×9のマスに、<strong>1〜9</strong>の数字を入れます。</li>
              <li>
                <strong>横の行</strong>・<strong>縦の列</strong>・<strong>太線の3×3</strong>
                それぞれに、同じ数字は1つだけ。
              </li>
              <li>計算は不要です。消しながら考えるパズルです。</li>
              <li>「やさしい」は数字が多めで、ヒントも使えます。</li>
              <li>行・列・3×3で同じ数字が重なると、マスが<strong>ピンク色</strong>になります。</li>
              <li>
                <strong>メモ</strong>をONにすると、空のマスに<strong>1〜9</strong>の小さな候補が付け外しできます（3×3）。
                OFFのときは大きい数字が入ります。
              </li>
              <li>
                <strong>最初から入っている数字</strong>は丸い字体、<strong>自分で入れた数字</strong>は濃い緑の角字体、
                <strong>メモ</strong>は小さな角字体です。
              </li>
            </ul>
          </div>
          <button type="button" className={btnPrimaryTouch} onClick={finishTutorial}>
            難易度を選ぶ
          </button>
        </div>
      ) : null}

      {view === 'menu' ? (
        <div className={`${immersiveContentWidth} flex-1 min-h-0 flex flex-col gap-2 py-2`}>
          <p className="text-center text-sm font-medium text-rk-indigo-900/70">難易度を選んでください</p>
          {(['easy', 'normal', 'hard'] as const).map((level) => (
            <button
              key={level}
              type="button"
              className={`${btnGhostTouch} w-full text-left px-4 border-rk-indigo-200 bg-rk-white/90`}
              onClick={() => startPuzzle(level)}
            >
              <span className="block font-black text-rk-indigo-950">{SUDOKU_DIFFICULTY_LABEL[level]}</span>
              <span className="block text-[12px] font-medium text-rk-indigo-900/65 mt-0.5">
                {SUDOKU_DIFFICULTY_HINT[level]}
              </span>
            </button>
          ))}
          <button type="button" className={`${btnGhostTouch} w-full mt-1 text-[12px]`} onClick={() => setView('tutorial')}>
            ルールをもう一度見る
          </button>
          <div className="mt-auto flex flex-col gap-2 pt-4 pb-1">
            <RK03GhostTouchButton
              className={`${SUDOKU_MENU_GHOST_NARROW} inline-flex items-center justify-center gap-2 ${SUDOKU_MENU_GHOST_BORDER}`}
              onClick={() => {
                vibrate(8);
                setViewPrefs(loadSudokuViewPrefs());
                setView('my-settings');
              }}
            >
              <Settings2 className="size-[1.15em] shrink-0" aria-hidden />
              自分の設定
            </RK03GhostTouchButton>
            <RK03GhostTouchButton
              className={`${SUDOKU_MENU_GHOST_NARROW} inline-flex items-center justify-center gap-2 ${SUDOKU_MENU_GHOST_BORDER}`}
              onClick={() => {
                vibrate(8);
                setClearLogs(loadSudokuClearLogs());
                setView('logs');
              }}
            >
              <BookOpen className="size-[1.15em] shrink-0" aria-hidden />
              記録（ログ）
            </RK03GhostTouchButton>
          </div>
        </div>
      ) : null}

      {view === 'my-settings' ? (
        <div className={`${immersiveContentWidth} flex-1 min-h-0 flex flex-col gap-3 py-2 overflow-y-auto`}>
          <div className="rounded-xl border border-rk-indigo-200 bg-rk-white/95 p-4 space-y-4 shadow-sm">
            <p className="text-sm font-black text-rk-indigo-950">自分の設定</p>
            <p className="text-[12px] font-medium text-rk-indigo-900/70 leading-relaxed">
              この端末だけの色設定です。
            </p>
            <label className="block space-y-1.5">
              <span className="text-[13px] font-bold text-rk-indigo-950">自分で入れた数字</span>
              <input
                type="color"
                value={viewPrefs.userDigitColor}
                onChange={(e) => setViewPrefs((prev) => ({ ...prev, userDigitColor: e.target.value }))}
                className="h-10 w-full rounded-lg border border-rk-slate-300 bg-rk-white"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[13px] font-bold text-rk-indigo-950">メモ（候補）</span>
              <input
                type="color"
                value={viewPrefs.memoDigitColor}
                onChange={(e) => setViewPrefs((prev) => ({ ...prev, memoDigitColor: e.target.value }))}
                className="h-10 w-full rounded-lg border border-rk-slate-300 bg-rk-white"
              />
            </label>
          </div>
          <div className="flex gap-2 shrink-0">
            <RK03GhostTouchButton
              className="flex-1"
              onClick={() => setViewPrefs({ ...SUDOKU_DEFAULT_VIEW_PREFS })}
            >
              初期値に戻す
            </RK03GhostTouchButton>
            <RK02PrimaryTouchButton
              className="flex-1"
              onClick={() => {
                saveSudokuViewPrefs(viewPrefs);
                window.dispatchEvent(
                  new CustomEvent('SHOW_TOAST', { detail: '自分の設定を保存しました' }),
                );
                setView('menu');
              }}
            >
              保存
            </RK02PrimaryTouchButton>
          </div>
        </div>
      ) : null}

      {view === 'logs' ? (
        <div className={`${immersiveContentWidth} flex-1 min-h-0 flex flex-col py-2`}>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 rounded-xl border border-rk-indigo-200 bg-rk-white/90 p-2">
            {clearLogs.length === 0 ? (
              <p className="text-[13px] text-center text-rk-indigo-900/65 py-8">まだ記録がありません</p>
            ) : (
              clearLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-rk-slate-200 bg-rk-slate-50/80 px-3 py-2 text-[13px]"
                >
                  <p className="font-bold tabular-nums text-rk-slate-500">{log.timestamp}</p>
                  <p className="mt-0.5 font-medium text-rk-slate-800">{log.message}</p>
                </div>
              ))
            )}
          </div>
          <RK02PrimaryTouchButton className="w-full mt-3 shrink-0" onClick={() => setView('menu')}>
            もどる
          </RK02PrimaryTouchButton>
        </div>
      ) : null}

      {view === 'play' && puzzlePack ? (
        <div className="w-full max-w-lg flex-1 min-h-0 flex flex-col gap-1 min-w-0 overflow-y-auto overscroll-y-contain">
          <p className="text-center text-[11px] font-bold text-rk-indigo-900/70 shrink-0 px-1 leading-tight">
            {SUDOKU_DIFFICULTY_LABEL[puzzlePack.difficulty]}
            {' · 同じ数字の重複は色付き'}
          </p>

          <div className="w-full shrink-0 flex justify-center px-0.5">
            <div
              className="aspect-square w-full max-w-[min(100%,52dvh)] [container-type:size]"
            >
              <div className="grid grid-cols-9 grid-rows-9 h-full w-full border-2 border-rk-indigo-800 bg-rk-white rounded-lg overflow-hidden shadow-md">
              {userGrid.map((row, r) =>
                row.map((value, c) => {
                  const isFixed = fixed[r][c];
                  const isSelected = selected?.row === r && selected?.col === c;
                  const inSelectedLine =
                    selected != null && (selected.row === r || selected.col === c);
                  const key = sudokuCellKey(r, c);
                  const conflict = conflictKeys.has(key);
                  const borderR = (c + 1) % 3 === 0 && c < 8 ? 'border-r-2 border-r-rk-indigo-700' : 'border-r border-r-rk-indigo-200';
                  const borderB = (r + 1) % 3 === 0 && r < 8 ? 'border-b-2 border-b-rk-indigo-700' : 'border-b border-b-rk-indigo-200';
                  const isGiven = isFixed && value > 0;
                  const isUserValue = !isFixed && value > 0;
                  const cellNotes = notesGrid[r][c];
                  const showMemo = value === 0 && cellHasSudokuNotes(notesGrid, r, c);
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-label={`${r + 1}行${c + 1}列${value > 0 ? value : cellNotes || '空'}`}
                      disabled={isFixed}
                      onClick={() => handleCellTap(r, c)}
                      className={[
                        'relative flex items-center justify-center min-h-0 min-w-0 p-0 overflow-hidden',
                        borderR,
                        borderB,
                        conflict
                          ? 'bg-rk-rose-100 text-rk-rose-900'
                          : isSelected
                            ? 'bg-rk-emerald-100 text-rk-indigo-950'
                            : inSelectedLine
                              ? 'bg-rk-emerald-50/90 text-rk-indigo-950'
                              : isGiven
                                ? 'bg-rk-indigo-50 text-rk-indigo-950'
                                : 'bg-rk-white',
                        isSelected ? 'ring-2 ring-inset ring-rk-amber-400 z-[1]' : '',
                        !conflict && !isFixed ? 'active:bg-rk-sky-50' : '',
                      ].join(' ')}
                    >
                      {value > 0 ? (
                        <span
                          className={[
                            'text-[clamp(0.975rem,11cqmin,1.625rem)] leading-none',
                            isGiven ? 'font-black text-rk-indigo-950' : '',
                            isUserValue && !conflict ? 'font-extrabold' : '',
                            isUserValue && conflict ? 'font-extrabold text-rk-rose-900' : '',
                          ].join(' ')}
                          style={{
                            fontFamily: isGiven ? SUDOKU_FONT_GIVEN : SUDOKU_FONT_EDITABLE,
                            color: isUserValue && !conflict ? viewPrefs.userDigitColor : undefined,
                          }}
                        >
                          {value}
                        </span>
                      ) : showMemo ? (
                        <span
                          className="absolute inset-[8%] grid grid-cols-3 grid-rows-3 pointer-events-none"
                          style={{ fontFamily: SUDOKU_FONT_EDITABLE }}
                          aria-hidden
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                            <span
                              key={d}
                              className="flex items-center justify-center font-black leading-none text-[3.1cqmin]"
                              style={{
                                gridRowStart: sudokuMemoSubCell(d).subR + 1,
                                gridColumnStart: sudokuMemoSubCell(d).subC + 1,
                                color: viewPrefs.memoDigitColor,
                              }}
                            >
                              {hasSudokuNote(notesGrid, r, c, d) ? d : ''}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </button>
                  );
                }),
              )}
              </div>
            </div>
          </div>

          <p
            className="text-center text-[11px] font-black shrink-0 px-1 h-[1.25rem] leading-tight text-rk-indigo-800"
            aria-live="polite"
          >
            {hintNotice ?? ''}
          </p>

          <div className="grid grid-cols-4 gap-1 shrink-0 w-full min-w-0 px-0.5">
            <button
              type="button"
              className="flex flex-col items-center justify-center gap-0.5 min-h-10 rounded-xl border border-rk-slate-300 bg-rk-white text-[10px] font-bold text-rk-slate-700 active:scale-95 transition-transform"
              onClick={handleClearCell}
              aria-label="消す"
            >
              <Eraser className="w-4 h-4 shrink-0" aria-hidden />
              消す
            </button>
            <button
              type="button"
              className="flex flex-col items-center justify-center gap-0.5 min-h-10 rounded-xl border border-rk-slate-300 bg-rk-white text-[10px] font-bold text-rk-slate-700 active:scale-95 transition-transform disabled:opacity-45"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              aria-label="一手戻す"
            >
              <Undo2 className="w-4 h-4 shrink-0" aria-hidden />
              戻す
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={memoMode}
              aria-label={memoMode ? 'メモON' : 'メモOFF'}
              onClick={() => {
                vibrate(5);
                setMemoMode((v) => !v);
              }}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-10 min-w-0 overflow-hidden rounded-xl border-2 px-1 active:scale-95 transition-all ${
                memoMode
                  ? 'border-rk-emerald-600 bg-rk-emerald-100'
                  : 'border-rk-slate-400 bg-rk-slate-100'
              }`}
            >
              <div className="flex items-center gap-0.5 min-w-0">
                <Pencil
                  className={`w-3.5 h-3.5 shrink-0 ${memoMode ? 'text-rk-emerald-900' : 'text-rk-slate-600'}`}
                  aria-hidden
                />
                <span
                  className={`text-[9px] font-black leading-none truncate ${
                    memoMode ? 'text-rk-emerald-950' : 'text-rk-slate-700'
                  }`}
                >
                  {memoMode ? 'メモON' : 'メモOFF'}
                </span>
              </div>
              <span
                className={`relative h-4 w-9 shrink-0 rounded-full transition-colors duration-200 ${
                  memoMode ? 'bg-rk-emerald-600' : 'bg-rk-slate-400'
                }`}
                aria-hidden
              >
                <span
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-rk-white shadow-sm ring-1 transition-all duration-200 ${
                    memoMode
                      ? 'right-0.5 ring-rk-emerald-200'
                      : 'left-0.5 ring-rk-slate-300'
                  }`}
                />
              </span>
            </button>
            {(difficulty === 'easy' || difficulty === 'normal') ? (
              <button
                type="button"
                className="flex flex-col items-center justify-center gap-0.5 min-h-10 rounded-xl border border-rk-amber-300 bg-rk-amber-50 text-[10px] font-bold text-rk-amber-950 active:scale-95 transition-transform"
                onClick={handleHint}
                aria-label="ヒント"
              >
                <Lightbulb className="w-4 h-4 shrink-0" aria-hidden />
                ヒント
              </button>
            ) : (
              <div className="min-h-10" aria-hidden />
            )}
          </div>

          <p className="text-center text-[10px] font-black shrink-0 px-1 leading-tight text-rk-indigo-900">
            {memoMode ? (
              <span className="text-rk-emerald-800">メモON — 1〜9はマス内の小さな候補（3×3）</span>
            ) : (
              <span className="text-rk-slate-700">メモOFF — 1〜9はマスに大きく入ります</span>
            )}
          </p>

          <div className="grid grid-cols-9 gap-1 shrink-0 w-full min-w-0">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <button
                key={d}
                type="button"
                className="min-h-10 sm:min-h-11 rounded-xl border border-rk-indigo-300 bg-rk-white font-black text-rk-indigo-950 active:scale-95 transition-transform"
                onClick={() => applyDigit(d)}
              >
                {d}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="w-full shrink-0 mt-1 min-h-10 rounded-xl border-2 border-rk-rose-400 bg-rk-rose-300/95 text-rk-rose-950 text-sm font-black shadow-sm active:scale-95 transition-transform"
            onClick={() => {
              vibrate(8);
              setShowInterruptConfirm(true);
            }}
          >
            中断
          </button>
        </div>
      ) : null}

      {showClearModal ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-rk-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sudoku-clear-title"
        >
          <div className="w-full max-w-sm rounded-2xl border-2 border-rk-indigo-300 bg-rk-white p-5 shadow-xl text-center space-y-4">
            <p id="sudoku-clear-title" className="text-lg font-black text-rk-indigo-950">
              クリアしました
            </p>
            <p className="text-sm font-medium text-rk-indigo-900/80 leading-relaxed">お疲れさまでした。</p>
            <LiveClearReportSoloPanel kind="sudoku" vibrate={vibrate} />
            <button type="button" className={btnPrimaryTouch} onClick={handleNextPuzzle}>
              次の問題
            </button>
            <button
              type="button"
              className={`${btnGhostTouch} w-full`}
              onClick={() => {
                setShowClearModal(false);
                setView('menu');
              }}
            >
              難易度を選び直す
            </button>
          </div>
        </div>
      ) : null}

      {showInterruptConfirm ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-rk-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sudoku-interrupt-title"
        >
          <div className="w-full max-w-sm rounded-2xl border-2 border-rk-indigo-300 bg-rk-white p-5 shadow-xl text-center space-y-4">
            <p id="sudoku-interrupt-title" className="text-base font-black text-rk-indigo-950 leading-relaxed">
              中断してメニューに戻りますか？
            </p>
            <p className="text-sm font-medium text-rk-indigo-900/75 leading-relaxed">
              いまの途中経過は保存されません。
            </p>
            <RK02PrimaryTouchButton className="w-full" onClick={confirmInterrupt}>
              中断する
            </RK02PrimaryTouchButton>
            <RK03GhostTouchButton className="w-full" onClick={() => setShowInterruptConfirm(false)}>
              続ける
            </RK03GhostTouchButton>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SudokuGame;
