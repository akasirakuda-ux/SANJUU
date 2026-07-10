/** らくだ応援ゲート — 月500円（暦1か月）・Stripe Checkout 連携。無料＝広告あり。応援＝広告なし。 */

import {
  RAKUDA_DEFAULT_PLAY_LABEL,
  RAKUDA_SUPPORT_GATE_LABEL,
} from '../constants/rakudaSupportGateLabels';

export const GREEN_GATE_PERIOD_MONTHS = 1;
export const GREEN_GATE_MONTHLY_YEN = 500;

/** 1請求期間の税込（暦1か月＝月額と同額） */
export const GREEN_GATE_PERIOD_YEN = GREEN_GATE_MONTHLY_YEN;

export const GREEN_GATE_PRICE_LABEL = `${GREEN_GATE_MONTHLY_YEN}円（税込）／月`;

/**
 * 新規の緑ゲート入口を一時閉鎖（2026-06-08 らくださん判断）。
 * 再開: ビルド env `VITE_GREEN_GATE_ENTRANCE_CLOSED=0` ＋ API env 同値。
 * 既存契約・感謝パス・解約ポータルは継続。
 */
export function isGreenGateEntranceClosed(): boolean {
  return String(import.meta.env.VITE_GREEN_GATE_ENTRANCE_CLOSED ?? '1').trim() !== '0';
}

export const GREEN_GATE_ENTRANCE_CLOSED_TITLE = `☕ ${RAKUDA_SUPPORT_GATE_LABEL} — 新規お休み`;

export const GREEN_GATE_ENTRANCE_CLOSED_BODY = `いま、${RAKUDA_SUPPORT_GATE_LABEL}の新規お申し込みはお休みしています。

${RAKUDA_DEFAULT_PLAY_LABEL}で、これまでどおり遊べます。
すでに応援ゲートが有効な方は、これまでどおりお使いいただけます。

特別寄付（任意）がある場合は、応援ゲートとは別の入口です。`;

/** 申込確認モーダル — 決済 ON */
export const GREEN_GATE_PITCH_BODY = `らくだ珈琲への応援です。
広告なしで遊べます。応援は、サイトを続け・育てる力になります。
無理は不要。${RAKUDA_DEFAULT_PLAY_LABEL}のままで大丈夫です。

・${GREEN_GATE_PRICE_LABEL}（暦1か月ごとに自動更新）
・期間終了前に解約可（設定→Stripe）`;

/** 決済接続前 */
export const GREEN_GATE_PITCH_BODY_PENDING = `らくだ珈琲への応援です（準備中）。
広告なし・サイトを育てる応援。無理は不要。${RAKUDA_DEFAULT_PLAY_LABEL}のままで大丈夫です。

・${GREEN_GATE_PRICE_LABEL}（暦1か月ごと）
決済の接続が整い次第、設定からお申し込みいただけます。`;

/** 開発用 */
export const GREEN_GATE_PITCH_BODY_DEV = `【開発用】${GREEN_GATE_PRICE_LABEL}・広告なし・暦1か月。
ローカルでは決済なしで試せます。`;

/** 本番ビルドで `VITE_STRIPE_GREEN_GATE_ENABLED=1` のときだけ決済 UI を出す */
export function isGreenGateStripeEnabled(): boolean {
  return String(import.meta.env.VITE_STRIPE_GREEN_GATE_ENABLED ?? '').trim() === '1';
}

/** 利用者向け・解約手順（設定・規約・申込画面で共通） */
export const GREEN_GATE_CANCEL_STEPS_JA = [
  '画面の歯車（設定）を開く',
  `「Google でログイン」— ${RAKUDA_SUPPORT_GATE_LABEL}を申し込んだときと同じアカウントを選ぶ`,
  '「解約・カード変更（Stripe）」ボタンを押す',
  'Stripe の画面で「サブスクリプションをキャンセル」→「期間終了時にキャンセル」を選ぶ',
] as const;

export const GREEN_GATE_CANCEL_NOTE_JA =
  '解約しても、すでに払った期間までは広告なしで使えます。運営への連絡は不要です。';

/** 緑ゲート決済 ON 時にプライバシーへ追記（`legal.ts`） */
export const GREEN_GATE_PRIVACY_APPEND = `

【有料プラン（${RAKUDA_SUPPORT_GATE_LABEL}・月額）】
- ${GREEN_GATE_PRICE_LABEL}のサブスクリプションです。暦1か月ごとに自動更新されます（解約するまで）。
- 決済は Stripe が代行します。カード番号等は Stripe が処理し、らくだ珈琲のサーバーには保存しません。
- 解約は次の手順で、利用者ご自身でいつでもできます（運営への連絡は不要です）。
  ① 設定（歯車）を開く
  ② ${RAKUDA_SUPPORT_GATE_LABEL}を申し込んだ Google アカウントでログイン
  ③「解約・カード変更（Stripe）」→ Stripe で「期間終了時にキャンセル」
`;
