import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { createPortal } from 'react-dom';
import { OUEN_NOTE_MIN_STAMPS, OUEN_NOTE_TITLE } from '../../lib/ouenNoteConfig';
import { vibrate } from '../../lib/utils';

export const OuenNotePrepPopup: React.FC<{
  open: boolean;
  onDismiss: () => void;
  /** 試験公開 — 「入る」でノートへ */
  onProceed?: () => void;
}> = ({ open, onDismiss, onProceed }) => {
  if (typeof document === 'undefined') return null;

  const canEnter = !!onProceed;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[7000] flex items-center justify-center p-6 bg-rk-slate-900/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ouen-note-prep-title"
          onClick={() => {
            vibrate(10);
            onDismiss();
          }}
        >
          <motion.div
            initial={{ scale: 0.95, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 8 }}
            className="max-w-[min(92vw,24rem)] rounded-2xl border-4 border-rk-amber-600 bg-gradient-to-b from-rk-amber-50 to-rk-white px-6 py-5 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-2xl leading-none" aria-hidden>
              📝
            </p>
            <p
              id="ouen-note-prep-title"
              className="mt-2 text-base md:text-lg font-black text-rk-amber-800 leading-snug"
            >
              テスト中
            </p>
            <p className="mt-2 text-xs font-bold text-rk-amber-950/85 leading-relaxed">
              {canEnter ? (
                <>
                  「{OUEN_NOTE_TITLE}」を試験公開しています。
                  <br />
                  しゅっせき{OUEN_NOTE_MIN_STAMPS}日以上の方が使えます。静かな場所として、様子を見ながら進めます。
                </>
              ) : (
                <>「{OUEN_NOTE_TITLE}」は、もう少ししたら開きます。</>
              )}
            </p>
            {canEnter ? (
              <button
                type="button"
                className="mt-4 min-h-[44px] w-full px-4 rounded-xl border-2 border-rk-teal-600 bg-rk-teal-600 text-rk-white text-sm font-black active:scale-[0.98] transition-transform"
                onClick={() => {
                  vibrate(10);
                  onProceed();
                }}
              >
                入る
              </button>
            ) : null}
            <button
              type="button"
              className={`${canEnter ? 'mt-2' : 'mt-4'} min-h-[44px] w-full px-4 rounded-xl border-2 border-rk-amber-600 bg-rk-white text-rk-amber-900 text-sm font-black active:scale-[0.98] transition-transform`}
              onClick={() => {
                vibrate(10);
                onDismiss();
              }}
            >
              閉じる
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
};

export default OuenNotePrepPopup;
