import React from 'react';
import { btnGhost, btnPrimary, cardClass } from '../ui/policy';

interface InstallGuideModalProps {
  onClose: () => void;
  language: 'ja';
}

const InstallGuideModal: React.FC<InstallGuideModalProps> = ({ onClose, language }) => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  return (
    <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-slate-50/90 backdrop-blur-sm p-4">
      <div className={`${cardClass} w-full max-w-md overflow-hidden flex flex-col`}>
        <div className="p-4 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-xl flex items-center justify-center mb-3 border border-emerald-200">
            <span className="text-sm">🐫</span>
          </div>
          
          <h2 className="text-sm font-medium text-slate-700 mb-3">
            {language === 'ja' ? 'ホーム画面に追加' : 'Add to Home Screen'}
          </h2>
          
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            {isIOS ? (
              language === 'ja' 
                ? 'ブラウザの「共有」ボタンを押して、下にある「ホーム画面に追加」を選択してください。'
                : 'Tap the Share button and select "Add to Home Screen" from the menu.'
            ) : (
              language === 'ja'
                ? 'ブラウザのメニューから「ホーム画面に追加」または「アプリをインストール」を選択してください。'
                : 'Select "Add to Home Screen" or "Install App" from your browser menu.'
            )}
          </p>

          <div className="w-full bg-slate-50 rounded-xl p-3 mb-4 flex flex-col gap-3 border border-slate-200">
            {isIOS ? (
              <>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] text-slate-500 font-medium">STEP 1</div>
                    <div className="text-xs font-medium text-slate-700">「共有」ボタンをタップ</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] text-slate-500 font-medium">STEP 2</div>
                    <div className="text-xs font-medium text-slate-700">「ホーム画面に追加」を選択</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="text-[10px] text-slate-500 font-medium">HINT</div>
                  <div className="text-xs font-medium text-slate-700">ブラウザメニューから追加できます</div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className={`${btnPrimary} w-full`}
          >
            {language === 'ja' ? 'わかった！' : 'Got it!'}
          </button>

          <button onClick={onClose} className={`${btnGhost} w-full mt-2`}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallGuideModal;
