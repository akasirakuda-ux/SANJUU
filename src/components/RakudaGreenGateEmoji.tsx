import React from 'react';
import {
  isGreenGateActiveFromUntil,
  RK_GREEN_GATE_AVATAR_SHELL_CLASS,
  RK_GREEN_GATE_EMOJI_FRAME_CLASS,
} from '../lib/greenGateEmoji';
import {
  rakudaEmojiFrameTitle,
  RK_EMOJI_FRAME_REGULAR_AND_GREEN_OUTER_CLASS,
  shussekiRegularEmojiFrameClass,
  showsShussekiRegularTeaFrame,
} from '../lib/shussekiRegularEmoji';

export type RakudaGreenGateEmojiSize = 'inline' | 'md' | 'lg';

const SIZE_CLASS: Record<RakudaGreenGateEmojiSize, string> = {
  inline: 'rk-green-gate-emoji--inline',
  md: 'rk-green-gate-emoji--md',
  lg: 'rk-green-gate-emoji--lg',
};

export type RakudaGreenGateEmojiProps = {
  children: React.ReactNode;
  /** 緑ゲート有効（`greenUntilMs` より優先） */
  greenGate?: boolean;
  greenUntilMs?: number | null;
  /** しゅっせき100日以上（茶枠は緑ゲートと両方のときのみ） */
  shussekiRegular?: boolean;
  size?: RakudaGreenGateEmojiSize;
  className?: string;
  title?: string;
};

/** 絵文字枠 — 緑（応援）／100+緑のとき茶内＋緑外（100だけでは茶枠なし） */
const RakudaGreenGateEmoji: React.FC<RakudaGreenGateEmojiProps> = ({
  children,
  greenGate,
  greenUntilMs,
  shussekiRegular = false,
  size = 'md',
  className = '',
  title,
}) => {
  const greenActive =
    greenGate === true ||
    (greenGate !== false && isGreenGateActiveFromUntil(greenUntilMs));
  const regularActive = shussekiRegular === true;

  if (!greenActive) {
    return (
      <span className={className} title={title}>
        {children}
      </span>
    );
  }

  const sizeClass = SIZE_CLASS[size];
  const avatar = size === 'md' || size === 'lg';
  const resolvedTitle = title ?? rakudaEmojiFrameTitle(greenActive, regularActive);

  if (showsShussekiRegularTeaFrame(greenActive, regularActive)) {
    const outerClass =
      size === 'md' || size === 'lg'
        ? `${RK_GREEN_GATE_AVATAR_SHELL_CLASS} ${RK_EMOJI_FRAME_REGULAR_AND_GREEN_OUTER_CLASS} ${sizeClass}`
        : `${RK_GREEN_GATE_EMOJI_FRAME_CLASS} ${RK_EMOJI_FRAME_REGULAR_AND_GREEN_OUTER_CLASS} ${sizeClass}`;
    const innerClass = shussekiRegularEmojiFrameClass(size, avatar);

    return (
      <span className={`${outerClass} ${className}`.trim()} title={resolvedTitle}>
        <span className={`${innerClass} rk-shusseki-regular-emoji--inner`}>{children}</span>
      </span>
    );
  }

  const frameClass =
    size === 'md' || size === 'lg'
      ? `${RK_GREEN_GATE_AVATAR_SHELL_CLASS} ${sizeClass}`
      : `${RK_GREEN_GATE_EMOJI_FRAME_CLASS} ${sizeClass}`;

  return (
    <span className={`${frameClass} ${className}`.trim()} title={resolvedTitle}>
      {children}
    </span>
  );
};

export default RakudaGreenGateEmoji;
