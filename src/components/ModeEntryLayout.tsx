import React, { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { btnGhost } from '../ui/policy';
import RakudaFloatingBackdrop, { type RakudaBackdropVariant } from './RakudaFloatingBackdrop';

export interface ModeEntryLayoutProps {
  /** 中央の大タイトル（ことば探しタイトルと同様の縁取りスタイル） */
  title: React.ReactNode;
  /** タイトル下の英字・補助テキスト */
  subtitle?: string;
  /** 補助テキストの色（例: 暗背景用 text-sky-200/90） */
  subtitleClassName?: string;
  /** false のときサブタイトルを大文字変換しない（ことば探しの英字行用） */
  subtitleUppercase?: boolean;
  /** タイトル（h1）に重ねるバッジ・ラベル（例: テスト中表示） */
  titleBadge?: React.ReactNode;
  /** WebkitTextStroke 用の色（例: #92400e） */
  titleStrokeColor: string;
  /** 画面全体の背景（Tailwind クラス） */
  backgroundClassName: string;
  /** らくだ珈琲の文字・絵文字パターン（低不透明度の浮遊レイヤー） */
  rakudaBackdropVariant?: RakudaBackdropVariant;
  /** メインCTA（`mainColumn` 未指定時は必須） */
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryButtonClassName?: string;
  /** サブCTA（任意） */
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryButtonClassName?: string;
  /** 左上：戻る（省略時は表示しない） */
  onBack?: () => void;
  /** 左上スロット（ハブの設定ボタン等。`onBack` より優先して並べる場合は children で制御） */
  topLeft?: React.ReactNode;
  /** 右上スロット（設定・ログイン等） */
  topRight?: React.ReactNode;
  /** タイトルとボタンのあいだ（プロフィール欄など） */
  children?: React.ReactNode;
  /** フッター（バージョン表記など） */
  footer?: React.ReactNode;
  /**
   * 指定時は primary/secondary の代わりにこのブロックを表示（トップハブの複数ボタン列用）
   */
  mainColumn?: React.ReactNode;
  /** タイトルブロックの top（既定 25%） */
  titleTopClass?: string;
  /** 補助コンテンツの top（既定 top-[42%]） */
  childrenTopClass?: string;
  /** メイン列の top（既定 top-[58%]） */
  mainColumnTopClass?: string;
  /** メイン列のスクロール（ハブの未読バッジ等がはみ出すときは `overflow-visible`） */
  mainColumnScrollClassName?: string;
}

/**
 * 「ことば探し」系のエントリー画面と同じ骨格：
 * 上部ツールバー → 25% 付近に大タイトル → 63% 付近にメインボタン列
 */
const ModeEntryLayout: React.FC<ModeEntryLayoutProps> = ({
  title,
  subtitle,
  subtitleClassName = 'text-slate-700/90',
  subtitleUppercase = true,
  titleBadge,
  titleStrokeColor,
  backgroundClassName,
  rakudaBackdropVariant,
  primaryLabel,
  onPrimary,
  primaryButtonClassName,
  secondaryLabel,
  onSecondary,
  secondaryButtonClassName,
  onBack,
  topLeft,
  topRight,
  children,
  footer,
  mainColumn,
  titleTopClass = 'top-[25%]',
  childrenTopClass = 'top-[42%]',
  mainColumnTopClass = 'top-[58%]',
  mainColumnScrollClassName = 'overflow-y-auto',
}) => {
  const [boardWidth, setBoardWidth] = useState(0);

  useEffect(() => {
    const updateWidth = () => {
      const isMobile = window.innerWidth < 768;
      const availableWidth = isMobile ? window.innerWidth - 32 : window.innerWidth - 64;
      setBoardWidth(Math.min(availableWidth, 800));
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const vibrate = (ms: number) => {
    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      window.navigator.vibrate(ms);
    }
  };

  return (
    <div
      className={`h-full w-full min-h-0 select-none relative ${backgroundClassName} ${
        rakudaBackdropVariant === 'hub' ? 'overflow-visible' : 'overflow-hidden'
      }`}
    >
      {rakudaBackdropVariant ? <RakudaFloatingBackdrop variant={rakudaBackdropVariant} /> : null}
      <div className="absolute top-0 left-0 w-full flex items-center justify-between px-4 z-30 pt-[env(safe-area-inset-top)] py-2 min-h-[56px]">
        <div className="flex items-center gap-2 min-h-[40px]">
          {topLeft}
          {onBack && (
            <button
              type="button"
              onClick={() => {
                vibrate(10);
                onBack();
              }}
              className="w-10 h-10 md:w-12 md:h-12 bg-white/90 text-slate-700 flex items-center justify-center shadow-sm active:scale-95 transition-transform rounded-xl border border-slate-200/80 leading-none"
              aria-label="もどる"
            >
              <ChevronLeft size={28} strokeWidth={3} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">{topRight}</div>
      </div>

      <div
        className={`absolute left-1/2 -translate-x-1/2 w-full flex flex-col items-center z-10 px-3 ${titleTopClass}`}
      >
        <div className="flex flex-col items-center gap-1 animate-in fade-in duration-500">
          <div className="relative w-max max-w-[95vw] mx-auto">
            <h1
              className="text-[11vw] xs:text-[3.25rem] md:text-[4.5rem] lg:text-[5.25rem] font-black tracking-tighter leading-none text-white text-center max-w-[95vw]"
              style={{
                fontFamily: '"M PLUS Rounded 1c", sans-serif',
                WebkitTextStroke: `min(7px, 1.8vw) ${titleStrokeColor}`,
                paintOrder: 'stroke fill',
                filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.18))',
                textWrap: 'balance',
              }}
            >
              {title}
            </h1>
            {titleBadge}
          </div>
          {subtitle ? (
            <div className="text-center w-full px-2 mt-1">
              <p
                className={`text-[10px] xs:text-xs md:text-base font-black tracking-tight ${subtitleUppercase ? 'uppercase' : ''} ${subtitleClassName}`}
              >
                {subtitle}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {children ? (
        <div
          className={`absolute left-1/2 -translate-x-1/2 z-[15] px-6 flex flex-col items-center w-full ${childrenTopClass}`}
          style={{ width: boardWidth || 'auto', maxWidth: '100%' }}
        >
          <div className="w-full max-w-md">{children}</div>
        </div>
      ) : null}

      <div
        className={`absolute left-1/2 -translate-x-1/2 z-20 px-6 flex flex-col gap-3 items-center w-full min-h-0 bottom-[calc(var(--rk-bottom-banner,0px)+12px)] ${mainColumnScrollClassName} ${mainColumnTopClass}`}
        style={{ width: boardWidth || 'auto', maxWidth: '100%' }}
      >
        {mainColumn ? (
          mainColumn
        ) : primaryLabel && onPrimary && primaryButtonClassName ? (
          <>
            <button
              type="button"
              onClick={() => {
                vibrate(12);
                onPrimary();
              }}
              className={`w-full max-w-md h-[56px] md:h-[60px] flex items-center justify-center rounded-xl text-sm font-medium shadow-sm border border-black/5 active:scale-[0.99] transition-transform ${primaryButtonClassName}`}
            >
              {primaryLabel}
            </button>
            {secondaryLabel && onSecondary ? (
              <button
                type="button"
                onClick={() => {
                  vibrate(8);
                  onSecondary();
                }}
                className={`w-full max-w-md h-[52px] flex items-center justify-center rounded-xl text-sm font-medium active:scale-[0.99] transition-transform ${secondaryButtonClassName ?? btnGhost}`}
              >
                {secondaryLabel}
              </button>
            ) : null}
          </>
        ) : null}
        {footer ? <div className="w-full flex justify-center mt-2">{footer}</div> : null}
      </div>
    </div>
  );
};

export default ModeEntryLayout;
