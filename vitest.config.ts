import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    coverage: {
      include: ['src/**/*'],
      exclude: ['src/**/*.stories.{js,jsx,ts,tsx}'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          // Tests only run from a __tests__/ folder. A test placed anywhere
          // else silently does not run, which makes the placement rule
          // self-enforcing. See agents/rules/testing-placement.md.
          include: ['src/**/__tests__/**/*.test.{js,ts}', '__tests__/**/*.test.{js,ts}'],
          // Browser-persisted data needs real IndexedDB, so the local/ tier
          // runs in the browser project instead.
          exclude: ['**/src/features/*/local/__tests__/**'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          include: [
            'src/**/__tests__/**/*.test.tsx',
            '__tests__/**/*.test.tsx',
            'src/features/*/local/__tests__/**/*.test.ts',
          ],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            screenshotDirectory: 'vitest-test-results',
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
    reporters: [
      'default',
      // conditional reporter
      process.env.CI ? 'github-actions' : {},
    ],
    env: loadEnv('', process.cwd(), ''), // Expose .env variables to Node.js
  },
  optimizeDeps: {
    // Pre-bundled so the browser project does not reload mid-run when the
    // local/ tests pull Dexie in for the first time.
    include: ['dexie'],
  },
  define: {
    'process.env': JSON.stringify(loadEnv('', process.cwd(), 'NEXT_PUBLIC_')), // Expose .env variables to browser
  },
});
