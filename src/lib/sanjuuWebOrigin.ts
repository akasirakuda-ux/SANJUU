const SANJUU_WEB_FALLBACK_LOCAL = 'http://localhost:3200';

/** `lib/tileMatch/config` の `RAKUDA_TILE_MATCH_CREATE_FRAGMENT` と同一（循環 import 回避） */
const RAKUDA_TILE_MATCH_CREATE_FRAGMENT = 'rk-tile-match-create';

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

/** 三十「ひと言探し」募集掲示板。絵文字・ニックの両方が揃うときだけ `rkEmoji` / `rkNick` を付与 */
export function sanjuuRecruitBoardUrlWithRakudaProfile(opts: { emoji?: string; nickname?: string }): string {
  const origin = stripTrailingSlashes(sanjuuWebOrigin());
  const u = new URL(`${origin}/sanjuu/recruit-board`);
  appendRakudaProfileQuery(u, opts);
  return u.toString();
}

/** 三十「ペア探し」募集掲示板 */
export function sanjuuTileMatchRecruitBoardUrlWithRakudaProfile(opts: {
  emoji?: string;
  nickname?: string;
}): string {
  const origin = stripTrailingSlashes(sanjuuWebOrigin());
  const u = new URL(`${origin}/sanjuu/tile-match-recruit-board`);
  appendRakudaProfileQuery(u, opts);
  return u.toString();
}

/** `hundredMode` に応じて三十の募集掲示板 URL を返す（未指定時はひと言探し） */
export function sanjuuRecruitBoardUrlForHundredRecruit(opts: {
  emoji?: string;
  nickname?: string;
  hundredMode?: string | null;
}): string {
  return sanjuuRecruitBoardUrlWithRakudaProfile(opts);
}

/** 三十募集板「ペア探し　ひとりで遊ぶ」→ らくだ本体のソロプレイ */
export function rakudaTileMatchSoloPlayUrl(rakudaOrigin: string): string {
  const base = rakudaOrigin.replace(/\/+$/, '');
  const u = new URL(`${base}/`);
  u.searchParams.set('play', 'tile-match');
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

/** `https://rakuda.coffee/hundred#rk-tile-match-create`（プロフィールクエリ付き可） */
export function rakudaTileMatchCreateUrlWithRakudaProfile(opts: {
  emoji?: string;
  nickname?: string;
}): string {
  const u = new URL(`${RAKUDA_CANONICAL_ORIGIN.replace(/\/+$/, '')}/hundred`);
  appendRakudaProfileQuery(u, opts);
  u.hash = RAKUDA_TILE_MATCH_CREATE_FRAGMENT;
  return u.toString();
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
