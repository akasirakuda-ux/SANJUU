import type { OthelloColor } from './othelloLogic';

export type ReversiTurnPickMode = 'random' | 'black_first' | 'white_first';

export type ReversiPieceThemeId =
  | 'classic'
  | 'forest'
  | 'ocean'
  | 'sunset'
  | 'cherry'
  | 'mint'
  | 'ruby'
  | 'steel'
  | 'coral'
  | 'lavender'
  | 'lemon';

export interface ReversiPieceTheme {
  id: ReversiPieceThemeId;
  labelJa: string;
  black: { fill: string; border: string };
  white: { fill: string; border: string };
}

export const REVERSI_PIECE_THEMES: readonly ReversiPieceTheme[] = [
  {
    id: 'classic',
    labelJa: 'クラシック（黒・白）',
    black: { fill: 'bg-rk-slate-900', border: 'border-rk-slate-700' },
    white: { fill: 'bg-rk-white', border: 'border-rk-slate-300' },
  },
  {
    id: 'forest',
    labelJa: 'もり（緑・オレンジ）',
    black: { fill: 'bg-rk-success-700', border: 'border-rk-success-900' },
    white: { fill: 'bg-rk-orange-300', border: 'border-rk-orange-600' },
  },
  {
    id: 'ocean',
    labelJa: 'うみ（紺・水色）',
    black: { fill: 'bg-rk-blue-800', border: 'border-rk-blue-950' },
    white: { fill: 'bg-sky-200', border: 'border-sky-500' },
  },
  {
    id: 'sunset',
    labelJa: 'ゆうやけ（紫・黄色）',
    black: { fill: 'bg-violet-700', border: 'border-violet-950' },
    white: { fill: 'bg-rk-amber-200', border: 'border-rk-amber-500' },
  },
  {
    id: 'cherry',
    labelJa: 'さくら（桃・白）',
    black: { fill: 'bg-rose-500', border: 'border-rose-800' },
    white: { fill: 'bg-rose-50', border: 'border-rose-200' },
  },
  {
    id: 'mint',
    labelJa: 'ミント（深緑・薄緑）',
    black: { fill: 'bg-emerald-800', border: 'border-emerald-950' },
    white: { fill: 'bg-emerald-100', border: 'border-emerald-400' },
  },
  {
    id: 'ruby',
    labelJa: 'ルビー（赤・ピンク）',
    black: { fill: 'bg-red-700', border: 'border-red-950' },
    white: { fill: 'bg-pink-200', border: 'border-pink-500' },
  },
  {
    id: 'steel',
    labelJa: 'スチール（灰・銀）',
    black: { fill: 'bg-zinc-600', border: 'border-zinc-800' },
    white: { fill: 'bg-zinc-100', border: 'border-zinc-400' },
  },
  {
    id: 'coral',
    labelJa: 'コーラル（橙・ベージュ）',
    black: { fill: 'bg-orange-600', border: 'border-orange-900' },
    white: { fill: 'bg-orange-50', border: 'border-orange-200' },
  },
  {
    id: 'lavender',
    labelJa: 'ラベンダー（紫・薄紫）',
    black: { fill: 'bg-purple-700', border: 'border-purple-950' },
    white: { fill: 'bg-purple-100', border: 'border-purple-300' },
  },
  {
    id: 'lemon',
    labelJa: 'レモン（黄緑・黄）',
    black: { fill: 'bg-lime-600', border: 'border-lime-800' },
    white: { fill: 'bg-yellow-100', border: 'border-yellow-400' },
  },
] as const;

/** オンライン募集時 — 先後の決め方 */
export type ReversiOnlineStartMode = 'default_black' | 'coin';

/** @deprecated Firestore 互換 */
export type ReversiOnlineStartModeLegacy = ReversiOnlineStartMode | 'roulette';

/** @deprecated Firestore 互換 — 新規ルームでは書かない */
export type ReversiPieceDisplay = 'classic' | 'emoji';

/** 自分の石の絵柄（端末ローカルのみ） */
export type ReversiMyStonePatternId = ReversiPieceThemeId;

export type ReversiBoardThemeId =
  | 'classic'
  | 'forest'
  | 'ocean'
  | 'walnut'
  | 'slate'
  | 'night';

export interface ReversiBoardTheme {
  id: ReversiBoardThemeId;
  labelJa: string;
  frameBorder: string;
  frameBg: string;
  cellBg: string;
}

export const REVERSI_BOARD_THEMES: readonly ReversiBoardTheme[] = [
  {
    id: 'classic',
    labelJa: 'クラシック（緑）',
    frameBorder: 'border-rk-success-700/70',
    frameBg: 'bg-rk-success-700',
    cellBg: 'bg-rk-success-600/95',
  },
  {
    id: 'forest',
    labelJa: 'もり（深緑）',
    frameBorder: 'border-emerald-800/80',
    frameBg: 'bg-emerald-800',
    cellBg: 'bg-emerald-600/95',
  },
  {
    id: 'ocean',
    labelJa: 'うみ（青）',
    frameBorder: 'border-sky-800/80',
    frameBg: 'bg-sky-800',
    cellBg: 'bg-sky-600/95',
  },
  {
    id: 'walnut',
    labelJa: 'ウォールナット（茶）',
    frameBorder: 'border-amber-900/70',
    frameBg: 'bg-amber-900',
    cellBg: 'bg-amber-700/95',
  },
  {
    id: 'slate',
    labelJa: 'スレート（灰）',
    frameBorder: 'border-zinc-600/80',
    frameBg: 'bg-zinc-600',
    cellBg: 'bg-zinc-500/95',
  },
  {
    id: 'night',
    labelJa: 'ナイト（紺）',
    frameBorder: 'border-indigo-950/80',
    frameBg: 'bg-indigo-950',
    cellBg: 'bg-indigo-800/95',
  },
] as const;

/** 自分の設定 — この端末の見た目だけ（Firestore に載せない） */
export interface ReversiLocalViewPrefs {
  myStonePatternId: ReversiMyStonePatternId;
  boardThemeId: ReversiBoardThemeId;
}

export const REVERSI_DEFAULT_LOCAL_VIEW_PREFS: ReversiLocalViewPrefs = {
  myStonePatternId: 'classic',
  boardThemeId: 'classic',
};

/** ルーム設定（Firestore に保存 — ルールのみ） */
export interface ReversiRoomSettings {
  handicapCorners: 0 | 1 | 2 | 3 | 4;
}

/** ルーム作成フォームの保存値 */
export interface ReversiRoomDefaults {
  handicapCorners: 0 | 1 | 2 | 3 | 4;
  onlineStartMode: ReversiOnlineStartMode;
  /** 募集コメント（任意） */
  recruitComment: string;
}

/** @deprecated 互換用エイリアス */
export type ReversiHostSettings = ReversiRoomSettings;

export const REVERSI_DEFAULT_ROOM_SETTINGS: ReversiRoomSettings = {
  handicapCorners: 0,
};

export const REVERSI_DEFAULT_ROOM_DEFAULTS: ReversiRoomDefaults = {
  handicapCorners: 0,
  onlineStartMode: 'default_black',
  recruitComment: '',
};

/** @deprecated */
export const REVERSI_DEFAULT_HOST_SETTINGS = REVERSI_DEFAULT_ROOM_SETTINGS;

const ROOM_DEFAULTS_KEY = 'rakuda_reversi_room_defaults_v1';
const LEGACY_HOST_SETTINGS_KEY = 'rakuda_reversi_host_settings_v1';
const LOCAL_VIEW_PREFS_KEY = 'rakuda_reversi_local_view_v1';

export function loadReversiRoomDefaults(): ReversiRoomDefaults {
  try {
    const raw =
      localStorage.getItem(ROOM_DEFAULTS_KEY) ?? localStorage.getItem(LEGACY_HOST_SETTINGS_KEY);
    if (!raw) return { ...REVERSI_DEFAULT_ROOM_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<ReversiRoomDefaults> & {
      onlineStartMode?: ReversiOnlineStartModeLegacy;
      pieceDisplay?: ReversiPieceDisplay;
      pieceThemeId?: string;
    };
    return {
      ...REVERSI_DEFAULT_ROOM_DEFAULTS,
      handicapCorners: clampHandicap(parsed.handicapCorners),
      onlineStartMode: normalizeReversiOnlineStartMode(parsed.onlineStartMode),
      recruitComment: normalizeReversiRecruitComment(
        typeof parsed.recruitComment === 'string' ? parsed.recruitComment : '',
      ),
    };
  } catch {
    return { ...REVERSI_DEFAULT_ROOM_DEFAULTS };
  }
}

export function saveReversiRoomDefaults(defaults: ReversiRoomDefaults): void {
  localStorage.setItem(ROOM_DEFAULTS_KEY, JSON.stringify(defaults));
}

/** @deprecated */
export function loadReversiHostSettings(): ReversiRoomSettings {
  const d = loadReversiRoomDefaults();
  return { handicapCorners: d.handicapCorners };
}

/** @deprecated */
export function saveReversiHostSettings(settings: ReversiRoomSettings): void {
  const cur = loadReversiRoomDefaults();
  saveReversiRoomDefaults({ ...cur, handicapCorners: settings.handicapCorners });
}

export function loadReversiLocalViewPrefs(): ReversiLocalViewPrefs {
  try {
    const raw = localStorage.getItem(LOCAL_VIEW_PREFS_KEY);
    if (!raw) {
      return migrateLegacyLocalViewPrefs();
    }
    const parsed = JSON.parse(raw) as Partial<ReversiLocalViewPrefs>;
    return {
      ...REVERSI_DEFAULT_LOCAL_VIEW_PREFS,
      myStonePatternId: 'classic',
      boardThemeId: normalizeReversiBoardThemeId(parsed.boardThemeId),
    };
  } catch {
    return { ...REVERSI_DEFAULT_LOCAL_VIEW_PREFS };
  }
}

export function saveReversiLocalViewPrefs(prefs: ReversiLocalViewPrefs): void {
  localStorage.setItem(
    LOCAL_VIEW_PREFS_KEY,
    JSON.stringify({ ...prefs, myStonePatternId: 'classic' as const }),
  );
}

function migrateLegacyLocalViewPrefs(): ReversiLocalViewPrefs {
  try {
    const raw =
      localStorage.getItem(ROOM_DEFAULTS_KEY) ?? localStorage.getItem(LEGACY_HOST_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { pieceDisplay?: ReversiPieceDisplay };
      if (parsed.pieceDisplay === 'emoji') {
        return { ...REVERSI_DEFAULT_LOCAL_VIEW_PREFS };
      }
    }
  } catch {
    // ignore
  }
  return { ...REVERSI_DEFAULT_LOCAL_VIEW_PREFS };
}

function clampHandicap(n: unknown): 0 | 1 | 2 | 3 | 4 {
  const v = typeof n === 'number' ? n : 0;
  if (v <= 0) return 0;
  if (v >= 4) return 4;
  return v as 0 | 1 | 2 | 3 | 4;
}

function isReversiBoardThemeId(id: unknown): id is ReversiBoardThemeId {
  return REVERSI_BOARD_THEMES.some((t) => t.id === id);
}

function normalizeReversiBoardThemeId(id: unknown): ReversiBoardThemeId {
  return isReversiBoardThemeId(id) ? id : 'classic';
}

function normalizeReversiMyStonePatternId(id: unknown): ReversiMyStonePatternId {
  if (id === 'emoji') return 'classic';
  return isReversiPieceThemeId(id) ? id : 'classic';
}

export function getReversiBoardTheme(id: ReversiBoardThemeId): ReversiBoardTheme {
  return REVERSI_BOARD_THEMES.find((t) => t.id === id) ?? REVERSI_BOARD_THEMES[0]!;
}

export type ReversiStoneVisual = { kind: 'disc'; fill: string; border: string };

/** 盤面の1マス分 — 石は常にクラシック黒白 */
export function resolveReversiStoneVisual(
  cellColor: OthelloColor,
  _myColor: OthelloColor | null,
  _prefs: ReversiLocalViewPrefs,
): ReversiStoneVisual {
  const classic = getReversiPieceTheme('classic');
  const side = cellColor === 'black' ? classic.black : classic.white;
  return { kind: 'disc', fill: side.fill, border: side.border };
}

export function reversiMyStonePatternLabelJa(id: ReversiMyStonePatternId): string {
  return getReversiPieceTheme(id).labelJa;
}

export function normalizeReversiOnlineStartMode(
  mode: ReversiOnlineStartModeLegacy | undefined,
): ReversiOnlineStartMode {
  if (mode === 'default_black') return 'default_black';
  return 'coin';
}

export function getReversiPieceTheme(id: ReversiPieceThemeId): ReversiPieceTheme {
  return REVERSI_PIECE_THEMES.find((t) => t.id === id) ?? REVERSI_PIECE_THEMES[0]!;
}

function isReversiPieceThemeId(id: unknown): id is ReversiPieceThemeId {
  return REVERSI_PIECE_THEMES.some((t) => t.id === id);
}

export function reversiOnlineStartModeLabelJa(mode: ReversiOnlineStartModeLegacy | undefined): string {
  switch (normalizeReversiOnlineStartMode(mode)) {
    case 'default_black':
      return 'ホスト先攻';
    case 'coin':
      return 'コインで決める';
  }
}

export function reversiOnlineStartModeHintJa(mode: ReversiOnlineStartModeLegacy | undefined): string {
  switch (normalizeReversiOnlineStartMode(mode)) {
    case 'default_black':
      return 'ホストが黒（先手）、参加側が白（後攻）';
    case 'coin':
      return '参加後にコインで先後を決めます';
  }
}

/** 対戦記録用：角ハンデの有無 */
export function reversiHandicapLogLabelJa(corners: number): string {
  if (corners <= 0) return 'ハンデなし';
  return `ハンデあり（角${corners}）`;
}

export const RAKUDA_ROBO_EMOJI = '🤖';
export const RAKUDA_ROBO_NAME = 'らくだロボ';

/** オンライン：手番開始から最終1分ゲージまで（3分） */
export const REVERSI_ONLINE_TURN_IDLE_MS = 3 * 60 * 1000;
/** オンライン：最終カウントダウン（1分） */
export const REVERSI_ONLINE_TURN_FINAL_MS = 60 * 1000;
/** オンライン：手番あたり上限（4分） */
export const REVERSI_ONLINE_TURN_TOTAL_MS =
  REVERSI_ONLINE_TURN_IDLE_MS + REVERSI_ONLINE_TURN_FINAL_MS;

export const REVERSI_PENDING_HOST_ROOM_KEY = 'rakuda_reversi_pending_host_room_v1';
export const REVERSI_PENDING_HOST_CHANGED_EVENT = 'rakuda_reversi_pending_host_changed';

/** 募集コメントの最大文字数 */
export const REVERSI_RECRUIT_COMMENT_MAX = 60;

export type ReversiRecruitAudience = 'beginner' | 'advanced' | 'casual';

export interface ReversiRecruitInfo {
  audience?: ReversiRecruitAudience;
  comment?: string;
}

export const REVERSI_RECRUIT_AUDIENCE_OPTIONS: ReadonlyArray<{
  id: ReversiRecruitAudience;
  label: string;
}> = [
  { id: 'beginner', label: '初心者歓迎' },
  { id: 'advanced', label: '上級者向け' },
  { id: 'casual', label: 'お気楽に' },
];

export const REVERSI_RECRUIT_COMMENT_PRESETS: readonly string[] = [
  '午後3時までなら遊べます。',
  '初心者の方もお気楽にどうぞ。',
  'ハンデついてます。',
];

export function reversiRecruitAudienceLabelJa(audience: ReversiRecruitAudience): string {
  return REVERSI_RECRUIT_AUDIENCE_OPTIONS.find((o) => o.id === audience)?.label ?? audience;
}

export function normalizeReversiRecruitComment(raw: string): string {
  return raw.trim().slice(0, REVERSI_RECRUIT_COMMENT_MAX);
}

/** ハブ・リバーシメニュー共通 — 募集中ポップアップ（2倍サイズ） */
export const REVERSI_RECRUIT_BADGE_CLASS =
  'shrink-0 rounded-full bg-red-500 px-5 py-2 text-[20px] xs:text-[22px] font-black leading-none text-white shadow-md border-2 border-red-600/40';

/** 自分がホストで募集中 */
export const REVERSI_RECRUIT_HOST_BADGE_CLASS =
  'shrink-0 rounded-full bg-rk-amber-400 px-5 py-2 text-[20px] xs:text-[22px] font-black leading-none text-rk-amber-950 shadow-md border-2 border-rk-amber-600/50';

export function loadReversiPendingHostRoomCode(): string {
  try {
    return (localStorage.getItem(REVERSI_PENDING_HOST_ROOM_KEY) ?? '').trim().toUpperCase();
  } catch {
    return '';
  }
}

export function saveReversiPendingHostRoomCode(code: string): void {
  try {
    if (code) localStorage.setItem(REVERSI_PENDING_HOST_ROOM_KEY, code.toUpperCase());
    else localStorage.removeItem(REVERSI_PENDING_HOST_ROOM_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(REVERSI_PENDING_HOST_CHANGED_EVENT));
    }
  } catch {
    // ignore
  }
}
