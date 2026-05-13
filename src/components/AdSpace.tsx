import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface AdSpaceProps {
  isVisible: boolean;
  onHide?: () => void;
  language?: 'ja';
  viewerCount?: number;
  className?: string;
  placement?: 'fixed' | 'inline';
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const ADSENSE_CLIENT = 'ca-pub-7810798546990694';
const ADSENSE_SLOT_FROM_AD_CONSOLE = '4524971505';
const ADSENSE_SLOT_FROM_ENV = (import.meta.env.VITE_ADSENSE_AD_SLOT as string | undefined)?.trim() ?? '';

/** リクエストが h≈90 になることが多いため、枠を 90px に揃えて 400（不正リクエスト）を減らす */
const BANNER_CSS_PX = 90;

function clampBannerHeightPx(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return BANNER_CSS_PX;
  return Math.min(BANNER_CSS_PX, Math.round(raw));
}

const AdSpace: React.FC<AdSpaceProps> = ({
  isVisible,
  onHide,
  language = 'ja',
  viewerCount,
  className = '',
  placement = 'fixed',
}) => {
  const adSlot = (ADSENSE_SLOT_FROM_AD_CONSOLE || ADSENSE_SLOT_FROM_ENV).trim();

  const enabled = useMemo(() => {
    return (
      ADSENSE_CLIENT.startsWith('ca-pub-') &&
      !ADSENSE_CLIENT.includes('XXXX') &&
      /^\d{6,20}$/.test(adSlot)
    );
  }, [adSlot]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const pushTriedRef = useRef(false);
  const [loadError, setLoadError] = useState(false);

  // AdSense が iframe を position:fixed で大きく描くと、overflow だけでは親外に見える。
  // transform がある祖先は fixed の包含ブロックになるため、90px 内に閉じ込める。
  const adClipBoxStyle = useMemo(
    () =>
      ({
        height: BANNER_CSS_PX,
        maxHeight: BANNER_CSS_PX,
        transform: 'translateZ(0)',
        overflow: 'hidden',
      }) as const,
    []
  );

  // 400 などで iframe 読み込み失敗したとき、黒巨大プレースホルダを止める（端末差あり）。
  useEffect(() => {
    if (!isVisible || !enabled || loadError) return;
    const onErr = (ev: Event) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.tagName !== 'IFRAME') return;
      const src = t.getAttribute('src') ?? '';
      if (src.includes('doubleclick.net') || src.includes('googleads.g.')) {
        setLoadError(true);
      }
    };
    window.addEventListener('error', onErr, true);
    return () => window.removeEventListener('error', onErr, true);
  }, [enabled, isVisible, loadError]);

  // Expose fixed-banner height to layout via CSS variable.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const shouldReserve = isVisible && placement === 'fixed';
    const setVar = (px: number) => {
      const v =
        Number.isFinite(px) && px > 0 ? `${Math.round(px)}px` : shouldReserve ? `${BANNER_CSS_PX}px` : '0px';
      try {
        root.style.setProperty('--rk-bottom-banner', shouldReserve ? v : '0px');
      } catch {
        // ignore
      }
    };

    // Prefer actual rendered height (AdSense can expand unexpectedly on some devices).
    const measure = () => {
      const el = containerRef.current;
      if (!el) {
        setVar(shouldReserve ? BANNER_CSS_PX : 0);
        return;
      }
      // AdSense が子 iframe を縦に膨らませると DOM 高さが画面半分になることがある。
      // レイアウト予約（--rk-bottom-banner）と見た目の帯の高さは常に 90px 上限に固定する。
      const h = clampBannerHeightPx(el.getBoundingClientRect().height);
      setVar(h);
    };

    measure();

    let ro: ResizeObserver | null = null;
    if (shouldReserve && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      if (containerRef.current) ro.observe(containerRef.current);
    }

    const onResize = () => measure();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      try {
        ro?.disconnect();
      } catch {
        // ignore
      }
      try {
        root.style.setProperty('--rk-bottom-banner', '0px');
      } catch {
        // ignore
      }
    };
  }, [isVisible, placement]);

  useEffect(() => {
    if (!isVisible || !enabled) return;
    if (pushTriedRef.current) return;
    pushTriedRef.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.warn('[AdSpace] adsbygoogle push failed', e);
      setLoadError(true);
    }
  }, [enabled, isVisible]);

  if (!isVisible) return null;

  const bar = (
    <div
      className={[
        placement === 'fixed'
          ? 'fixed bottom-0 left-0 right-0 z-[1200] w-full max-h-[calc(90px+env(safe-area-inset-bottom))]'
          : 'relative z-[20] w-full max-h-[90px]',
        // 帯状: 本体 90px + 下 safe-area（見た目）。--rk-bottom-banner は内側 90px のみ計測（AppLayout と二重に safe-area しない）
        `bg-[#1A1A1A] border-t border-white/5 overflow-hidden pb-[env(safe-area-inset-bottom)]`,
        `flex flex-col items-stretch justify-end gap-0 px-0`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={placement === 'fixed' ? undefined : { minHeight: BANNER_CSS_PX }}
      role="complementary"
      aria-label={language === 'ja' ? '広告' : 'Advertisement'}
    >
      <div
        ref={containerRef}
        className="flex h-[90px] min-h-0 max-h-[90px] w-full shrink-0 items-center justify-center gap-3 min-w-0 overflow-hidden px-3 sm:px-4 [contain:layout]"
        style={{ height: BANNER_CSS_PX, maxHeight: BANNER_CSS_PX }}
      >
        <span className="bg-[#333333] text-white text-[10px] px-2 py-0.5 rounded border border-white/10 font-bold shrink-0">
          AD
        </span>
        {enabled && !loadError ? (
          <div
            className="relative min-h-0 min-w-0 flex-1 flex items-center justify-center [&_iframe]:!max-h-[90px] [&_iframe]:!max-w-full"
            style={adClipBoxStyle}
          >
            <ins
              className="adsbygoogle block w-full max-w-full !max-h-[90px] overflow-hidden"
              style={{
                display: 'block',
                width: '100%',
                maxWidth: '100%',
                height: BANNER_CSS_PX,
                maxHeight: BANNER_CSS_PX,
                overflow: 'hidden',
              }}
              data-ad-client={ADSENSE_CLIENT}
              data-ad-slot={adSlot}
              data-ad-format="horizontal"
              data-full-width-responsive="false"
            />
          </div>
        ) : (
          <p className="text-white/80 text-[12px] font-bold tracking-tight truncate text-center">
            {language === 'ja' ? '広告（AdSense設定待ち）' : 'Ad (AdSense not configured)'}
          </p>
        )}
      </div>
    </div>
  );

  if (placement === 'fixed') {
    if (typeof document === 'undefined') return null;
    return createPortal(bar, document.body);
  }

  return bar;
};

export default AdSpace;