import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
  resolve: {
    alias: {
      '@avenza/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@': resolve(__dirname, './src'),
    },
  },
});
