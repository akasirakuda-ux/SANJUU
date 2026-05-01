import React from 'react';
import ModeEntryLayout from './ModeEntryLayout';
import { btnGhost } from '../ui/policy';

const WorldsWish: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  return (
    <div className="absolute inset-0 z-40 bg-amber-100 p-3 md:p-4 overflow-visible">
      <div className="relative h-full w-full rounded-xl shadow-md border border-amber-300/80 overflow-hidden">
        <ModeEntryLayout
          title="みんなの願い"
          subtitle="準備中"
          titleStrokeColor="#fbbf24"
          subtitleClassName="text-slate-50/90"
          backgroundClassName="bg-gradient-to-b from-indigo-950 via-violet-900 to-amber-200"
          rakudaBackdropVariant="quiet"
          topLeft={
            <button
              type="button"
              onClick={onBack}
              className={`w-10 h-10 flex items-center justify-center leading-none ${btnGhost}`}
              aria-label="もどる"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="4" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          }
          titleTopClass="top-[18%]"
          childrenTopClass="top-[34%]"
          mainColumnTopClass="top-[52%]"
          children={
            <div className="mx-auto w-full max-w-md space-y-3 rounded-2xl border border-yellow-200/35 bg-white/10 backdrop-blur-sm px-4 py-4 shadow-sm">
              <p className="text-[12px] font-black tracking-widest text-yellow-200/95 text-center">WISH OF WORDS</p>
              <p className="text-sm font-medium text-slate-50 leading-relaxed text-center">
                世界中の言葉が、誰かの願いになりますように
              </p>
              <p className="text-xs text-slate-50/80 leading-relaxed text-center">
                ひかりの方へ、ゆっくり準備しています。
              </p>
            </div>
          }
          mainColumn={
            <div className="w-full max-w-md mx-auto flex flex-col items-stretch gap-2">
              <button
                type="button"
                onClick={onBack}
                className="w-full rounded-xl border border-yellow-200/35 bg-white/15 text-slate-50 text-sm font-medium py-3 shadow-sm hover:bg-white/20 active:scale-[0.99] transition-transform"
              >
                もどる
              </button>
            </div>
          }
          footer={
            <div className="text-[10px] text-slate-50/70 font-medium text-center">
              らくだ珈琲 — みんなの願い
            </div>
          }
        />
      </div>
    </div>
  );
};

export default WorldsWish;

