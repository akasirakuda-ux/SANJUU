/** Payment Link から戻ったとき `?donation=thanks` を検出（リロード対策で sessionStorage も使う） */

const SESSION_KEY = 'rk_donation_thanks_pending_v1';

function stripDonationFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('donation')) return;
    url.searchParams.delete('donation');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* ignore */
  }
}

/** 初回ロード時: お礼モーダルを出すか */
export function resolveDonationThanksOnLoad(): boolean {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get('donation') === 'thanks') {
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* ignore */
    }
    stripDonationFromUrl();
    return true;
  }

  try {
    if (sessionStorage.getItem(SESSION_KEY) === '1') {
      sessionStorage.removeItem(SESSION_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }

  return false;
}

/** 設定 → 応援ボタンを押した直前（別タブ復帰の補助） */
export function markDonationCheckoutStarted(): void {
  try {
    sessionStorage.setItem('rk_donation_checkout_started_v1', String(Date.now()));
  } catch {
    /* ignore */
  }
}
