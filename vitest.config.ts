import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve('.'),
      'server-only': path.resolve('tests/server-only.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'features/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '**/*.integration.test.ts', 'e2e/**', 'tests/e2e/**'],
    testTimeout: 30000,
    hookTimeout: 120000,
    setupFiles: ['@testing-library/jest-dom/vitest'],
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['features/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
      exclude: ['node_modules/', 'dist/', 'tests/', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
