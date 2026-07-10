/**
 * 連続小説「今日のお題」— 毎日0時 JST · Gemini · Admin SDK で Firestore に起を1本掲出
 */
import {
  generateRelayStoryOpening,
  pickRelayPromptGenre,
  todayKeyJst,
} from './relayStoryGemini.mjs';

const AUTHOR_UID = 'e64TIfCKEnO8BDEqCwobZUasnHT2';
const AUTHOR_NICK = '今日のお題';
const AUTHOR_EMOJI = '🐫';

function readCronSecret() {
  return String(process.env.ROBO_PICKUP_CRON_SECRET ?? '').trim();
}

function isCronAuthorized(req) {
  const secret = readCronSecret();
  if (!secret) return false;
  const header = String(req.headers['x-robo-pickup-cron-secret'] ?? '').trim();
  return header.length > 0 && header === secret;
}

async function findTodayPrompt(db, dateKey) {
  const snap = await db.collection('rk_relay_stories').where('promptDateKey', '==', dateKey).limit(1).get();
  if (!snap.empty) return snap.docs[0];
  return null;
}

/**
 * @param {{ force?: boolean, dateKey?: string }} opts
 */
export async function publishTodayRelayPrompt(db, FieldValue, opts = {}) {
  const dateKey = String(opts.dateKey ?? todayKeyJst()).trim();
  const force = opts.force === true;

  const existing = await findTodayPrompt(db, dateKey);
  if (existing && !force) {
    const d = existing.data();
    return {
      ok: true,
      skipped: true,
      id: existing.id,
      title: d.title,
      genre: d.promptGenre ?? null,
      chars: d.segments?.[0]?.text ? [...String(d.segments[0].text)].length : null,
      dateKey,
    };
  }

  const genre = pickRelayPromptGenre(dateKey);
  const generated = await generateRelayStoryOpening(genre);
  if (generated.error) {
    return { ok: false, error: generated.error, dateKey, genre };
  }

  const title = `今日のお題（${genre}）`;
  const ref = existing && force ? existing.ref : db.collection('rk_relay_stories').doc();
  await ref.set({
    title,
    status: 'open',
    currentStep: 1,
    participantUids: [AUTHOR_UID],
    promptDateKey: dateKey,
    promptGenre: genre,
    officialPrompt: true,
    segments: [
      {
        kind: '起',
        text: generated.text,
        authorUid: AUTHOR_UID,
        authorNick: AUTHOR_NICK,
        authorEmoji: AUTHOR_EMOJI,
        createdAtMs: Date.now(),
      },
    ],
    createdAt: FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    skipped: false,
    id: ref.id,
    title,
    genre,
    chars: generated.length,
    attempts: generated.attempts,
    dateKey,
  };
}

/** @deprecated 互換 alias */
export async function seedTodayRelayPrompt(db, FieldValue, opts) {
  return publishTodayRelayPrompt(db, FieldValue, opts);
}

async function handleCronPublish(req, res, { getFirebaseAdmin }) {
  if (!isCronAuthorized(req)) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }
  try {
    const force = req.body?.force === true || req.query?.force === '1';
    const { db } = await getFirebaseAdmin();
    const { FieldValue } = await import('firebase-admin/firestore');
    const result = await publishTodayRelayPrompt(db, FieldValue, { force });
    if (!result.ok) {
      res.status(result.error === 'gemini_not_configured' ? 503 : 500).json(result);
      return;
    }
    res.json(result);
  } catch (e) {
    console.error('[relayStoryTodayPrompt] cron', e);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
}

export function registerRelayStoryTodayPromptApi(app, { getFirebaseAdmin }) {
  const paths = [
    '/api/relay-story/cron-daily',
    '/api/relay-story/cron-daily/',
    '/api/relay-story/seed-today',
    '/api/relay-story/seed-today/',
  ];
  app.post(paths, (req, res) => handleCronPublish(req, res, { getFirebaseAdmin }));
}
