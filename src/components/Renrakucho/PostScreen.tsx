import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ChevronDown, Globe, Lock } from 'lucide-react';
import { btnAccent, btnGhost, cardClass } from '../../ui/policy';
import {
  RENRAKU_BOARD_TIMELINE_TAB_ANNOUNCEMENTS,
  RENRAKU_BOARD_TIMELINE_TAB_CHAT,
  type RenrakuBoardTimelineTab,
} from '../../lib/renrakuBoardPostKind';

const PostScreen: React.FC<{
  isExcludedFromRakuda: boolean;
  yellowCardCount: number;
  message: string;
  setMessage: (v: string) => void;
  handleSend: (mode: 'public' | 'private' | 'announcement') => void | Promise<void>;
  isSending: boolean;
  sendCooldownUntilMs: number;
  /** 掲示板タブ（連絡事項 / みんなの会話） */
  boardTimelineTab: RenrakuBoardTimelineTab;
  isAdmin: boolean;
  /** プロフィール（名前/絵文字）が未登録のときは投稿をブロックし、登録導線を出す */
  needsProfileSetup?: boolean;
  onOpenProfileSetup?: () => void;
  onRequestGoogleLogin?: () => void;
  /** Google ログイン済みなら伝言は確認モーダルを挟まず送信する */
  canSendPrivateDenwa?: boolean;
}> = ({
  isExcludedFromRakuda,
  yellowCardCount,
  message,
  setMessage,
  handleSend,
  isSending,
  sendCooldownUntilMs,
  needsProfileSetup = false,
  onOpenProfileSetup,
  onRequestGoogleLogin,
  canSendPrivateDenwa = false,
  boardTimelineTab,
  isAdmin,
}) => {
  const isAnnouncementsTab = boardTimelineTab === RENRAKU_BOARD_TIMELINE_TAB_ANNOUNCEMENTS;
  const canPostAnnouncements = isAnnouncementsTab && isAdmin;
  const canPostChat = boardTimelineTab === RENRAKU_BOARD_TIMELINE_TAB_CHAT;
  const [composerOpen, setComposerOpen] = useState(false);
  const [privateSendHintOpen, setPrivateSendHintOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (sendCooldownUntilMs <= Date.now()) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, [sendCooldownUntilMs]);

  useEffect(() => {
    setComposerOpen(false);
  }, [boardTimelineTab]);

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
      {isExcludedFromRakuda ? (
        <div className="bg-rk-rose-50 border border-rk-rose-200 rounded-xl p-4 text-center space-y-3">
          <AlertCircle className="mx-auto text-rk-rose-200" size={24} />
          <p className="text-sm font-medium text-rk-slate-700">ご利用いただけません</p>
          <p className="text-xs text-rk-slate-600 leading-relaxed">
            🟥 レッドカードのため、らくだ珈琲🐫☕のすべての機能を
            <br />
            ご利用いただけません。
          </p>
        </div>
      ) : (
        <>
          {yellowCardCount > 0 ? (
            <div className="mb-3 rounded-xl border-2 border-rk-amber-300 bg-rk-amber-50 px-3 py-2.5 text-center space-y-1">
              <p className="text-[11px] font-black text-rk-amber-950">
                🟨 イエローカード {yellowCardCount}枚
              </p>
              <p className="text-[10px] font-bold text-rk-amber-900 leading-relaxed">
                らくだ珈琲の場のルールを守って、みんなが楽しめるようにお願いします。
              </p>
            </div>
          ) : null}
          {needsProfileSetup ? (
        <div className="space-y-2">
          <div className="bg-rk-amber-50 border-2 border-rk-amber-200 rounded-2xl p-3 text-center space-y-2 shadow-sm">
            <p className="text-[11px] font-black text-rk-amber-950">投稿するには「登録」が必要です</p>
            <p className="text-[10px] font-bold text-rk-amber-900 leading-relaxed">
              名前と絵文字を決めると、掲示板に書けるようになります
            </p>
            <button
              type="button"
              onClick={() => onOpenProfileSetup?.()}
              className="w-full min-h-[44px] rounded-xl px-3 text-sm font-black border-2 border-rk-amber-700 bg-rk-amber-300 text-rk-amber-950 shadow-sm active:scale-[0.99] transition-transform"
            >
              登録して投稿する
            </button>
          </div>
        </div>
      ) : isAnnouncementsTab && !isAdmin ? (
        <div className="rounded-xl border-2 border-rk-sky-200 bg-rk-sky-50 px-3 py-3 text-center space-y-1">
          <p className="text-[11px] font-black text-rk-sky-950">📢 らくだ珈琲からの連絡事項</p>
          <p className="text-[10px] font-bold text-rk-sky-900 leading-relaxed">
            上の「連絡事項」タブでお知らせを読めます。会話は「みんなの会話」タブからどうぞ。
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {!composerOpen ? (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="w-full flex items-center justify-center gap-2 min-h-[44px] rounded-xl px-2 text-sm font-black border-2 border-[var(--rk-hub-bark)] bg-[var(--rk-hub-parchment)] text-rk-amber-950 shadow-sm transition-transform active:scale-[0.99] hover:bg-[var(--rk-hub-parchment-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-rk-amber-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--rk-hub-parchment)]"
            >
              <span className="text-lg leading-none shrink-0" aria-hidden>
                {canPostAnnouncements ? '📢' : '📝'}
              </span>
              {canPostAnnouncements ? '連絡事項を書く' : '掲示板にメッセージを送る'}
              <ChevronDown size={16} className="shrink-0 text-rk-amber-950" aria-hidden />
            </button>
          ) : (
            <div className={`${cardClass} space-y-3 !bg-[var(--rk-hub-parchment)] !border-2 !border-[var(--rk-hub-bark)] rounded-2xl shadow-[var(--rk-shadow-elev-hub)] focus-within:shadow-[var(--rk-shadow-elev-hub-focus)] transition-shadow`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black text-rk-amber-950">
                  {canPostAnnouncements ? 'らくだ珈琲からの連絡を書く' : '掲示板にメッセージを送る'}
                </p>
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="text-[11px] font-bold text-rk-amber-950 hover:text-rk-amber-900 px-2 py-1 rounded-lg"
                >
                  閉じる
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-rk-amber-950 uppercase tracking-widest ml-1">メッセージ</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    canPostAnnouncements
                      ? 'サイトのお知らせ・配信の案内など'
                      : 'やさしく、楽しく会話しよう＾＾'
                  }
                  className="w-full h-16 p-2.5 bg-rk-white border border-[var(--rk-hub-bark-border-soft)] rounded-xl focus:outline-none focus:border-rk-amber-700 focus:ring-2 focus:ring-rk-amber-600/40 transition-colors text-sm text-rk-amber-950 placeholder:text-rk-slate-500 resize-none"
                />
              </div>

              {cooldownLeftSec > 0 ? (
                <p className="text-center text-[10px] font-bold text-rk-amber-900">再送信まで {cooldownLeftSec} 秒</p>
              ) : null}
              {isSending ? <p className="text-center text-[10px] font-bold text-rk-slate-600">送信中...</p> : null}

              <div className="flex flex-row gap-2">
                {canPostAnnouncements ? (
                  <button
                    type="button"
                    disabled={sendDisabled}
                    onClick={() => void handleSend('announcement')}
                    className={`flex-1 min-w-0 ${!sendDisabled ? btnAccent : btnGhost} flex min-h-[48px] items-center justify-center gap-1.5 px-1.5 text-center text-xs font-bold leading-tight text-rk-amber-950 sm:gap-2 sm:px-2 sm:text-sm disabled:opacity-50`}
                  >
                    <Globe size={18} className="shrink-0" />
                    <span className="min-w-0">
                      連絡事項をのせる
                      <span className="block text-[9px] font-medium text-rk-amber-950 sm:text-[10px]">
                        （みんなが見る・公式）・送信
                      </span>
                    </span>
                  </button>
                ) : canPostChat ? (
                  <button
                    type="button"
                    disabled={sendDisabled}
                    onClick={() => void handleSend('public')}
                    className={`flex-1 min-w-0 ${!sendDisabled ? btnAccent : btnGhost} flex min-h-[48px] items-center justify-center gap-1.5 px-1.5 text-center text-xs font-bold leading-tight text-rk-amber-950 sm:gap-2 sm:px-2 sm:text-sm disabled:opacity-50`}
                  >
                    <Globe size={18} className="shrink-0" />
                    <span className="min-w-0">
                      掲示板にのせる
                      <span className="block text-[9px] font-medium text-rk-amber-950 sm:text-[10px]">（みんなが見る）・送信</span>
                    </span>
                  </button>
                ) : null}
                {!canPostAnnouncements ? (
                <button
                  type="button"
                  disabled={sendDisabled}
                  onClick={() => {
                    if (canSendPrivateDenwa) {
                      void handleSend('private');
                    } else {
                      setPrivateSendHintOpen(true);
                    }
                  }}
                  className={`flex-1 min-w-0 ${btnGhost} flex min-h-[48px] items-center justify-center gap-1.5 px-1.5 text-center text-xs font-bold leading-tight text-rk-amber-950 border-2 border-[var(--rk-hub-bark)] bg-rk-white sm:gap-2 sm:px-2 sm:text-sm disabled:opacity-50`}
                >
                  <Lock size={18} className="shrink-0" />
                  <span className="min-w-0">
                    らくだ珈琲に伝言
                    <span className="block text-[9px] font-medium text-rk-amber-950 sm:text-[10px]">
                      （掲示板に出ない・Google で送る）・送信
                    </span>
                  </span>
                </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
        </>
      )}

      {privateSendHintOpen ? (
        <div
          className="fixed inset-0 z-[400] flex items-end justify-center p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6 bg-rk-slate-900/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rk-denwa-hint-title"
          onClick={() => setPrivateSendHintOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border-2 border-rk-sky-400 bg-rk-sky-50 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="rk-denwa-hint-title" className="text-sm font-black text-rk-sky-950 leading-snug">
              らくだ珈琲への伝言
            </p>
            <p className="mt-2 text-[12px] font-bold text-rk-slate-700 leading-relaxed">
              伝言と返信は、<span className="text-rk-sky-950">Google でログイン</span>してからお使いください。
            </p>
            <p className="mt-1.5 text-[10px] font-medium text-rk-slate-600 leading-relaxed">
              同じ Google アカウントなら、スマホとパソコンなど違う端末でも返信を受け取れます。追加の確認は不要です。
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {onRequestGoogleLogin ? (
                <button
                  type="button"
                  onClick={() => {
                    setPrivateSendHintOpen(false);
                    onRequestGoogleLogin();
                  }}
                  className="w-full min-h-[44px] rounded-xl border-2 border-rk-sky-600 bg-rk-sky-200 px-3 text-sm font-black text-rk-sky-950 shadow-sm active:scale-[0.99]"
                >
                  Google でログインする
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setPrivateSendHintOpen(false)}
                className="w-full min-h-[40px] rounded-xl border border-rk-slate-300 bg-rk-white/80 px-3 text-xs font-bold text-rk-slate-600"
              >
                とじる
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
};

export default PostScreen;
