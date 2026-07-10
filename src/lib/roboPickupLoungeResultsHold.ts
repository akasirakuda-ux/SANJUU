/** ロボ常設 — 結果画面表示中は hundred_rooms の同期で盤面を上書きしない */

let holdActive = false;
let holdTargetWord = '';

export function activateRoboLoungeResultsHold(targetWord: string): void {
  holdActive = true;
  holdTargetWord = String(targetWord ?? '').trim();
}

export function clearRoboLoungeResultsHold(): void {
  holdActive = false;
  holdTargetWord = '';
}

export function isRoboLoungeResultsHoldActive(): boolean {
  return holdActive;
}

/** 結果画面表示中は hundred_rooms の更新をすべて無視する */
export function shouldDeferRoboLoungeRoomSync(_incomingTargetWord?: string): boolean {
  return holdActive;
}
