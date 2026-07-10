import React from 'react';
import { createPortal } from 'react-dom';

/** 百人盤面・待機で共有。問題生成中に画面全体の最前面へ表示（広告・下部フォームより上） */
const HundredProblemGeneratingOverlay: React.FC<{
  visible: boolean;
  /** 指定時のみ「キャンセルして戻る」を表示（ホスト向けなど） */
  onCancel?: () => void;
}> = ({ visible, onCancel }) => {
  if (!visible || typeof document === 'undefined') return null;

  const node = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-rk-success-900/50 backdrop-blur-sm p-4 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label="問題を作成しています"
    >
      <div className="bg-rk-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-3 border-4 border-rk-success-100 max-w-sm w-full">
        <div className="w-14 h-14 border-8 border-rk-success-100 border-t-rk-success-500 rounded-full animate-spin shrink-0" />
        <p className="font-black text-rk-slate-800 text-lg text-center leading-snug">
          問題を作っています。しばらくお待ちください
        </p>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="mt-1 w-full max-w-[280px] py-3 px-4 rounded-xl text-sm font-bold text-rk-slate-700 bg-rk-gray-200 hover:bg-rk-gray-300 border-2 border-rk-slate-400/90 shadow-md ring-2 ring-rk-slate-300/80 active:scale-[0.99] transition-colors"
          >
            キャンセルして戻る
          </button>
        ) : null}
      </div>
    </div>
  );

  return createPortal(node, document.body);
};

export default HundredProblemGeneratingOverlay;
