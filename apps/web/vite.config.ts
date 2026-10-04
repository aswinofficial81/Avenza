import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: true,
  },
  preview: {
    port: 3001,
  },
  resolve: {
    alias: {
      '@avenza/shared': resolve('../../packages/shared/src/index.ts'),
      '@': resolve('./src'),
    },
  },
});
