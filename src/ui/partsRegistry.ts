/**
 * らくだ基準 UI — 番号カタログ（RK-01 …）
 *
 * Cursor 等が作った画面のパーツを、番号で指して `baselineParts.tsx` に置き換える。
 * 一覧・判断: `src/ui/baseline.md`
 */

export type RakudaBaselinePartId =
  | 'RK-01'
  | 'RK-02'
  | 'RK-03'
  | 'RK-04'
  | 'RK-05'
  | 'RK-06'
  | 'RK-07'
  | 'RK-08'
  | 'RK-09'
  | 'RK-10'
  | 'RK-11'
  | 'RK-12'
  | 'RK-13'
  | 'RK-14'
  | 'RK-15'
  | 'RK-16'
  | 'RK-17'
  | 'RK-18'
  | 'RK-19';

export type RakudaBaselinePartKind = 'component' | 'layout' | 'reference';

export type RakudaBaselineSizeVariant = 'half-w' | 'half-h';

export interface RakudaBaselinePartMeta {
  id: RakudaBaselinePartId;
  /** カタログ・コメント用の短い名前 */
  labelJa: string;
  kind: RakudaBaselinePartKind;
  /** 置き換え先（React コンポーネント名 or 既存レイアウト） */
  replaceWith: string;
  /** policy.ts の定数キー（トークン由来のもの） */
  policyKey?: string;
  /** 使う画面パターン */
  pattern: 'hub' | 'immersive' | 'modal' | 'any';
  /** 半幅 / 半高（RK-11 以降） */
  sizeVariant?: RakudaBaselineSizeVariant;
  /** 元になった標準部品 */
  basedOn?: RakudaBaselinePartId;
  /** 1 行メモ */
  note: string;
}

export const RK_BASELINE_PARTS: readonly RakudaBaselinePartMeta[] = [
  {
    id: 'RK-01',
    labelJa: 'ハブ・メニュー行',
    kind: 'component',
    replaceWith: 'RK01HubMenuRow',
    policyKey: 'hubMenuBtn',
    pattern: 'hub',
    note: 'トップメニュー 1 行。グラデ・枠色だけ画面テーマで足す',
  },
  {
    id: 'RK-02',
    labelJa: '主 CTA（タッチ）',
    kind: 'component',
    replaceWith: 'RK02PrimaryTouchButton',
    policyKey: 'btnPrimaryTouch',
    pattern: 'any',
    note: 'ミニゲーム・モーダルの主ボタン。min-h-12',
  },
  {
    id: 'RK-03',
    labelJa: '副 CTA（ゴースト）',
    kind: 'component',
    replaceWith: 'RK03GhostTouchButton',
    policyKey: 'btnGhostTouch',
    pattern: 'any',
    note: '副操作・キャンセル系',
  },
  {
    id: 'RK-04',
    labelJa: 'ホーム戻る（スキュア）',
    kind: 'component',
    replaceWith: 'RK04HomeBackButton',
    policyKey: 'homeSquircleSize',
    pattern: 'immersive',
    note: '没入画面左上。独自の戻る形は作らない',
  },
  {
    id: 'RK-05',
    labelJa: '没入画面シェル',
    kind: 'layout',
    replaceWith: 'RK05ImmersiveScreen',
    policyKey: 'immersiveScreenShell',
    pattern: 'immersive',
    note: 'safe-area 込み外枠。背景グラデは themeClassName',
  },
  {
    id: 'RK-06',
    labelJa: '没入ヘッダ（三行＋戻る）',
    kind: 'component',
    replaceWith: 'RK06ImmersiveHeader',
    pattern: 'immersive',
    note: '「らくだ珈琲 / タイトル / 補足」＋ RK-04',
  },
  {
    id: 'RK-07',
    labelJa: 'カード面',
    kind: 'component',
    replaceWith: 'RK07Card',
    policyKey: 'cardClass',
    pattern: 'modal',
    note: '連絡帳・説明・モーダル内の面',
  },
  {
    id: 'RK-08',
    labelJa: 'バッジ',
    kind: 'component',
    replaceWith: 'RK08Badge',
    policyKey: 'badgeClass',
    pattern: 'any',
    note: '状態ラベル・小さなタグ',
  },
  {
    id: 'RK-09',
    labelJa: 'モード入口レイアウト',
    kind: 'reference',
    replaceWith: 'ModeEntryLayout',
    pattern: 'hub',
    note: 'ハブ・ことば探し入口。hubScroll / absolute を選ぶ',
  },
  {
    id: 'RK-10',
    labelJa: 'コンテンツ幅ラッパ',
    kind: 'layout',
    replaceWith: 'RK10ContentColumn',
    policyKey: 'immersiveContentWidth',
    pattern: 'any',
    note: 'max-w-md 中央列',
  },
  {
    id: 'RK-11',
    labelJa: '主 CTA・半幅',
    kind: 'component',
    replaceWith: 'RK11PrimaryTouchButtonHalfW',
    policyKey: 'btnPrimaryTouchHalfW',
    pattern: 'any',
    sizeVariant: 'half-w',
    basedOn: 'RK-02',
    note: '2 列並び用。高さは RK-02 と同じ 48px',
  },
  {
    id: 'RK-12',
    labelJa: '主 CTA・半高',
    kind: 'component',
    replaceWith: 'RK12PrimaryTouchButtonHalfH',
    policyKey: 'btnPrimaryTouchHalfH',
    pattern: 'any',
    sizeVariant: 'half-h',
    basedOn: 'RK-02',
    note: 'min-h-6（24px）。補助操作・行内ボタン',
  },
  {
    id: 'RK-13',
    labelJa: '副 CTA・半幅',
    kind: 'component',
    replaceWith: 'RK13GhostTouchButtonHalfW',
    policyKey: 'btnGhostTouchHalfW',
    pattern: 'any',
    sizeVariant: 'half-w',
    basedOn: 'RK-03',
    note: 'RK-11 とペアで grid 2 列',
  },
  {
    id: 'RK-14',
    labelJa: '副 CTA・半高',
    kind: 'component',
    replaceWith: 'RK14GhostTouchButtonHalfH',
    policyKey: 'btnGhostTouchHalfH',
    pattern: 'any',
    sizeVariant: 'half-h',
    basedOn: 'RK-03',
    note: 'RK-12 のゴースト版',
  },
  {
    id: 'RK-15',
    labelJa: 'ハブメニュー・半幅',
    kind: 'component',
    replaceWith: 'RK15HubMenuRowHalfW',
    policyKey: 'hubMenuBtnHalfW',
    pattern: 'hub',
    sizeVariant: 'half-w',
    basedOn: 'RK-01',
    note: '横 2 列メニュー。flex + gap で並べる',
  },
  {
    id: 'RK-16',
    labelJa: 'ハブメニュー・半高',
    kind: 'component',
    replaceWith: 'RK16HubMenuRowHalfH',
    policyKey: 'hubMenuBtnHalfH',
    pattern: 'hub',
    sizeVariant: 'half-h',
    basedOn: 'RK-01',
    note: 'min-h-[26px]。コンパクトなサブメニュー',
  },
  {
    id: 'RK-17',
    labelJa: 'コンテンツ列・半幅',
    kind: 'layout',
    replaceWith: 'RK17ContentColumnHalfW',
    policyKey: 'immersiveContentHalfWidth',
    pattern: 'any',
    sizeVariant: 'half-w',
    basedOn: 'RK-10',
    note: 'max-w-md の半分。2 カラムレイアウト',
  },
  {
    id: 'RK-18',
    labelJa: 'ホーム戻る・半サイズ',
    kind: 'component',
    replaceWith: 'RK18HomeBackButtonHalf',
    policyKey: 'homeSquircleHalfSize',
    pattern: 'immersive',
    sizeVariant: 'half-h',
    basedOn: 'RK-04',
    note: '縦横半分。コンパクトヘッダ向け',
  },
  {
    id: 'RK-19',
    labelJa: 'しずかの間・戻る',
    kind: 'component',
    replaceWith: 'RK19QuietRoomBackButton',
    policyKey: 'quietRoomBackBtn',
    pattern: 'immersive',
    note: 'しずかの間左上。白角丸 48px + ChevronLeft。RK-04（水色スキュア）とは別',
  },
] as const;

const byId = new Map(RK_BASELINE_PARTS.map((p) => [p.id, p]));

export function getBaselinePart(id: RakudaBaselinePartId): RakudaBaselinePartMeta {
  const part = byId.get(id);
  if (!part) throw new Error(`Unknown baseline part: ${id}`);
  return part;
}

export function listBaselineParts(): readonly RakudaBaselinePartMeta[] {
  return RK_BASELINE_PARTS;
}
