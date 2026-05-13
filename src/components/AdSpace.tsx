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
      const h = el.getBoundingClientRect().height;
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
          ? 'fixed bottom-0 left-0 right-0 z-[1200] w-full'
          : 'relative z-[20] w-full',
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
        className="flex h-[90px] min-h-[90px] max-h-[90px] w-full items-center justify-center gap-3 min-w-0 px-3 sm:px-4"
        style={{ height: BANNER_CSS_PX, maxHeight: BANNER_CSS_PX }}
      >
        <span className="bg-[#333333] text-white text-[10px] px-2 py-0.5 rounded border border-white/10 font-bold shrink-0">
          AD
        </span>
        {enabled && !loadError ? (
          <div className="min-w-0 flex-1 overflow-hidden max-h-[90px] flex items-center justify-center">
            <ins
              className="adsbygoogle block w-full max-w-full"
              style={{
                display: 'block',
                width: '100%',
                height: BANNER_CSS_PX,
                maxHeight: BANNER_CSS_PX,
                overflow: 'hidden',
              }}
              data-ad-client={ADSENSE_CLIENT}
              data-ad-slot={adSlot}
              data-ad-format="auto"
              data-full-width-responsive="true"
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