import { defineConfig } from '@playwright/test';
import { E2E_BOT_TOKEN, E2E_BOT_USERNAME, E2E_DB_URL, E2E_PORT, E2E_WEBAPP_URL, E2E_WEB_DIR } from './tests/e2e/env';

// End-to-end tests run against the PRODUCTION build (a copy of apps/web/dist) served by the real API (apps/api/dist)
// with a disposable PostgreSQL database. Build first: `npm run build` (done automatically by `npm run test:e2e`).
export default defineConfig({
  testDir: 'tests/e2e', timeout: 90_000, expect: { timeout: 10_000 }, fullyParallel: false, workers: 1, retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}`, locale: 'ru-RU', timezoneId: 'Europe/Istanbul', viewport: { width: 1366, height: 900 },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] }, trace: 'retain-on-failure'
  },
  webServer: {
    command: 'node tests/e2e/server.mjs', url: `http://127.0.0.1:${E2E_PORT}/api/health`, reuseExistingServer: false, timeout: 60_000, stdout: 'ignore', stderr: 'pipe',
    env: {
      DATABASE_URL: E2E_DB_URL, PORT: String(E2E_PORT), HOST: '127.0.0.1', WEB_DIST: E2E_WEB_DIR, E2E_WEB_DIR,
      BOT_TOKEN: E2E_BOT_TOKEN, BOT_USERNAME: E2E_BOT_USERNAME, WEBAPP_URL: E2E_WEBAPP_URL, LOG_LEVEL: 'warn',
      RATE_LIMIT: '100000', AUTH_RATE_LIMIT: '1000'
    }
  }
});
