/** スマホ相当のレイアウト幅（CSS px） */
export const PHONE_CANVAS_WIDTH = 390;

/** iPad mini 縦幅以上をタブレット扱い（スマホ横向き ~430px は除外） */
export const TABLET_PHONE_CANVAS_MIN_SHORT_EDGE = 744;

export const DEFAULT_VIEWPORT_CONTENT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

export function isTabletPhoneCanvasActive(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dataset.rakudaPhoneCanvas === '1';
}

function readQueryOverride(): boolean | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  if (q.get('phoneCanvas') === '1') return true;
  if (q.get('phoneCanvas') === '0') return false;
  return null;
}

/**
 * タブレット判定は screen 寸法（viewport 390 化後も変わらない）。
 * innerWidth は canvas 適用後 390 になるため使わない。
 * hover:none は iPadOS（トラックパッド等）で false になり得るため coarse のみ。
 */
export function isTabletTouchLayout(): boolean {
  const override = readQueryOverride();
  if (override !== null) return override;

  if (typeof window === 'undefined') return false;
  if (!window.matchMedia('(pointer: coarse)').matches) return false;

  const sw = window.screen.width;
  const sh = window.screen.height;
  const shortEdge = Math.min(sw, sh);
  if (shortEdge < TABLET_PHONE_CANVAS_MIN_SHORT_EDGE) return false;

  const longEdge = Math.max(sw, sh);
  if (longEdge / shortEdge > 2.1 && shortEdge < 520) return false;

  return true;
}

/** canvas 適用後は innerWidth≈390 になるため、拡大率は screen 寸法から求める */
function getDisplayDimensions(): { w: number; h: number } {
  const innerW = window.innerWidth;
  const innerH = window.innerHeight;
  if (innerW > PHONE_CANVAS_WIDTH + 20) {
    return { w: innerW, h: innerH };
  }
  return { w: window.screen.width, h: window.screen.height };
}

export function shouldUseTabletPhoneCanvas(): boolean {
  if (typeof window === 'undefined') return false;
  return isTabletTouchLayout();
}

function viewportMeta(): HTMLMetaElement | null {
  return document.querySelector('meta[name="viewport"]');
}

function clearPhoneCanvasCssVars(): void {
  document.documentElement.style.removeProperty('--rk-phone-canvas-scale');
  document.documentElement.style.removeProperty('--rk-phone-canvas-layout-h');
}

function setPhoneCanvasCssVars(scale: number, layoutH: number): void {
  const scaleStr = String(scale);
  const layoutStr = `${layoutH}px`;
  if (
    document.documentElement.style.getPropertyValue('--rk-phone-canvas-scale') === scaleStr &&
    document.documentElement.style.getPropertyValue('--rk-phone-canvas-layout-h') === layoutStr
  ) {
    return;
  }
  document.documentElement.style.setProperty('--rk-phone-canvas-scale', scaleStr);
  document.documentElement.style.setProperty('--rk-phone-canvas-layout-h', layoutStr);
}

let lastViewportContent: string | null = null;
let lastSyncKey: string | null = null;
let scheduledRaf: number | null = null;

function buildViewportContent(scaleStr: string): string {
  return `width=${PHONE_CANVAS_WIDTH}, initial-scale=${scaleStr}, maximum-scale=${scaleStr}, user-scalable=no, viewport-fit=cover`;
}

/** 390px レイアウトを画面幅いっぱいに等倍拡大（値が変わったときだけ DOM 更新） */
export function applyTabletPhoneCanvasViewport(): void {
  const meta = viewportMeta();
  if (!meta) return;

  const { w: deviceW, h: deviceH } = getDisplayDimensions();
  const scale = Math.min(Math.max(deviceW / PHONE_CANVAS_WIDTH, 1), 3);
  const scaleStr = scale.toFixed(4).replace(/\.?0+$/, '') || '1';
  const layoutH = deviceH / scale;
  const content = buildViewportContent(scaleStr);

  if (content !== lastViewportContent) {
    meta.setAttribute('content', content);
    lastViewportContent = content;
  }

  document.documentElement.dataset.rakudaPhoneCanvas = '1';
  setPhoneCanvasCssVars(scale, layoutH);
}

export function restoreDefaultViewport(): void {
  const meta = viewportMeta();
  if (!meta) return;
  if (lastViewportContent !== DEFAULT_VIEWPORT_CONTENT) {
    meta.setAttribute('content', DEFAULT_VIEWPORT_CONTENT);
  }
  lastViewportContent = DEFAULT_VIEWPORT_CONTENT;
  lastSyncKey = null;
  delete document.documentElement.dataset.rakudaPhoneCanvas;
  clearPhoneCanvasCssVars();
}

/**
 * 390px canvas を外して iPad 実幅を使う画面。
 * - ことば探し（問題一覧・プレイ）: 盤面・一覧を大きく、一覧↔プレイ間で viewport を切替えない
 * - ペア探し: TileMatchGame が enter/leave で制御
 */
export const PHONE_CANVAS_EXEMPT_SCREENS = new Set(['select', 'game', 'tile-match']);

export function shouldDisablePhoneCanvasForScreen(screen: string): boolean {
  return PHONE_CANVAS_EXEMPT_SCREENS.has(screen);
}

/** 現在の screen に合わせて viewport を適用（phone canvas ON/OFF） */
export function applyViewportForScreen(screen: string): void {
  resetTabletPhoneCanvasSyncCache();
  const wantPhoneCanvas = shouldUseTabletPhoneCanvas() && !shouldDisablePhoneCanvasForScreen(screen);
  if (wantPhoneCanvas) {
    applyTabletPhoneCanvasViewport();
    lastSyncKey = `screen:${screen}:canvas`;
  } else {
    restoreDefaultViewport();
    lastSyncKey = `screen:${screen}:native`;
  }
}

/** Safari 向け: 画面遷移直後に数フレーム再同期 */
export function applyViewportForScreenDeferred(screen: string): void {
  applyViewportForScreen(screen);
  window.requestAnimationFrame(() => {
    applyViewportForScreen(screen);
    window.requestAnimationFrame(() => applyViewportForScreen(screen));
  });
}

function syncTabletPhoneCanvasViewportNow(): void {
  if (!shouldUseTabletPhoneCanvas()) {
    if (lastSyncKey !== 'off') {
      lastSyncKey = 'off';
      restoreDefaultViewport();
    }
    return;
  }

  const { w, h } = getDisplayDimensions();
  const key = `canvas:${w}x${h}`;
  if (key === lastSyncKey) return;
  lastSyncKey = key;

  applyTabletPhoneCanvasViewport();
}

/** rAF で 1 フレームに 1 回だけ同期 */
export function scheduleTabletPhoneCanvasSync(): void {
  if (typeof window === 'undefined') return;
  if (scheduledRaf != null) return;
  scheduledRaf = window.requestAnimationFrame(() => {
    scheduledRaf = null;
    syncTabletPhoneCanvasViewportNow();
  });
}

export function syncTabletPhoneCanvasViewport(): void {
  syncTabletPhoneCanvasViewportNow();
}

/** 画面回転・端末切替時: 寸法キャッシュを捨てて再同期 */
export function resetTabletPhoneCanvasSyncCache(): void {
  lastSyncKey = null;
}

const TILE_MATCH_FULL_DATASET = 'rkTileMatchFull';

/** ペア探し: iPad でも実幅・実高（390px canvas を確実に解除） */
export function enterTileMatchFullViewport(): void {
  if (typeof document === 'undefined') return;
  resetTabletPhoneCanvasSyncCache();
  restoreDefaultViewport();
  document.documentElement.dataset[TILE_MATCH_FULL_DATASET] = '1';
}

export function leaveTileMatchFullViewport(): void {
  if (typeof document === 'undefined') return;
  delete document.documentElement.dataset[TILE_MATCH_FULL_DATASET];
  applyViewportForScreenDeferred('seat-selection');
}
