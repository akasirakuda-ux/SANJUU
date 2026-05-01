import React from 'react';
import { createPortal } from 'react-dom';
import GlobalOverlays from './GlobalOverlays';
import AppStatusOverlays from './AppStatusOverlays';

type GlobalOverlaysProps = React.ComponentProps<typeof GlobalOverlays>;

export type AppLayoutProps = GlobalOverlaysProps & {
  isGenerating: boolean;
  isMultiplay: boolean;
  roomStatus: string;
  syncCountdown: number;
  showFullScreenAd: boolean;
  onDismissFullScreenAd: () => void;
  /** 配信モード（軽量化）: 広告完全OFF */
  streamMode?: boolean;
  /** isGenerating 時の表示文言（任意） */
  generatingTitle?: string;
  generatingHint?: string;
  children: React.ReactNode;
  /** 下部バナー広告と重ならないようメイン領域に余白（例: pb-24） */
  reserveBottomAdSpace?: boolean;
};

export const AppLayout: React.FC<AppLayoutProps> = ({
  isGenerating,
  isMultiplay,
  roomStatus,
  syncCountdown,
  showFullScreenAd,
  onDismissFullScreenAd,
  streamMode = false,
  generatingTitle,
  generatingHint,
  children,
  language,
  reserveBottomAdSpace,
  ...overlayProps
}) => {
  return (
    <div
      className={[
        'fixed inset-0 max-w-screen-xl bg-amber-100/90 md:shadow-2xl overflow-hidden flex flex-col mx-auto',
        'pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]',
        // Reserve space for iOS safe area + fixed bottom banner (AdSpace).
        // This must be on the root container so h-full screens don't slide under the fixed banner.
        reserveBottomAdSpace
          ? 'pb-[calc(env(safe-area-inset-bottom)+var(--rk-bottom-banner,0px))]'
          : 'pb-[env(safe-area-inset-bottom)]',
        'select-none touch-none font-rounded text-slate-800',
      ].join(' ')}
    >
      <div
        className={[
          'flex-1 relative min-h-0 overflow-hidden',
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
        />

        {children}
      </div>

      <GlobalOverlays {...overlayProps} language={language} isMultiplay={isMultiplay} />

      {/* 全面広告: 下部バナー（AdSpace）の領域も含めビューポート全体を body 直下で覆う */}
      {!streamMode &&
        showFullScreenAd &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[5000] bg-black flex flex-col items-center justify-center p-6"
            role="dialog"
            aria-modal="true"
            aria-label={language === 'ja' ? '広告' : 'Advertisement'}
          >
            <div className="w-full max-w-md aspect-video bg-slate-800 rounded-2xl flex flex-col items-center justify-center border-4 border-slate-700 relative">
              <div className="absolute top-4 right-4 bg-white/10 text-white text-[10px] px-2 py-1 rounded">AD</div>
              <p className="text-white font-black text-xl mb-4">
                {language === 'ja' ? '広告プレースホルダー' : 'AD PLACEHOLDER'}
              </p>
              <p className="text-slate-400 text-sm text-center px-8">
                {language === 'ja' ? 'ここに全面広告が表示されます' : 'Full-screen ad will appear here'}
              </p>
            </div>
            <button
              type="button"
              onClick={onDismissFullScreenAd}
              className="mt-8 px-8 py-3 bg-white text-black rounded-lg font-black text-lg shadow-xl active:scale-95 transition-all"
            >
              {language === 'ja' ? '広告を閉じる' : 'CLOSE AD'}
            </button>
          </div>,
          document.body
        )}
    </div>
  );
};

export default AppLayout;
