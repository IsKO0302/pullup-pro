/* ================= API configuration (environment variables only — no secrets in code) ================= */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { withEnvAliases } from '@pullup/shared/env';

export interface ApiConfig {
  port: number; host: string; databaseUrl: string;
  /** Telegram bot token: used ONLY on the server to validate Mini App initData (never sent to the client) */
  botToken: string | null; botUsername: string | null; webAppUrl: string | null;
  corsOrigins: string[]; webDist: string | null; allowPhotos: boolean; maxPhotoBytes: number;
  sessionTtlDays: number; initDataMaxAgeSec: number; trustProxy: boolean; rateLimitPerMin: number; authRateLimitPerMin: number;
  migrateOnStart: boolean; version: string; logLevel: string;
}

const bool = (v: string | undefined, def: boolean) => v == null || v === '' ? def : /^(1|true|yes|on)$/i.test(v);
function int(name: string, v: string | undefined, def: number, min: number, max: number): number {
  if (v == null || v === '') return def;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be an integer between ${min} and ${max} (got "${v}")`);
  return n;
}
function defaultWebDist(): string | null {
  // apps/api/src/config.ts and the bundle apps/api/dist/server.js both resolve to apps/web/dist
  const p = fileURLToPath(new URL('../../web/dist', import.meta.url));
  return existsSync(p) ? p : null;
}

export function loadConfig(rawEnv: NodeJS.ProcessEnv = process.env): ApiConfig {
  const env = withEnvAliases(rawEnv);
  const databaseUrl = env.DATABASE_URL || '';
  if (!databaseUrl) throw new Error('DATABASE_URL is required, e.g. postgres://pullup:pullup@localhost:5432/pullup');
  const botToken = (env.BOT_TOKEN || '').trim() || null;
  if (botToken && !/^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(botToken)) throw new Error('BOT_TOKEN does not look like a token from @BotFather (<digits>:<secret>)');
  const botUsername = (env.BOT_USERNAME || '').trim().replace(/^@/, '') || null;
  if (botUsername && !/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(botUsername)) throw new Error('BOT_USERNAME must be the bot username without @');
  const webAppUrl = (env.WEBAPP_URL || '').trim() || null;
  if (webAppUrl && !/^https?:\/\//.test(webAppUrl)) throw new Error('WEBAPP_URL must be an absolute URL (https:// in production)');
  const webDist = env.WEB_DIST === 'off' ? null : (env.WEB_DIST ? env.WEB_DIST : defaultWebDist());
  return {
    port: int('PORT', env.PORT, 8080, 1, 65535), host: env.HOST || '0.0.0.0', databaseUrl,
    botToken, botUsername, webAppUrl,
    corsOrigins: (env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
    webDist, allowPhotos: bool(env.ALLOW_PHOTOS, true), maxPhotoBytes: int('MAX_PHOTO_MB', env.MAX_PHOTO_MB, 15, 1, 50) * 1024 * 1024,
    sessionTtlDays: int('SESSION_TTL_DAYS', env.SESSION_TTL_DAYS, 90, 1, 365),
    initDataMaxAgeSec: int('INITDATA_MAX_AGE', env.INITDATA_MAX_AGE, 86_400, 60, 30 * 86_400),
    trustProxy: bool(env.TRUST_PROXY, false),
    rateLimitPerMin: int('RATE_LIMIT', env.RATE_LIMIT, 300, 10, 100_000),
    authRateLimitPerMin: int('AUTH_RATE_LIMIT', env.AUTH_RATE_LIMIT, 30, 3, 10_000),
    migrateOnStart: bool(env.MIGRATE_ON_START, true),
    version: env.APP_VERSION || '2.0.0', logLevel: env.LOG_LEVEL || 'info'
  };
}
