import React from 'react';
import { createPortal } from 'react-dom';
import type { User } from 'firebase/auth';
import { getAuthLoginDisplay, googleLoginActionLabelJa, resolveAuthUserForLoginDisplay } from '../lib/rakudaHubShell';
import { RK_GATE_NICK_DISPLAY_CLASS } from '../lib/rakudaGate';
import RakudaGreenGateEmoji from './RakudaGreenGateEmoji';
import { useLoginReassurancePrompt } from '../hooks/useLoginReassurancePrompt';
import { useFirebaseAuthListener } from '../hooks/useFirebaseAuthListener';

/** 座席選択（トップ）のプロフィール欄へスクロールするための id（SeatSelection と共有） */
export const RAKUDA_PROFILE_SETTINGS_ANCHOR_ID = 'rakuda-profile-settings';

export type AppHeaderProps = {
  userEmoji: string;
  nickname: string;
  isOnline: boolean;
  firebaseUser?: User | null;
  isAuthReady?: boolean;
  onGoogleLogin?: () => void;
  /** リダイレクトが失敗するとき用（同一タブ内ポップアップ） */
  onGoogleLoginPopup?: () => void | Promise<void>;
  /** しずかの間では非表示（没入のため） */
  hidden?: boolean;
  /** 緑ゲート有効時、プロフィール行の絵文字に緑枠 */
  greenGateActive?: boolean;
  /** しゅっせき100日以上（常連さん・茶枠） */
  shussekiRegular?: boolean;
};

function presenceTitleLine(emojiRaw: string, nicknameRaw: string): string {
  const emoji = (emojiRaw ?? '').trim();
  const nick = (nicknameRaw ?? '').trim();
  if (emoji && nick) return `${emoji}・${nick}`;
  if (emoji) return emoji;
  if (nick) return nick;
  return '（未設定）';
}

const toneClass: Record<string, string> = {
  google: 'text-rk-sky-800',
  guest: 'text-rk-amber-900',
  none: 'text-rk-slate-600',
  loading: 'text-rk-slate-500',
};

/**
 * 画面最下部の固定ステータス帯（左→右）: ログイン / 回線 / プロフィール
 * 本文は AppLayout の `reserveBottomStatusInset` で帯の高さ分余白を確保する
 */
const AppHeader: React.FC<AppHeaderProps> = ({
  userEmoji,
  nickname,
  isOnline,
  firebaseUser = null,
  isAuthReady = true,
  onGoogleLogin,
  onGoogleLoginPopup,
  hidden = false,
  greenGateActive = false,
  shussekiRegular = false,
}) => {
  const { promptLogin, loginReassuranceModal } = useLoginReassurancePrompt(
    onGoogleLogin,
    onGoogleLoginPopup,
  );

  if (hidden) return null;

  const liveAuthUser = useFirebaseAuthListener();
  const authUserForDisplay = resolveAuthUserForLoginDisplay(firebaseUser, liveAuthUser);
  const auth = getAuthLoginDisplay(authUserForDisplay, isAuthReady);
  const lineNetwork = isOnline ? 'オンライン' : 'オフライン';
  const emojiTrim = (userEmoji ?? '').trim();
  const nickTrim = (nickname ?? '').trim();
  const lineProfile = presenceTitleLine(userEmoji, nickname);
  const showLoginAction =
    isAuthReady && auth.tone !== 'google' && !!(onGoogleLoginPopup ?? onGoogleLogin);

  const bar = (
    <footer
      className="fixed z-[2800] bottom-0 left-0 right-0 pointer-events-none border-t border-rk-amber-300/85 bg-[#fff9e1]/95 backdrop-blur-sm shadow-[0_-6px_20px_rgb(0_0_0/0.06)]"
      aria-label={`${auth.label} ${lineNetwork} ${lineProfile}`}
    >
      <div
        className="max-w-screen-xl mx-auto px-[max(10px,env(safe-area-inset-left))] pr-[max(10px,env(safe-area-inset-right))] pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]"
      >
        <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 min-h-[2.5rem]">
          {/* ログイン列 */}
          <div className="flex flex-col gap-0.5 min-w-0 flex-[1_1_7rem] sm:flex-none sm:max-w-[40%]">
            {showLoginAction ? (
              <>
                <button
                  type="button"
                  onClick={promptLogin}
                  className={`text-left text-[11px] font-bold truncate leading-snug min-h-[1rem] underline-offset-2 hover:underline active:opacity-80 ${toneClass[auth.tone] ?? toneClass.none}`}
                  title="Google でログイン（リダイレクト）"
                >
                  {googleLoginActionLabelJa(auth.tone)}
                </button>
                {onGoogleLoginPopup ? (
                  <button
                    type="button"
                    onClick={() => void onGoogleLoginPopup()}
                    className="text-left text-[10px] font-semibold text-rk-sky-900 underline underline-offset-2 hover:opacity-90 active:opacity-80 max-w-full truncate"
                    title="リダイレクトがうまくいかないとき用。ポップアップをブロックしないでください。"
                  >
                    ポップアップでログイン
                  </button>
                ) : null}
              </>
            ) : (
              <div
                className={`text-[11px] font-bold truncate leading-snug min-h-[1rem] ${toneClass[auth.tone] ?? toneClass.none}`}
                title={auth.title}
              >
                {auth.label}
              </div>
            )}
          </div>

          {/* 回線 */}
          <div
            className={`shrink-0 text-center text-[11px] font-black min-w-[4rem] ${
              isOnline ? 'text-rk-success-700' : 'text-rk-slate-500'
            }`}
          >
            {lineNetwork}
          </div>

          {/* プロフィール */}
          <div
            className={`text-[12px] sm:text-sm font-semibold truncate text-right min-w-0 flex-[1_1_7rem] sm:flex-none sm:max-w-[42%] flex items-center justify-end gap-1 ${RK_GATE_NICK_DISPLAY_CLASS}`}
            title={lineProfile}
          >
            {emojiTrim ? (
              <RakudaGreenGateEmoji size="inline" greenGate={greenGateActive} shussekiRegular={shussekiRegular}>
                {emojiTrim}
              </RakudaGreenGateEmoji>
            ) : null}
            <span className="truncate">
              {emojiTrim && nickTrim ? `・${nickTrim}` : nickTrim || emojiTrim || '（未設定）'}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );

  if (typeof document === 'undefined') return null;
  return (
    <>
      {loginReassuranceModal}
      {createPortal(bar, document.body)}
    </>
  );
};

export default AppHeader;
