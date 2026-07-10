import React from 'react';
import { createPortal } from 'react-dom';
import { PARENT_REASSURANCE } from '../constants/parentReassurance';
import { btnGhost } from '../ui/policy';

type LoginReassuranceModalProps = {
  onClose: () => void;
  onGoogleLogin: () => void;
};

const LoginReassuranceModal: React.FC<LoginReassuranceModalProps> = ({ onClose, onGoogleLogin }) => {
  const dialog = (
  <div className="fixed inset-0 z-[3600] flex items-center justify-center p-4 bg-rk-slate-900/40 backdrop-blur-sm">
    <div
      className="w-full max-w-sm rounded-2xl border-2 border-rk-sky-200 bg-rk-white p-4 shadow-2xl space-y-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-reassurance-title"
    >
      <h2 id="login-reassurance-title" className="text-xs font-black text-rk-sky-900/80 uppercase tracking-widest">
        {PARENT_REASSURANCE.settingsTitle}
      </h2>
      <p className="text-[11px] font-bold leading-relaxed text-rk-slate-700 whitespace-pre-wrap">
        {PARENT_REASSURANCE.settingsBody}
      </p>
      <div className="flex flex-col gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            onGoogleLogin();
            onClose();
          }}
          className="w-full py-3 rounded-xl border-2 border-rk-sky-400 bg-rk-sky-50 text-rk-sky-950 font-black text-sm active:scale-[0.99] transition-transform"
        >
          Google でログイン（ポップアップ）
        </button>
        <button type="button" onClick={onClose} className={`${btnGhost} w-full py-2.5 text-sm font-black`}>
          とじる
        </button>
      </div>
    </div>
  </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(dialog, document.body);
};

export default LoginReassuranceModal;
