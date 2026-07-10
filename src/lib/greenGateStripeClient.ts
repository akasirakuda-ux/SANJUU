/** 設定→解約ログイン後に設定を再表示するためのフラグ */

import { RAKUDA_SUPPORT_GATE_LABEL } from '../constants/rakudaSupportGateLabels';
export const RK_SETTINGS_BILLING_LOGIN_KEY = 'rk_settings_billing_login_v1';

export function markSettingsBillingLoginIntent(): void {
  try {
    sessionStorage.setItem(RK_SETTINGS_BILLING_LOGIN_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function consumeSettingsBillingLoginIntent(): boolean {
  try {
    if (sessionStorage.getItem(RK_SETTINGS_BILLING_LOGIN_KEY) === '1') {
      sessionStorage.removeItem(RK_SETTINGS_BILLING_LOGIN_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export type GreenGateCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function createGreenGateCheckoutSession(idToken: string): Promise<GreenGateCheckoutResult> {
  const r = await fetch('/api/stripe/create-checkout-session', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${idToken}`,
    },
  });
  let data: { ok?: boolean; url?: string; error?: string } = {};
  try {
    data = await r.json();
  } catch {
    return { ok: false, error: 'invalid_response' };
  }
  if (!r.ok || !data.ok || !data.url) {
    return { ok: false, error: String(data.error ?? 'checkout_failed') };
  }
  return { ok: true, url: data.url };
}

export async function syncGreenGateBillingFromStripe(
  idToken: string,
): Promise<{ ok: boolean; greenUntilMs?: number | null; synced?: boolean }> {
  const r = await fetch('/api/stripe/sync-billing', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${idToken}`,
    },
  });
  let data: { ok?: boolean; greenUntilMs?: number | null; synced?: boolean } = {};
  try {
    data = await r.json();
  } catch {
    return { ok: false };
  }
  return {
    ok: !!data.ok,
    greenUntilMs: data.greenUntilMs ?? null,
    synced: !!data.synced,
  };
}

export async function syncGreenGateAfterCheckout(
  idToken: string,
  sessionId: string,
): Promise<{ ok: boolean; greenUntilMs?: number | null }> {
  const r = await fetch('/api/stripe/sync-checkout-session', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ sessionId }),
  });
  let data: { ok?: boolean; greenUntilMs?: number | null } = {};
  try {
    data = await r.json();
  } catch {
    return { ok: false };
  }
  return { ok: !!data.ok, greenUntilMs: data.greenUntilMs ?? null };
}

export type GreenGatePortalResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function createGreenGatePortalSession(idToken: string): Promise<GreenGatePortalResult> {
  const r = await fetch('/api/stripe/create-portal-session', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${idToken}`,
    },
  });
  let data: { ok?: boolean; url?: string; error?: string } = {};
  try {
    data = await r.json();
  } catch {
    return { ok: false, error: 'invalid_response' };
  }
  if (!r.ok || !data.ok || !data.url) {
    return { ok: false, error: String(data.error ?? 'portal_failed') };
  }
  return { ok: true, url: data.url };
}

export function greenGatePortalErrorJa(code: string): string {
  switch (code) {
    case 'auth_required':
      return 'Google でログインしてからお試しください';
    case 'no_stripe_subscription':
      return `${RAKUDA_SUPPORT_GATE_LABEL}のお支払い情報が見つかりません（配布コードの場合、解約は不要です）`;
    case 'stripe_not_configured':
      return '解約画面の準備中です。しばらくしてからお試しください';
    default:
      return '解約画面を開けませんでした。しばらくしてからお試しください';
  }
}
