import React from 'react';
import type { User } from 'firebase/auth';
import { AnimatePresence, motion } from 'framer-motion';
import { RK_GATE_NICK_DISPLAY_CLASS } from '../../lib/rakudaGate';
import { vibrate } from '../../lib/utils';
import {
  getRakudaDisplayNameValidationError,
} from '../../lib/rakudaHubShell';
import { btnPrimary, cardClass } from '../../ui/policy';
import RakudaPlayerPresetChips from '../RakudaPlayerPresetChips';

const ProfileSetupModal: React.FC<{
  showProfileSetup: boolean;
  setShowProfileSetup: React.Dispatch<React.SetStateAction<boolean>>;
  tempName: string;
  setTempName: React.Dispatch<React.SetStateAction<string>>;
  tempEmoji: string;
  setTempEmoji: React.Dispatch<React.SetStateAction<string>>;
  setNotification: React.Dispatch<React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>>;
  setNickname: (n: string) => void;
  setUserEmoji: (e: string) => void;
  /** 連絡帳管理者は「らくだ珈琲」公式名をニックに使える */
  authUser?: User | null;
}> = ({
  showProfileSetup,
  setShowProfileSetup,
  tempName,
  setTempName,
  tempEmoji,
  setTempEmoji,
  setNotification,
  setNickname,
  setUserEmoji,
  authUser,
}) => {
  return (
    <AnimatePresence>
      {showProfileSetup && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] bg-rk-slate-50/90 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className={`${cardClass} w-full max-w-sm space-y-4`}>
            <div className="text-center space-y-2">
              <h2 className="text-sm font-medium text-rk-slate-700">掲示板のじゅんび</h2>
              <p className="text-xs text-rk-slate-600">
                みんなに表示される名前と、
                <br />
                あなたの「顔」になる絵文字をきめてね。
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-rk-slate-400 uppercase tracking-widest ml-1">なまえ</label>
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="ななしさん"
                  maxLength={10}
                  className={`w-full h-12 p-3 bg-rk-slate-50 border border-rk-slate-200 rounded-xl focus:outline-none focus:border-rk-amber-200 transition-colors text-sm ${RK_GATE_NICK_DISPLAY_CLASS}`}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-rk-slate-400 uppercase tracking-widest ml-1">あなたの絵文字（1つ）</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="text"
                    value={tempEmoji}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        setTempEmoji('');
                        return;
                      }
                      const chars = Array.from(val);
                      setTempEmoji(chars[chars.length - 1]);
                    }}
                    placeholder="👤"
                    className="w-20 h-12 text-center bg-rk-slate-50 border border-rk-slate-200 rounded-xl focus:outline-none focus:border-rk-amber-200 transition-colors text-sm"
                  />
                  <p className="text-[10px] text-rk-slate-600 leading-tight">
                    好きな絵文字を
                    <br />
                    貼り付けてね！
                  </p>
                </div>
              </div>
            </div>

            <RakudaPlayerPresetChips
              onPick={(emoji, nick) => {
                setTempEmoji(emoji);
                setTempName(nick);
              }}
            />

            <button
              onClick={() => {
                if (!tempName.trim()) {
                  setNotification({ type: 'error', text: 'なまえを入力してね！' });
                  return;
                }
                if (!tempEmoji.trim()) {
                  setNotification({ type: 'error', text: '絵文字を入力してね！' });
                  return;
                }

                const displayNameError = getRakudaDisplayNameValidationError(
                  tempName.trim(),
                  tempEmoji.trim(),
                  authUser,
                );
                if (displayNameError) {
                  setNotification({ type: 'error', text: displayNameError });
                  return;
                }

                setNickname(tempName.trim());
                setUserEmoji(tempEmoji.trim());
                setShowProfileSetup(false);
                vibrate(30);
              }}
              className={`${btnPrimary} w-full`}
            >
              これでOK！
            </button>

            <button
              type="button"
              onClick={() => {
                // Allow "view only" entry. Posting can remain blocked elsewhere until profile is set.
                setShowProfileSetup(false);
                setNotification({ type: 'success', text: '掲示板は見られます（投稿する前に登録してください）' });
                vibrate(10);
              }}
              className="w-full h-11 rounded-xl border-2 border-rk-slate-200 bg-rk-white text-rk-slate-700 font-black text-sm shadow-sm active:scale-[0.99] transition-transform"
            >
              あとで（見るだけ）
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProfileSetupModal;

