import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    coverage: {
      include: ['brand.js'],
      thresholds: {
        lines: 90,
        statements: 90,
        branches: 80,
      },
    },
  },
});
