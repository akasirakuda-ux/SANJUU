import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        strictPort: true,
        host: true,
        open: true,
        hmr: false,
      },
      plugins: [
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
