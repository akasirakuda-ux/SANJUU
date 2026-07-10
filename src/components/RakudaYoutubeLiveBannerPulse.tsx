import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { RK_YOUTUBE_LIVE_BANNER_LABEL } from '../lib/rakudaLiveBannerPulse';
import { useLiveBannerPulse } from '../hooks/useLiveBannerPulse';
import { shouldShowLiveBannerPulseScreen } from '../lib/rakudaLiveBannerPulse';

const RakudaYoutubeLiveBannerPulse: React.FC<{
  screen: string;
  showRenrakucho: boolean;
}> = ({ screen, showRenrakucho }) => {
  const eligible = shouldShowLiveBannerPulseScreen(screen, showRenrakucho);
  const visible = useLiveBannerPulse(eligible);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="youtube-live-banner-pulse"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
          className="pointer-events-none fixed left-1/2 z-[6500] -translate-x-1/2 px-4"
          style={{ top: 'max(0.5rem, env(safe-area-inset-top))' }}
          role="status"
          aria-live="polite"
        >
          <div className="rounded-lg border-4 border-rk-red-600 bg-rk-red-600 px-4 py-1.5 text-center text-[15px] font-black tracking-wide text-rk-white shadow-lg whitespace-nowrap sm:text-[17px]">
            {RK_YOUTUBE_LIVE_BANNER_LABEL}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
};

export default RakudaYoutubeLiveBannerPulse;
