/**
 * GA4 — 初期化は vite `injectGa4Tag` が index.html の `<head>` に gtag を埋め込む。
 * ここは SPA 画面遷移の page_path 更新と、開発時のフォールバックのみ。
 */
export function getGaMeasurementId(): string | null {
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!id || typeof id !== 'string' || !id.startsWith('G-')) return null;
  return id;
}

function pageViewParams(): { page_path: string; page_location: string; page_title: string } {
  return {
    page_path: window.location.pathname + window.location.search,
    page_location: window.location.href,
    page_title: document.title,
  };
}

/** カスタムイベント（メニュー利用など）。GA4 では `rakuda_hub_menu` / `rakuda_screen` を登録推奨 */
export function sendGaEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined | null>,
): void {
  if (typeof window === 'undefined') return;
  const gaId = getGaMeasurementId();
  if (!gaId) return;
  const w = window as unknown as Window & { gtag?: (...args: unknown[]) => void };
  if (typeof w.gtag !== 'function') return;
  const clean: Record<string, string> = {};
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      clean[k] = String(v);
    }
  }
  try {
    w.gtag('event', eventName, clean);
  } catch {
    // ignore
  }
}

/** SPA の画面遷移時に page_path を GA4 へ送る */
export function sendGaPageView(): void {
  if (typeof window === 'undefined') return;
  const gaId = getGaMeasurementId();
  if (!gaId) return;
  const w = window as unknown as Window & { gtag?: (...args: unknown[]) => void };
  if (typeof w.gtag !== 'function') return;
  try {
    w.gtag('config', gaId, pageViewParams());
  } catch {
    // ignore
  }
}

/** 開発時など HTML 未注入のときだけ gtag を動的ロード */
export function initGoogleAnalytics4(): void {
  if (typeof window === 'undefined') return;
  const GA_ID = getGaMeasurementId();
  if (!GA_ID) return;

  const w = window as unknown as Window & {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  };
  if (typeof w.gtag === 'function') return;

  w.dataLayer = w.dataLayer || [];
  function gtag(...args: unknown[]) {
    w.dataLayer.push(args);
  }
  w.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID, { send_page_view: true, ...pageViewParams() });

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);
}
