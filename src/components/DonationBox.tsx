import React from 'react';

import { DONATION_COPY, getDonationPaymentLink, isDonationUiReady } from '../constants/donationConfig';

import { markDonationCheckoutStarted } from '../lib/donationReturn';

const DonationBox: React.FC = () => {

  if (!isDonationUiReady()) return null;



  const href = getDonationPaymentLink();



  return (

    <div className="rounded-2xl border-2 border-orange-400/90 bg-orange-50/95 px-4 py-4 space-y-3 shadow-sm">
      <div className="text-[11px] font-black text-orange-950/90 tracking-tight">{DONATION_COPY.title}</div>

      <p className="text-[12px] font-medium text-rk-slate-700 leading-relaxed whitespace-pre-wrap">{DONATION_COPY.body}</p>

      <a

        href={href}

        onClick={() => markDonationCheckoutStarted()}

        className="flex w-full items-center justify-center py-3 rounded-xl border-2 border-orange-500 bg-rk-white text-orange-950 font-black text-sm shadow-sm active:scale-[0.99] transition-transform"

      >

        {DONATION_COPY.button}

      </a>

    </div>

  );

};



export default DonationBox;


