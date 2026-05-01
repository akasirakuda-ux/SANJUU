/**
 * Firestore は「配列の要素に配列を入れる」ことを許可しないため、
 * 盤面 string[][] は gridRows: string[]（各行を1文字列）で保存する。
 */
export function gridToFirestoreRows(grid: string[][]): string[] {
  return grid.map((row) =>
    Array.isArray(row) ? row.map((c) => (c == null ? '' : String(c))).join('') : ''
  );
}

export function gridRowsFromFirestore(data: Record<string, unknown>): string[][] | undefined {
  const rows = data.gridRows;
  if (Array.isArray(rows) && rows.length > 0) {
    const out = rows.map((row) => Array.from(String(row ?? '')));
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
