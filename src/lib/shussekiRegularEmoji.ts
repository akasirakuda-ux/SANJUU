import { RAKUDA_SUPPORT_GATE_LABEL } from '../constants/rakudaSupportGateLabels';
import { getTotalStampCount } from './shussekiDailyClears';

export const SHUSSEKI_REGULAR_MIN_DAYS = 100;

export const RK_SHUSSEKI_REGULAR_EMOJI_FRAME_CLASS = 'rk-shusseki-regular-emoji-frame';
export const RK_SHUSSEKI_REGULAR_AVATAR_SHELL_CLASS = 'rk-shusseki-regular-avatar-shell';
export const RK_EMOJI_FRAME_REGULAR_AND_GREEN_OUTER_CLASS = 'rk-emoji-frame-regular-and-green-outer';

export type ShussekiRegularUserLike = {
  completedDates?: string[];
  specialDates?: string[];
  dailyClearCounts?: Record<string, number>;
};

export function isShussekiRegularTotal(total: number): boolean {
  return Number.isFinite(total) && total >= SHUSSEKI_REGULAR_MIN_DAYS;
}

export function isShussekiRegularUser(user: ShussekiRegularUserLike): boolean {
  return isShussekiRegularTotal(getTotalStampCount(user));
}

/** 茶枠を出すか — 100だけでは false（緑ゲート応援＋100日のみ） */
export function showsShussekiRegularTeaFrame(greenActive: boolean, shussekiRegular: boolean): boolean {
  return greenActive && shussekiRegular;
}

export type RakudaEmojiFrameSize = 'inline' | 'md' | 'lg';

const SIZE_SUFFIX: Record<RakudaEmojiFrameSize, string> = {
  inline: 'rk-shusseki-regular-emoji--inline',
  md: 'rk-shusseki-regular-emoji--md',
  lg: 'rk-shusseki-regular-emoji--lg',
};

export function shussekiRegularEmojiFrameClass(size: RakudaEmojiFrameSize, avatar: boolean): string {
  const base = avatar ? RK_SHUSSEKI_REGULAR_AVATAR_SHELL_CLASS : RK_SHUSSEKI_REGULAR_EMOJI_FRAME_CLASS;
  return `${base} ${SIZE_SUFFIX[size]}`;
}

export function rakudaEmojiFrameTitle(greenActive: boolean, shussekiRegular: boolean): string | undefined {
  if (showsShussekiRegularTeaFrame(greenActive, shussekiRegular)) {
    return `常連さん（しゅっせき100日）・${RAKUDA_SUPPORT_GATE_LABEL}`;
  }
  if (greenActive) return RAKUDA_SUPPORT_GATE_LABEL;
  return undefined;
}
