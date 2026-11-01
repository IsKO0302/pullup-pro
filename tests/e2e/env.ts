// Shared constants of the E2E environment (used by playwright.config.ts, the E2E server and the specs).
import os from 'node:os';
import path from 'node:path';

export const E2E_PORT = Number(process.env.E2E_PORT || 4310);
/** fake bot token, valid format only — used to sign test initData and by the in-test bot */
export const E2E_BOT_TOKEN = '123456789:AAtest_token_for_e2e_tests_only_00000';
export const E2E_BOT_USERNAME = 'pullup_test_bot';
export const E2E_WEBAPP_URL = 'https://fit.example.org/';
export const E2E_DB_URL = process.env.E2E_DATABASE_URL || 'postgres://postgres@127.0.0.1:5432/pullup_e2e';
/** the server serves a COPY of apps/web/dist from here, so the PWA test can publish a "new version" safely */
export const E2E_WEB_DIR = path.join(os.tmpdir(), 'pullup-pro-e2e-web');
