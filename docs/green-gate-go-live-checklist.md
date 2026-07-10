# 緑ゲート — 初回収益までのチェックリスト（らくださん＋豆）

**目的**：月額緑（¥480）で **最初の1件の入金** を通し、設定が正しいと実感する。  
**注意**：緑はサブスクのため、初回の成功入金は **480円（税込）** になる（1円決済ではない）。設定確認後、Stripe 上で解約すればよい。

---

## らくださんがやること（秘密はチャットに貼らない）

### 1. Stripe ダッシュボード

- [ ] 本番商品 **緑のゲート ¥480/月** の **Price ID**（`price_...`）を控える
- [ ] **API キー** → 秘密鍵 `sk_live_...`（再表示できないので安全な場所に）
- [ ] **Webhook** を追加  
  - URL: `https://rakuda.coffee/api/stripe/webhook`  
  - イベント例: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`（Stripe 推奨に合わせて選択）  
  - 署名シークレット `whsec_...` を控える

### 2. リポジトリ直下に `.env.rakuda-api.local`（Git に載せない）

`.env.rakuda-api.local.example` をコピーして値を入れる：

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_GREEN_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_PUBLIC_ORIGIN=https://rakuda.coffee
```

### 3. 豆に「API をデプロイして」と依頼

豆が実行：`npm run deploy:rakuda-api`

### 4. 豆に「緑を ON して Hosting」と依頼

豆が `.env.production` に `VITE_STRIPE_GREEN_GATE_ENABLED=1` を足して `npm run deploy:hosting:with-rules`  
（プライバシー追記は 2026-05-31 コード済み）

### 5. 本人テスト（確認してほしいこと）

1. シークレットウィンドウで `https://rakuda.coffee/` を開く
2. **Google ログイン**
3. ゲート選択で **緑 → 協力する（決済へ）**
4. Stripe Checkout が開く → **テスト用カードで 480円**
5. 戻ったあと **広告なし・緑のゲート** になっている
6. Stripe ダッシュボードに **入金 480円** が見える
7. 不要なら Stripe で **サブスク解約**

---

## 豆が見る成功の目安

| 確認 | OK の目安 |
|------|-----------|
| API | `POST https://rakuda.coffee/api/stripe/create-checkout-session` が `stripe_not_configured` ではない |
| UI | 緑ボタンが「準備中」ではなく **協力する（決済へ）** |
| 戻り | URL に `?green_gate=success&session_id=...` のあと緑が有効 |
| 収益 | Stripe 残高／決済一覧に 1 件 |

---

## うまくいかないとき

- **「決済の準備中です」** → API の Stripe 環境変数未設定 or Hosting だけ先に ON
- **「準備中」ボタンのまま** → `VITE_STRIPE_GREEN_GATE_ENABLED=1` がビルドに入っていない
- **緑にならない** → Webhook 未設定。戻り URL の `sync` だけでは足りない場合あり

---

## 参考：募金箱（すでに Hosting 向け設定あり）

緑より先に「少額で入金テスト」だけなら、設定画面の **特別寄付**（100円〜）も利用可。  
本丸は緑のまま進めてよい。
