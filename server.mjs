import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT ?? 8080);

const distDir = path.join(__dirname, 'dist');

app.disable('x-powered-by');

app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false }));

/**
 * Canonical host redirect.
 * Keep the historical Cloud Run URL working, but redirect human navigation to the canonical domain.
 */
const CANONICAL_HOST = (process.env.CANONICAL_HOST ?? 'rakuda.coffee').trim().toLowerCase();
const LEGACY_HOST = (process.env.LEGACY_HOST ?? 'remix-732792089650.us-west1.run.app').trim().toLowerCase();
app.use((req, res, next) => {
  try {
    const host = String(req.headers.host ?? '').split(':')[0]?.trim().toLowerCase();
    const isLegacy = host === LEGACY_HOST;
    const isCanonical = host === CANONICAL_HOST;
    if (!isLegacy || isCanonical) return next();

    // Don't redirect API calls (keep them functional even if someone uses the legacy host).
    const p = req.path || '';
    if (p.startsWith('/api/')) return next();

    // Redirect only safe navigation methods.
    const m = String(req.method || 'GET').toUpperCase();
    if (!(m === 'GET' || m === 'HEAD')) return next();

    const target = `https://${CANONICAL_HOST}${req.originalUrl || '/'}`;
    res.redirect(301, target);
  } catch {
    next();
  }
});

app.post('/api/submit-to-teacher', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const payload = {
      seedText: String(body.seedText ?? ''),
      nameText: String(body.nameText ?? ''),
      categoryTitle: String(body.categoryTitle ?? ''),
      difficultyText: String(body.difficultyText ?? ''),
      totalCount: String(body.totalCount ?? ''),
      clearTime: String(body.clearTime ?? ''),
      pointsText: String(body.pointsText ?? ''),
      vCode: String(body.vCode ?? 'DUMMY_DATA'),
    };

    if (!payload.nameText.trim()) {
      res.status(400).json({ ok: false, error: 'name required' });
      return;
    }

    const formActionUrl =
      'https://docs.google.com/forms/d/e/1FAIpQLScgx8M30O6TQTAtDxtxb-ftAs7hv3F5WR53iD79XySoa7HETA/formResponse';
    const formData = new URLSearchParams();
    formData.append('entry.1199053163', payload.seedText || 'なし');
    formData.append('entry.372020919', payload.nameText);
    formData.append('entry.2126071547', payload.categoryTitle);
    formData.append('entry.1550339233', payload.difficultyText);
    formData.append('entry.92185271', String(payload.totalCount ?? ''));
    formData.append('entry.458856475', payload.clearTime);
    formData.append('entry.2094453691', payload.pointsText);
    formData.append('entry.390053549', payload.vCode);

    const r = await fetch(formActionUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: formData.toString(),
    });

    // Google Forms often returns 200/302. Treat any 2xx/3xx as success.
    if (r.status >= 400) {
      res.status(502).json({ ok: false, error: `google form status ${r.status}` });
      return;
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('[submit-to-teacher]', e);
    res.status(500).json({ ok: false, error: 'internal error' });
  }
});

// Static assets (hashed files, icons, etc.)
app.use(express.static(distDir, { index: false, etag: true, maxAge: '1h' }));

// SPA fallback
// Express 5 + path-to-regexp v8 doesn't accept "*" as a route pattern.
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`[server] listening on :${port}`);
});

