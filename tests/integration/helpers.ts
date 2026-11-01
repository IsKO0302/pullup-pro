import { createPool, migrate, type Pool } from '@pullup/db';
import type { ApiConfig } from '../../apps/api/src/config';

/** a dedicated, disposable database: every test file drops and re-creates the schema */
export const TEST_DB = process.env.TEST_DATABASE_URL || '';
export const haveDb = !!TEST_DB;
if (!haveDb) console.warn('[integration] TEST_DATABASE_URL is not set — integration tests are skipped (see docs/TESTING.md)');

export async function freshPool(): Promise<Pool> {
  const pool = createPool(TEST_DB, 5);
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  await migrate(pool, undefined, () => undefined);
  return pool;
}
/** fake token for tests only — not a real bot */
export const TOKEN = '123456789:AAtest_token_for_integration_tests_0';
export function testConfig(over: Partial<ApiConfig> = {}): ApiConfig {
  return {
    port: 0, host: '127.0.0.1', databaseUrl: TEST_DB, botToken: TOKEN, botUsername: 'pullup_test_bot', webAppUrl: 'https://fit.example.org/',
    corsOrigins: [], webDist: null, allowPhotos: true, maxPhotoBytes: 2 * 1024 * 1024, sessionTtlDays: 30, initDataMaxAgeSec: 86_400,
    trustProxy: false, rateLimitPerMin: 10_000, authRateLimitPerMin: 1_000, migrateOnStart: false, version: 'test', logLevel: 'silent', ...over
  };
}
