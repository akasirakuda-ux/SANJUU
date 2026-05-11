const SANJUU_WEB_FALLBACK_LOCAL = 'http://localhost:3200';

function stripTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, '');
}

/**
 * SANJUU Next のオリジン（`VITE_SANJUU_WEB_ORIGIN`。本番は `.env.production`）。
 * - `vite` / `npm run dev:rakuda` のとき（import.meta.env.DEV）: **常に** `http://localhost:3200`
 *   （環境変数の取り違えで本番 thirty に飛ぶのを防ぐ）。
 * - `vite build` 後にブラウザが `localhost` / `127.0.0.1` のときもローカル既定。
 * - **`https://rakuda.coffee` のようなインターネットの URL** では localhost には届かない（ブラウザの仕様）。
 *   開発時は **`http://localhost:5173`** でらくだを開く。
 */
export function sanjuuWebOrigin(): string {
  const raw = (import.meta.env.VITE_SANJUU_WEB_ORIGIN as string | undefined)?.trim();
  if (import.meta.env.DEV) {
    return SANJUU_WEB_FALLBACK_LOCAL;
  }

  const baked = raw ? stripTrailingSlashes(raw) : SANJUU_WEB_FALLBACK_LOCAL;

  if (typeof window !== 'undefined') {
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
