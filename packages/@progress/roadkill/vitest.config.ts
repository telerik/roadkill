import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Enable TypeScript support
    globals: true,
  },
});