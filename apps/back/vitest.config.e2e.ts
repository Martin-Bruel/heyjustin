import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// e2e tests read their tokens from .env (or the shell); workers inherit them
if (existsSync('.env')) process.loadEnvFile('.env');

/**
 * End-to-end tests, in test/ (`npm run test:e2e`): against real services
 * (e.g. the Pennylane sandbox). Not part of `vitest run src` nor the
 * pre-commit hook: they need the network and tokens.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // a 409 "file not ready" is retried for up to 14 s
    testTimeout: 60_000,
    hookTimeout: 30_000,
    // one file at a time: Pennylane allows 25 requests per 5 s per token
    fileParallelism: false,
    env: { NEST_LOG_LEVEL: 'warn' },
  },
});
