import React from 'react';
import { createPortal } from 'react-dom';

/** 座席選択（トップ）のプロフィール欄へスクロールするための id（SeatSelection と共有） */
export const RAKUDA_PROFILE_SETTINGS_ANCHOR_ID = 'rakuda-profile-settings';

export type AppHeaderProps = {
  userEmoji: string;
  nickname: string;
  /** ブラウザのネットワーク状態（三十の「オンライン中／オフライン」行に相当） */
  isOnline: boolean;
};

/** 三十右上（SanjuuGlobalPresenceBar 想定）に合わせた1行目：絵文字・中黒・ニックネーム */
function presenceTitleLine(emojiRaw: string, nicknameRaw: string): string {
  const emoji = (emojiRaw ?? '').trim();
  const nick = (nicknameRaw ?? '').trim();
  if (emoji && nick) return `${emoji}・${nick}`;
  if (emoji) return emoji;
  if (nick) return nick;
  return '';
}

/**
 * 三十の右上表示に行の意味を揃える：
 * 1行目 … 絵文字・中黒・ニックネーム
 * 2行目 … オンライン中 / オフライン
 */
const AppHeader: React.FC<AppHeaderProps> = ({ userEmoji, nickname, isOnline }) => {
  const line1 = presenceTitleLine(userEmoji, nickname);
  const line2 = isOnline ? 'オンライン中' : 'オフライン';

  /** `AppLayout` の `overflow-hidden` 内だと fixed でもクリップされるため body 直下へ出す */
  const header = (
    <header
      className="fixed z-[2800] pointer-events-none top-[calc(env(safe-area-inset-top)+6px)] left-0 right-0"
      aria-label={`表示名 ${line1 || '未入力'} ${line2}`}
    >
      <div className="max-w-screen-xl mx-auto flex justify-end pr-[max(12px,env(safe-area-inset-right))] pl-[max(12px,env(safe-area-inset-left))]">
        <div className="max-w-[min(72vw,18rem)] rounded-xl border border-amber-300/80 bg-amber-50/95 px-2.5 py-1 shadow-sm text-right">
          <div
            className="text-[13px] sm:text-sm leading-tight font-semibold text-slate-800 truncate min-h-[1.25rem]"
            title={line1 || undefined}
          >
            {line1 || '\u00a0'}
          </div>
          <div
            className={`text-[11px] font-semibold truncate leading-snug mt-0.5 min-h-[1rem] ${
              isOnline ? 'text-emerald-800' : 'text-slate-500'
            }`}
          >
            {line2}
          </div>
        </div>
      </div>
    </header>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(header, document.body);
};

export default AppHeader;
