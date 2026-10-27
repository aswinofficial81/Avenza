import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3005',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3000,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@avenza/shared': resolve('../../packages/shared/src/index.ts'),
      '@': resolve('./src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');

          if (!normalizedId.includes('/node_modules/')) {
            return;
          }

          if (normalizedId.includes('/node_modules/@clerk/')) {
            return 'vendor-clerk';
          }

          if (normalizedId.includes('/node_modules/@tanstack/')) {
            return 'vendor-query';
          }

          if (
            normalizedId.includes('/node_modules/react-router/') ||
            normalizedId.includes('/node_modules/react-router-dom/') ||
            normalizedId.includes('/node_modules/@remix-run/')
          ) {
            return 'vendor-router';
          }

          if (
            /\/node_modules\/(?:react|react-dom|scheduler)\//.test(
              normalizedId,
            )
          ) {
            return 'vendor-react';
          }

          // Unmatched dependencies use Rollup's default chunk assignment.
          return undefined;
        },
      },
    },
  },
});
