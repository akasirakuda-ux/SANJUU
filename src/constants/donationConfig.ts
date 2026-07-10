/** 特別寄付（Stripe Payment Link・可変金額・100円以上） */

import { RAKUDA_SUPPORT_GATE_LABEL } from './rakudaSupportGateLabels';

/** 本番で UI を出す: `VITE_DONATION_ENABLED=1` */
export function isDonationEnabled(): boolean {
  return String(import.meta.env.VITE_DONATION_ENABLED ?? '').trim() === '1';
}

/** Stripe Payment Link（ダッシュボードで「金額を顧客が決める」・下限100円） */
export function getDonationPaymentLink(): string {
  return String(import.meta.env.VITE_STRIPE_DONATION_PAYMENT_LINK ?? '').trim();
}

export function isDonationUiReady(): boolean {
  return isDonationEnabled() && getDonationPaymentLink().startsWith('https://');
}

/** Payment Link の成功 URL: `https://rakuda.coffee/?donation=thanks` */
export const DONATION_RETURN_QUERY = 'donation';

export const DONATION_COPY = {
  title: '🧡 特別寄付（任意）',
  body: `金額は自由です（100円以上）。らくだ珈琲への応援です。
${RAKUDA_SUPPORT_GATE_LABEL}（月額・広告なし）とは別。特典はありません。
決済は Stripe が処理します。`,
  button: '特別寄付する（金額は自由）',
  thanksTitle: '特別寄付ありがとうございます',
  thanksBody: `いただいた応援は、らくだ珈琲を続け・育てるために使わせていただきます。`,
  thanksClose: 'とじる',
} as const;

/** プライバシーポリシー追記（特別寄付 ON 時の説明） */
export const DONATION_PRIVACY_APPEND = `

【特別寄付（任意）】
- 金額はご自身で決めていただく、任意の一回払いです（100円以上・Stripe Payment Link）。
- 寄付いただいても広告の出方やゲートは変わりません。寄付者一覧等は表示しません。
- ${RAKUDA_SUPPORT_GATE_LABEL}（月額・広告なし）とは別の仕組みです。
- カード情報等は Stripe が処理し、らくだ珈琲のサーバーには保存しません。
`;
