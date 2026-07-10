export const RK_STREAM_MODE_KEY = 'rk_stream_mode';



/**

 * 配信モード ON/OFF の真実は localStorage。

 * URL の `?stream=1` だけ ON を強制できる（ブックマーク用）。

 * URL の `?stream=0` は無視 — ナビゲーションで勝手に OFF にしない（管理画面の明示 OFF のみ）。

 */

export function readStreamModeEnabled(): boolean {

  if (typeof window === 'undefined') return false;

  try {

    const params = new URLSearchParams(window.location.search);

    if (params.get('stream') === '1') return true;

  } catch {

    /* ignore */

  }

  try {

    return window.localStorage.getItem(RK_STREAM_MODE_KEY) === '1';

  } catch {

    return false;

  }

}



/** localStorage と URL クエリを同期（リロードなし） */

export function persistStreamModeEnabled(enabled: boolean): void {

  if (typeof window === 'undefined') return;

  try {

    window.localStorage.setItem(RK_STREAM_MODE_KEY, enabled ? '1' : '0');

  } catch {

    /* ignore */

  }

  try {

    const u = new URL(window.location.href);

    if (enabled) {

      u.searchParams.set('stream', '1');

    } else {

      u.searchParams.delete('stream');

    }

    const next = `${u.pathname}${u.search}${u.hash}`;

    window.history.replaceState(window.history.state, '', next);

  } catch {

    /* ignore */

  }

}



/** 初回マウント: URL ?stream=1 を localStorage へ反映（?stream=0 は反映しない） */

export function syncStreamModeFromUrlToStorage(): void {

  if (typeof window === 'undefined') return;

  let v: string | null = null;

  try {

    v = new URLSearchParams(window.location.search).get('stream');

  } catch {

    return;

  }

  if (v !== '1') return;

  try {

    window.localStorage.setItem(RK_STREAM_MODE_KEY, '1');

  } catch {

    /* ignore */

  }

}



/** pathname（と任意 hash）だけ変え、他クエリ（stream=1 等）は維持 */

export function hrefWithPathname(pathname: string, hash = ''): string {

  if (typeof window === 'undefined') return `${pathname}${hash}`;

  try {

    const u = new URL(window.location.href);

    u.pathname = pathname;

    u.hash = hash;

    return `${u.pathname}${u.search}${u.hash}`;

  } catch {

    return `${pathname}${hash}`;

  }

}



/** 指定クエリだけ削除し、他（stream 等）は維持した URL を返す */

export function hrefWithoutSearchParams(...keys: string[]): string {

  if (typeof window === 'undefined') return '/';

  try {

    const u = new URL(window.location.href);

    for (const k of keys) u.searchParams.delete(k);

    return `${u.pathname}${u.search}${u.hash}`;

  } catch {

    return '/';

  }

}


