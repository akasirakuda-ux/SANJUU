const RELOAD_KEY = 'rk_firestore_assert_reload_v1';

/** Firestore SDK の内部アサーション（ca9/b815）— ページをリロードすれば直ることが多い */
export function isFirestoreInternalAssertError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /INTERNAL ASSERTION FAILED/i.test(msg) && /\(ID:\s*(ca9|b815)\)/i.test(msg);
}

/** 1 回だけフルリロードして Firestore クライアントを作り直す */
export function reloadOnceForFirestoreAssert(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return false;
    sessionStorage.setItem(RELOAD_KEY, '1');
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

export function clearFirestoreAssertReloadFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    /* ignore */
  }
}
