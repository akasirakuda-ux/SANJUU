/** スマホ相当のレイアウト幅（CSS px）— らくだ本体 `src/lib/tabletPhoneCanvas.ts` と同値 */
export const PHONE_CANVAS_WIDTH = 390;

/** iPad mini 縦幅以上をタブレット扱い */
export const TABLET_PHONE_CANVAS_MIN_SHORT_EDGE = 744;

export const DEFAULT_VIEWPORT_CONTENT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

function readQueryOverride(): boolean | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  if (q.get('phoneCanvas') === '1') return true;
  if (q.get('phoneCanvas') === '0') return false;
  return null;
}

/** 一覧・掲示板は iPad 幅をそのまま使う（phone canvas 390px 拡大は使わない） */
function shouldSkipPhoneCanvasForRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return (
    path === '/sanjuu/recruit-board' ||
    path.endsWith('/sanjuu/recruit-board') ||
    path === '/sanjuu/tile-match-recruit-board' ||
    path.endsWith('/sanjuu/tile-match-recruit-board') ||
    path === '/sanjuu/bulletin' ||
    path.endsWith('/sanjuu/bulletin')
  );
}

function isPhysicalTabletTouchDevice(): boolean {
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
  if (shouldSkipPhoneCanvasForRoute()) return false;
  return isPhysicalTabletTouchDevice();
}

function viewportMeta(): HTMLMetaElement | null {
  return document.querySelector('meta[name="viewport"]');
}

function clearPhoneCanvasCssVars(): void {
  document.documentElement.style.removeProperty('--rk-phone-canvas-scale');
  document.documentElement.style.removeProperty('--rk-phone-canvas-layout-h');
}

function setPhoneCanvasCssVars(scale: number, layoutH: number): void {
  document.documentElement.style.setProperty('--rk-phone-canvas-scale', String(scale));
  document.documentElement.style.setProperty('--rk-phone-canvas-layout-h', `${layoutH}px`);
}

let lastViewportContent: string | null = null;
let lastSyncKey: string | null = null;
let scheduledRaf: number | null = null;

function buildViewportContent(scaleStr: string): string {
  return `width=${PHONE_CANVAS_WIDTH}, initial-scale=${scaleStr}, maximum-scale=${scaleStr}, user-scalable=no, viewport-fit=cover`;
}

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

function syncTabletPhoneCanvasViewportNow(): void {
  const enabled = shouldUseTabletPhoneCanvas();
  if (!enabled) {
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

export function resetTabletPhoneCanvasSyncCache(): void {
  lastSyncKey = null;
}

/** index.html 直後と同じ — FOUC 前に viewport を合わせる */
export const TABLET_PHONE_CANVAS_BOOT_SCRIPT = `(function () {
  try {
    var p = (location.pathname || '/').replace(/\\/+$/, '') || '/';
    if (p === '/sanjuu/recruit-board' || p.endsWith('/sanjuu/recruit-board')) return;
    if (p === '/sanjuu/tile-match-recruit-board' || p.endsWith('/sanjuu/tile-match-recruit-board')) return;
    if (p === '/sanjuu/bulletin' || p.endsWith('/sanjuu/bulletin')) return;
    var q = new URLSearchParams(location.search);
    if (q.get('phoneCanvas') === '0') return;
    var coarse = window.matchMedia('(pointer: coarse)').matches;
    if (!coarse && q.get('phoneCanvas') !== '1') return;
    var sw = window.screen.width;
    var sh = window.screen.height;
    var shortEdge = Math.min(sw, sh);
    if (shortEdge < ${TABLET_PHONE_CANVAS_MIN_SHORT_EDGE} && q.get('phoneCanvas') !== '1') return;
    var w = window.innerWidth > 410 ? window.innerWidth : sw;
    var s = Math.min(Math.max(w / ${PHONE_CANVAS_WIDTH}, 1), 3);
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    meta.setAttribute(
      'content',
      'width=${PHONE_CANVAS_WIDTH}, initial-scale=' +
        s +
        ', maximum-scale=' +
        s +
        ', user-scalable=no, viewport-fit=cover',
    );
    document.documentElement.dataset.rakudaPhoneCanvas = '1';
  } catch (e) {}
})();`;
