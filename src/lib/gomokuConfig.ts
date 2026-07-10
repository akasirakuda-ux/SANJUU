import type { GomokuBoardSize, GomokuColor, GomokuHandicapStones } from './gomokuLogic';

export type GomokuOnlineStartMode = 'default_black' | 'guest_black' | 'coin';

export type GomokuRoomSettings = {
  boardSize: GomokuBoardSize;
  handicapStones: GomokuHandicapStones;
  handicapBeneficiary: GomokuColor;
};

export type GomokuRoomDefaults = GomokuRoomSettings & {
  onlineStartMode: GomokuOnlineStartMode;
  recruitComment: string;
};

export const GOMOKU_DEFAULT_ROOM_DEFAULTS: GomokuRoomDefaults = {
  boardSize: 13,
  handicapStones: 0,
  handicapBeneficiary: 'white',
  onlineStartMode: 'default_black',
  recruitComment: '',
};

const ROOM_DEFAULTS_KEY = 'rk_gomoku_room_defaults_v1';

export const GOMOKU_RECRUIT_COMMENT_MAX = 60;

export const GOMOKU_PENDING_HOST_ROOM_KEY = 'rk_gomoku_pending_host_room_v1';
export const GOMOKU_PENDING_HOST_CHANGED_EVENT = 'rk_gomoku_pending_host_changed';

export const GOMOKU_RECRUIT_BADGE_CLASS =
  'bg-rk-sky-100 text-[9px] px-1.5 py-0.5 rounded-lg border border-rk-sky-400 shadow-sm font-bold text-rk-sky-950';

export const GOMOKU_RECRUIT_HOST_BADGE_CLASS =
  'bg-rk-amber-100 text-[9px] px-1.5 py-0.5 rounded-lg border border-rk-amber-400 shadow-sm font-black text-rk-amber-950';

export function loadGomokuRoomDefaults(): GomokuRoomDefaults {
  try {
    const raw = localStorage.getItem(ROOM_DEFAULTS_KEY);
    if (!raw) return { ...GOMOKU_DEFAULT_ROOM_DEFAULTS };
    const p = JSON.parse(raw) as Partial<GomokuRoomDefaults>;
    return {
      boardSize: p.boardSize === 15 ? 15 : 13,
      handicapStones: clampHandicap(p.handicapStones),
      handicapBeneficiary: p.handicapBeneficiary === 'black' ? 'black' : 'white',
      onlineStartMode:
        p.onlineStartMode === 'guest_black'
          ? 'guest_black'
          : p.onlineStartMode === 'coin'
            ? 'coin'
            : 'default_black',
      recruitComment: normalizeGomokuRecruitComment(String(p.recruitComment ?? '')),
    };
  } catch {
    return { ...GOMOKU_DEFAULT_ROOM_DEFAULTS };
  }
}

export function saveGomokuRoomDefaults(draft: GomokuRoomDefaults): void {
  try {
    localStorage.setItem(ROOM_DEFAULTS_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

function clampHandicap(v: unknown): GomokuHandicapStones {
  const n = typeof v === 'number' ? v : Number(v);
  if (n >= 4) return 4;
  if (n >= 3) return 3;
  if (n >= 2) return 2;
  if (n >= 1) return 1;
  return 0;
}

export function normalizeGomokuRecruitComment(raw: string): string {
  return raw.trim().slice(0, GOMOKU_RECRUIT_COMMENT_MAX);
}

export function normalizeGomokuOnlineStartMode(
  mode: GomokuOnlineStartMode | undefined,
): GomokuOnlineStartMode {
  if (mode === 'default_black') return 'default_black';
  if (mode === 'guest_black') return 'guest_black';
  return 'coin';
}

export function isGomokuPresetSideAssignMode(mode: GomokuOnlineStartMode | undefined): boolean {
  const normalized = normalizeGomokuOnlineStartMode(mode);
  return normalized === 'default_black' || normalized === 'guest_black';
}

export function gomokuOnlineStartModeLabelJa(mode: GomokuOnlineStartMode | undefined): string {
  switch (normalizeGomokuOnlineStartMode(mode)) {
    case 'default_black':
      return 'ホスト先攻（黒）';
    case 'guest_black':
      return '参加者先攻（黒）';
    case 'coin':
      return 'コインで決める';
  }
}

export function gomokuOnlineStartModeHintJa(mode: GomokuOnlineStartMode | undefined): string {
  switch (normalizeGomokuOnlineStartMode(mode)) {
    case 'default_black':
      return 'ホストが黒（先手）、参加側が白（後攻）';
    case 'guest_black':
      return '参加側が黒（先手）、ホストが白（後攻）';
    case 'coin':
      return '参加後にコインで先後を決めます';
  }
}

export function loadGomokuPendingHostRoomCode(): string {
  try {
    return (localStorage.getItem(GOMOKU_PENDING_HOST_ROOM_KEY) ?? '').trim().toUpperCase();
  } catch {
    return '';
  }
}

export function saveGomokuPendingHostRoomCode(code: string): void {
  try {
    if (code) localStorage.setItem(GOMOKU_PENDING_HOST_ROOM_KEY, code.toUpperCase());
    else localStorage.removeItem(GOMOKU_PENDING_HOST_ROOM_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(GOMOKU_PENDING_HOST_CHANGED_EVENT));
    }
  } catch {
    /* ignore */
  }
}
