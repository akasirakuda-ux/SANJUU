import { ADSENSE_PRIVACY_APPEND } from './adsensePrivacy';
import { DONATION_PRIVACY_APPEND } from './donationConfig';
import {
  GREEN_GATE_CANCEL_STEPS_JA,
  GREEN_GATE_PERIOD_MONTHS,
  GREEN_GATE_PRICE_LABEL,
  GREEN_GATE_PRIVACY_APPEND,
} from '../lib/greenGateStripeConfig';
import { RAKUDA_SUPPORT_GATE_LABEL } from '../constants/rakudaSupportGateLabels';
import { PARENT_REASSURANCE } from './parentReassurance';

const TOKUSHOHO_CANCEL_STEPS = GREEN_GATE_CANCEL_STEPS_JA.map((step, i) => `${i + 1}. ${step}`).join('\n');

export const LEGAL_TEXTS = {
  ja: {
    terms: {
      title: "利用規約",
      content: `
本アプリ「らくだ珈琲🐫☕（ことば探しPRO）」をご利用いただくためのルールです。

【禁止事項】
- 不正アクセス、解析・改変、チート等の不正行為
- 他の利用者の迷惑となる行為

【免責】
本アプリの利用により生じた損害について、運営者は責任を負いません。

【変更】
本規約は予告なく変更される場合があります。

運営者：らくだ珈琲
連絡先：akasirakuda@gmail.com

【有料プラン（${RAKUDA_SUPPORT_GATE_LABEL}）】
${GREEN_GATE_PRICE_LABEL}のサブスクリプション（広告なし）です。暦${GREEN_GATE_PERIOD_MONTHS}か月ごとに自動更新されます。決済は Stripe 経由です。

【解約方法（利用者ご自身で可能・運営への連絡不要）】
① 設定（歯車）を開く
② ${RAKUDA_SUPPORT_GATE_LABEL}を申し込んだ Google アカウントでログイン
③「解約・カード変更（Stripe）」ボタンを押す
④ Stripe の画面で「サブスクリプションをキャンセル」→「期間終了時にキャンセル」を選ぶ
解約後も、すでにお支払い済みの期間までは広告なしでご利用いただけます。
      `
    },
    privacy: {
      title: "プライバシーポリシー",
      content: `
【収集する情報】
- 端末内に保存される自動生成ID（プレイデータ保存のため）
- オンライン（Googleログイン）利用時の Firebase UID（端末間同期のため）

【利用目的】
- ゲームの進行状況の保存・同期
- 利用状況の分析（サービス改善）

【アクセス解析】
- Google Analytics 4（GA4）を利用します（Cookie等を使用する場合があります）

【広告】
- リワード広告等の「見飛ばしにくい形式」を、ゲームの区切りのよいタイミング（所定時間経過後）で表示する場合があります。プレイ中に固定のバナー広告は表示しません。

【第三者提供】
法令に基づく場合を除き、取得した情報を第三者に提供しません。

お問い合わせ：akasirakuda@gmail.com
      `.trim() + PARENT_REASSURANCE.privacyAppend + ADSENSE_PRIVACY_APPEND + DONATION_PRIVACY_APPEND + GREEN_GATE_PRIVACY_APPEND,
    },
    contact: {
      title: "お問い合わせ",
      content: `
ご意見・ご要望・不具合の報告はこちらへお願いします。

メール：akasirakuda@gmail.com

【${RAKUDA_SUPPORT_GATE_LABEL}（${GREEN_GATE_PRICE_LABEL}）の解約】
解約は利用者ご自身でできます。運営に連絡する必要はありません。
設定（歯車）→ Google ログイン（申込時と同じアカウント）→「解約・カード変更（Stripe）」

※返信にお時間をいただく場合があります。
      `
    },
    tokushoho: {
      title: "特定商取引法に基づく表記",
      content: `
【販売業者】
らくだ珈琲

【運営責任者】
らくだ

【所在地】
請求があり次第、遅滞なく開示いたします。

【電話番号】
お問い合わせメールアドレス（下記）にご連絡いただければ、遅滞なく開示いたします。

【メールアドレス】
akasirakuda@gmail.com

【販売URL】
https://rakuda.coffee/

【販売価格】
・${RAKUDA_SUPPORT_GATE_LABEL}：${GREEN_GATE_PRICE_LABEL}
・特別寄付（任意）：100円以上、金額はお客様が指定（税込）

【商品代金以外の必要料金】
インターネット接続にかかる通信料は、お客様の負担となります。

【支払方法】
クレジットカード等（Stripe 経由）

【支払時期】
・${RAKUDA_SUPPORT_GATE_LABEL}：お申し込み時に初回分を決済し、以降は暦${GREEN_GATE_PERIOD_MONTHS}か月ごとに自動更新されます。
・特別寄付：決済時に即時お支払いとなります。

【商品の引渡し時期】
決済完了後、直ちにご利用いただけます（デジタルサービスの提供）。

【返品・キャンセル・解約】
・${RAKUDA_SUPPORT_GATE_LABEL}：利用者ご自身で解約できます（運営への連絡は不要です）。
${TOKUSHOHO_CANCEL_STEPS}
解約後も、すでにお支払い済みの期間までは広告なしでご利用いただけます。日割り返金は行いません。
・特別寄付：任意の寄付のため、決済完了後の返品・返金はお受けできません。

【動作環境】
インターネットに接続できるスマートフォン・タブレット・PC の Web ブラウザ。
      `.trim(),
    },
  }
};
