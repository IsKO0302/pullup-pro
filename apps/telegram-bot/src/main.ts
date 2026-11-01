/* ================= Bot entry point: long polling (default) or webhook ================= */
import { createServer } from 'node:http';
import { webhookCallback } from 'grammy';
import { createPool, migrate } from '@pullup/db';
import { loadBotConfig } from './config';
import { createBot, setupBotProfile } from './bot';
import { startReminderLoop } from './reminders';

const log = (m: string, e?: unknown) => console.log(`[bot] ${m}`, e instanceof Error ? e.message : (e ?? ''));
const ALLOWED = ['message', 'callback_query', 'my_chat_member'] as const;

async function main() {
  const cfg = loadBotConfig();
  const pool = createPool(cfg.databaseUrl);
  if (cfg.migrateOnStart) await migrate(pool, undefined, m => log(m));
  const bot = createBot(cfg.botToken, { pool, webAppUrl: cfg.webAppUrl, defaultTz: cfg.defaultTz, log });
  await bot.init();
  log(`authorized as @${bot.botInfo.username} — set BOT_USERNAME=${bot.botInfo.username} for the API`);
  if (cfg.setupProfile) await setupBotProfile(bot, cfg.webAppUrl, m => log(m));
  const stopReminders = cfg.reminders ? startReminderLoop(bot.api, pool, { webAppUrl: cfg.webAppUrl, windowMin: cfg.reminderWindowMin, defaultTz: cfg.defaultTz, log }) : () => undefined;

  let server: ReturnType<typeof createServer> | null = null;
  if (cfg.mode === 'webhook') {
    const path = new URL(cfg.webhookUrl!).pathname;
    const handle = webhookCallback(bot, 'http', { secretToken: cfg.webhookSecret!, onTimeout: 'return' });
    server = createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); return; }
      if (req.method === 'POST' && (req.url || '').split('?')[0] === path) { void handle(req, res); return; }
      res.writeHead(404); res.end();
    });
    await new Promise<void>(r => server!.listen(cfg.port, cfg.host, () => r()));
    await bot.api.setWebhook(cfg.webhookUrl!, { secret_token: cfg.webhookSecret!, allowed_updates: [...ALLOWED], drop_pending_updates: false });
    log(`webhook mode: listening on ${cfg.host}:${cfg.port}${path}`);
  } else {
    await bot.api.deleteWebhook();
    void bot.start({ allowed_updates: [...ALLOWED], onStart: () => log('long polling started') });
  }
  let closing = false;
  const stop = async (sig: string) => {
    if (closing) return; closing = true; log(`${sig}: stopping`);
    stopReminders();
    try { if (server) await new Promise(r => server!.close(() => r(null))); else await bot.stop(); }
    finally { await pool.end().catch(() => undefined); process.exit(0); }
  };
  process.on('SIGTERM', () => void stop('SIGTERM'));
  process.on('SIGINT', () => void stop('SIGINT'));
}
main().catch(e => { console.error('[bot] failed to start:', e instanceof Error ? e.message : e); process.exit(1); });
