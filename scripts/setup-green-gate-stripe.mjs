/**
 * 緑ゲート Stripe セットアップ（秘密鍵1つだけで Price ID / Webhook を自動取得）
 *
 * 用法:
 *   1. .env.rakuda-api.local の STRIPE_SECRET_KEY だけ本物に書く
 *   2. node scripts/setup-green-gate-stripe.mjs
 *   3. npm run deploy:rakuda-api
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envFile = path.join(root, '.env.rakuda-api.local');
const WEBHOOK_URL = 'https://rakuda.coffee/api/stripe/webhook';

function loadSecretKey() {
  if (!fs.existsSync(envFile)) {
    console.error('[setup] .env.rakuda-api.local がありません');
    process.exit(1);
  }
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^STRIPE_SECRET_KEY=(.+)$/);
    if (!m) continue;
    const key = m[1].trim();
    if (!key || key.includes('ここに') || key.includes('sk_live_ここ') || key === 'sk_live_...') {
      console.error('[setup] STRIPE_SECRET_KEY がまだ placeholder です。sk_live_ で始まる本物だけ書いて保存してください。');
      process.exit(1);
    }
    if (!key.startsWith('sk_live_') && !key.startsWith('sk_test_') && !key.startsWith('rk_live_') && !key.startsWith('rk_test_')) {
      console.error('[setup] STRIPE_SECRET_KEY の形式が不正です（sk_live_ / rk_live_ など）');
      process.exit(1);
    }
    return key;
  }
  console.error('[setup] STRIPE_SECRET_KEY の行が見つかりません');
  process.exit(1);
}

async function stripeGet(secretKey, pathSuffix) {
  const r = await fetch(`https://api.stripe.com/v1${pathSuffix}`, {
    headers: { authorization: `Bearer ${secretKey}` },
  });
  const data = await r.json();
  if (!r.ok) {
    throw new Error(data?.error?.message ?? `Stripe GET ${pathSuffix} failed (${r.status})`);
  }
  return data;
}

async function stripePost(secretKey, pathSuffix, form) {
  const r = await fetch(`https://api.stripe.com/v1${pathSuffix}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secretKey}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  const data = await r.json();
  if (!r.ok) {
    throw new Error(data?.error?.message ?? `Stripe POST ${pathSuffix} failed (${r.status})`);
  }
  return data;
}

function pickGreenPrice(prices) {
  const list = prices?.data ?? [];
  const active = list.filter((p) => p.active && p.type === 'recurring');
  const byName = active.find((p) => {
    const nick = String(p.nickname ?? '').toLowerCase();
    const prod = String(p.product?.name ?? p.product ?? '').toLowerCase();
    return nick.includes('緑') || prod.includes('緑') || nick.includes('green') || prod.includes('green');
  });
  if (byName) return byName.id;
  const yen500 = active.find((p) => p.currency === 'jpy' && p.unit_amount === 500);
  if (yen500) return yen500.id;
  const yen480 = active.find((p) => p.currency === 'jpy' && p.unit_amount === 480);
  if (yen480) return yen480.id;
  if (active.length === 1) return active[0].id;
  return null;
}

async function ensureWebhook(secretKey) {
  const existing = await stripeGet(secretKey, '/webhook_endpoints?limit=100');
  const hit = (existing.data ?? []).find((w) => w.url === WEBHOOK_URL && w.status !== 'disabled');
  if (hit?.secret) return hit.secret;

  const form = new URLSearchParams();
  form.set('url', WEBHOOK_URL);
  for (const ev of [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
  ]) {
    form.append('enabled_events[]', ev);
  }
  form.set('description', 'rakuda green gate');
  const created = await stripePost(secretKey, '/webhook_endpoints', form);
  if (!created.secret) throw new Error('Webhook 作成後に secret が返りませんでした');
  return created.secret;
}

function writeEnv(secretKey, priceId, webhookSecret) {
  const body = `# 自動更新: scripts/setup-green-gate-stripe.mjs
STRIPE_SECRET_KEY=${secretKey}
STRIPE_GREEN_PRICE_ID=${priceId}
STRIPE_WEBHOOK_SECRET=${webhookSecret}
APP_PUBLIC_ORIGIN=https://rakuda.coffee
`;
  fs.writeFileSync(envFile, body, 'utf8');
}

async function main() {
  const secretKey = loadSecretKey();
  console.log('[setup] Stripe から価格 ID を探しています…');
  const prices = await stripeGet(secretKey, '/prices?active=true&limit=100&expand[]=data.product');
  const priceId = pickGreenPrice(prices);
  if (!priceId) {
    console.error('[setup] らくだ応援ゲート（¥500/月）の Price が見つかりません。Stripe の商品名に「緑」「応援」が含まれているか確認してください。');
    process.exit(1);
  }
  console.log('[setup] Price ID:', priceId);

  console.log('[setup] Webhook を確認・作成しています…');
  const webhookSecret = await ensureWebhook(secretKey);
  console.log('[setup] Webhook OK');

  writeEnv(secretKey, priceId, webhookSecret);
  console.log('[setup] .env.rakuda-api.local を更新しました');
  console.log('[setup] 次: npm run deploy:rakuda-api');
}

main().catch((e) => {
  console.error('[setup]', e?.message ?? e);
  process.exit(1);
});
