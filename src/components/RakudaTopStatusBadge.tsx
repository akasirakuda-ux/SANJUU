import React from 'react';
import type { User } from 'firebase/auth';
import { getAuthLoginDisplay, googleLoginActionLabelJa, resolveAuthUserForLoginDisplay } from '../lib/rakudaHubShell';
import { RK_GATE_NICK_DISPLAY_CLASS } from '../lib/rakudaGate';
import RakudaGreenGateEmoji from './RakudaGreenGateEmoji';
import { useLoginReassurancePrompt } from '../hooks/useLoginReassurancePrompt';
import { useFirebaseAuthListener } from '../hooks/useFirebaseAuthListener';

export type RakudaTopStatusBadgeProps = {
  userEmoji: string;
  nickname: string;
  isOnline: boolean;
  firebaseUser?: User | null;
  isAuthReady?: boolean;
  onGoogleLogin?: () => void;
  onGoogleLoginPopup?: () => void | Promise<void>;
  greenGateActive?: boolean;
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

/** トップページ右上: ログイン → 絵文字・ニックネーム → オンライン（横並び・コンパクト） */
const RakudaTopStatusBadge: React.FC<RakudaTopStatusBadgeProps> = ({
  userEmoji,
  nickname,
  isOnline,
  firebaseUser = null,
  isAuthReady = true,
  onGoogleLogin,
  onGoogleLoginPopup,
  greenGateActive = false,
  shussekiRegular = false,
}) => {
  const { promptLogin, loginReassuranceModal } = useLoginReassurancePrompt(
    onGoogleLogin,
    onGoogleLoginPopup,
  );
  const liveAuthUser = useFirebaseAuthListener();
  const authUserForDisplay = resolveAuthUserForLoginDisplay(firebaseUser, liveAuthUser);
  const auth = getAuthLoginDisplay(authUserForDisplay, isAuthReady);
  const lineNetwork = isOnline ? 'オンライン' : 'オフライン';
  const emojiTrim = (userEmoji ?? '').trim();
  const nickTrim = (nickname ?? '').trim();
  const lineProfile = presenceTitleLine(userEmoji, nickname);
  const showLoginAction =
    isAuthReady && auth.tone !== 'google' && !!(onGoogleLoginPopup ?? onGoogleLogin);

  return (
    <>
      {loginReassuranceModal}
      <aside
      className="flex items-center gap-1 min-w-0 max-w-[min(72vw,20rem)] rounded-xl border border-rk-amber-300/80 bg-rk-amber-50/95 px-2 py-1 shadow-sm"
      aria-label={`${auth.label} ${lineProfile} ${lineNetwork}`}
    >
      {showLoginAction ? (
        <button
          type="button"
          onClick={promptLogin}
          onContextMenu={(e) => {
            if (!onGoogleLoginPopup) return;
            e.preventDefault();
            void onGoogleLoginPopup();
          }}
          className={`shrink min-w-0 truncate text-[10px] font-bold leading-snug underline-offset-2 hover:underline active:opacity-80 ${toneClass[auth.tone] ?? toneClass.none}`}
          title={
            onGoogleLoginPopup
              ? 'Google でログイン（リダイレクト）。長押しまたは右クリックでポップアップログイン'
              : 'Google でログイン（リダイレクト）'
          }
        >
          {googleLoginActionLabelJa(auth.tone)}
        </button>
      ) : (
        <span
          className={`shrink min-w-0 truncate text-[10px] font-bold leading-snug ${toneClass[auth.tone] ?? toneClass.none}`}
          title={auth.title}
        >
          {auth.label}
        </span>
      )}

      <span className="text-rk-amber-700/45 shrink-0 text-[10px]" aria-hidden>
        ·
      </span>

      <span
        className={`min-w-0 flex items-center gap-0.5 truncate text-[11px] font-semibold ${RK_GATE_NICK_DISPLAY_CLASS}`}
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
      </span>

      <span className="text-rk-amber-700/45 shrink-0 text-[10px]" aria-hidden>
        ·
      </span>

      <span
        className={`shrink-0 text-[10px] font-black ${isOnline ? 'text-rk-success-700' : 'text-rk-slate-500'}`}
      >
        {lineNetwork}
      </span>
    </aside>
    </>
  );
};

export default RakudaTopStatusBadge;
