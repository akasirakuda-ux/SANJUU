import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ChevronDown, Globe, Lock } from 'lucide-react';
import { btnAccent, btnGhost, cardClass } from '../../ui/policy';

const PostScreen: React.FC<{
  isBlocked: boolean;
  message: string;
  setMessage: (v: string) => void;
  handleSend: (mode: 'public' | 'private') => void | Promise<void>;
  isSending: boolean;
  sendCooldownUntilMs: number;
  /** プロフィール（名前/絵文字）が未登録のときは投稿をブロックし、登録導線を出す */
  needsProfileSetup?: boolean;
  onOpenProfileSetup?: () => void;
}> = ({
  isBlocked,
  message,
  setMessage,
  handleSend,
  isSending,
  sendCooldownUntilMs,
  needsProfileSetup = false,
  onOpenProfileSetup,
}) => {
  const [composerOpen, setComposerOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (sendCooldownUntilMs <= Date.now()) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, [sendCooldownUntilMs]);

  const cooldownLeftSec =
    sendCooldownUntilMs > nowMs ? Math.ceil((sendCooldownUntilMs - nowMs) / 1000) : 0;
  const sendDisabled = isSending || !message.trim() || cooldownLeftSec > 0;

  return (
    <motion.div
      key="post"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="max-w-lg mx-auto"
    >
      {isBlocked ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center space-y-3">
          <AlertCircle className="mx-auto text-rose-200" size={24} />
          <p className="text-sm font-medium text-slate-700">投稿できません</p>
          <p className="text-xs text-slate-600">
            あんしんな場所を守るため、
            <br />
            投稿機能が制限されています。
          </p>
        </div>
      ) : needsProfileSetup ? (
        <div className="space-y-2">
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-3 text-center space-y-2 shadow-sm">
            <p className="text-[11px] font-black text-amber-950">投稿するには「登録」が必要です</p>
            <p className="text-[10px] font-bold text-amber-900 leading-relaxed">
              名前と絵文字を決めると、掲示板に書けるようになります
            </p>
            <button
              type="button"
              onClick={() => onOpenProfileSetup?.()}
              className="w-full min-h-[44px] rounded-xl px-3 text-sm font-black border-2 border-amber-700 bg-amber-300 text-amber-950 shadow-sm active:scale-[0.99] transition-transform"
            >
              登録して投稿する
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {!composerOpen ? (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="w-full flex items-center justify-center gap-2 min-h-[44px] rounded-xl px-2 text-sm font-black border-2 border-[#5a3d28] bg-[#e3d5bc] text-amber-950 shadow-sm transition-transform active:scale-[0.99] hover:bg-[#d9c9ae] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[#e3d5bc]"
            >
              <span className="text-lg leading-none shrink-0" aria-hidden>
                📝
              </span>
              掲示板にメッセージを送る
              <ChevronDown size={16} className="shrink-0 text-amber-950" aria-hidden />
            </button>
          ) : (
            <div className={`${cardClass} space-y-3 !bg-[#e3d5bc] !border-2 !border-[#5a3d28] rounded-2xl shadow-[0_10px_30px_rgba(120,53,15,0.08)] focus-within:shadow-[0_12px_36px_rgba(217,119,6,0.16)] transition-shadow`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black text-amber-950">掲示板にメッセージを送る</p>
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="text-[11px] font-bold text-amber-950 hover:text-amber-900 px-2 py-1 rounded-lg"
                >
                  閉じる
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-amber-950 uppercase tracking-widest ml-1">メッセージ</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="やさしく、楽しく会話しよう＾＾"
                  className="w-full h-16 p-2.5 bg-white border border-[#5a3d28]/50 rounded-xl focus:outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-600/40 transition-colors text-sm text-amber-950 placeholder:text-slate-500 resize-none"
                />
              </div>

              {cooldownLeftSec > 0 ? (
                <p className="text-center text-[10px] font-bold text-amber-900">再送信まで {cooldownLeftSec} 秒</p>
              ) : null}
              {isSending ? <p className="text-center text-[10px] font-bold text-slate-600">送信中...</p> : null}

              <div className="flex flex-row gap-2">
                <button
                  type="button"
                  disabled={sendDisabled}
                  onClick={() => void handleSend('public')}
                  className={`flex-1 min-w-0 ${!sendDisabled ? btnAccent : btnGhost} flex min-h-[48px] items-center justify-center gap-1.5 px-1.5 text-center text-xs font-bold leading-tight text-amber-950 sm:gap-2 sm:px-2 sm:text-sm disabled:opacity-50`}
                >
                  <Globe size={18} className="shrink-0" />
                  <span className="min-w-0">
                    掲示板にのせる
                    <span className="block text-[9px] font-medium text-amber-950 sm:text-[10px]">（みんなが見る）・送信</span>
                  </span>
                </button>
                <button
                  type="button"
                  disabled={sendDisabled}
                  onClick={() => void handleSend('private')}
                  className={`flex-1 min-w-0 ${btnGhost} flex min-h-[48px] items-center justify-center gap-1.5 px-1.5 text-center text-xs font-bold leading-tight text-amber-950 border-2 border-[#5a3d28] bg-white sm:gap-2 sm:px-2 sm:text-sm disabled:opacity-50`}
                >
                  <Lock size={18} className="shrink-0" />
                  <span className="min-w-0">
                    らくだ先生に伝言
                    <span className="block text-[9px] font-medium text-amber-950 sm:text-[10px]">（掲示板に出ない）・送信</span>
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default PostScreen;
