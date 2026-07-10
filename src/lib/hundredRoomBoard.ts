import { isRoboPickupLoungeRoomId } from './roboPickupLoungeConfig';
import { PICKUP_EMOJI_GRID_CELL_SEP } from './pickupEmojiSymbols';
import { normalizePickupCharset } from './hundredPickupCharset';

/**
 * Firestore は「配列の要素に配列を入れる」ことを許可しないため、
 * 盤面 string[][] は gridRows: string[]（各行を1文字列）で保存する。
 * 絵文字盤面はセル区切り文字で連結する。
 */
export function gridToFirestoreRows(grid: string[][], pickupCharset?: string): string[] {
  const useEmojiSep = normalizePickupCharset(pickupCharset) === 'emoji';
  const sep = useEmojiSep ? PICKUP_EMOJI_GRID_CELL_SEP : '';
  return grid.map((row) =>
    Array.isArray(row)
      ? row.map((c) => (c == null ? '' : String(c))).join(sep)
      : '',
  );
}

/** 盤面 string[][] が Firestore に載っているか（生成フラグは見ない） */
export function hundredRoomHasPlayableGrid(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;
  const grid = gridRowsFromFirestore(data);
  return !!grid?.length && grid.some((row) => row.length > 0);
}

/** 盤面・お題が揃っているか（生成中は false — ロボ常設は grid あれば可） */
export function hundredRoomBoardReady(
  data: Record<string, unknown> | undefined,
  roomId?: string | null,
): boolean {
  if (!data) return false;
  const hasGrid = hundredRoomHasPlayableGrid(data);
  if (!hasGrid) return false;
  if (data.problemsGenerating === true) {
    if (isRoboLoungeRoomData(data, roomId)) return true;
    const status = typeof data.status === 'string' ? data.status : '';
    // ホスト開始後に problemsGenerating が残っても、盤面があれば途中参加可
    if (status === 'playing' || status === 'started') return true;
    return false;
  }
  return true;
}

function isRoboLoungeRoomData(
  data: Record<string, unknown> | undefined,
  roomId?: string | null,
): boolean {
  if (data?.roboPickupLounge === true) return true;
  return isRoboPickupLoungeRoomId(roomId);
}

/** みんなであそぶ: 盤面付きで GameScreen へ入ってよいか（HundredWaitPanel / HundredBoardPanel 共通） */
export function hundredRoomCanEnterGame(
  data: Record<string, unknown> | undefined,
  roomId?: string | null,
): boolean {
  if (!hundredRoomBoardReady(data)) return false;
  if (isRoboLoungeRoomData(data, roomId)) return true;
  const status = typeof data!.status === 'string' ? data!.status : '';
  return status === 'playing' || status === 'started';
}

export function gridRowsFromFirestore(data: Record<string, unknown>): string[][] | undefined {
  const charset = normalizePickupCharset(data.pickupCharset);
  const rows = data.gridRows;
  if (Array.isArray(rows) && rows.length > 0) {
    const out =
      charset === 'emoji'
        ? rows.map((row) => {
            const s = String(row ?? '');
            if (!s) return [];
            if (s.includes(PICKUP_EMOJI_GRID_CELL_SEP)) {
              return s.split(PICKUP_EMOJI_GRID_CELL_SEP);
            }
            return Array.from(s);
          })
        : rows.map((row) => Array.from(String(row ?? '')));
    if (out.some((r) => r.length > 0)) return out;
  }
  const legacy = data.grid;
  if (Array.isArray(legacy) && legacy.length > 0) {
    const first = legacy[0];
    if (Array.isArray(first)) {
      return legacy.map((row: unknown) =>
        Array.isArray(row) ? row.map((c) => String(c ?? '')) : []
      ) as string[][];
    }
  }
  return undefined;
}

/** Firestore に送る前に undefined を除去（SDK が invalid-argument を返すのを防ぐ） */
export function firestoreSafeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
