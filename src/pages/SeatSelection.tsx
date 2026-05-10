import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Heart, Moon } from 'lucide-react';
import KotobaLogo from '../components/KotobaLogo';
import ModeEntryLayout from '../components/ModeEntryLayout';
import QRCode from 'qrcode';

import { User, signOut } from 'firebase/auth';
import { btnGhost } from '../ui/policy';
import type { UserAccount } from '../types';
import { auth } from '../firebase';
import { isRenrakuAdmin } from '../lib/renrakuAdmin';
import { sanjuuTopUrlWithRakudaProfile } from '../lib/sanjuuWebOrigin';
import { vibrate } from '../lib/utils';

interface SeatSelectionProps {
  onSelectWindow: () => void;
  onOpenHundredHub: () => void;
  onOpenRenrakuchoAdmin: () => void;
  onSelectQuietRoom: () => void;
  onOpenStampCard: () => void;
  onOpenSettings: () => void;
  isOnline: boolean;
  onGoogleLogin?: () => void;
  firebaseUser?: User | null;
  hasActiveRecruitments?: boolean;
  /** 連絡帳に未読（最終閲覧より新しい投稿） */
  renrakuchoHasUnread?: boolean;
  viewerCount?: number;
  nickname: string;
  setNickname: (name: string) => void;
  userEmoji: string;
  setUserEmoji: (emoji: string) => void;
  totalPoints: number;
  accounts: UserAccount[];
  activeUserId: string;
  switchAccount: (userId: string) => void;
  createAccount: () => string;
}

const hubBtn =
  'relative w-full max-w-md min-h-[52px] px-3 py-2 flex items-center justify-center gap-2 rounded-xl text-sm font-medium shadow-sm border active:scale-[0.99] transition-transform overflow-visible';

const SeatSelection: React.FC<SeatSelectionProps> = ({
  onSelectWindow,
  onOpenHundredHub,
  onOpenRenrakuchoAdmin,
  onSelectQuietRoom,
  onOpenStampCard,
  onOpenSettings,
  isOnline,
  onGoogleLogin,
  firebaseUser,
  hasActiveRecruitments,
  renrakuchoHasUnread = false,
  viewerCount,
  nickname,
  setNickname,
  userEmoji,
  setUserEmoji,
  totalPoints,
}) => {
  const [showRegisteredMessage, setShowRegisteredMessage] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const LOGIN_PROMPT_DISMISSED_KEY = 'rk_login_prompt_dismissed_v1';

  useEffect(() => {
    // 初回ユーザー向け：オンライン（Googleログイン）導線を明確にする。
    // 既にログイン済み / ログイン機能が無い / 一度閉じたことがある場合は出さない。
    if (firebaseUser) {
      setShowLoginPrompt(false);
      return;
    }
    if (!onGoogleLogin) return;
    try {
      const dismissed = localStorage.getItem(LOGIN_PROMPT_DISMISSED_KEY) === '1';
      if (!dismissed) setShowLoginPrompt(true);
    } catch {
      // localStorage が使えない環境でも、とりあえず1回は見せる
      setShowLoginPrompt(true);
    }
  }, [firebaseUser, onGoogleLogin]);

  const dismissLoginPrompt = () => {
    setShowLoginPrompt(false);
    try {
      localStorage.setItem(LOGIN_PROMPT_DISMISSED_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const loginPrompt = useMemo(() => {
    if (!showLoginPrompt || firebaseUser || !onGoogleLogin) return null;
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="w-full max-w-md mx-auto rounded-xl border-2 border-sky-300 bg-sky-50 text-slate-700 shadow-sm px-3 py-2 flex items-start justify-between gap-3"
        role="status"
      >
        <div className="min-w-0">
          <div className="text-[11px] font-black">はじめての方へ</div>
          <div className="text-[10px] font-medium leading-relaxed text-slate-600 mt-0.5">
            右上の <span className="font-black">🔑ログイン（オンライン）</span> を押すと、
            みんなであそぶ・連絡帳が安定します。
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onGoogleLogin()}
              className="px-3 py-2 rounded-xl border border-sky-300 bg-white text-slate-700 text-[11px] font-black shadow-sm active:scale-95 transition-transform"
            >
              🔑 いまログインする
            </button>
            <button
              type="button"
              onClick={dismissLoginPrompt}
              className="px-2 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-[10px] font-bold hover:bg-slate-50"
            >
              とじる
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismissLoginPrompt}
          className="shrink-0 w-8 h-8 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-black hover:bg-slate-50"
          aria-label="閉じる"
          title="閉じる"
        >
          ×
        </button>
      </motion.div>
    );
  }, [showLoginPrompt, firebaseUser, onGoogleLogin]);

  const handleRegister = () => {
    setShowRegisteredMessage(true);
    setTimeout(() => setShowRegisteredMessage(false), 3000);
  };

  const hasProfile = useMemo(() => {
    return !!(nickname && nickname.trim()) && !!(userEmoji && userEmoji.trim());
  }, [nickname, userEmoji]);

  const isStreamMode = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('stream');
      if (v === '1') return true;
      if (v === '0') return false;
    } catch {
      // ignore
    }
    try {
      return window.localStorage.getItem('rk_stream_mode') === '1';
    } catch {
      return false;
    }
  }, []);

  const isOwnerAdmin = useMemo(() => {
    if (!firebaseUser) return false;
    if (!isRenrakuAdmin(firebaseUser)) return false;
    const email = (firebaseUser.email || '').trim().toLowerCase();
    return email === 'akasirakuda@gmail.com';
  }, [firebaseUser]);

  // Public QR (canonical URL)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const url = 'https://rakuda.coffee/';
        const dataUrl = await QRCode.toDataURL(url, {
          // Center overlay (🐫) needs stronger error correction + a bit more quiet zone.
          errorCorrectionLevel: 'H',
          margin: 2,
          scale: 7,
          // 小豆色（あずきいろ）
          color: { dark: '#96514D', light: '#ffffff' },
        });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) setQrDataUrl('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const requireProfile = (action: () => void) => {
    if (hasProfile) {
      action();
      return;
    }
    window.dispatchEvent(
      new CustomEvent('SHOW_TOAST', {
        detail: '「絵文字・ニックネーム」を入力してから遊んでください',
      })
    );
    setShowRegisteredMessage(true);
    setTimeout(() => setShowRegisteredMessage(false), 2500);
  };

  const topRightSlot = (
    <div className="flex items-center justify-end gap-2 flex-wrap">
      {isOwnerAdmin ? (
        <div className="bg-emerald-50/95 px-3 py-2 rounded-xl text-[11px] font-black border border-emerald-200 text-emerald-900 flex items-center gap-2 shadow-sm">
          <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span>管理者としてオンライン中</span>
        </div>
      ) : (
        <>
          <div className="bg-white/90 px-2.5 py-1.5 rounded-xl text-[10px] font-black border border-slate-200/80 text-slate-700 flex items-center gap-2 shadow-sm">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>{isOnline ? 'オンライン中' : 'オフライン'}</span>
          </div>
          {firebaseUser ? (
            <>
              <div className="bg-white/90 px-2.5 py-1.5 rounded-xl text-[10px] font-black border border-slate-200/80 text-slate-700 shadow-sm max-w-[min(52vw,18rem)] truncate">
                {firebaseUser.isAnonymous
                  ? `匿名ログイン（UID: ${firebaseUser.uid.slice(0, 6)}…）`
                  : firebaseUser.email
                    ? `Google: ${firebaseUser.email}`
                    : 'Google: (メール不明)'}
              </div>
              {firebaseUser.isAnonymous && onGoogleLogin ? (
                <button
                  type="button"
                  onClick={onGoogleLogin}
                  className={`${btnGhost} px-2.5 py-1.5 text-[10px] shadow-sm`}
                  title="Google アカウントでログイン（匿名→Google連携）"
                >
                  🔑 ログイン
                </button>
              ) : null}
              <div
                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black border shadow-sm ${
                  isRenrakuAdmin(firebaseUser)
                    ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50/90 border-rose-200 text-rose-800'
                }`}
                title={`UID: ${firebaseUser.uid}`}
              >
                {isRenrakuAdmin(firebaseUser) ? '管理者OK' : '管理者NG'}
              </div>
              {isRenrakuAdmin(firebaseUser) ? (
                <button
                  type="button"
                  onClick={onOpenRenrakuchoAdmin}
                  className={`${btnGhost} px-2.5 py-1.5 text-[10px] shadow-sm`}
                  title="管理者（かんり）"
                >
                  かんり
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void signOut(auth)}
                className={`${btnGhost} px-2.5 py-1.5 text-[10px] shadow-sm`}
                title="ログアウト"
              >
                ログアウト
              </button>
            </>
          ) : null}
        </>
      )}
        {viewerCount !== undefined && (
          <div className="bg-amber-50/95 px-2.5 py-1.5 rounded-xl text-[10px] font-medium border border-amber-200/80 text-slate-700 flex items-center gap-2 shadow-sm">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse shrink-0" />
            <span>{viewerCount}名がオンライン中</span>
          </div>
        )}
        {!firebaseUser && onGoogleLogin && (
          <button type="button" onClick={onGoogleLogin} className={`${btnGhost} px-2.5 py-1.5 text-[10px] shadow-sm`}>
            🔑 ログイン
          </button>
        )}
    </div>
  );

  const streamToggleButton = (
    <button
      type="button"
      onClick={() => {
        try {
          window.localStorage.setItem('rk_stream_mode', isStreamMode ? '0' : '1');
        } catch {
          // ignore
        }
        window.location.reload();
      }}
      className={`h-10 px-3 rounded-xl text-[11px] font-black border shadow-sm active:scale-95 transition-transform ${
        isStreamMode ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-900 border-slate-950 text-white'
      }`}
      aria-label="広告の表示を切り替え"
      title="広告 なし/あり を切り替えます"
    >
      広告 {isStreamMode ? 'なし' : 'あり'}
    </button>
  );

  const settingsButton = (
    <button type="button" onClick={onOpenSettings} className={`w-10 h-10 flex items-center justify-center leading-none ${btnGhost}`} aria-label="設定">
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.50-.38-1.03-.70-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
      </svg>
    </button>
  );

  const profileBlock = (
    <div className="w-full space-y-2 rounded-xl border-2 border-amber-400/75 bg-amber-50/98 shadow-md p-2.5 sm:p-3">
      <p className="text-[10px] font-medium text-slate-600 text-left pl-0.5">絵文字・ニックネーム</p>
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        <input
          type="text"
          value={userEmoji}
          onChange={(e) => {
            const val = e.target.value;
            if (!val) {
              setUserEmoji('');
              return;
            }
            const chars = Array.from(val);
            setUserEmoji(chars[chars.length - 1] ?? '');
          }}
          placeholder="🐫"
          className="w-10 h-10 shrink-0 bg-slate-50 rounded-xl text-base text-center border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-300/50"
        />
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="なまえ..."
          className="min-w-0 flex-1 h-10 bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-sm font-medium text-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-300/50"
        />
        <button
          type="button"
          onClick={() => {
            if (!hasProfile) {
              window.dispatchEvent(
                new CustomEvent('SHOW_TOAST', {
                  detail: '絵文字とニックネームを入れてね',
                })
              );
              setShowRegisteredMessage(true);
              setTimeout(() => setShowRegisteredMessage(false), 2500);
              return;
            }
            handleRegister();
          }}
          className="h-10 min-w-[2.75rem] px-1.5 sm:px-2 shrink-0 flex items-center justify-center rounded-xl bg-indigo-200 text-slate-700 text-xs sm:text-sm font-medium active:scale-95 transition-transform"
        >
          登録
        </button>
      </div>
      <AnimatePresence>
        {showRegisteredMessage && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-[10px] font-medium text-slate-700 text-center bg-amber-50 border border-amber-200 p-2 rounded-xl"
          >
            {hasProfile ? '登録しました' : '絵文字・ニックネームを入力してください'}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="absolute inset-0 z-40 bg-amber-100 p-3 md:p-4 overflow-visible">
      <div className="relative h-full w-full rounded-xl shadow-md border border-amber-300/80 overflow-visible">
        <div className="relative z-[1] h-full min-h-0">
          {/* QR: fixed under the top toolbar (never overlaps top buttons/badges) */}
          {qrDataUrl ? (
            <div
              className="pointer-events-none fixed left-1/2 -translate-x-1/2 z-20"
              style={{ top: 'calc(env(safe-area-inset-top) + 72px)' }}
            >
              <div className="bg-white rounded-2xl shadow-md px-2 py-2">
                <div className="relative w-[112px] h-[112px]">
                  <img
                    src={qrDataUrl}
                    alt="https://rakuda.coffee QR"
                    className="w-[112px] h-[112px] rounded-xl"
                  />
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="w-6 h-6 rounded-full bg-white border border-amber-200 shadow-sm grid place-items-center">
                      <span className="text-[14px] leading-none">🐫</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <ModeEntryLayout
            title="らくだ珈琲"
            subtitle="永遠の素人。ゆるゆると遊んでいってね"
            titleBadge={
              <>
                {/* "β版": right shoulder, subtle & diagonal */}
                <span
                  className="pointer-events-none absolute -top-2 right-[-18px] z-[30] px-2.5 py-1 rounded-full border border-amber-300 bg-amber-50/90 text-amber-900 text-[10px] xs:text-[11px] font-black shadow-sm whitespace-nowrap rotate-[-12deg]"
                  role="status"
                >
                  β版
                </span>
              </>
            }
            titleStrokeColor="#78350f"
            subtitleClassName="text-amber-950/90"
            backgroundClassName="bg-gradient-to-b from-amber-100 via-amber-50 to-orange-100"
            rakudaBackdropVariant="hub"
            topLeft={
              <div className="flex items-center gap-2">
                {streamToggleButton}
                {settingsButton}
              </div>
            }
            topRight={topRightSlot}
            titleTopClass={qrDataUrl ? 'top-[28%]' : 'top-[18%]'}
            childrenTopClass={qrDataUrl ? 'top-[44%]' : 'top-[34%]'}
            mainColumnTopClass={qrDataUrl ? 'top-[56%]' : 'top-[46%]'}
            // Keep badges visible horizontally, but allow vertical scroll so lower items
            // (e.g., "広告の消去（準備中）") remain reachable even with the fixed ad banner.
            mainColumnScrollClassName="overflow-y-auto overflow-x-visible"
            children={
              <div className="w-full space-y-2">
                <AnimatePresence initial={false}>{loginPrompt}</AnimatePresence>
                {profileBlock}
              </div>
            }
            mainColumn={
              <div className="flex flex-col gap-3 w-full max-w-md mx-auto items-stretch pb-3 overflow-visible">
                {/* 1. ことば探しであそぶ */}
                <button
                  type="button"
                  className={`${hubBtn} bg-[#f6c7c7] border-[#5a3d28] text-[#3b2a18] shadow-md`}
                  onClick={() => {
                    // Playing should always be possible even before profile setup.
                    if (!hasProfile) {
                      window.dispatchEvent(
                        new CustomEvent('SHOW_TOAST', {
                          detail: 'プロフィールはあとでOK。まずは遊べます',
                        })
                      );
                    }
                    onSelectWindow();
                  }}
                >
                  <KotobaLogo size={22} />
                  <span className="font-medium">ことば探しであそぶ</span>
                </button>

                {/* 2. 掲示板（らくだ内・/hundred と同じ遷移） */}
                <button
                  type="button"
                  className={`${hubBtn} bg-gradient-to-r from-violet-200 to-indigo-200 border-indigo-700/40 text-indigo-950 shadow-md`}
                  onClick={() => {
                    vibrate(10);
                    if (!hasProfile) {
                      window.dispatchEvent(
                        new CustomEvent('SHOW_TOAST', {
                          detail: '掲示板を見ることはできます。投稿する前に「絵文字・ニックネーム」を入れてください',
                        })
                      );
                    }
                    void onOpenHundredHub();
                  }}
                >
                  <span className="text-lg leading-none">📋</span>
                  <span className="font-medium text-center leading-tight flex flex-col gap-0.5">
                    <span>掲示板</span>
                    {hasActiveRecruitments ? (
                      <span className="text-[10px] font-black text-indigo-800/90">募集中あり</span>
                    ) : renrakuchoHasUnread ? (
                      <span className="text-[10px] font-black text-indigo-800/90">未読あり</span>
                    ) : null}
                  </span>
                </button>

                {/* 3. ３０用の募集掲示板（SANJUU トップ・既存 URL パラメータと同じ） */}
                <button
                  type="button"
                  className={`${hubBtn} bg-gradient-to-r from-sky-200 to-cyan-200 border-sky-700/45 text-sky-950 shadow-md`}
                  onClick={() => {
                    vibrate(10);
                    const url = sanjuuTopUrlWithRakudaProfile({ emoji: userEmoji, nickname });
                    window.location.assign(url);
                  }}
                >
                  <span className="text-lg leading-none">３０</span>
                  <span className="font-medium text-center leading-tight">３０用の募集掲示板</span>
                </button>

                {/* 4. みんなの願い */}
                {/* 5. しゅっせき簿 */}
                <button
                  type="button"
                  className={`${hubBtn} bg-gradient-to-r from-emerald-300 to-green-300 border-emerald-600/55 text-emerald-950 shadow-md`}
                  onClick={() => requireProfile(onOpenStampCard)}
                >
                  <span className="text-lg leading-none">💮</span>
                  <span className="font-medium">しゅっせき簿</span>
                </button>

                {/* 6. しずかの間 */}
                <button
                  type="button"
                  className={`${hubBtn} bg-gradient-to-r from-slate-900 to-blue-950 border-sky-500/50 text-sky-50 shadow-md`}
                  onClick={() => requireProfile(onSelectQuietRoom)}
                >
                  <Moon className="w-5 h-5 shrink-0 opacity-90" />
                  <span className="font-medium">しずかの間</span>
                </button>

                {/* 7. 広告の消去 */}
                <button
                  type="button"
                  disabled
                  className={`${hubBtn} opacity-50 border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed`}
                >
                  <Heart className="w-5 h-5 shrink-0" />
                  <span className="font-medium">広告の消去（準備中）</span>
                </button>
              </div>
            }
            footer={
              <div className="flex flex-col items-center gap-1 text-[10px] text-amber-950/80 font-medium">
                <span>🐫 {totalPoints.toLocaleString()} pt</span>
                <span>&copy; 2026 らくだ珈琲</span>
              </div>
            }
          />
        </div>
      </div>

    </div>
  );
};

export default SeatSelection;
