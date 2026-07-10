/**
 * らくだロボ / 絵文字ロボ 常設ひと言探し — 初回セットアップ
 * 用法: ROBO_PICKUP_CRON_SECRET=... node scripts/seed-robo-pickup-lounge.mjs
 */
const secret = String(process.env.ROBO_PICKUP_CRON_SECRET ?? '').trim();
const origin = String(process.env.APP_PUBLIC_ORIGIN ?? 'https://rakuda.coffee').trim().replace(/\/+$/, '');

if (!secret) {
  console.error('ROBO_PICKUP_CRON_SECRET を設定してください');
  process.exit(1);
}

const res = await fetch(`${origin}/api/robo-pickup/ensure`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-robo-pickup-cron-secret': secret,
  },
  body: '{}',
});

const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  json = { raw: text };
}

console.log(res.status, json);
if (!res.ok) process.exit(1);
