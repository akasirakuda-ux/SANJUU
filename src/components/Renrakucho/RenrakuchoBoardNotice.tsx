import React, { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Info } from 'lucide-react';
/** 掲示板トップに常時表示する注意書き */
const RenrakuchoBoardNotice: React.FC = () => {
  const contentId = useId();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm py-2.5 px-3">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Info className="w-5 h-5 text-amber-950 shrink-0" aria-hidden />
          <span className="text-xs font-black text-amber-950 truncate">掲示板をご利用の前に</span>
        </span>
        <span
          className={`shrink-0 w-11 h-11 -mr-1 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-amber-950 shadow-sm transition-transform duration-200 ${
            isOpen ? 'rotate-180' : 'rotate-0'
          }`}
          aria-hidden
        >
          <span className="text-[30px] leading-none font-black">▾</span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={contentId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-2.5 pl-7 space-y-1.5">
              <p className="text-[11px] font-medium leading-relaxed text-amber-950">
                公開で送るメッセージは、<strong>タイムライン（掲示・募集・探しもの）</strong>に表示されます。非公開は管理者だけが読みます。
              </p>
              <p className="text-[11px] leading-relaxed text-amber-950">
                みんなが気持ちよく過ごせるよう、やさしい言葉を使いましょう。誹謗中傷や個人情報・連絡先の投稿はおやめください。
                <span className="text-sky-700 font-medium"> @ニックネーム</span>
                と書くと相手へ伝わりやすくなります。
              </p>
              <p className="text-[11px] leading-relaxed text-amber-950">
                「みんなであそぶ」の同時参加は<strong>最大30名</strong>です。
              </p>
              <p className="text-[10px] text-amber-950 leading-relaxed">※投稿は30日後に自動的に整理されます</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RenrakuchoBoardNotice;
