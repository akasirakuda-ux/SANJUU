const STORAGE_KEY = 'rk_gomoku_trial_popup_v1';

export function isGomokuTrialPopupDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markGomokuTrialPopupDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function shouldShowGomokuTrialPopup(): boolean {
  return !isGomokuTrialPopupDismissed();
}
