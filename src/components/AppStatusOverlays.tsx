import React from 'react';

export type AppStatusOverlaysProps = {
  language: 'ja';
  isGenerating: boolean;
  isMultiplay: boolean;
  roomStatus: string;
  syncCountdown: number;
  generatingTitle?: string;
  generatingHint?: string;
};

const AppStatusOverlays: React.FC<AppStatusOverlaysProps> = ({
  language,
  isGenerating,
  isMultiplay,
  roomStatus,
  syncCountdown,
  generatingTitle,
  generatingHint,
}) => {
  return (
    <>
      {(isGenerating || (isMultiplay && roomStatus === 'start')) && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-emerald-900/60 backdrop-blur-sm">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl flex flex-col items-center gap-6 animate-scale-in border-[6px] border-emerald-100">
            {isMultiplay && roomStatus === 'start' ? (
              <div className="flex flex-col items-center gap-2 mb-2">
                <div className="text-7xl font-black text-slate-800 animate-bounce">
                  {syncCountdown > 0 ? syncCountdown : '!'}
                </div>
                <p className="font-black text-slate-800 text-2xl tracking-tighter">まもなくはじまるよ！</p>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 border-8 border-emerald-100 border-t-emerald-500 rounded-full animate-spin"></div>
                <p className="font-black text-slate-800 text-2xl tracking-tighter">
                  {generatingTitle ?? (language === 'ja' ? 'パズルを生成中...' : 'Generating...')}
                </p>
                {generatingHint ? (
                  <p className="text-xs text-emerald-600 font-bold text-center">{generatingHint}</p>
                ) : isMultiplay ? (
                  <p className="text-xs text-emerald-600 font-bold">同期の準備をしています</p>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default AppStatusOverlays;
