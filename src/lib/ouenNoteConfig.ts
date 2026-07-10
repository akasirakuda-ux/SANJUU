/** ちょっと誰かに聞いて欲しい人のためのノート */

export const OUEN_NOTE_TITLE = 'ちょっと誰かに聞いて欲しい人のためのノート';

export const OUEN_NOTE_COLLECTION = 'ouen_note_topics';

/** 入場目安 — しゅっせき簿の「出席した日」がこの数以上 */
export const OUEN_NOTE_MIN_STAMPS = 30;

/** false のときハブのテーブルは案内ポップアップのみ（入れない） */
export const OUEN_NOTE_HUB_LIVE = true;

/** true のときハブに「テスト中」バッジ＋入る前の案内ポップアップ（試験公開） */
export const OUEN_NOTE_HUB_TESTING = true;

/** 旧単一 textarea 上限（互換） */
export const OUEN_NOTE_TOPIC_MAX_CHARS = 1800;

export const OUEN_NOTE_COMMENT_MAX_CHARS = 200;

/** 項目別上限 */
export const OUEN_NOTE_FIELD_LIMITS = {
  title: 60,
  consultantProfile: 80,
  goal: 200,
  situation: 400,
  feelings: 300,
  triedResearch: 300,
  postNick: 32,
  postEmoji: 8,
} as const;

/** 相談者プロフィール（自分用・下書き）各項目 */
export const OUEN_NOTE_PROFILE_FIELD_LIMITS = {
  ageText: 40,
  genderText: 40,
  occupationText: 40,
} as const;

export const OUEN_NOTE_PROFILE_COLLECTION = 'ouen_note_profiles';

export const OUEN_NOTE_PROFILE_GUIDANCE =
  '自分だけが見える下書きです。相談を書くとき「項目2」に入れられます。書きたくない項目は空でOKです。';

export const OUEN_NOTE_RESPECT_MESSAGE =
  '「みんな違ってみんないい」の気持ちを大切に、相手を尊重しましょう。正解を押し付けず、聞く・寄り添う返信を。';

export const OUEN_NOTE_FORM_INTRO =
  '6つの項目は、全部埋めなくて大丈夫です。タイトルと、書けるところからでOKです。';

export const OUEN_NOTE_GATE_INTRO =
  'しゅっせき簿30日以上の方へ。らくだの空気を知っている人の、静かな置き場です。';

/** 入場条件（30日）の意味 — 画面に表示 */
export const OUEN_NOTE_GATE_WHY_STAMPS = `しゅっせき簿の「出席した日」が${OUEN_NOTE_MIN_STAMPS}日以上の方を想定しています。

これは順位や実力の話ではありません。「らくだ珈琲の静かな空気」「煽らない・急がせない」を、少しずつ知ってきた方同士の場所にしたいからです。連絡帳や募集掲示板とは別の、聞いてほしいことを置くノートです。`;

/** 世界観 — この場の約束 */
export const OUEN_NOTE_WORLDVIEW = `・子どもも大人も、主役として大切にします
・正解や速さを競いません。誰かを負かす場所ではありません
・返信は「聞いたよ」「一緒に考えよう」くらいの温度で。アドバイス競争にしません
・ランキングやいいね数で焦らせません
・${OUEN_NOTE_RESPECT_MESSAGE}`;

export const OUEN_NOTE_POSTING_NOTICE =
  '本名・電話・住所・SNSの連絡先は書かないでください。他の利用者の悪口や晒しもやめてください。やさしい言葉で、らくだの空気に合うように。';

/** 閲覧範囲・管理者対応 — 説明欄 */
export const OUEN_NOTE_MODERATION_NOTICE = `ここに書かれたことは利用者に見られます。
管理者の判断で投稿の削除、ブロック（らくだ珈琲🐫☕サイトへ出入り禁止）をすることがあります。`;

/** 表示名について — ノート用呼び名 */
export const OUEN_NOTE_NAME_GUIDANCE = `このノートだけの絵文字・ニックネームを、投稿のたびに選べます（ゲーム本体の名前は変わりません）。

本名や連絡先は書かないでください。`;
