// Vite config: React + Tailwind, jsdom for tests, and dev proxy /api -> backend on :8000 (no path rewrite).
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  build: {
    // Split the large vendor libraries into their own cacheable chunks so the app chunk stays under the 500 kB warning.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return undefined;
          if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react-vendor';
          if (/\/node_modules\/(recharts|d3-|victory-vendor|lodash)/.test(id)) return 'charts';
          if (id.includes('/node_modules/@radix-ui/')) return 'radix';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    env: { VITE_USE_FIXTURES: 'true' },
  },
});
