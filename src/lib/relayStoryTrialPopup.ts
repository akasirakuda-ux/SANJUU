const STORAGE_KEY = 'rk_relay_story_trial_popup_v1';

export function isRelayStoryTrialPopupDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markRelayStoryTrialPopupDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function shouldShowRelayStoryTrialPopup(): boolean {
  return !isRelayStoryTrialPopupDismissed();
}
