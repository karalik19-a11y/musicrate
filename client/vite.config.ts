import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/**
 * `PAGES=1 npm run build` produces a fully static bundle:
 *   • relative asset URLs (`./assets/…`) so it works from any sub-path
 *     (github.io/<repo>/docs/app/, a custom domain, or a `file://` copy);
 *   • no `/api` proxy assumptions — the client picks its data source at boot.
 */
const isPages = process.env.PAGES === '1';

export default defineConfig({
  base: isPages ? './' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.API_URL || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
    rollupOptions: {
      output: {
        // long-lived vendor chunks: app code changes far more often than these
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          motion: ['motion/react'],
          data: ['@tanstack/react-query', 'zustand'],
        },
      },
    },
  },
});
