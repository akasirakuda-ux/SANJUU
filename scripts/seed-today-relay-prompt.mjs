/**
 * 連続小説「今日のお題」— 起を1本 Firestore に掲出（段階A）
 * 用法:
 *   node scripts/seed-today-relay-prompt.mjs           … 本番 API（Admin SDK は Cloud Run 側）
 *   node scripts/seed-today-relay-prompt.mjs --admin     … ローカル Admin SDK（GOOGLE_APPLICATION_CREDENTIALS 等）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedTodayRelayPrompt } from '../server/relayStoryTodayPrompt.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const viaAdmin = process.argv.includes('--admin');
const force = process.argv.includes('--force');

function loadLocalEnvKey(key) {
  const file = path.join(root, '.env.rakuda-api.local');
  if (!fs.existsSync(file)) return '';
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    if (k !== key) continue;
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    return val;
  }
  return '';
}

async function seedViaAdmin() {
  const [{ initializeApp, applicationDefault, cert }, { getFirestore, FieldValue }] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/firestore'),
  ]);
  const credPath = String(process.env.GOOGLE_APPLICATION_CREDENTIALS ?? loadLocalEnvKey('GOOGLE_APPLICATION_CREDENTIALS')).trim();
  if (credPath && fs.existsSync(credPath)) {
    initializeApp({ credential: cert(JSON.parse(fs.readFileSync(credPath, 'utf8'))) });
  } else {
    initializeApp({ credential: applicationDefault() });
  }
  const db = getFirestore();
  return seedTodayRelayPrompt(db, FieldValue, force ? { force: true } : undefined);
}

async function seedViaApi() {
  const secret = String(process.env.ROBO_PICKUP_CRON_SECRET ?? loadLocalEnvKey('ROBO_PICKUP_CRON_SECRET')).trim();
  const origin = String(process.env.APP_PUBLIC_ORIGIN ?? 'https://rakuda.coffee').trim().replace(/\/+$/, '');
  if (!secret) {
    console.error('ROBO_PICKUP_CRON_SECRET を .env.rakuda-api.local に設定してください');
    process.exit(1);
  }
  const res = await fetch(`${origin}/api/relay-story/cron-daily${force ? '?force=1' : ''}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-robo-pickup-cron-secret': secret,
    },
    body: JSON.stringify(force ? { force: true } : {}),
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
  return json;
}

const json = viaAdmin ? await seedViaAdmin() : await seedViaApi();
if (viaAdmin) console.log(json);
if (!json.ok) process.exit(1);
if (json.skipped) {
  console.log('既に掲出済み:', json.id, json.title);
} else if (json.ok) {
  console.log('掲出しました:', json.id, json.title, `(${json.chars}字)`);
}
