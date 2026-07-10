# らくだ珈琲 UI 背骨（RK トーン）— 三十 × らくだ本体 共有メモ

**目的**: 入口は `https://rakuda.coffee/` に一本化しつつ、三十だけ別ブランドに見えない。README は増やさず、この1ファイルに寄せる。

**コンポーネント・ボタン・没入画面のレイアウト基準（人間向け）**: `src/ui/baseline.md`（コード定数は `src/ui/policy.ts`）。

**らくだ本体のプロダクト約束（3GB 級・共通プロフィール・入口一本化・ミニゲーム拡張）**: `src/lib/rakudaHubShell.ts` モジュール先頭コメントを正とする（**公開 URL は周知済みのため変更しない**）。しゅっせき・スタンプ・基本 UI（RK トークン）・没入ポリシー・連絡帳（伝言・掲示 TTL・管理者・表示可否・投稿バリデーション）・インタースティシャル・Google セッション復帰・全体トースト / ログイン表示文言の import 窓口も同ファイルに寄せる。

**同日リリース（三十 × らくだ）**: 三十（Cloud Run 等）を先に本番反映して URL を確定 → `.env.production` の `VITE_SANJUU_*` を合わせる → らくだで `pnpm run build` → `pnpm run deploy:hosting:with-rules` または `deploy:hosting`。作業ツリーは **コミット済みのスナップショット**を本番の正にする（未コミット大量のまま載せない）。詳細は `.cursor/rules/hosting-verify-deploy.mdc`。

---

## 1. RK トーンに寄せたいルート（三十 / Next）

現リポジトリ構成ベース。今後 `.sj-rk-theme`（または同等）を振る対象の目安。

| パス | 備考 |
|------|------|
| `/sanjuu` | 三十ハブ |
| `/sanjuu/bulletin` | 掲示板系 |
| `/sanjuu/recruit-board` | 募集ボード |
| `/sanjuu/recruit-lobby` | ロビー |
| `/play` | らくだ側プレイ連携 |
| `/r/[roomId]` | ルーム参加 |

**整理ポイント**: `globals.css` のデフォルト（明／暗の `--background` / `--foreground`）と RK クリーム系が混ざらないよう、**上記は常に RK ラッパークラス配下**に寄せる。

---

## 2. 三十側 CSS の現状（このリポジトリ時点）

- **`src/app/globals.css`**: 非 RK ルート向け（`:root` の `--background` / `--foreground`、`.sanjuuBrand` は従来どおり）。
- **`src/app/sanjuu/sanjuu-rk-theme.css`**: `.sj-rk-theme` 配下の **`--sj-rk-*`**（らくだ本体 `--rk-*` と同値・同意味）。
- **適用ルート**: `app/sanjuu/layout.tsx`・`app/play/layout.tsx`・`app/r/layout.tsx` で `.sj-rk-theme` をラップ。三十ハブ・900マス・ルーム参加が RK トーンになる。
- **ハブ内の見出し色**: `.sj-rk-theme .sanjuuBrand` で暖色（`--sj-rk-accent-warm`）に上書き。

---

## 3. らくだ本体（Vite）側の事実

| 区分 | 実装の所在 | 値・クラス（代表） |
|------|------------|-------------------|
| メインシェル背景 | `src/components/AppLayout.tsx` | `bg-rk-shell`、`max-w-screen-xl`、`text-rk-fg`、`font-rounded`（値は `:root` の `--rk-*`） |
| `html` / `body` 背景 | `src/index.css` | `body { background-color: var(--rk-bg-page); }` |
| フォント | `src/index.css` `@theme` | `--font-rounded`: M PLUS Rounded 1c；`--font-kiwi`: Kiwi Maru |
| 角丸・余白トークン | `src/index.css` `:root` / `@theme` | `--radius-standard: 0.75rem`、`--padding-s|m|l` |
| ひらめきルーム系 | `src/index.css` `:root` / `@theme` | **`--rk-rest-bg`** / **`--rk-rest-accent`**。**`QuietRoom` / `WorldsWish`（`quiet` 背景パーティクル＋外枠・タイトル縁は rest／紫系）/ `RakudaFloatingBackdrop` `quiet` / `SeatSelection`（しずかの間・みんなの願いボタンの枠）**で使用（詳細は各ファイル） |
| 緑アクセント（設定・トグル等） | `src/components/SettingsModal.tsx` 等 | `var(--rk-accent-primary)` / `bg-rk-primary`（`#00c874` は `:root` のみ）。Canvas は `rkResolvedAccentPrimary()` |
| 成功フラッシュ（アニメ） | `index.css` `.animate-soft-flash` | `soft-success-flash` のピーク色は `color-mix(in srgb, var(--rk-success-400) 15%, transparent)` |
| ひらめきルームの泡 | `index.css` `.bubble` | 地色は `color-mix(in srgb, var(--rk-white) 20%, transparent)` |
| WebKit スクロールバー | `index.css` | `.custom-scrollbar`／`.custom-scrollbar-white` — WebKit 疑似要素に加え **`scrollbar-width: thin`** と **`scrollbar-color`**（Firefox） |
| 警告・禁止 | 各所 | `red-600` / `red-50` レイなど |
| 下部余白（旧バナー用 CSS 変数） | （バナー廃止）`--rk-bottom-banner` は未設定時 `0px`。レイアウトは `var(..., 0px)` で互換 |
| ハブ・連絡帳の木／羊皮 | `SeatSelection`・`SelectScreen`・`Renrakucho/*` | `--rk-hub-rose-panel` / `--rk-hub-bark` / `--rk-hub-parchment-screen` など（`rkResolvedHubBark()` が `:root` を解決。未適用時フォールバックは `rgb()`） |
| ゲーム羊皮グラデ・PRO スクリム・戻るスキュア | `GameScreen`・`SelectScreen`・`RakudaHomeSquircleButton` | `--rk-game-parchment-*` / `--rk-unlock-scrim` / `--rk-hub-squircle` |
| 単独プレイ・ゲームシェル縦グラデ | `GameScreen`（loading / メインラッパ） | `--rk-game-solo-shell-gradient`・ユーティリティ `.rk-bg-game-solo-shell` |
| ハブ QR 小豆・しゅっせき簿段階緑 | `SeatSelection`（QR）・`StampCard` | `--rk-hub-qr-azuki` / `--rk-stamp-tier-green`（Canvas 色は `rkCssColor` で1フレーム1回だけ読む） |
| 白・Kotoba ロゴ帯 | 盤面 Canvas・QR light・`KotobaLogo` / `IconPreview`・**各画面の白い面** | `--rk-white`（コンポーネントは `bg-rk-white` / `text-rk-white` / `border-rk-white`、グラデ止め色は `to-rk-white` 等。素の Tailwind `white` は使わない） / `--rk-logo-band-*` |
| ピュア黒 | `AppLayout`（全面広告スクリム）・`SelectScreen`・`ModeEntryLayout`・`QuietRoom`（グラデ端）・`AdminScreen`（`ring-rk-black/10`） | `--rk-black`（`bg-rk-black` / `text-rk-black` / `border-rk-black/5` / `from-rk-black` / `to-rk-black` / `ring-rk-black/*`。素の Tailwind `black` は使わない） |
| マルチ帯・盤面縁取り | `useGame`（割当）・`GameScreen`（粒子） | `--rk-band-0`〜`9`（canvas は `rkResolvedBandColor(i)`・未適用時は同順の `rgb()` フォールバック）、`--rk-board-glyph-stroke-*` |
| カード／フッタのソフト影 | `SelectScreen`・`PostScreen`・`Renrakucho` | `--rk-shadow-unlock-buy` / `--rk-shadow-soft-plate` / `--rk-shadow-elev-*` / `--rk-shadow-footer-*` |
| 飛び出しタイトル（ラストワン／クリア） | `GameScreen` | `--rk-fly-title-stroke` / `--rk-fly-title-text-shadow`（測定用 style と実表示で同一） |
| モード入口の大見出しの影 | `ModeEntryLayout` | `filter: drop-shadow(var(--rk-title-drop-shadow))` |
| 起動失敗オーバーレイ・初回読み込み | `main.tsx` | `--rk-boot-overlay-bg` / `--rk-boot-fatal-accent` / `--rk-boot-fatal-stack-bg` / `--rk-boot-loading-fg`（`--rk-white` は再読み込みボタン文字） |

---

## 4. セマンティック名の対応表（三十 × Vite）— **ここを育てる**

**方針**: 両方とも最終的には **同じ「意味」の1行を参照**する。三十は `--sj-rk-*` または共有名 `--rk-*` に寄せ、Vite は `src/index.css` の `:root` に追記して Tailwind と併用できるようにする。

| 意味（セマンティック） | 三十 `--sj-rk-*`（`sanjuu-rk-theme.css`） | らくだ本体 `--rk-*` / Tailwind | 備考 |
|------------------------|---------------------------------------------|----------------------------------|------|
| ページ下地（アプリ外周） | `--sj-rk-bg-page` | `--rk-bg-page` / `body` | シェル内は別レイヤ |
| アプリシェル背景（玄関〜ゲーム枠） | `--sj-rk-bg-shell` | `--rk-bg-shell` / `bg-rk-shell`（`AppLayout`） | RK の「顔」 |
| 既定テキスト | `--sj-rk-fg-default` | `--rk-fg-default` / `text-rk-fg` | |
| 補助テキスト | `--sj-rk-fg-muted` / `--sj-rk-fg-subtle` | `--rk-fg-muted` / `--rk-fg-subtle` | 各画面で段階的に |
| 面（カード・入力の下） | `--sj-rk-surface-card` / `--sj-rk-surface-input` | `--rk-surface-card` / `--rk-surface-input` | |
| 枠線（標準） | `--sj-rk-border-default` / `--sj-rk-border-muted` | `--rk-border-default` / `--rk-border-muted` | |
| アクセント（暖色・見出し） | `--sj-rk-accent-warm` | `--rk-accent-warm` | `.sanjuuBrand` 上書き |
| 本文リンク（青→暖色系） | `--sj-rk-link` | `--rk-link` | `.sj-rk-inline-link` |
| 成功・オン・主CTA緑 | `--sj-rk-accent-primary` ほか success 系 | `--rk-accent-primary` / `--rk-semantic-success-*` | |
| 警告 | `--sj-rk-semantic-warning-fg` | `--rk-semantic-warning-fg` | |
| エラー・禁止 | `--sj-rk-semantic-danger` / `*-bg` | `--rk-semantic-danger` / `*-bg` | |
| 無効 | `--sj-rk-disabled-*` | `--rk-disabled-*` | |
| 募集リスト「募集中」強調 | `--sj-rk-hundred-recruit-badge` | `--rk-hundred-recruit-badge` / `bg-rk-hundred-recruit`（Vite `@theme`） | 従来 #ff0000 |
| ハブ・連絡帳（木／羊皮） | `--sj-rk-hub-*`（rose-panel, bark, parchment 等） | `--rk-hub-*` | SeatSelection / SelectScreen / Renrakucho |
| 白・Kotoba ロゴ帯 | `--sj-rk-white` / `--sj-rk-logo-band-coral` / `--sj-rk-logo-band-mint` | `--rk-white` / `--rk-logo-band-*` | SVG は `fill="var(--rk-*)"`。Vite は `@theme` の `--color-rk-white` により `bg-rk-white` / `text-rk-white` 可 |
| ピュア黒 | `--sj-rk-black` | `--rk-black` | `@theme` `--color-rk-black` → `bg-rk-black` / `text-rk-black` / `border-rk-black` / `ring-rk-black` / `from-rk-black` / `to-rk-black` |
| 単独プレイ・シェル縦グラデ | `--sj-rk-game-solo-shell-gradient` | `--rk-game-solo-shell-gradient` / `.rk-bg-game-solo-shell` | 三十で同背景を張るとき用 |
| UI フォント | `--sj-rk-font-ui`（`--font-mplus-rounded` 依存） | `var(--font-rounded)` | |
| 角丸（標準） | `--sj-rk-radius` | `var(--radius-standard)` | |
| 広告帯のレイアウト予約 | （未使用・互換） | `--rk-bottom-banner` は常に 0 相当 |
| 広告帯の見た目トークン | （未使用・互換） | `--rk-ad-banner-bg` / `--rk-ad-banner-badge-bg` |
| 飛び出しタイトル縁・影 | `--sj-rk-fly-title-stroke` / `--sj-rk-fly-title-text-shadow` | `--rk-fly-title-stroke` / `--rk-fly-title-text-shadow` | 三十で同演出を足すとき用 |
| モード入口 drop-shadow | `--sj-rk-title-drop-shadow` | `--rk-title-drop-shadow` | |
| ブート致命オーバーレイ | `--sj-rk-boot-*`（overlay / fatal-accent / stack-bg / loading-fg） | `--rk-boot-*` | 三十の `main` 相当があれば同値 |
| ひらめきルーム（例外テーマ） | `--sj-rk-rest-bg` / `--sj-rk-rest-accent` | `--rk-rest-bg` / `--rk-rest-accent`（`@theme` → `--color-rest-*`） | メイン RK 外。accent はパレットでは `var(--rk-teal-400)` |

---

## 5. 次の作業（合意・更新）

1. **三十**: 新規 UI は **`var(--sj-rk-*)`** を優先（`sanjuu-rk-theme.css`・layout 配線済み）。
2. **らくだ本体**: 旧 `amber-*` の直参照は **必要なところだけ** `--rk-*` / `bg-rk-*` へ（一括リプレイスはしない）。
3. **ひらめきルーム**: 例外トーンは **`--rk-rest-bg` / `--rk-rest-accent`**（`@theme` の `--color-rest-*`）に集約済み。変更は `:root` 側を優先。
4. **広告**: **固定バナー（AdSense 帯）は不使用**。リワード相当の全面は **`AppLayout` ポータル**（`tryInterstitialAtNaturalBreak`・2分アーム後の自然な区切り）。
5. **没入画面のオーバーレイ**: **没入ポリシー**（`closesGlobalOverlays` 等）の **import は `rakudaHubShell` 経由**で揃える。 **`game` / `quiet-room` / `worlds-wish`** へ入ったときの整理は **`closesGlobalOverlays()`**（`useAppShell`）と **`suppressesQuietImmersiveGlobalChrome()`**（静的没入の UI 抑止）で分ける。`closesGlobalOverlays` では **連絡帳・設定・説明・しゅっせき簿・PWA インストール案内**のほか **`puzzleSizeHintMessage` / `notification` state** もクリア。**`puzzleSizeHintMessage` の DOM** は **`GlobalOverlays` で `screen === 'select'` のときだけ**。**トースト DOM** は **`suppressesQuietImmersiveGlobalChrome` 中は出さず**、その間に立った **`notification` も state から即消す**。**`AppStatusOverlays`** は **`suppressGameStatusOverlays`**。**静か没入へ遷移したとき** **`showFullScreenAd` なら** **`handleDismissFullScreenAd`**。**オフライン帯 / 通信吹き出し**は `GlobalOverlays` / `NetworkStatusHandler`。**`AppRouter`** は **`quiet-room` / `worlds-wish` 入場時に `history.pushState`**（`state.rk` は **`QuietImmersiveHistoryKind`**）し、**`popstate`**（端末の戻る）でも **`tryInterstitialAtNaturalBreak` 経由でハブ**へ戻す（画面上の「もどる」は `history.back()`）。**連続 `popstate` の再入**は **`quietImmersivePopRef` で抑止**（`await tryInterstitialAtNaturalBreak` 中に `screen` が変わっても、**発火時の画面**で分岐するよう **`const s = screen` でスナップ**）。**ことば探し `select` / `game` の履歴スタックは未対応**（静か没入のみ `pushState`）。**画面ごとのフラグの一次ソースは `src/lib/rakudaScreenRegistry.ts`**（`immersiveScreenPolicy` はここから導出。方針の読み方は同 `immersiveScreenPolicy` 先頭コメント）。
6. **右上 `AppHeader`**: **`quiet-room` / `worlds-wish`** では **`hidden`** にしてポータル非表示（ハブ用のログイン／回線バッジが没入 UI を覆わないようにする）。

---

## 6. 参照 URL

- 入口・世界観の約束: `https://rakuda.coffee/`
