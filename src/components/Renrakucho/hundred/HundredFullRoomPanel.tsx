import React from 'react';
import { btnGhost, btnPrimary } from '../../../ui/policy';
import { HUNDRED_MAX_PLAYERS, rakudaHundredCreateUrlWithRakudaProfile } from '../../../lib/hundredRoomCapacity';
import { sanjuuRecruitBoardUrlForHundredRecruit, RAKUDA_CANONICAL_ORIGIN } from '../../../lib/sanjuuWebOrigin';

const HundredFullRoomPanel: React.FC<{
  nickname: string;
  userEmoji: string;
  hundredMode?: string;
  onBack: () => void;
}> = ({ nickname, userEmoji, onBack }) => {
  const profile = { emoji: userEmoji, nickname };
  const createHref = rakudaHundredCreateUrlWithRakudaProfile(profile);
  const recruitHref = sanjuuRecruitBoardUrlForHundredRecruit(profile);
  const hubHref = `${RAKUDA_CANONICAL_ORIGIN.replace(/\/+$/, '')}/`;

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <button type="button" onClick={onBack} className={btnGhost}>
        もどる
      </button>

      <div className="rounded-xl border border-rk-amber-200 bg-gradient-to-b from-rk-amber-50 to-rk-white p-5 shadow-sm space-y-4">
        <p className="text-lg font-black text-rk-amber-950 leading-snug">ごめんなさい、満室です。</p>
        <p className="text-sm text-rk-slate-700 leading-relaxed">
          この部屋は同時に<strong> {HUNDRED_MAX_PLAYERS} 人まで</strong>
          です。いまいっぱいなので、別の場所へお願いします。
        </p>

        <div className="flex flex-col gap-2 pt-1">
          <a href={recruitHref} className={`${btnPrimary} text-center no-underline`}>
            ひと言探しの募集一覧
          </a>
          <a href={createHref} className={`${btnGhost} text-center no-underline border border-rk-slate-300`}>
            問題を作る
          </a>
          <a href={hubHref} className={`${btnGhost} text-center no-underline border border-rk-slate-300`}>
            らくだ珈琲
          </a>
        </div>
      </div>
    </div>
  );
};

export default HundredFullRoomPanel;
