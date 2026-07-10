/** 緑ゲート有効者の絵文字枠（名前色の代わりに視認しやすく） */

export const RK_GREEN_GATE_EMOJI_FRAME_CLASS = 'rk-green-gate-emoji-frame';

/** 掲示板・在席の絵文字タイル（緑ゲート時は琥珀の「自分」枠より優先） */
export const RK_GREEN_GATE_AVATAR_SHELL_CLASS = 'rk-green-gate-avatar-shell';

export function isGreenGateActiveFromUntil(
  greenUntilMs: number | null | undefined,
  nowMs: number = Date.now()
): boolean {
  return greenUntilMs != null && Number.isFinite(greenUntilMs) && nowMs < greenUntilMs;
}

export function readPresenceGreenUntilMs(data: Record<string, unknown>): number | null {
  const raw = data.greenUntilMs;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

/** 自分は Firestore 購読の期限を優先（在席 heartbeat より先に枠を出す） */
export function resolveUserGreenUntilMs(
  uid: string,
  presenceGreenUntilMs: number | null | undefined,
  currentUid: string | null | undefined,
  myGreenUntilMs: number | null | undefined
): number | null {
  if (currentUid && uid === currentUid && myGreenUntilMs != null && Number.isFinite(myGreenUntilMs)) {
    return myGreenUntilMs;
  }
  return presenceGreenUntilMs ?? null;
}

export function isUserGreenGate(
  uid: string,
  presenceGreenUntilMs: number | null | undefined,
  currentUid: string | null | undefined,
  myGreenUntilMs: number | null | undefined,
  nowMs: number = Date.now()
): boolean {
  return isGreenGateActiveFromUntil(
    resolveUserGreenUntilMs(uid, presenceGreenUntilMs, currentUid, myGreenUntilMs),
    nowMs
  );
}

type EmojiPresenceShellOpts = {
  compact?: boolean;
  /** 緑でないとき、自分の絵文字（クリック可）用の琥珀枠 */
  selfClickable?: boolean;
  hundred?: boolean;
  /** しゅっせき100日以上（自分のみ渡す想定） */
  shussekiRegular?: boolean;
};

/**
 * 絵文字タイルの外枠。緑ゲートのときは **緑のみ**（琥珀の二重枠を出さない）。
 */
export function emojiPresenceAvatarShellClass(
  greenUntilMs: number | null | undefined,
  opts: EmojiPresenceShellOpts = {}
): string {
  const compact = opts.compact === true;
  const base = compact
    ? 'relative inline-flex h-7 w-7 items-center justify-center rounded-xl text-base shadow-sm'
    : 'relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-sm shadow-sm';

  if (opts.hundred) {
    return `${base} border border-rk-white/30 bg-rk-white/15`;
  }

  const greenActive = isGreenGateActiveFromUntil(greenUntilMs);
  const regularActive = opts.shussekiRegular === true;

  if (greenActive && regularActive) {
    return `${base} rk-presence-avatar-regular-and-green`;
  }

  if (greenActive) {
    return `${base} ${RK_GREEN_GATE_AVATAR_SHELL_CLASS}`;
  }

  if (opts.selfClickable) {
    return `${base} border-2 border-rk-amber-300 bg-rk-white ring-rk-amber-200 transition active:scale-95 hover:ring-2`;
  }

  return `${base} border border-rk-slate-200 bg-rk-white`;
}
