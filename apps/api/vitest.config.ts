import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    hookTimeout: 180000,
    testTimeout: 120000,
    fileParallelism: false,
  },
});
