import React from 'react';
import {
  emojiPresenceAvatarShellClass,
  resolveUserGreenUntilMs,
} from '../../../lib/greenGateEmoji';
import type { ActiveUser } from '../types';

type RakudaPresenceEmojiProps = {
  user: Pick<ActiveUser, 'uid' | 'emoji' | 'greenUntilMs'>;
  currentUid?: string | null;
  myGreenUntilMs?: number | null;
  myShussekiRegular?: boolean;
  compact?: boolean;
  selfClickable?: boolean;
  hundred?: boolean;
  onClick?: () => void;
  title?: string;
  'aria-label'?: string;
  children?: React.ReactNode;
};

/** 在席・掲示板ヘッダ用の絵文字タイル（緑ゲート＝緑枠、それ以外は琥珀/グレー） */
const RakudaPresenceEmoji: React.FC<RakudaPresenceEmojiProps> = ({
  user,
  currentUid,
  myGreenUntilMs,
  myShussekiRegular = false,
  compact = false,
  selfClickable = false,
  hundred = false,
  onClick,
  title,
  'aria-label': ariaLabel,
  children,
}) => {
  const emoji = (user.emoji || '👤').trim() || '👤';
  const until = resolveUserGreenUntilMs(user.uid, user.greenUntilMs, currentUid, myGreenUntilMs);
  const isSelf = !!currentUid && user.uid === currentUid;
  const shell = emojiPresenceAvatarShellClass(until, {
    compact,
    selfClickable,
    hundred,
    shussekiRegular: isSelf && myShussekiRegular,
  });

  const body = (
    <>
      {emoji}
      {children}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={shell} onClick={onClick} title={title} aria-label={ariaLabel}>
        {body}
      </button>
    );
  }

  return (
    <span className={shell} title={title}>
      {body}
    </span>
  );
};

export default RakudaPresenceEmoji;
