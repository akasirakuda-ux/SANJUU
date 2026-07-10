import React from 'react';
import { ChevronLeft } from 'lucide-react';

/** らくだトップへ戻る（三十・ことば探し共通）：淡い水色寄りの地＋太め・角丸キャップの左矢印 */
export const RakudaHomeSquircleButton: React.FC<{
  onClick: () => void;
  /** 隣の戻るボタンと揃える（例 w-10 h-10 md:w-14 md:h-14） */
  sizeClassName: string;
  title?: string;
  /** RK-18 向け：アイコンも半分サイズ */
  compact?: boolean;
}> = ({ onClick, sizeClassName, title = 'らくだ珈琲のトップへもどる', compact = false }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${sizeClassName} flex-shrink-0 z-10 flex items-center justify-center ${compact ? 'rounded-[0.7rem] md:rounded-[0.875rem]' : 'rounded-[1.35rem] md:rounded-[1.75rem]'} bg-[var(--rk-hub-squircle)] border border-rk-sky-100/90 shadow-sm text-rk-slate-800 active:scale-95 transition-transform`}
      aria-label={title}
      title={title}
    >
      <ChevronLeft
        className={compact ? 'w-3 h-3 md:w-3.5 md:h-3.5' : 'w-[1.65rem] h-[1.65rem] md:w-8 md:h-8'}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      />
    </button>
  );
};
