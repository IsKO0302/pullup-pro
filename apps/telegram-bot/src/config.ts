/* ================= Bot configuration (environment variables; the token never leaves the server) ================= */
export interface BotConfig {
  botToken: string; databaseUrl: string; webAppUrl: string | null;
  mode: 'polling' | 'webhook'; webhookUrl: string | null; webhookSecret: string | null; port: number; host: string;
  reminders: boolean; reminderWindowMin: number; defaultTz: string; migrateOnStart: boolean; setupProfile: boolean;
}
const bool = (v: string | undefined, def: boolean) => v == null || v === '' ? def : /^(1|true|yes|on)$/i.test(v);

export function loadBotConfig(env: NodeJS.ProcessEnv = process.env): BotConfig {
  const botToken = (env.BOT_TOKEN || '').trim();
  if (!botToken) throw new Error('BOT_TOKEN is required: create a bot with @BotFather and put its token into .env');
  if (!/^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(botToken)) throw new Error('BOT_TOKEN does not look like a token from @BotFather (<digits>:<secret>)');
  const databaseUrl = env.DATABASE_URL || '';
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const webAppUrl = (env.WEBAPP_URL || '').trim() || null;
  if (webAppUrl && !/^https?:\/\//.test(webAppUrl)) throw new Error('WEBAPP_URL must be an absolute https:// URL');
  const mode = (env.BOT_MODE || 'polling') === 'webhook' ? 'webhook' : 'polling';
  const webhookUrl = (env.WEBHOOK_URL || '').trim() || null, webhookSecret = (env.WEBHOOK_SECRET || '').trim() || null;
  if (mode === 'webhook') {
    if (!webhookUrl || !/^https:\/\//.test(webhookUrl)) throw new Error('BOT_MODE=webhook needs WEBHOOK_URL=https://<domain>/<path>');
    if (!webhookSecret || !/^[A-Za-z0-9_-]{16,256}$/.test(webhookSecret)) throw new Error('BOT_MODE=webhook needs WEBHOOK_SECRET (16–256 chars: A-Z a-z 0-9 _ -)');
  }
  const port = Number(env.BOT_PORT || 8081);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('BOT_PORT must be a valid port');
  const win = Number(env.REMINDER_WINDOW_MIN || 5);
  return {
    botToken, databaseUrl, webAppUrl, mode, webhookUrl, webhookSecret, port, host: env.BOT_HOST || '0.0.0.0',
    reminders: bool(env.REMINDERS, true), reminderWindowMin: Number.isInteger(win) && win >= 1 && win <= 60 ? win : 5,
    defaultTz: env.DEFAULT_TZ || 'UTC', migrateOnStart: bool(env.MIGRATE_ON_START, true), setupProfile: bool(env.BOT_SETUP_PROFILE, true)
  };
}
