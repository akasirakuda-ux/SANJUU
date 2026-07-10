import fs from 'node:fs';
import path from 'path';
import type { Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Vite 単体起動時は `server.mjs` の `/api/*` が存在しないためスタブを返す。
 * - GET /api/me/profile … 三十 CORS 用
 * - POST /api/session … Google ログイン後の session cookie 同期（dev は no-op OK）
 */
function rakudaDevApiStubs(): Plugin {
  return {
    name: 'rakuda-dev-api-stubs',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
        next();
      });

      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0] ?? '';

        if (pathname === '/api/me/profile' || pathname === '/api/me/profile/') {
          if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
            res.statusCode = 204;
            res.end();
            return;
          }
          if (req.method === 'GET') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ ok: true, profile: { emoji: '', nickname: '' } }));
            return;
          }
        }

        if (pathname === '/api/session' || pathname === '/api/session/') {
          if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.statusCode = 204;
            res.end();
            return;
          }
          if (req.method === 'POST' || req.method === 'DELETE') {
            if (req.method === 'DELETE') {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.statusCode = 200;
              res.end(JSON.stringify({ ok: true, devStub: true }));
              return;
            }
            const chunks: Buffer[] = [];
            req.on('data', (c) => chunks.push(typeof c === 'string' ? Buffer.from(c) : c));
            req.on('end', () => {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.statusCode = 200;
              res.end(JSON.stringify({ ok: true, devStub: true }));
            });
            req.on('error', () => {
              res.statusCode = 500;
              res.end(JSON.stringify({ ok: false }));
            });
            return;
          }
        }

        if (
          pathname === '/api/stripe/create-checkout-session' ||
          pathname === '/api/stripe/create-checkout-session/' ||
          pathname === '/api/stripe/sync-checkout-session' ||
          pathname === '/api/stripe/sync-checkout-session/' ||
          pathname === '/api/stripe/create-portal-session' ||
          pathname === '/api/stripe/create-portal-session/' ||
          pathname === '/api/green-pass/redeem' ||
          pathname === '/api/green-pass/redeem/' ||
          pathname === '/api/green-pass/admin/create' ||
          pathname === '/api/green-pass/admin/create/' ||
          pathname === '/api/green-pass/admin/list' ||
          pathname === '/api/green-pass/admin/list/' ||
          pathname === '/api/green-pass/admin/referrers' ||
          pathname === '/api/green-pass/admin/referrers/'
        ) {
          if (req.method === 'POST' || req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.statusCode = 503;
            res.end(JSON.stringify({ ok: false, error: 'api_not_available_in_dev' }));
            return;
          }
        }

        next();
      });
    },
  };
}

/** 本番 HTML の `<head>` に Google 公式 gtag を埋め込む（Tag Assistant 検知・早期送信） */
function injectGa4Tag(gaId: string | undefined): Plugin {
  return {
    name: 'inject-ga4-tag',
    transformIndexHtml(html) {
      const id = (gaId ?? '').trim();
      if (!id.startsWith('G-')) return html;
      const marker = '<!-- GA4:';
      if (!html.includes(marker)) return html;
      const snippet = [
        '    <!-- Google tag (gtag.js) — GA4 -->',
        `    <script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>`,
        '    <script>',
        '      window.dataLayer = window.dataLayer || [];',
        '      function gtag(){dataLayer.push(arguments);}',
        '      gtag("js", new Date());',
        `      gtag("config", "${id}", { send_page_view: true });`,
        '    </script>',
      ].join('\n');
      return html.replace(marker, `${snippet}\n    ${marker}`);
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        // NOTE: SANJUU dev relay typically uses :3000, so keep rakuda (Vite) on a different port.
        port: 5173,
        strictPort: true,
        host: true,
        open: true,
        hmr: false,
      },
      /** `npm run preview` — 本番ビルドの確認用。LAN からも見えるように host を合わせる */
      preview: {
        port: 4173,
        strictPort: true,
        host: true,
        open: true,
      },
      plugins: [
        injectGa4Tag(env.VITE_GA_MEASUREMENT_ID),
        ...(mode === 'development' ? [rakudaDevApiStubs()] : []),
        react(),
        tailwindcss(),
      ],
      build: {
        /** Firebase Hosting の `public` と一致（既定も dist） */
        outDir: 'dist',
        chunkSizeWarningLimit: 900,
        rollupOptions: {
          input: {
            main: path.resolve(__dirname, 'index.html'),
          },
          output: {
            manualChunks(id) {
              if (!id.includes('node_modules')) return;
              if (id.includes('firebase')) return 'vendor-firebase';
              if (id.includes('@google/genai')) return 'vendor-google-genai';
              if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
                return 'vendor-react';
              }
            },
            entryFileNames: `assets/[name]-[hash].js`,
            chunkFileNames: `assets/[name]-[hash].js`,
            assetFileNames: `assets/[name]-[hash].[ext]`
          }
        }
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.GEMINI_API_KEY_2 || env.GEMINI_API_KEY2),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.GEMINI_API_KEY_2 || env.GEMINI_API_KEY2),
        'process.env.GEMINI_API_KEY_2': JSON.stringify(env.GEMINI_API_KEY_2),
        'process.env.GEMINI_API_KEY2': JSON.stringify(env.GEMINI_API_KEY2),
        'process.env.APP_URL': JSON.stringify(env.APP_URL),
        'process.env.SHARED_APP_URL': JSON.stringify(env.SHARED_APP_URL)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      }
    };
});
