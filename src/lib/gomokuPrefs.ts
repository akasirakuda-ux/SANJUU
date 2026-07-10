import type {
  GomokuBoardSize,
  GomokuColor,
  GomokuCpuDifficulty,
  GomokuHandicapStones,
  GomokuOpponent,
} from './gomokuLogic';

export type GomokuGameSettings = {
  opponent: GomokuOpponent;
  humanColor: GomokuColor;
  difficulty: GomokuCpuDifficulty;
  boardSize: GomokuBoardSize;
  /** らくだ式 星ハンデ（0=なし） */
  handicapStones: GomokuHandicapStones;
  handicapBeneficiary: GomokuColor;
  /** 盤外に A1 形式の座標（配信向け・既定 ON） */
  showCoords: boolean;
};

const STORAGE_KEY = 'rk_gomoku_settings_v2';

export const GOMOKU_DEFAULT_SETTINGS: GomokuGameSettings = {
  opponent: 'cpu',
  humanColor: 'black',
  difficulty: 'normal',
  boardSize: 13,
  handicapStones: 0,
  handicapBeneficiary: 'white',
  showCoords: true,
};

function clampHandicap(v: unknown): GomokuHandicapStones {
  const n = typeof v === 'number' ? v : Number(v);
  if (n >= 4) return 4;
  if (n >= 3) return 3;
  if (n >= 2) return 2;
  if (n >= 1) return 1;
  return 0;
}

export function loadGomokuSettings(): GomokuGameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem('rk_gomoku_settings_v1');
      if (legacy) {
        const p = JSON.parse(legacy) as Partial<GomokuGameSettings>;
        return {
          ...GOMOKU_DEFAULT_SETTINGS,
          opponent: p.opponent === 'human' ? 'human' : 'cpu',
          humanColor: p.humanColor === 'white' ? 'white' : 'black',
          difficulty:
            p.difficulty === 'easy' || p.difficulty === 'hard' ? p.difficulty : 'normal',
          boardSize: p.boardSize === 15 ? 15 : 13,
        };
      }
      return { ...GOMOKU_DEFAULT_SETTINGS };
    }
    const parsed = JSON.parse(raw) as Partial<GomokuGameSettings>;
    return {
      opponent: parsed.opponent === 'human' ? 'human' : 'cpu',
      humanColor: parsed.humanColor === 'white' ? 'white' : 'black',
      difficulty:
        parsed.difficulty === 'easy' || parsed.difficulty === 'hard'
          ? parsed.difficulty
          : 'normal',
      boardSize: parsed.boardSize === 15 ? 15 : 13,
      handicapStones: clampHandicap(parsed.handicapStones),
      handicapBeneficiary: parsed.handicapBeneficiary === 'black' ? 'black' : 'white',
      showCoords: parsed.showCoords !== false,
    };
  } catch {
    return { ...GOMOKU_DEFAULT_SETTINGS };
  }
}

export function saveGomokuSettings(settings: GomokuGameSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}
