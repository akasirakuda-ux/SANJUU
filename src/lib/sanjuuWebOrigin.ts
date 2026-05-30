const SANJUU_WEB_FALLBACK_LOCAL = 'http://localhost:3200';

function stripTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, '');
}

/** らくだ本体（Firebase Hosting）のホスト。API・掲示板直リンクは同一オリジンに留める。 */
const RAKUDA_MAIN_APP_HOSTS = new Set([
  'rakuda.coffee',
  'www.rakuda.coffee',
  'rakuda-coffee.web.app',
  'rakuda-coffee.firebaseapp.com',
]);

/** 運用上の正とする公開URL（QR・案内文と揃える） */
export const RAKUDA_CANONICAL_ORIGIN = 'https://rakuda.coffee';

/**
 * 連絡帳内「３０の問題を作る」フォームへジャンプするためのフラグメント。
 * 例: `https://rakuda.coffee/hundred#rk-hundred-create`（クエリがあるときは `#` を最後に: `/hundred?rkEmoji=…&rkNick=…#rk-hundred-create`）
 */
export const RAKUDA_HUNDRED_CREATE_FRAGMENT = 'rk-hundred-create';

/**
 * SANJUU ws の REST ベース（`/api/play/*` の直前まで）。
 * 未設定のときは空文字＝同一オリジン（Firebase Hosting の `/api/play/**` rewrite 前提）。
 * ローカルで ws を直叩きする場合だけ `VITE_SANJUU_HTTP_BASE` を設定する。
 * 本番らくだ（`rakuda.coffee` 等）では `VITE_SANJUU_HTTP_BASE` を無視し、常に同一オリジン（CORS 回避）。
 */
export function sanjuuHttpApiOrigin(): string {
  if (typeof window !== 'undefined') {
    const h = window.location.hostname.toLowerCase();
    if (RAKUDA_MAIN_APP_HOSTS.has(h)) {
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
export function readRakudaProfileQuery(): { emoji: string; nickname: string } {
  if (typeof window === 'undefined') return { emoji: '', nickname: '' };
  try {
    const sp = new URL(window.location.href).searchParams;
    return {
      emoji: (sp.get('rkEmoji') ?? '').trim(),
      nickname: (sp.get('rkNick') ?? '').trim(),
    };
  } catch {
    return { emoji: '', nickname: '' };
  }
}

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

/** 三十「30募集掲示板」（らくだトップの「３０募集一覧」）。絵文字・ニックの両方が揃うときだけ `rkEmoji` / `rkNick` を付与 */
export function sanjuuRecruitBoardUrlWithRakudaProfile(opts: { emoji?: string; nickname?: string }): string {
  const origin = stripTrailingSlashes(sanjuuWebOrigin());
  const u = new URL(`${origin}/sanjuu/recruit-board`);
  appendRakudaProfileQuery(u, opts);
  return u.toString();
}

/** らくだ・みんなであそぶ（掲示板）を開く直リンク（`useAppShell` の `/keijiban`）。常に「今のホスト」の同一オリジンに留め、web.app ⇄ 独自ドメインの行き来でログインが切れないようにする。 */
export function rakudaCommunityBulletinUrl(): string {
  if (typeof window !== 'undefined') {
    const h = window.location.hostname.toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1') {
      return `${window.location.origin.replace(/\/+$/, '')}/keijiban`;
    }
    if (RAKUDA_MAIN_APP_HOSTS.has(h)) {
      return `${window.location.origin.replace(/\/+$/, '')}/keijiban`;
    }
  }
  return `${RAKUDA_CANONICAL_ORIGIN.replace(/\/+$/, '')}/keijiban`;
}

/** みんなであそぶを開き、作成フォームが画面内の先頭付近に来る URL（同一オリジン優先） */
export function rakudaHundredHubCreateUrl(searchSuffix = ''): string {
  const frag = `#${RAKUDA_HUNDRED_CREATE_FRAGMENT}`;
  const path = `/hundred${searchSuffix}${frag}`;
  if (typeof window !== 'undefined') {
    const h = window.location.hostname.toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1') {
      return `${window.location.origin.replace(/\/+$/, '')}${path}`;
    }
    if (RAKUDA_MAIN_APP_HOSTS.has(h)) {
      return `${window.location.origin.replace(/\/+$/, '')}${path}`;
    }
  }
  return `${RAKUDA_CANONICAL_ORIGIN.replace(/\/+$/, '')}${path}`;
}

/** 三十トップ（`/`) の絶対 URL。絵文字・ニックの両方が揃うときだけ `rkEmoji` / `rkNick` を付与 */
export function sanjuuTopUrlWithRakudaProfile(opts: { emoji?: string; nickname?: string }): string {
  const origin = stripTrailingSlashes(sanjuuWebOrigin());
  const u = new URL(`${origin}/`);
  appendRakudaProfileQuery(u, opts);
  return u.toString();
}
