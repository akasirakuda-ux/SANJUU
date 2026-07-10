import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const CHUNK_RELOAD_KEY = 'rk_chunk_reload_v2';

/** デプロイ後に古い index から存在しない lazy チャンクを取りに行ったとき */
export function isStaleChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('MIME type')
  );
}

/** デプロイ前のペア探し JS が残っているとき（layout has N tiles, need M） */
export function isStaleTileLayoutError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /layout has \d+ tiles, need \d+/.test(msg);
}

export function isStaleAppBundleError(err: unknown): boolean {
  return isStaleChunkLoadError(err) || isStaleTileLayoutError(err);
}

function getLoadedMainAssetId(): string | null {
  const el = document.querySelector('script[type="module"][src*="/assets/main-"]');
  const src = el?.getAttribute('src') ?? '';
  return src.match(/main-([A-Za-z0-9]+)\.js/)?.[1] ?? null;
}

/** index.html の main ハッシュと読み込み済みバンドルが違えば 1 回リロード */
export function checkForStaleMainBundle(): void {
  if (typeof window === 'undefined') return;
  const current = getLoadedMainAssetId();
  if (!current) return;
  void fetch(`/?_=${Date.now()}`, { cache: 'no-store' })
    .then((r) => r.text())
    .then((html) => {
      const deployed = html.match(/\/assets\/main-([A-Za-z0-9]+)\.js/)?.[1];
      if (deployed && deployed !== current) {
        reloadOnceForStaleChunk();
      }
    })
    .catch(() => {
      /* offline 等は無視 */
    });
}

export function clearStaleChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    /* ignore */
  }
}

/** 1 回だけフルリロードして index.html から最新チャンクを取り直す */
export function reloadOnceForStaleChunk(): boolean {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1') return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  } catch {
    /* quota / private mode — still reload */
  }
  window.location.reload();
  return true;
}

/**
 * `lazy()` の読み込み失敗（デプロイ直後の古いタブ）を検知し、自動で 1 回リロードする。
 */
export function lazyWithReload<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await factory();
      clearStaleChunkReloadFlag();
      return mod;
    } catch (err) {
      if (isStaleChunkLoadError(err) && reloadOnceForStaleChunk()) {
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
