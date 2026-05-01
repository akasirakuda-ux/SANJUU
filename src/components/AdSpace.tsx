import React, { useEffect, useMemo, useRef, useState } from 'react';

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
const AdSpace: React.FC<AdSpaceProps> = ({
  isVisible,
  onHide,
  language = 'ja',
  viewerCount,
  className = '',
  placement = 'fixed',
}) => {
  if (!isVisible) return null;

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
      const v = Number.isFinite(px) && px > 0 ? `${Math.round(px)}px` : shouldReserve ? '56px' : '0px';
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
        setVar(shouldReserve ? 56 : 0);
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
    if (!enabled) return;
    if (pushTriedRef.current) return;
    pushTriedRef.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.warn('[AdSpace] adsbygoogle push failed', e);
      setLoadError(true);
    }
  }, [enabled]);

  return (
    <div
      ref={containerRef}
      className={[
        placement === 'fixed'
          ? 'fixed bottom-0 left-0 right-0 z-[1200]'
          : 'relative z-[20]',
        'w-full h-[56px] min-h-[56px] max-h-[56px] bg-[#1A1A1A] px-4 flex items-center justify-between border-t border-white/5 overflow-hidden',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ height: 56, maxHeight: 56 }}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="bg-[#333333] text-white text-[10px] px-2 py-0.5 rounded border border-white/10 font-bold shrink-0">AD</span>
        {enabled && !loadError ? (
          <div className="min-w-0 flex-1 overflow-hidden max-h-[56px]">
            <ins
              className="adsbygoogle block w-full"
              style={{ display: 'block', width: '100%', height: 56, maxHeight: 56, overflow: 'hidden' }}
              data-ad-client={ADSENSE_CLIENT}
              data-ad-slot={adSlot}
              data-ad-format="horizontal"
              data-full-width-responsive="false"
            />
          </div>
        ) : (
          <p className="text-white/80 text-[12px] font-bold tracking-tight truncate">
            {language === 'ja'
              ? '広告（AdSense設定待ち）'
              : 'Ad (AdSense not configured)'}
          </p>
        )}
      </div>
      <div className="flex items-center gap-4" />
    </div>
  );
};

export default AdSpace;