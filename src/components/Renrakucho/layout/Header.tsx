import React, { useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import { btnGhost } from '../../../ui/policy';
import { pageTopHeadingClass } from '../../../ui/typography';

const Header: React.FC<{
  onBack: () => void;
  variant?: 'default' | 'hundred';
  /** 未指定時は従来どおり「みんなであそぶ（掲示板）」（例: `/keijiban` では「掲示板」） */
  title?: string;
}> = ({ onBack, variant = 'default', title }) => {
  const isHundred = variant === 'hundred';
  const isStreamMode = useMemo(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get('stream') === '1') return true;
    } catch {
      // ignore
    }
    try {
      return window.localStorage.getItem('rk_stream_mode') === '1';
    } catch {
      return false;
    }
  }, []);

  return (
    <header
      className={
        isHundred
          ? 'bg-[#5a3d28] border-b border-[#3b2a18] p-3 flex items-center justify-between shadow-md'
          : 'bg-amber-50 border-b border-amber-200 p-3 flex items-center justify-between shadow-sm'
      }
    >
      <button
        onClick={onBack}
        className={
          isHundred
            ? 'rounded-xl bg-white/15 text-white p-2 font-medium active:scale-95 transition-transform'
            : btnGhost
        }
        aria-label="戻る"
      >
        <ChevronLeft size={24} className={isHundred ? 'text-white' : undefined} />
      </button>
      <h1
        className={`min-w-0 flex items-center gap-2 ${pageTopHeadingClass} ${isHundred ? 'text-white' : 'text-amber-950'}`}
      >
        <span className="text-base leading-none shrink-0" aria-hidden>
          📝
        </span>
        <span className="truncate">{title ?? 'みんなであそぶ（掲示板）'}</span>
        {isStreamMode ? (
          <span
            className={
              isHundred
                ? 'ml-2 text-[10px] font-black px-2 py-0.5 rounded-lg border border-white/30 bg-white/15 text-white shrink-0'
                : 'ml-2 text-[10px] font-black px-2 py-0.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 shrink-0'
            }
            title="配信モード（軽量化）"
          >
            広告なし
          </span>
        ) : null}
      </h1>
      <button
        type="button"
        onClick={() => {
          try {
            const next = isStreamMode ? '0' : '1';
            window.localStorage.setItem('rk_stream_mode', next);
          } catch {
            // ignore
          }
          // 画面側の購読・広告表示が多数あるため、切替はリロードで確実に反映する
          window.location.reload();
        }}
        className={
          isHundred
            ? 'rounded-xl bg-white/15 text-white px-2.5 py-2 text-[11px] font-black border border-white/20 active:scale-95 transition-transform shrink-0'
            : `${btnGhost} px-2.5 py-2 text-[11px] font-black shrink-0`
        }
        title="配信モード（軽量化）を切り替えます"
        aria-label="配信モード切り替え"
      >
        {isStreamMode ? '広告あり' : '広告なし'}
      </button>
    </header>
  );
};

export default Header;
