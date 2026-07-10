# らくだ珈琲 — 番号付き基準 UI

**一枚絵（静的）**: [`rakuda-ui-baseline-reference.png`](./rakuda-ui-baseline-reference.png)

**目で見て選ぶカタログ（実物プレビュー）**: ブラウザで **`/#ui-catalog`** を開く（例: 開発中 `http://localhost:5173/#ui-catalog`）。RK 番号をタップして選び、コピーアイコンで Cursor に渡せます。

## イメージ（らくださんの持ち方）

```
Cursor が画面を作る
    ↓
「この部分は RK-02」「ヘッダは RK-06」… と番号で指す
    ↓
`baselineParts.tsx` の部品に置き換える
    ↓
見た目・触覚・余白が baseline に揃う
```

**自由配置の D&D ビルダーではなく**、「既にある部品番号への差し替え」が中心です。

---

## 番号カタログ

| 番号 | 名前 | コンポーネント | 主な用途 |
|------|------|----------------|----------|
| **RK-01** | ハブ・メニュー行 | `RK01HubMenuRow` | トップメニュー 1 行 |
| **RK-02** | 主 CTA（タッチ） | `RK02PrimaryTouchButton` | 決定・もう一局 |
| **RK-03** | 副 CTA（ゴースト） | `RK03GhostTouchButton` | 戻る・選び直す |
| **RK-04** | ホーム戻る | `RK04HomeBackButton` | 没入画面左上 |
| **RK-05** | 没入画面シェル | `RK05ImmersiveScreen` | ミニゲーム外枠 |
| **RK-06** | 没入ヘッダ | `RK06ImmersiveHeader` | 三行＋ RK-04 |
| **RK-07** | カード面 | `RK07Card` | モーダル・連絡帳 |
| **RK-08** | バッジ | `RK08Badge` | 状態ラベル |
| **RK-09** | モード入口 | `ModeEntryLayout` | ハブ・ことば入口（参照） |
| **RK-10** | コンテンツ幅 | `RK10ContentColumn` | max-w-md 列 |

### 半幅 / 半高（標準の 50% サイズ）

| 番号 | 名前 | コンポーネント | 元 | 用途 |
|------|------|----------------|-----|------|
| **RK-11** | 主 CTA・半幅 | `RK11PrimaryTouchButtonHalfW` | RK-02 | 2 列並び（高さ 48px のまま） |
| **RK-12** | 主 CTA・半高 | `RK12PrimaryTouchButtonHalfH` | RK-02 | 行内・補助（24px） |
| **RK-13** | 副 CTA・半幅 | `RK13GhostTouchButtonHalfW` | RK-03 | RK-11 とペア |
| **RK-14** | 副 CTA・半高 | `RK14GhostTouchButtonHalfH` | RK-03 | RK-12 のゴースト版 |
| **RK-15** | ハブメニュー・半幅 | `RK15HubMenuRowHalfW` | RK-01 | 横 2 列メニュー |
| **RK-16** | ハブメニュー・半高 | `RK16HubMenuRowHalfH` | RK-01 | コンパクト行（26px） |
| **RK-17** | コンテンツ列・半幅 | `RK17ContentColumnHalfW` | RK-10 | 2 カラム |
| **RK-18** | ホーム戻る・半サイズ | `RK18HomeBackButtonHalf` | RK-04 | コンパクトヘッダ |

カタログの **「半幅」「半高」** フィルタでまとめて見られます。

メタデータ（機械可読）: `partsRegistry.ts`

---

## 置き換えのしかた

### 1. Cursor に依頼するとき

> 「この画面、ボタンは RK-02/RK-03、ヘッダは RK-06、外枠 RK-05 で組み直して」

のように **番号で指定** するとブレにくい。

### 2. コード上

```tsx
import {
  RK02PrimaryTouchButton,
  RK05ImmersiveScreen,
  RK06ImmersiveHeader,
} from '../ui/baselineParts';

// was: 独自の div + button ヘッダ
<RK05ImmersiveScreen themeClassName="bg-gradient-to-b from-rk-success-100 via-rk-white to-rk-success-100 text-rk-slate-800">
  <RK06ImmersiveHeader
    title="オセロ"
    subtitle="CPU ふつう · あなたは黒（先手）"
    kickerClassName="text-rk-success-900/75"
    titleClassName="text-rk-success-950"
    subtitleClassName="text-rk-success-900/70"
    onBack={handleBack}
  />
  …
  <RK02PrimaryTouchButton onClick={resetGame}>もう一局</RK02PrimaryTouchButton>
</RK05ImmersiveScreen>
```

- **テーマ色**（グラデ・`text-rk-*`）だけ画面ごとに変える
- **形・高さ・余白**は RK 側に任せる

### 3. 新しい部品が必要なとき

1. `partsRegistry.ts` に **RK-11** を追加
2. `baselineParts.tsx` にコンポーネントを追加
3. この表と一枚絵を更新

---

## レイヤの役割

| ファイル | 役割 |
|----------|------|
| `partsRegistry.ts` | 番号・名前・置き換え先の一覧 |
| `baselineParts.tsx` | 番号付き React 部品（置き換え先） |
| `policy.ts` | Tailwind クラス定数（部品の中身） |
| `index.css` | 色 `--rk-*` |
| `rakuda-ui-spine.md` | 三十との色対応 |

---

## 設計原則（短く）

1. **子どもが主役** — RK 未登録の小さなボタンを増やさない  
2. **48px+** — RK-02/03/01 はタップ高さ込み  
3. **3GB** — 部品は軽量。アニメは画面側で最小限  
4. **番号が無いなら追加** — コピペで増やさない  

---

## 参照実装

| 画面 | 使っている RK |
|------|----------------|
| `SeatSelection.tsx` | RK-01（今後 `RK01HubMenuRow` に寄せ可） |
| `OthelloGame.tsx` / `SlidePuzzleGame.tsx` | RK-05, RK-06, RK-02, RK-03, RK-04 |

---

*Cursor / 豆向け: 画面 PR では「RK-xx に置換済み」を触ったファイル一覧と一緒に書く。*
