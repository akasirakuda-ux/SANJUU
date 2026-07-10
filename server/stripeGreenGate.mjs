/**
 * 緑のゲート Stripe — Checkout / Webhook / Firestore 同期
 * 環境変数: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_GREEN_PRICE_ID, APP_PUBLIC_ORIGIN
 */

function readStripeConfig() {
  const secretKey = String(process.env.STRIPE_SECRET_KEY ?? '').trim();
  const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET ?? '').trim();
  const priceId = String(process.env.STRIPE_GREEN_PRICE_ID ?? '').trim();
  const origin = String(process.env.APP_PUBLIC_ORIGIN ?? 'https://rakuda.coffee').trim().replace(/\/+$/, '');
  return { secretKey, webhookSecret, priceId, origin, configured: !!secretKey && !!priceId };
}

/** 2026-06-08 らくださん判断 — 新規緑ゲート入口を一時閉鎖。`GREEN_GATE_ENTRANCE_CLOSED=0` で再開。 */
function isGreenGateEntranceClosed() {
  return String(process.env.GREEN_GATE_ENTRANCE_CLOSED ?? '1').trim() !== '0';
}

let _stripe = null;
async function getStripe() {
  const { secretKey, configured } = readStripeConfig();
  if (!configured) return null;
  if (_stripe) return _stripe;
  const Stripe = (await import('stripe')).default;
  _stripe = new Stripe(secretKey);
  return _stripe;
}

function periodEndMs(subscription) {
  const end = subscription?.current_period_end;
  return typeof end === 'number' && Number.isFinite(end) ? end * 1000 : null;
}

function periodStartMs(subscription) {
  const start = subscription?.current_period_start;
  return typeof start === 'number' && Number.isFinite(start) ? start * 1000 : null;
}

function subscriptionCreatedMs(subscription) {
  const created = subscription?.created;
  return typeof created === 'number' && Number.isFinite(created) ? created * 1000 : null;
}

function readStoredMs(raw) {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function upsertGreenGateFromSubscription(db, uid, subscription) {
  if (!uid || !subscription) return null;
  const greenUntilMs = periodEndMs(subscription);
  if (greenUntilMs == null) return null;
  const { FieldValue } = await import('firebase-admin/firestore');
  const ref = db.collection('rk_green_gate').doc(uid);
  const snap = await ref.get();
  const prev = snap.exists ? snap.data() : null;
  const prevContract = readStoredMs(prev?.contractAtMs);
  const periodStart = periodStartMs(subscription);
  const createdMs = subscriptionCreatedMs(subscription);

  await ref.set(
    {
      greenUntilMs,
      contractAtMs: prevContract ?? createdMs ?? periodStart ?? greenUntilMs,
      ...(periodStart != null ? { currentPeriodStartMs: periodStart } : {}),
      stripeCustomerId: String(subscription.customer ?? ''),
      stripeSubscriptionId: String(subscription.id ?? ''),
      status: String(subscription.status ?? ''),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return greenUntilMs;
}

async function verifyBearer(auth, req) {
  const authz = String(req.headers.authorization ?? '').trim();
  const m = authz.match(/^Bearer\s+(.+)$/i);
  if (!m?.[1]) return null;
  try {
    const decoded = await auth.verifyIdToken(m[1].trim());
    const uid = String(decoded?.uid ?? '').trim();
    if (!uid) return null;
    const email = String(decoded?.email ?? '').trim().toLowerCase() || null;
    return { uid, email };
  } catch {
    return null;
  }
}

async function verifyBearerUid(auth, req) {
  const v = await verifyBearer(auth, req);
  return v?.uid ?? null;
}

/** Stripe 上の有効サブスクを Firebase uid の rk_green_gate に同期（Firestore 欠損の復旧） */
async function syncGreenGateBillingFromStripe(stripe, db, uid, email) {
  const ref = db.collection('rk_green_gate').doc(uid);
  const snap = await ref.get();
  const prev = snap.exists ? snap.data() : null;
  const prevUntil = readStoredMs(prev?.greenUntilMs);
  if (prevUntil != null && prevUntil > Date.now() && String(prev?.stripeCustomerId ?? '').trim()) {
    return { greenUntilMs: prevUntil, synced: false };
  }

  const emailNorm = String(email ?? '').trim().toLowerCase();
  if (!emailNorm) return { greenUntilMs: null, synced: false };

  const customers = await stripe.customers.list({ email: emailNorm, limit: 20 });
  let bestSub = null;
  let bestEndMs = null;

  for (const customer of customers.data) {
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 20,
    });
    for (const sub of subs.data) {
      const endMs = periodEndMs(sub);
      if (endMs == null || endMs <= Date.now()) continue;
      if (sub.status !== 'active' && sub.status !== 'trialing') continue;
      if (bestEndMs == null || endMs > bestEndMs) {
        bestEndMs = endMs;
        bestSub = sub;
      }
    }
  }

  if (!bestSub || bestEndMs == null) {
    return { greenUntilMs: prevUntil, synced: false };
  }

  const greenUntilMs = await upsertGreenGateFromSubscription(db, uid, bestSub);
  return { greenUntilMs: greenUntilMs ?? bestEndMs, synced: true };
}

export function registerStripeGreenGateWebhook(app, { getFirebaseAdmin, express }) {
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const { webhookSecret } = readStripeConfig();
    const stripe = await getStripe();
    if (!stripe || !webhookSecret) {
      res.status(503).json({ ok: false, error: 'stripe_not_configured' });
      return;
    }
    const sig = req.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
      res.status(400).json({ ok: false, error: 'missing_signature' });
      return;
    }
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (e) {
      console.warn('[stripe/webhook] signature', e?.message ?? e);
      res.status(400).json({ ok: false, error: 'invalid_signature' });
      return;
    }

    try {
      const { db } = await getFirebaseAdmin();
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const uid = String(session.metadata?.uid ?? session.client_reference_id ?? '').trim();
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        if (uid && subId) {
          const subscription = await stripe.subscriptions.retrieve(subId);
          await upsertGreenGateFromSubscription(db, uid, subscription);
        }
      } else if (
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.created'
      ) {
        const subscription = event.data.object;
        const uid = String(subscription.metadata?.uid ?? '').trim();
        if (uid) await upsertGreenGateFromSubscription(db, uid, subscription);
      } else if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const uid = String(subscription.metadata?.uid ?? '').trim();
        if (uid) {
          const endMs = periodEndMs(subscription) ?? Date.now();
          const { FieldValue } = await import('firebase-admin/firestore');
          await db.collection('rk_green_gate').doc(uid).set(
            {
              greenUntilMs: endMs,
              status: 'canceled',
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }
      }
      res.json({ ok: true, received: true });
    } catch (e) {
      console.error('[stripe/webhook]', e);
      res.status(500).json({ ok: false, error: 'webhook_handler_failed' });
    }
  });
}

export function registerStripeGreenGateApi(app, { getFirebaseAdmin }) {
  app.post(['/api/stripe/create-checkout-session', '/api/stripe/create-checkout-session/'], async (req, res) => {
    try {
      const stripe = await getStripe();
      const { priceId, origin } = readStripeConfig();
      if (!stripe || !priceId) {
        res.status(503).json({ ok: false, error: 'stripe_not_configured' });
        return;
      }
      const { auth } = await getFirebaseAdmin();
      const uid = await verifyBearerUid(auth, req);
      if (!uid) {
        res.status(401).json({ ok: false, error: 'auth_required' });
        return;
      }
      if (isGreenGateEntranceClosed()) {
        res.status(403).json({ ok: false, error: 'entrance_closed' });
        return;
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        client_reference_id: uid,
        metadata: { uid },
        subscription_data: { metadata: { uid } },
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${origin}/?green_gate=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?green_gate=cancel`,
      });

      if (!session.url) {
        res.status(500).json({ ok: false, error: 'no_checkout_url' });
        return;
      }
      res.status(200).json({ ok: true, url: session.url });
    } catch (e) {
      console.error('[stripe/create-checkout-session]', e);
      res.status(500).json({ ok: false, error: 'internal_error' });
    }
  });

  app.post(['/api/stripe/sync-checkout-session', '/api/stripe/sync-checkout-session/'], async (req, res) => {
    try {
      const stripe = await getStripe();
      if (!stripe) {
        res.status(503).json({ ok: false, error: 'stripe_not_configured' });
        return;
      }
      const { auth, db } = await getFirebaseAdmin();
      const uid = await verifyBearerUid(auth, req);
      if (!uid) {
        res.status(401).json({ ok: false, error: 'auth_required' });
        return;
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const sessionId = String(body.sessionId ?? '').trim();
      if (!sessionId) {
        res.status(400).json({ ok: false, error: 'session_id_required' });
        return;
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const ownerUid = String(session.metadata?.uid ?? session.client_reference_id ?? '').trim();
      if (ownerUid !== uid) {
        res.status(403).json({ ok: false, error: 'forbidden' });
        return;
      }
      if (session.payment_status !== 'paid' && session.status !== 'complete') {
        res.status(200).json({ ok: true, greenUntilMs: null, pending: true });
        return;
      }
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (!subId) {
        res.status(200).json({ ok: true, greenUntilMs: null });
        return;
      }
      const subscription = await stripe.subscriptions.retrieve(subId);
      const greenUntilMs = await upsertGreenGateFromSubscription(db, uid, subscription);
      res.status(200).json({ ok: true, greenUntilMs: greenUntilMs ?? null });
    } catch (e) {
      console.error('[stripe/sync-checkout-session]', e);
      res.status(500).json({ ok: false, error: 'internal_error' });
    }
  });

  app.post(['/api/stripe/sync-billing', '/api/stripe/sync-billing/'], async (req, res) => {
    try {
      const stripe = await getStripe();
      if (!stripe) {
        res.status(503).json({ ok: false, error: 'stripe_not_configured' });
        return;
      }
      const { auth, db } = await getFirebaseAdmin();
      const bearer = await verifyBearer(auth, req);
      if (!bearer) {
        res.status(401).json({ ok: false, error: 'auth_required' });
        return;
      }
      const { greenUntilMs, synced } = await syncGreenGateBillingFromStripe(
        stripe,
        db,
        bearer.uid,
        bearer.email,
      );
      res.status(200).json({
        ok: true,
        greenUntilMs: greenUntilMs ?? null,
        synced,
      });
    } catch (e) {
      console.error('[stripe/sync-billing]', e);
      res.status(500).json({ ok: false, error: 'internal_error' });
    }
  });

  app.post(['/api/stripe/create-portal-session', '/api/stripe/create-portal-session/'], async (req, res) => {
    try {
      const stripe = await getStripe();
      const { origin } = readStripeConfig();
      if (!stripe) {
        res.status(503).json({ ok: false, error: 'stripe_not_configured' });
        return;
      }
      const { auth, db } = await getFirebaseAdmin();
      const uid = await verifyBearerUid(auth, req);
      if (!uid) {
        res.status(401).json({ ok: false, error: 'auth_required' });
        return;
      }

      const snap = await db.collection('rk_green_gate').doc(uid).get();
      const customerId = String(snap.data()?.stripeCustomerId ?? '').trim();
      if (!customerId) {
        res.status(404).json({ ok: false, error: 'no_stripe_subscription' });
        return;
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/?green_gate=portal_return`,
      });
      if (!session.url) {
        res.status(500).json({ ok: false, error: 'no_portal_url' });
        return;
      }
      res.status(200).json({ ok: true, url: session.url });
    } catch (e) {
      console.error('[stripe/create-portal-session]', e);
      res.status(500).json({ ok: false, error: 'internal_error' });
    }
  });
}

export { readStripeConfig };
