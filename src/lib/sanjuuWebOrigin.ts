const SANJUU_WEB_FALLBACK_LOCAL = 'http://localhost:3200';

function stripTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, '');
}

/**
 * SANJUU Next のオリジン（`VITE_SANJUU_WEB_ORIGIN`。本番は `.env.production`）。
 * - DEV: 常に `http://localhost:3200`
 * - 本番ビルドでも `localStorage rk_sanjuu_use_localhost=1` なら `http://localhost:3200`（開発者用・1ブラウザで1回設定）
 */
export function sanjuuWebOrigin(): string {
  if (import.meta.env.DEV) {
    return SANJUU_WEB_FALLBACK_LOCAL;
  }

  const raw = (import.meta.env.VITE_SANJUU_WEB_ORIGIN as string | undefined)?.trim();
  const baked = raw ? stripTrailingSlashes(raw) : SANJUU_WEB_FALLBACK_LOCAL;

  if (typeof window !== 'undefined') {
    try {
      if (window.localStorage.getItem('rk_sanjuu_use_localhost') === '1') {
        return SANJUU_WEB_FALLBACK_LOCAL;
      }
    } catch {
      /* private mode 等 */
    }
    const h = window.location.hostname.toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1') {
      return SANJUU_WEB_FALLBACK_LOCAL;
    }
  }

  return baked;
}

/** 三十「全体掲示板」（らくだトップの「掲示板」ボタン）。本番・開発とも `VITE_SANJUU_WEB_ORIGIN` をベースにする。 */
export function sanjuuBulletinBoardUrl(): string {
  return `${sanjuuWebOrigin().replace(/\/+$/, '')}/sanjuu/bulletin`;
}

/** 三十トップ（`/`) の絶対 URL。空でないときだけ `rkEmoji` / `rkNick` を付与（三十側仕様に合わせる） */
export function sanjuuTopUrlWithRakudaProfile(opts: { emoji?: string; nickname?: string }): string {
  const base = `${sanjuuWebOrigin().replace(/\/+$/, '')}/`;
  const q = new URLSearchParams();
  const emoji = (opts.emoji ?? '').trim();
  const nickname = (opts.nickname ?? '').trim();
  if (emoji) q.set('rkEmoji', emoji);
  if (nickname) q.set('rkNick', nickname);
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}
