import React from 'react';
import { vibrate } from '../lib/utils';
import {
  RAKUDA_DEFAULT_PROFILE_EMOJI,
  RAKUDA_PLAYER_PRESET_COUNT,
  rakudaPlayerPresetNickname,
} from '../lib/rakudaProfilePresets';

/**
 * 絵文字を 👤、ニックネームを PLAYER1… にまとめて入れる快捷。
 * 入力欄はそのまま自由編集可能。
 */
const RakudaPlayerPresetChips: React.FC<{
  onPick: (emoji: string, nickname: string) => void;
}> = ({ onPick }) => {
  return (
    <div className="flex gap-1 overflow-x-auto pb-2 -mx-0.5 px-0.5 [scrollbar-width:thin]">
        {Array.from({ length: RAKUDA_PLAYER_PRESET_COUNT }, (_, i) => {
          const n = i + 1;
          const nick = rakudaPlayerPresetNickname(n);
          return (
            <button
              key={nick}
              type="button"
              onClick={() => {
                onPick(RAKUDA_DEFAULT_PROFILE_EMOJI, nick);
                vibrate(5);
              }}
              className="shrink-0 px-2 py-1 rounded-lg border border-rk-slate-200 bg-rk-white text-[10px] font-black text-rk-slate-700 shadow-sm active:scale-[0.97] transition-transform"
            >
              {nick}
            </button>
          );
        })}
    </div>
  );
};

export default RakudaPlayerPresetChips;
