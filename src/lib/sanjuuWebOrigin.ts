const SANJUU_WEB_FALLBACK_LOCAL = 'http://localhost:3200';

function stripTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, '');
}

/** ブラザで `VITE_SANJUU_HTTP_BASE`（別オリジン）を使うと CORS で失敗するため、本番らくだでは常に同一オリジン */
const RAKUDA_HTTP_API_SAME_ORIGIN_HOSTS = new Set([
  'rakuda.coffee',
  'www.rakuda.coffee',
  'rakuda-coffee.web.app',
  'rakuda-coffee.firebaseapp.com',
]);

/**
 * SANJUU ws の REST ベース（`/api/play/*` の直前まで）。
 * 未設定のときは空文字＝同一オリジン（Firebase Hosting の `/api/play/**` rewrite 前提）。
 * ローカルで ws を直叩きする場合だけ `VITE_SANJUU_HTTP_BASE` を設定する。
 * 本番らくだ（`rakuda.coffee` 等）では `VITE_SANJUU_HTTP_BASE` を無視し、常に同一オリジン（CORS 回避）。
 */
export function sanjuuHttpApiOrigin(): string {
  if (typeof window !== 'undefined') {
    const h = window.location.hostname.toLowerCase();
    if (RAKUDA_HTTP_API_SAME_ORIGIN_HOSTS.has(h)) {
      return '';
    }
  }
  const raw = (import.meta.env.VITE_SANJUU_HTTP_BASE as string | undefined)?.trim();
  return raw ? stripTrailingSlashes(raw) : '';
}

/**
 * SANJUU Next のオリジン（`VITE_SANJUU_WEB_ORIGIN`。本番は `.env.production`）。
 * - DEV: 常に `http://localhost:3200`
 * - 本番: `.env.production` の `VITE_SANJUU_WEB_ORIGIN`（未設定時のみ localhost 既定）
 */
export function sanjuuWebOrigin(): string {
  if (import.meta.env.DEV) {
    return SANJUU_WEB_FALLBACK_LOCAL;
  }

  const raw = (import.meta.env.VITE_SANJUU_WEB_ORIGIN as string | undefined)?.trim();
  const baked = raw ? stripTrailingSlashes(raw) : SANJUU_WEB_FALLBACK_LOCAL;

  if (typeof window !== 'undefined') {
    const h = window.location.hostname.toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1') {
      return SANJUU_WEB_FALLBACK_LOCAL;
    }
  }

  return baked;
}

/** rkEmoji / rkNick は両方そろっているときだけ付与（片方だけのクエリは付けない） */
export function appendRakudaProfileQuery(
  url: URL,
  opts: { emoji?: string; nickname?: string }
): URL {
  const emoji = (opts.emoji ?? '').trim();
  const nick = (opts.nickname ?? '').trim();
  if (emoji && nick) {
    url.searchParams.set('rkEmoji', emoji);
    url.searchParams.set('rkNick', nick);
  }
  return url;
}

/** 三十「全体掲示板」（らくだトップの「掲示板」ボタン）。本番・開発とも `VITE_SANJUU_WEB_ORIGIN` をベースにする。 */
export function sanjuuBulletinBoardUrl(): string {
  return `${sanjuuWebOrigin().replace(/\/+$/, '')}/sanjuu/bulletin`;
}

/** らくだ・みんなであそぶ（掲示板）を開く直リンク（`useAppShell` の `/keijiban`）。三十の全体掲示板からもここへ誘導する。 */
export function rakudaCommunityBulletinUrl(): string {
  if (typeof window !== 'undefined') {
    const h = window.location.hostname.toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1') {
      return `${window.location.origin.replace(/\/+$/, '')}/keijiban`;
    }
  }
  return 'https://rakuda.coffee/keijiban';
}

/** 三十トップ（`/`) の絶対 URL。絵文字・ニックの両方が揃うときだけ `rkEmoji` / `rkNick` を付与 */
export function sanjuuTopUrlWithRakudaProfile(opts: { emoji?: string; nickname?: string }): string {
  const origin = stripTrailingSlashes(sanjuuWebOrigin());
  const u = new URL(`${origin}/`);
  appendRakudaProfileQuery(u, opts);
  return u.toString();
}
