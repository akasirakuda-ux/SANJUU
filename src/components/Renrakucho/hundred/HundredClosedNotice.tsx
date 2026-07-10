import React from 'react';

/**
 * ゲスト向け：ホストが hundred_public を削除（募集をとじる）したあとの案内
 */
const HundredClosedNotice: React.FC<{
  onBackToLobby: () => void;
}> = ({ onBackToLobby }) => {
  return (
    <div className="min-h-[55vh] flex flex-col items-center justify-center px-8 py-20 max-w-lg mx-auto">
      <p className="text-center text-rk-slate-600 text-base leading-relaxed tracking-wide mb-14">
        この募集は、もうとじられました。
      </p>
      <button
        type="button"
        onClick={onBackToLobby}
        className="px-10 py-3.5 rounded-2xl border border-rk-slate-300 bg-rk-slate-100 text-rk-slate-700 text-sm font-medium shadow-sm hover:bg-rk-slate-200 active:scale-[0.99] transition-colors"
      >
        らくちょうにもどる
      </button>
    </div>
  );
};

export default HundredClosedNotice;
