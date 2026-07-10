import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GateAdPresentation } from '../services/adService';
import GlobalOverlays from './GlobalOverlays';
import AppStatusOverlays from './AppStatusOverlays';
import RakudaYoutubeLiveBannerPulse from './RakudaYoutubeLiveBannerPulse';

type GlobalOverlaysProps = React.ComponentProps<typeof GlobalOverlays>;

export type AppLayoutProps = GlobalOverlaysProps & {
  isGenerating: boolean;
  isMultiplay: boolean;
  roomStatus: string;
  syncCountdown: number;
  gateAdPresentation: GateAdPresentation | null;
  onDismissFullScreenAd: () => void;
  /** 配信モード（軽量化）: 広告完全OFF */
  streamMode?: boolean;
  /** 緑ゲート有効期間中: 広告完全OFF */
  gateSuppressAds?: boolean;
  /** isGenerating 時の表示文言（任意） */
  generatingTitle?: string;
  generatingHint?: string;
  children: React.ReactNode;
  /** 旧: 下部固定バナー用の余白。現在は常に false（バナー不使用） */
  reserveBottomAdSpace?: boolean;
  /**
   * AppHeader 下部ステータス帯と本文が重ならないよう、シェル下端に余白を足す（しずかの間では false）
   */
  reserveBottomStatusInset?: boolean;
  /** しずかの間・みんなの願い — 盤面生成/マルチ開始カウントのオーバーレイを出さない */
  suppressGameStatusOverlays?: boolean;
};

function gateAdKindLabelJa(presentation: GateAdPresentation, language: 'ja' | string): string {
  if (language !== 'ja') {
    return presentation.kind === 'interstitial' ? 'Interstitial ad' : 'Short video ad';
  }
  if (presentation.kind === 'interstitial') {
    return `${presentation.labelJa}（${presentation.durationMinSec}〜${presentation.durationMaxSec}秒）`;
  }
  return `${presentation.labelJa}（${presentation.durationMinSec}〜${presentation.durationMaxSec}秒）`;
}

function GateFullScreenAdOverlay({
  presentation,
  language,
  onDismiss,
}: {
  presentation: GateAdPresentation;
  language: 'ja' | string;
  onDismiss: () => void;
}) {
  const [remainingSec, setRemainingSec] = useState(presentation.durationSec);

  useEffect(() => {
    setRemainingSec(presentation.durationSec);
    const started = Date.now();
    const tick = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      const next = Math.max(0, presentation.durationSec - elapsed);
      setRemainingSec(next);
      if (next <= 0) {
        window.clearInterval(tick);
        onDismiss();
      }
    }, 250);
    return () => window.clearInterval(tick);
  }, [presentation, onDismiss]);

  const kindHint =
    presentation.kind === 'interstitial'
      ? language === 'ja'
        ? 'SDK 接続後、ここにインタースティシャルが表示されます'
        : 'Interstitial will appear here after SDK integration'
      : language === 'ja'
        ? 'SDK 接続後、ここに短尺動画が表示されます'
        : 'Short video will appear here after SDK integration';

  return (
    <div
      className="fixed inset-0 z-[5000] bg-rk-black flex flex-col items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label={gateAdKindLabelJa(presentation, language)}
    >
      <div className="w-full max-w-md aspect-video bg-rk-slate-800 rounded-2xl flex flex-col items-center justify-center border-4 border-rk-slate-700 relative px-4">
        <div className="absolute top-4 right-4 bg-rk-white/10 text-rk-white text-[10px] px-2 py-1 rounded">AD</div>
        {presentation.slotTotal > 1 ? (
          <p className="absolute top-4 left-4 text-rk-slate-300 text-[10px] font-bold">
            {language === 'ja'
              ? `${presentation.slotIndex} / ${presentation.slotTotal}`
              : `${presentation.slotIndex} / ${presentation.slotTotal}`}
          </p>
        ) : null}
        <p className="text-rk-white font-black text-lg sm:text-xl mb-3 text-center leading-snug">
          {gateAdKindLabelJa(presentation, language)}
        </p>
        <p className="text-rk-slate-400 text-xs sm:text-sm text-center px-2 mb-4">{kindHint}</p>
        <p className="text-rk-amber-200 text-sm font-bold tabular-nums" aria-live="polite">
          {language === 'ja' ? `あと ${remainingSec} 秒` : `${remainingSec}s left`}
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        disabled={remainingSec > 0}
        className="mt-8 px-8 py-3 bg-rk-white text-rk-black rounded-lg font-black text-lg shadow-xl active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {language === 'ja' ? '閉じる' : 'CLOSE'}
      </button>
    </div>
  );
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  isGenerating,
  isMultiplay,
  roomStatus,
  syncCountdown,
  gateAdPresentation,
  onDismissFullScreenAd,
  streamMode = false,
  gateSuppressAds = false,
  generatingTitle,
  generatingHint,
  children,
  language,
  reserveBottomAdSpace,
  reserveBottomStatusInset = false,
  suppressGameStatusOverlays = false,
  screen,
  showRenrakucho = false,
  ...overlayProps
}) => {
  const bottomPad = reserveBottomStatusInset
    ? 'pb-[calc(env(safe-area-inset-bottom)+var(--rk-app-status-footer-reserve))]'
    : reserveBottomAdSpace
      ? 'pb-[calc(env(safe-area-inset-bottom)+var(--rk-bottom-banner,0px))]'
      : 'pb-[env(safe-area-inset-bottom)]';

  return (
    <div
      className={[
        'fixed inset-0 max-w-screen-xl bg-rk-shell md:shadow-2xl overflow-hidden flex flex-col mx-auto',
        'pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]',
        bottomPad,
        'select-none touch-none font-rounded text-rk-fg',
      ].join(' ')}
    >
      <div
        className={[
          'flex-1 relative z-[2] min-h-0 overflow-hidden',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <AppStatusOverlays
          language={language}
          isGenerating={isGenerating}
          isMultiplay={isMultiplay}
          roomStatus={roomStatus}
          syncCountdown={syncCountdown}
          generatingTitle={generatingTitle}
          generatingHint={generatingHint}
          suppressForQuietImmersive={suppressGameStatusOverlays}
        />

        {children}
      </div>

      <GlobalOverlays
        {...overlayProps}
        language={language}
        isMultiplay={isMultiplay}
        streamMode={streamMode}
        screen={screen}
        showRenrakucho={showRenrakucho}
      />

      <RakudaYoutubeLiveBannerPulse screen={screen} showRenrakucho={showRenrakucho} />

      {!streamMode && !gateSuppressAds && gateAdPresentation && typeof document !== 'undefined'
        ? createPortal(
            <GateFullScreenAdOverlay
              presentation={gateAdPresentation}
              language={language}
              onDismiss={onDismissFullScreenAd}
            />,
            document.body,
          )
        : null}
    </div>
  );
};

export default AppLayout;
