import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { sanjuuRecruitBoardUrlWithRakudaProfile } from '../lib/rakudaHubShell';
import { vibrate } from '../lib/utils';

export const HundredRecruitNewPopup: React.FC<{
  open: boolean;
  userEmoji: string;
  nickname: string;
  onDismiss: () => void;
}> = ({ open, userEmoji, nickname, onDismiss }) => {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[850] flex items-center justify-center p-6 bg-rk-slate-900/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hundred-recruit-new-title"
        >
          <motion.div
            initial={{ scale: 0.95, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 8 }}
            className="max-w-[min(92vw,24rem)] rounded-2xl border-4 border-rk-amber-300 bg-rk-amber-50 px-6 py-5 shadow-2xl text-center"
          >
            <p id="hundred-recruit-new-title" className="text-base md:text-lg font-black text-rk-amber-950 leading-snug">
              ひと言探しの募集に新着あり
            </p>
            <p className="mt-2 text-xs font-medium text-rk-amber-900/85 leading-relaxed">
              みんなであそぶに新しい募集が届いています
            </p>
            <div className="mt-4 flex flex-col xs:flex-row gap-2 justify-center">
              <button
                type="button"
                className="min-h-[44px] px-4 rounded-xl bg-rk-amber-500 text-rk-white text-sm font-black shadow-sm active:scale-[0.98] transition-transform"
                onClick={() => {
                  onDismiss();
                  vibrate(10);
                  window.location.assign(
                    sanjuuRecruitBoardUrlWithRakudaProfile({ emoji: userEmoji, nickname }),
                  );
                }}
              >
                ひと言探し
              </button>
              <button
                type="button"
                className="min-h-[44px] px-4 rounded-xl border-2 border-rk-amber-300 bg-rk-white text-rk-amber-950 text-sm font-bold active:scale-[0.98] transition-transform"
                onClick={onDismiss}
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

export default HundredRecruitNewPopup;
