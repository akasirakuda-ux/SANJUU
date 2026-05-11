const SANJUU_WEB_FALLBACK_LOCAL = 'http://localhost:3200';

function stripTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, '');
}

function isLocalDevOrigin(origin: string): boolean {
  try {
    const u = new URL(origin.includes('://') ? origin : `http://${origin}`);
    const host = u.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * SANJUU Next のオリジン（`VITE_SANJUU_WEB_ORIGIN`。本番は `.env.production`）。
 * - `vite` 開発時: プロセス環境で本番 URL が入っていると `.env.development` を潰すため、
 *   localhost / 127.0.0.1 以外は無視してローカル既定へフォールバックする。
 * - `vite build` の後ろ盾でページが localhost のとき（`npm start` / `vite preview` など）も
 *   同一マシンで三十を触りたいのでローカル既定へ寄せる（本番ドメインでは効かない）。
 */
export function sanjuuWebOrigin(): string {
  const raw = (import.meta.env.VITE_SANJUU_WEB_ORIGIN as string | undefined)?.trim();
  if (import.meta.env.DEV) {
    if (!raw) return SANJUU_WEB_FALLBACK_LOCAL;
    const normalized = stripTrailingSlashes(raw);
    return isLocalDevOrigin(normalized) ? normalized : SANJUU_WEB_FALLBACK_LOCAL;
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
