import React from 'react';
import type { RakudaGateId } from '../lib/rakudaGate';
import { btnGhost } from '../ui/policy';
import DonationBox from './DonationBox';
import RakudaIntroPanel from './RakudaIntroPanel';

export type RakudaGateSelectionProps = {
  onSelectGate: (gate: RakudaGateId) => void;
};

const WELCOME_BODY = `「らくだ珈琲」へようこそ ☕🐫

ここは、安心してのんびり遊べる、小さな“居場所”です。

プログラム知識ゼロの59歳が、
AIといっしょに半年かけて育ち、今も成長しています。
ここの遊びは、上手い下手も関係なく、競争もありません。
ふわっと立ち寄って、力を抜いて遊べる場所です。

LIVE配信を続ける中で、
子どもたちと、それを見守る大人たちが
たくさん集まってくれていることに気づきました。
この場所は、周りと仲良く遊べる誰もが、安心して参加できる場所でありたいと思っています。

無料で遊べます。ゲームの区切りで、短い広告が入ることがあります。
その広告が、らくだ珈琲とこの居場所を続ける力になっています。
はじめての方も、いつも遊んでいる方も、ここで大丈夫です。

広告なしで応援したい方は、設定の「☕ らくだ応援ゲート（任意）」からお申し込みいただけます。
無理は不要です。

あなたがここに来てくれるだけで、みんなの居場所が広がります。`;

const WELCOME_SIGN_OFF = 'らくだ珈琲🐫☕2026/6/7';

const RakudaGateSelection: React.FC<RakudaGateSelectionProps> = ({ onSelectGate }) => {
  return (
    <div
      className="fixed inset-0 z-[6000] flex flex-col bg-gradient-to-b from-rk-amber-100 via-rk-amber-50 to-rk-orange-100 font-rounded text-rk-amber-950"
      role="dialog"
      aria-modal="true"
      aria-label="らくだ珈琲へようこそ"
    >
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <div className="max-w-lg mx-auto space-y-4">
          <h1 className="text-center text-lg font-black tracking-tight text-rk-amber-950">らくだ珈琲</h1>
          <div className="rounded-2xl border-2 border-rk-amber-300/80 bg-rk-amber-50/95 px-4 py-4 shadow-sm">
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap font-medium text-rk-amber-950/95">
              {WELCOME_BODY}
            </p>
            <p className="mt-3 text-[13px] font-black text-rk-amber-950/95 text-right">{WELCOME_SIGN_OFF}</p>
          </div>
          <RakudaIntroPanel />
          <DonationBox />
        </div>
      </div>

      <div className="shrink-0 border-t border-rk-amber-300/80 bg-rk-amber-50/98 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(0_0_0/0.06)]">
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => onSelectGate('blue')}
            className="w-full py-3 px-2 rounded-xl font-black text-sm leading-snug border-2 border-rk-sky-700 bg-gradient-to-b from-rk-sky-100 to-rk-sky-50 text-rk-sky-900 shadow-md active:scale-[0.99] transition-transform"
          >
            はじめる
          </button>
        </div>
      </div>
    </div>
  );
};

export default RakudaGateSelection;
