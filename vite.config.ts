import fs from 'node:fs';
import path from 'path';
import type { Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Vite 単体起動時は `server.mjs` の `/api/*` が存在しないため、
 * 三十（別オリジン）からの `GET /api/me/profile` が HTML を返して失敗する。
 * 開発時のみ server.mjs と同形の JSON を返し CORS を付与する。
 */
function rakudaDevApiMeProfileStub(): Plugin {
  return {
    name: 'rakuda-dev-api-me-profile-stub',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0] ?? '';
        if (pathname !== '/api/me/profile' && pathname !== '/api/me/profile/') {
          next();
          return;
        }
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
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as {
      version?: string;
    };
    return {
      server: {
        // NOTE: SANJUU dev relay typically uses :3000, so keep rakuda (Vite) on a different port.
        port: 5173,
        strictPort: true,
        host: true,
        open: true,
        hmr: false,
      },
      plugins: [
        ...(mode === 'development' ? [rakudaDevApiMeProfileStub()] : []),
        react(),
        tailwindcss(),
      ],
      build: {
        /** Firebase Hosting の `public` と一致（既定も dist） */
        outDir: 'dist',
        rollupOptions: {
          output: {
            entryFileNames: `assets/[name]-[hash].js`,
            chunkFileNames: `assets/[name]-[hash].js`,
            assetFileNames: `assets/[name]-[hash].[ext]`
          }
        }
      },
      define: {
        'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version ?? ''),
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
