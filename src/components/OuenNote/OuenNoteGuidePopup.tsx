import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { createPortal } from 'react-dom';
import {
  OUEN_NOTE_GATE_WHY_STAMPS,
  OUEN_NOTE_MIN_STAMPS,
  OUEN_NOTE_MODERATION_NOTICE,
  OUEN_NOTE_POSTING_NOTICE,
  OUEN_NOTE_TITLE,
  OUEN_NOTE_WORLDVIEW,
} from '../../lib/ouenNoteConfig';
import { vibrate } from '../../lib/utils';

export const OuenNoteGuidePopup: React.FC<{
  open: boolean;
  onDismiss: () => void;
}> = ({ open, onDismiss }) => {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[7000] flex items-end sm:items-center justify-center p-3 sm:p-6 bg-rk-slate-900/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ouen-note-guide-title"
          onClick={() => {
            vibrate(10);
            onDismiss();
          }}
        >
          <motion.div
            initial={{ scale: 0.97, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 12 }}
            className="w-full max-w-[min(92vw,26rem)] max-h-[min(88dvh,36rem)] flex flex-col rounded-2xl border-4 border-rk-teal-600 bg-gradient-to-b from-rk-teal-50 to-rk-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 px-5 pt-5 pb-3 text-center border-b border-rk-teal-200/80">
              <p className="text-2xl leading-none" aria-hidden>
                📝
              </p>
              <p
                id="ouen-note-guide-title"
                className="mt-2 text-sm sm:text-base font-black text-rk-teal-900 leading-snug"
              >
                {OUEN_NOTE_TITLE} — 説明
              </p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-3 text-left">
              <section className="rounded-xl border border-rk-teal-200/80 bg-rk-white/95 p-3 space-y-1.5">
                <p className="text-[11px] font-black text-rk-teal-900">
                  なぜしゅっせき{OUEN_NOTE_MIN_STAMPS}日以上？
                </p>
                <p className="text-[11px] font-bold text-rk-slate-700 leading-relaxed whitespace-pre-wrap">
                  {OUEN_NOTE_GATE_WHY_STAMPS}
                </p>
              </section>

              <section className="rounded-xl border border-rk-sky-200/80 bg-rk-sky-50/40 p-3 space-y-1.5">
                <p className="text-[11px] font-black text-rk-sky-950">この場の空気</p>
                <p className="text-[11px] font-bold text-rk-slate-700 leading-relaxed whitespace-pre-wrap">
                  {OUEN_NOTE_WORLDVIEW}
                </p>
              </section>

              <section className="rounded-xl border border-rk-amber-200/80 bg-rk-amber-50/50 p-3 space-y-1.5">
                <p className="text-[11px] font-black text-rk-amber-950">ご利用について</p>
                <p className="text-[11px] font-bold text-rk-slate-700 leading-relaxed whitespace-pre-wrap">
                  {OUEN_NOTE_MODERATION_NOTICE}
                </p>
              </section>

              <p className="text-[11px] font-bold text-rk-slate-600 leading-relaxed px-0.5">
                {OUEN_NOTE_POSTING_NOTICE}
              </p>
            </div>

            <div className="shrink-0 px-5 pb-5 pt-2 border-t border-rk-teal-200/80">
              <button
                type="button"
                className="min-h-[44px] w-full px-4 rounded-xl border-2 border-rk-teal-600 bg-rk-teal-600 text-rk-white text-sm font-black active:scale-[0.98] transition-transform"
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
    </AnimatePresence>,
    document.body,
  );
};

export default OuenNoteGuidePopup;
