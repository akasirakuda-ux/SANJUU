/**
 * 累計来場者 — GA 起点 1,729 を Firestore に反映（1回）
 * 用法: node scripts/seed-hub-visitor-baseline.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { doc, getDoc, initializeFirestore, setDoc } from 'firebase/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const BASELINE = 1729;

const config = JSON.parse(fs.readFileSync(path.join(root, 'firebase-applet-config.json'), 'utf8'));
const app = initializeApp(config);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  experimentalLongPollingOptions: { timeoutSeconds: 30 },
});

const ref = doc(db, 'system', 'hub_visitor_total');
const snap = await getDoc(ref);
const current = snap.exists() ? Number(snap.data()?.totalCount) || 0 : 0;
const next = Math.max(current, BASELINE);

await setDoc(
  ref,
  {
    totalCount: next,
    baselineCount: BASELINE,
    baselineSource: 'ga_au_2026-06-01_28d',
    updatedAtMs: Date.now(),
  },
  { merge: true },
);

console.log('[seed-hub-visitor-baseline] OK totalCount=', next, '(was', current, ')');
