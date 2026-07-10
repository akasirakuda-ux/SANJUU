/** AdSense サイト（pub-7642612812471632）向けプライバシー追記 */

import { RAKUDA_SUPPORT_GATE_LABEL } from './rakudaSupportGateLabels';

export const ADSENSE_PRIVACY_APPEND = `

【Google AdSense（サイト内広告）】
- 当サイト（https://rakuda.coffee/）では Google AdSense を利用して広告を配信する場合があります。
- Google および第三者の配信事業者は Cookie 等を使用し、過去のアクセス情報に基づく広告を表示することがあります。
- 広告はゲームプレイの区切り（1問クリア後・対戦終了時など）に表示します。メニュー・待機・ゲート選択など、遊びの本体がない画面には広告を配置しません。プレイ中に画面端へ固定表示するバナー広告は使用しません。
- ${RAKUDA_SUPPORT_GATE_LABEL}ご契約中は広告を表示しません。
- パーソナライズド広告のオプトアウト: https://www.google.com/settings/ads
- Google の広告に関するポリシー: https://policies.google.com/technologies/ads
`;
