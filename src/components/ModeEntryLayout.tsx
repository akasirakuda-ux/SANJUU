import React, { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { btnGhost } from '../ui/policy';
import RakudaFloatingBackdrop, { type RakudaBackdropVariant } from './RakudaFloatingBackdrop';

export interface ModeEntryLayoutProps {
  /** 中央の大タイトル（ことば探しタイトルと同様の縁取りスタイル） */
  title: React.ReactNode;
  /** タイトル下の英字・補助テキスト */
  subtitle?: string;
  /** 補助テキストの色（例: 暗背景用 text-rk-sky-200/90） */
  subtitleClassName?: string;
  /** false のときサブタイトルを大文字変換しない（ことば探しの英字行用） */
  subtitleUppercase?: boolean;
  /** タイトル（h1）に重ねるバッジ・ラベル（例: テスト中表示） */
  titleBadge?: React.ReactNode;
  /** WebkitTextStroke 用の色（例: `var(--rk-amber-800)` または `rgb(146 64 14)`） */
  titleStrokeColor: string;
  /** 画面全体の背景（Tailwind クラス） */
  backgroundClassName: string;
  /** らくだ珈琲の文字・絵文字ロジック（低不透明度の浮遊レイヤー） */
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
  /**
   * `absolute` … 従来どおり % + 絶対配置（みんなの願いなど簡易画面向け）
   * `hubScroll` … トップハブ向け。**タイトル→children→main を縦積み＆1 スクロール**。操作域の重なりを防ぐ。
   */
  layoutVariant?: 'absolute' | 'hubScroll';
  /** タイトル（h1）の直上（トップハブの QR 等） */
  aboveTitle?: React.ReactNode;
  /**
   * `hubScroll` のみ。スクロール列の上余白（例: `pt-2`）
   */
  hubScrollContentTopClass?: string;
  /** タイトルブロックの top（`absolute` のみ） */
  titleTopClass?: string;
  /** 補助コンテンツの top（`absolute` のみ） */
  childrenTopClass?: string;
  /** メイン列の top（`absolute` のみ） */
  mainColumnTopClass?: string;
  /** メイン列のスクロール（`absolute` のみ・ハブの未読バッジ等がはみ出すときは `overflow-visible`） */
  mainColumnScrollClassName?: string;
}

/**
 * 「ことば探し」系のエントリー画面と同じ骨格：
 * - 既定: 上部ツールバー → % 指定の絶対配置でタイトル・補助・メイン列
 * - `hubScroll`: らくだトップハブ専用。縦スクロール 1 本にまとめ、UI の競合を防ぐ
 */
const ModeEntryLayout: React.FC<ModeEntryLayoutProps> = ({
  title,
  subtitle,
  subtitleClassName = 'text-rk-slate-700/90',
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
  layoutVariant = 'absolute',
  aboveTitle,
  hubScrollContentTopClass = '',
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

  const titleBlock = (
    <div className="flex flex-col items-center gap-1 animate-in fade-in duration-500 w-full overflow-visible">
      <div
        className={`relative w-max max-w-[95vw] mx-auto overflow-visible ${
          titleBadge ? 'pt-8 sm:pt-10' : 'pt-4 sm:pt-5'
        }`}
      >
        <h1
          className="text-[11vw] xs:text-[3.25rem] md:text-[4.5rem] lg:text-[5.25rem] font-black tracking-tighter leading-[1.08] pt-2 text-rk-white text-center max-w-[95vw]"
          style={{
            fontFamily: '"M PLUS Rounded 1c", sans-serif',
            WebkitTextStroke: `min(7px, 1.8vw) ${titleStrokeColor}`,
            paintOrder: 'stroke fill',
            filter: 'drop-shadow(var(--rk-title-drop-shadow))',
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
  );

  const toolbar = (
    <div className="shrink-0 w-full grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 z-30 pt-[env(safe-area-inset-top)] py-2 min-h-[56px]">
      <div className="flex items-center gap-2 min-h-[40px] justify-self-start min-w-0">
        {topLeft}
        {onBack && (
          <button
            type="button"
            onClick={() => {
              vibrate(10);
              onBack();
            }}
            className="w-10 h-10 md:w-12 md:h-12 bg-rk-white/90 text-rk-slate-700 flex items-center justify-center shadow-sm active:scale-95 transition-transform rounded-xl border border-rk-slate-200/80 leading-none"
            aria-label="もどる"
          >
            <ChevronLeft size={28} strokeWidth={3} />
          </button>
        )}
      </div>
      <div aria-hidden className="w-0" />
      {topRight ? (
        <div className="flex items-center gap-2 flex-wrap justify-end min-w-0 justify-self-end">{topRight}</div>
      ) : (
        <div aria-hidden />
      )}
    </div>
  );

  const mainButtons =
    mainColumn ? (
      mainColumn
    ) : primaryLabel && onPrimary && primaryButtonClassName ? (
      <>
        <button
          type="button"
          onClick={() => {
            vibrate(12);
            onPrimary();
          }}
          className={`w-full max-w-md h-[56px] md:h-[60px] flex items-center justify-center rounded-xl text-sm font-medium shadow-sm border border-rk-black/5 active:scale-[0.99] transition-transform ${primaryButtonClassName}`}
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
    ) : null;

  const shellOverflow =
    rakudaBackdropVariant === 'hub' ? 'overflow-visible' : 'overflow-hidden';

  const backgroundLayer = backgroundClassName ? (
    <div
      className={`absolute inset-0 pointer-events-none ${backgroundClassName} z-0`}
      aria-hidden
    />
  ) : null;

  if (layoutVariant === 'hubScroll') {
    return (
      <div
        className={`rk-hub-scroll-shell h-full w-full min-h-0 select-none relative flex flex-col ${shellOverflow}`}
      >
        {backgroundLayer}
        {rakudaBackdropVariant ? (
          <RakudaFloatingBackdrop variant={rakudaBackdropVariant} className="!z-[1]" />
        ) : null}
        <div className="rk-hub-toolbar shrink-0">{toolbar}</div>
        <div
          className={[
            'rk-hub-scroll-pane flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden relative z-[2] bg-transparent custom-scrollbar [scrollbar-gutter:stable] touch-pan-y overscroll-y-contain',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div
            className={`relative w-full max-w-md mx-auto flex flex-col items-center gap-5 px-4 sm:px-6 box-border pb-[calc(var(--rk-bottom-banner,0px)+env(safe-area-inset-bottom)+16px)] overflow-visible ${hubScrollContentTopClass}`}
          >
            {aboveTitle ? (
              <div className="flex flex-col items-center w-full">{aboveTitle}</div>
            ) : null}
            {titleBlock}
            {children ? <div className="w-full">{children}</div> : null}
            {mainButtons ? <div className="w-full">{mainButtons}</div> : null}
            {footer ? <div className="w-full flex justify-center mt-1">{footer}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full w-full min-h-0 select-none relative ${shellOverflow}`}>
      {backgroundLayer}
      {rakudaBackdropVariant ? <RakudaFloatingBackdrop variant={rakudaBackdropVariant} /> : null}
      <div className="absolute top-0 left-0 right-0 z-30">{toolbar}</div>

      <div
        className={`absolute left-1/2 -translate-x-1/2 w-full flex flex-col items-center z-10 px-3 ${titleTopClass}`}
      >
        {titleBlock}
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
        {mainButtons}
        {footer ? <div className="w-full flex justify-center mt-2">{footer}</div> : null}
      </div>
    </div>
  );
};

export default ModeEntryLayout;
