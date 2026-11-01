/* ================= API entry point ================= */
import { createPool, migrate, purgeExpired, syncCatalog } from '@pullup/db';
import { loadConfig } from './config';
import { buildApp } from './app';

async function main() {
  const cfg = loadConfig();
  const pool = createPool(cfg.databaseUrl);
  if (cfg.migrateOnStart) await migrate(pool);
  const app = await buildApp(cfg, pool);
  if (!cfg.botToken) app.log.warn('BOT_TOKEN is not set: Telegram sign-in is disabled (the app still works locally)');
  if (!cfg.webDist) app.log.info('web build not found: serving the API only (set WEB_DIST or run "npm run build:web")');
  // mirror the exercise / program catalog of this release into the catalog tables (relational model, SQL reports)
  try { const k = await syncCatalog(pool); if (k.changed) app.log.info(`catalog: ${k.exercises} exercises, ${k.programs} programs (${k.changed} rows updated)`); }
  catch (e) { app.log.warn({ err: e }, 'catalog sync failed (run the migrations)'); }
  const purge = setInterval(() => { purgeExpired(pool).catch(e => app.log.warn({ err: e }, 'purge failed')); }, 6 * 3600_000);
  purge.unref();
  let closing = false;
  const stop = async (sig: string) => {
    if (closing) return; closing = true;
    app.log.info(`${sig}: shutting down`);
    clearInterval(purge);
    try { await app.close(); } finally { await pool.end().catch(() => undefined); process.exit(0); }
  };
  process.on('SIGTERM', () => void stop('SIGTERM'));
  process.on('SIGINT', () => void stop('SIGINT'));
  await app.listen({ port: cfg.port, host: cfg.host });
}
main().catch(e => { console.error('[api] failed to start:', e instanceof Error ? e.message : e); process.exit(1); });
