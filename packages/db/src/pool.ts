import pg from 'pg';

// BIGINT (int8) → number: revisions and millisecond timestamps stay far below 2^53
pg.types.setTypeParser(20, (v: string) => Number(v));

export type Pool = pg.Pool;
export type Client = pg.PoolClient;

export function createPool(url = process.env.DATABASE_URL, max = Number(process.env.DB_POOL_MAX || 10)): pg.Pool {
  if (!url) throw new Error('DATABASE_URL is not set');
  const pool = new pg.Pool({ connectionString: url, max, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
  pool.on('error', e => console.error('[db] idle client error', e.message));
  return pool;
}

/** run `fn` inside a transaction (BEGIN / COMMIT, ROLLBACK on error) */
export async function tx<T>(pool: pg.Pool, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    try { await c.query('ROLLBACK'); } catch { /* connection already broken */ }
    throw e;
  } finally { c.release(); }
}

export async function ping(pool: pg.Pool): Promise<boolean> {
  try { await pool.query('SELECT 1'); return true; } catch { return false; }
}
