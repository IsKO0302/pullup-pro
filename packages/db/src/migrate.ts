import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from './pool';

/** default location: <repo>/database/migrations (override with MIGRATIONS_DIR) */
export const defaultMigrationsDir = (): string => {
  if (process.env.MIGRATIONS_DIR) return process.env.MIGRATIONS_DIR;
  for (const rel of ['../../../database/migrations', '../../database/migrations', '../database/migrations', './database/migrations']) {
    const p = fileURLToPath(new URL(rel, import.meta.url));
    if (existsSync(p)) return p;
  }
  return join(process.cwd(), 'database/migrations');
};

/**
 * Applies pending *.sql migrations in file-name order, each in its own transaction.
 * A session-level advisory lock prevents two processes (API + bot) from migrating at the same time.
 */
export async function migrate(pool: Pool, dir = defaultMigrationsDir(), log: (m: string) => void = console.log): Promise<string[]> {
  const files = readdirSync(dir).filter(f => /^\d+_.+\.sql$/.test(f)).sort();
  const c = await pool.connect();
  const applied: string[] = [];
  try {
    await c.query('SELECT pg_advisory_lock(727001)');
    await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const done = new Set((await c.query('SELECT name FROM schema_migrations')).rows.map(r => r.name as string));
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = readFileSync(join(dir, f), 'utf8');
      try {
        await c.query('BEGIN');
        await c.query(sql);
        await c.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
        await c.query('COMMIT');
      } catch (e) {
        await c.query('ROLLBACK');
        throw new Error(`migration ${f} failed: ${(e as Error).message}`);
      }
      applied.push(f); log(`[db] applied ${f}`);
    }
  } finally {
    try { await c.query('SELECT pg_advisory_unlock(727001)'); } catch { /* ignore */ }
    c.release();
  }
  return applied;
}
