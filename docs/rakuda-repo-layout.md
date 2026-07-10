# らくだ珈琲リポジトリ — 何が本番か（豆用）

**最終更新**: 2026-07-10（Git 整理 B 後）

利用者の入口は常に **`https://rakuda.coffee/`**（変えない）。

---

## フォルダと本番の対応

| フォルダ | 役割 | 本番 URL / サービス | 載せ方 |
|---|---|---|---|
| **`src/`** + ルート `package.json` | **らくだ本体**（PWA・連絡帳・ひと言探し・ゲート等） | `https://rakuda.coffee/` | `npm run deploy:hosting`（`firestore.rules` 変更時は `deploy:hosting:with-rules`） |
| **`server/`** + `server.mjs` | Stripe API・プロキシ等 | Cloud Run **`rakuda-api`** → `https://rakuda.coffee/api/*` | `npm run deploy:rakuda-api` |
| **`SANJUU/`** | **三十**（Next + WS 同梱イメージ） | Cloud Run **`sanjuu`**（例: `sanjuu-….asia-northeast1.run.app`） | `npm run deploy:sanjuu` |
| **`flutter_slide_puzzle_idle/`** | Flutter スライドパズル（将来・アプリ） | **未接続** | デプロイなし |
| **`docs/`** | 豆・他 AI 用メモ（メトリクス・収益・手順） | 公開しない | Git のみ |
| **`.cursor/rules/`** | Cursor エージェント境界 | 公開しない | Git のみ |

---

## 環境変数（Git に載せないもの）

| ファイル | 用途 |
|---|---|
| `.env.rakuda-api.local` | Cloud Run `rakuda-api`（Stripe 秘密鍵等） |
| `.env.local` / `*.local` | ローカル秘密（`.gitignore` で除外） |

**コミットしてよい例**: `.env.example`、`.env.production`（公開ビルド用フラグ・三十 URL・GA ID 等）

---

## 同一リリース日に揃えるもの

1. **三十**（`deploy:sanjuu`）— 募集一覧・三十 UI
2. **`.env.production` の `VITE_SANJUU_*`** が三十の URL と一致しているか
3. **らくだ Hosting**（`deploy:hosting`）

「らくだだけ先」「三十だけ先」が長くズレないよう、**同じ日にペア**で載せる。

---

## 直近の本番バンドル（Hosting）

デプロイ成功ログの `main-XXXXXXXX.js` を正とする。  
`verify-hosting-dist` の OK 行と Firebase CLI 成功ログをセットで残す。

---

## Firestore

- ルール: `firestore.rules`
- 索引: `firestore.indexes.json`
- クライアントとルールをズラさない（Hosting だけ載せない）
