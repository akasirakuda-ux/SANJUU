import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cardClass } from '../../../ui/policy';

const RenrakuchoBreakPopup: React.FC<{
  open: boolean;
  onClose: () => void;
  myOnBreak: boolean;
  onToggleBreak: () => void;
  myPlayInvite: boolean;
  onTogglePlayInvite: () => void;
  disabled?: boolean;
  playInviteDisabled?: boolean;
  userEmoji: string;
  userName: string;
}> = ({
  open,
  onClose,
  myOnBreak,
  onToggleBreak,
  myPlayInvite,
  onTogglePlayInvite,
  disabled = false,
  playInviteDisabled = false,
  userEmoji,
  userName,
}) => {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[250] flex items-center justify-center bg-rk-amber-950/35 p-4"
          onClick={onClose}
          aria-hidden={!open}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="renraku-break-title"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            className={`w-full max-w-xs ${cardClass} border-2 border-rk-amber-200 p-4 shadow-xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-rk-amber-200 bg-rk-white text-2xl shadow-sm">
                {userEmoji || '👤'}
                {myOnBreak ? (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-rk-success-500 bg-rk-success-100 text-[10px] leading-none">
                    ☕
                  </span>
                ) : null}
                {myPlayInvite ? (
                  <span className="absolute -left-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border border-rk-sky-500 bg-rk-sky-100 px-0.5 text-[9px] font-black leading-none text-rk-sky-950">
                    ？
                  </span>
                ) : null}
              </div>
              <div>
                <h2 id="renraku-break-title" className="text-sm font-black text-rk-amber-950">
                  {myOnBreak ? '☕ 休憩中' : `${userName || 'ななし'}さん`}
                </h2>
                <p className="mt-2 text-[11px] font-bold leading-relaxed text-rk-amber-900/80">
                  {myOnBreak
                    ? 'らくだにいますが、いま画面は見ていません（食事など）。戻ったらボタンを押してください。'
                    : '食事・よそ事のときは「休憩する」を押すと、今いる人に伝わります。'}
                </p>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={onToggleBreak}
                className={[
                  'w-full rounded-xl border-2 px-4 py-2.5 text-xs font-black shadow-sm transition active:scale-[0.98] disabled:opacity-50',
                  myOnBreak
                    ? 'border-rk-success-600 bg-rk-success-100 text-rk-success-950'
                    : 'border-rk-amber-400 bg-rk-amber-50 text-rk-amber-950',
                ].join(' ')}
                aria-pressed={myOnBreak}
              >
                {myOnBreak ? '戻った（休憩をやめる）' : '☕ 休憩する'}
              </button>
              <button
                type="button"
                disabled={playInviteDisabled}
                onClick={onTogglePlayInvite}
                className={[
                  'w-full rounded-xl border-2 px-4 py-2.5 text-xs font-black shadow-sm transition active:scale-[0.98] disabled:opacity-50',
                  myPlayInvite
                    ? 'border-rk-sky-600 bg-rk-sky-100 text-rk-sky-950'
                    : 'border-rk-sky-300 bg-rk-white text-rk-sky-950',
                ].join(' ')}
                aria-pressed={myPlayInvite}
              >
                {myPlayInvite ? '一緒に遊ぶ？をやめる' : '一緒に遊ぶ？を出す'}
              </button>
              <p className="text-[10px] font-bold leading-relaxed text-rk-amber-900/70">
                「一緒に遊ぶ？」は30分で自動的に消えます。
              </p>
              <button
                type="button"
                onClick={onClose}
                className="text-[11px] font-bold text-rk-amber-800/70 underline-offset-2 hover:underline"
              >
                とじる
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default RenrakuchoBreakPopup;
