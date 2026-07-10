/**
 * 対人プレイ（オンライン対戦・三十・協力）中は全面広告を出さず、
 * 席（トップ）に戻るときにまとめて清算する。
 */

let sessionActive = false;
let deferredAdOwed = false;

/** 対人プレイが始まった（相手・ルームが存在） */
export function markSocialPlayAdSessionActive(): void {
  sessionActive = true;
  deferredAdOwed = true;
}

export function isSocialPlayAdSessionActive(): boolean {
  return sessionActive;
}

/** 自然な区切り広告を抑止するか */
export function shouldDeferInterstitialDuringSocialPlay(): boolean {
  return sessionActive && deferredAdOwed;
}

/**
 * 席に戻るなどセッション終了。
 * @returns 清算用の全面広告を出してよいか
 */
export function settleSocialPlayAdSession(): boolean {
  sessionActive = false;
  if (!deferredAdOwed) return false;
  deferredAdOwed = false;
  return true;
}

/** 広告なしでセッションだけ終了（緑ゲート等） */
export function cancelSocialPlayAdDeferral(): void {
  sessionActive = false;
  deferredAdOwed = false;
}
