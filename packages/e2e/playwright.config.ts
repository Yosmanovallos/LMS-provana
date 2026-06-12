import { defineConfig, devices } from '@playwright/test';

/**
 * Golden journeys against `pnpm dev` (master plan §15). Both servers are booted by
 * Playwright; the API seeds the demo scenario on boot (ADR-007 in-memory persistence).
 *
 * workers: 1 — all journeys share ONE in-memory API process, so they run serially in
 * file-name order (01–08). Journeys are written to be state-disjoint anyway (mutations
 * go through Ben or freshly created entities; Ana's seeded 82% is only ever read), but
 * serial execution removes cross-journey races on shared queues/inboxes for free.
 * Per-worker API instances are the upgrade path if wall time ever matters (<10 min now).
 */
export default defineConfig({
  testDir: './tests',
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @lms/api dev',
      url: 'http://localhost:3001/health',
      reuseExistingServer: false, // journeys mutate in-memory state — every run must start seeded-fresh
      timeout: 90_000,
      cwd: '../..',
    },
    {
      command: 'pnpm --filter @lms/web dev',
      url: 'http://localhost:3000/personas',
      reuseExistingServer: false, // journeys mutate in-memory state — every run must start seeded-fresh
      timeout: 120_000,
      cwd: '../..',
    },
  ],
});
