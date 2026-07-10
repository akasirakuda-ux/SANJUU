/**
 * らくだ珈琲 — 基本 UI トークン（Tailwind クラス文字列）
 *
 * 新規画面・ミニゲームはここから import し、同じ見た目・触覚・余白を揃える。
 * 色の意味・パレット一覧は `src/index.css` の `--rk-*` と
 * `SANJUU/web/docs/rakuda-ui-spine.md` を参照。
 *
 * 人間向けの判断基準: `src/ui/baseline.md`
 * 番号付き部品: `src/ui/partsRegistry.ts` → `baselineParts.tsx`
 */

// ── 面・バッジ ─────────────────────────────────────────────

export const cardClass =
  'bg-rk-white rounded-xl border border-rk-slate-200 shadow-sm p-3';

export const badgeClass =
  'rounded-xl border border-rk-slate-200 bg-rk-slate-50 px-2 py-1 text-[10px] font-medium text-rk-slate-700';

// ── ボタン（ベース） ───────────────────────────────────────

export const tapFeedback = 'active:scale-95 transition-transform';
export const tapFeedbackSubtle = 'active:scale-[0.99] transition-transform';

export const btnPrimary = `rounded-xl bg-rk-indigo-200 text-rk-slate-700 p-2 text-sm font-medium ${tapFeedback}`;

export const btnAccent =
  'rounded-xl bg-rk-success-200 text-rk-slate-700 p-2 text-sm font-medium active:scale-95 transition-transform';

export const btnGhost = `rounded-xl bg-rk-slate-100 text-rk-slate-700 p-2 text-sm font-medium ${tapFeedback}`;

// ── タッチターゲット（最小 48px / clamp タイポ） ─────────────

/** iOS HIG 44pt 相当。ミニゲーム・モーダル CTA は原則これ以上 */
export const touchMinH = 'min-h-12';

export const btnTextClamp = 'text-[clamp(0.8rem,3.2vw,0.95rem)] leading-snug';

/** ミニゲームの主 CTA */
export const btnPrimaryTouch = `${btnPrimary} ${touchMinH} py-3 px-3 ${btnTextClamp}`;

/** ミニゲームの副 CTA・ゴースト */
export const btnGhostTouch = `${btnGhost} ${touchMinH} py-3 px-3 ${btnTextClamp} shrink-0`;

/** 標準高さの半分（24px）。サブ操作・2列並びの行内ボタン向け */
export const touchHalfH = 'min-h-6';

export const btnTextClampHalf = 'text-[clamp(0.72rem,3vw,0.85rem)] leading-tight';

/** 主 CTA・半高 */
export const btnPrimaryTouchHalfH = `${btnPrimary} ${touchHalfH} py-1.5 px-2.5 ${btnTextClampHalf}`;

/** 副 CTA・半高 */
export const btnGhostTouchHalfH = `${btnGhost} ${touchHalfH} py-1.5 px-2.5 ${btnTextClampHalf} shrink-0`;

/** 横幅半分（親 flex 内で 2 列）。高さは標準のまま */
export const touchHalfW = 'w-1/2 max-w-[11rem] shrink-0';

/** 主 CTA・半幅 */
export const btnPrimaryTouchHalfW = `${btnPrimaryTouch} ${touchHalfW}`;

/** 副 CTA・半幅 */
export const btnGhostTouchHalfW = `${btnGhostTouch} ${touchHalfW}`;

// ── トップハブ ─────────────────────────────────────────────

/** SeatSelection のメニュー行（グラデ・枠色は呼び出し側で追加） */
export const hubMenuBtn = `relative w-full max-w-md min-h-[52px] px-3 py-2 flex items-center justify-center gap-2 rounded-xl text-sm font-medium shadow-sm border ${tapFeedbackSubtle} overflow-visible`;

/** ハブメニュー・半高（26px） */
export const hubMenuBtnHalfH = `relative w-full max-w-md min-h-[26px] px-2 py-1 flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium shadow-sm border ${tapFeedbackSubtle} overflow-visible`;

/** ハブメニュー・半幅（カタログ等・max-w 固定） */
export const hubMenuBtnHalfW = `relative ${touchHalfW} min-h-[52px] px-2 py-2 flex items-center justify-center gap-1.5 rounded-xl text-sm font-medium shadow-sm border ${tapFeedbackSubtle} overflow-visible`;

/** ハブメニュー・半幅（flex 行で 2 列いっぱい） */
export const hubMenuBtnHalfWFill = `relative flex-1 min-w-0 basis-0 min-h-[52px] px-2 py-2 flex items-center justify-center gap-1.5 rounded-xl text-sm font-medium shadow-sm border ${tapFeedbackSubtle} overflow-visible`;

// ── 没入画面（ミニゲーム等） ───────────────────────────────

/** RakudaHomeSquircleButton の sizeClassName */
export const homeSquircleSize = 'w-10 h-10 md:w-11 md:h-11';

/** ホーム戻る・縦横半分 */
export const homeSquircleHalfSize = 'w-5 h-5 md:w-[1.375rem] md:h-[1.375rem]';

/** しずかの間など没入画面左上の白角丸戻る（ChevronLeft 32px） */
export const quietRoomBackBtn = `w-12 h-12 flex items-center justify-center bg-rk-white rounded-xl text-rk-slate-700 shadow-sm border border-rk-slate-200 ${tapFeedback}`;

/** 画面全体シェル。`bg-gradient-to-b …` と `text-rk-*` は画面テーマで足す */
export const immersiveScreenShell =
  'absolute inset-0 z-40 h-full max-h-full overflow-hidden flex flex-col items-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] text-[clamp(0.9375rem,3.6vw,1.0625rem)]';

export const immersiveContentWidth = 'w-full max-w-md';

/** max-w-md の半分幅（2 列レイアウト用） */
export const immersiveContentHalfWidth = 'w-1/2 max-w-[14rem]';

/** 左上ホームボタン用の左右余白込みヘッダ */
export const immersiveHeader = `${immersiveContentWidth} relative shrink-0 text-center mb-2 pl-12 pr-12`;

/** ヘッダ三行: らくだ珈琲 / タイトル / 補足 */
export const immersiveKicker = 'text-[0.72em] font-medium tracking-wide leading-tight';
export const immersiveTitle = 'text-[1.15em] font-black mt-0.5 leading-tight';
export const immersiveSubtitle = 'text-[0.82em] mt-0.5 leading-snug';

// ── ユーティリティ ─────────────────────────────────────────

/** ローカル DEV グリッド（`RakudaDevGridOverlay`）と同一の 10px 目盛 */
export const rakudaLayoutGridPx = 10;

/** 上から n 本目のグリッド線（1 始まり） */
export function rakudaGridTop(line1Index: number): string {
  return `${(line1Index - 1) * rakudaLayoutGridPx}px`;
}

/** 下から n 本目のグリッド線（1 始まり） */
export function rakudaGridBottom(line1Index: number): string {
  return `${(line1Index - 1) * rakudaLayoutGridPx}px`;
}

export const limitList = (list: string[], max = 10) =>
  list.length <= max ? { shown: list, more: 0 } : { shown: list.slice(0, max), more: list.length - max };

export const cellColorByGameValue = (gv?: number) => {
  const v = gv ?? 0;
  return (
    [
      'bg-rk-rose-50 border-rk-rose-200',
      'bg-rk-amber-50 border-rk-amber-200',
      'bg-rk-success-50 border-rk-success-200',
      'bg-rk-sky-50 border-rk-sky-200',
    ][v] || 'bg-rk-rose-50 border-rk-rose-200'
  );
};
