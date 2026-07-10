import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { vibrate } from '../lib/utils';

export const RelayStoryTrialPopup: React.FC<{
  open: boolean;
  onDismiss: () => void;
  onTry: () => void;
}> = ({ open, onDismiss, onTry }) => {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[840] flex items-center justify-center p-6 bg-rk-slate-900/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="relay-story-trial-title"
        >
          <motion.div
            initial={{ scale: 0.95, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 8 }}
            className="max-w-[min(92vw,24rem)] rounded-2xl border-4 border-rk-violet-300 bg-gradient-to-b from-rk-amber-50 to-rk-violet-50 px-6 py-5 shadow-2xl text-center"
          >
            <p
              id="relay-story-trial-title"
              className="text-base md:text-lg font-black text-rk-violet-950 leading-snug"
            >
              制作中
            </p>
            <p className="mt-2 text-xs font-medium text-rk-violet-900/85 leading-relaxed">
              起・承・転・結の４話（4人がそれぞれ繋げた話）でひとつの物語。書いた人も読むだけの人も楽しめます。
            </p>
            <div className="mt-4 flex flex-col xs:flex-row gap-2 justify-center">
              <button
                type="button"
                className="min-h-[44px] px-4 rounded-xl bg-rk-violet-600 text-rk-white text-sm font-black shadow-sm active:scale-[0.98] transition-transform"
                onClick={() => {
                  vibrate(10);
                  onTry();
                }}
              >
                連続小説を試す
              </button>
              <button
                type="button"
                className="min-h-[44px] px-4 rounded-xl border-2 border-rk-violet-300 bg-rk-white text-rk-violet-950 text-sm font-bold active:scale-[0.98] transition-transform"
                onClick={() => {
                  vibrate(10);
                  onDismiss();
                }}
              >
                閉じる
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default RelayStoryTrialPopup;
