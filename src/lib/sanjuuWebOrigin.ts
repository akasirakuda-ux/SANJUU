/** SANJUU Next のオリジン（`VITE_SANJUU_WEB_ORIGIN`。開発は `.env.development`、本番は `.env.production`。未設定時のみ localhost:3200 既定） */
export function sanjuuWebOrigin(): string {
  const v = (import.meta.env.VITE_SANJUU_WEB_ORIGIN as string | undefined)?.trim();
  return v || 'http://localhost:3200';
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
