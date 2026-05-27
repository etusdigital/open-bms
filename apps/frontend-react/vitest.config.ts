import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    // Pin the test timezone to the production server's (msgops-api runs
    // TZ=America/Sao_Paulo). Date-handling tests — e.g. scheduled-campaign
    // hydration (EVO-1413) — must be deterministic and exercise a non-UTC
    // offset so timezone bugs surface instead of coincidentally passing.
    env: { TZ: 'America/Sao_Paulo' },
    setupFiles: ['@retention/test-config/vitest-setup', './tests/setup.ts'],
    css: false,
    // v8 coverage instrumentation plus concurrent turbo task execution
    // pushes some async tests past the default 5s. Bump to 15s so coverage
    // runs are stable without masking genuinely slow test code.
    testTimeout: 15000,
    onConsoleLog(log) {
      if (log.includes('i18next') || log.includes('Locize')) return false;
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/**/__tests__/**',
        'src/**/__mocks__/**',
        'src/test-utils/**',
        'src/routeTree.gen.ts',
        'src/main.tsx',
      ],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
