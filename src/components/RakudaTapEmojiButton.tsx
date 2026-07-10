import React from 'react';
import { vibrate } from '../lib/utils';

export type RakudaTapEmojiButtonProps = {
  emoji: string;
  nickname: string;
  className?: string;
  /** トーストに絵文字も出す（既定 true） */
  showEmojiInToast?: boolean;
} & Omit<React.ComponentPropsWithoutRef<'button'>, 'children' | 'onClick' | 'type'>;

/** 絵文字タップでニックネームをトースト表示（トップハブ等） */
export const RakudaTapEmojiButton: React.FC<RakudaTapEmojiButtonProps> = ({
  emoji,
  nickname,
  className = '',
  showEmojiInToast = true,
  ...rest
}) => {
  const glyph = (emoji || '👤').trim() || '👤';
  const name = (nickname || '').trim() || 'ななし';

  return (
    <button
      type="button"
      className={className}
      aria-label={`${name} — タップで名前を表示`}
      onClick={() => {
        vibrate(8);
        window.dispatchEvent(
          new CustomEvent('SHOW_TOAST', {
            detail: showEmojiInToast ? `${glyph} ${name}` : name,
          }),
        );
      }}
      {...rest}
    >
      {glyph}
    </button>
  );
};

export default RakudaTapEmojiButton;
