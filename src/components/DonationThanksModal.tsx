import React from 'react';
import { createPortal } from 'react-dom';
import { DONATION_COPY } from '../constants/donationConfig';
import { btnGhost } from '../ui/policy';

const DonationThanksModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const dialog = (
  <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4 bg-rk-slate-900/40 backdrop-blur-sm">
    <div
      className="w-full max-w-sm rounded-2xl border-2 border-orange-300 bg-rk-white p-5 shadow-2xl space-y-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="donation-thanks-title"
    >
      <h2 id="donation-thanks-title" className="text-base font-black text-orange-950 text-center">
        {DONATION_COPY.thanksTitle}
      </h2>
      <p className="text-xs font-bold leading-relaxed text-rk-slate-700 whitespace-pre-wrap text-center">
        {DONATION_COPY.thanksBody}
      </p>
      <button type="button" onClick={onClose} className={`${btnGhost} w-full py-3 text-sm font-black`}>
        {DONATION_COPY.thanksClose}
      </button>
    </div>
  </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(dialog, document.body);
};

export default DonationThanksModal;
