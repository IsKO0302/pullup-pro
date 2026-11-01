import { createPool } from './pool';
import { migrate } from './migrate';

const pool = createPool();
migrate(pool)
  .then(a => { console.log(a.length ? `[db] ${a.length} migration(s) applied` : '[db] schema is up to date'); return pool.end(); })
  .catch(e => { console.error('[db]', e.message); pool.end().finally(() => process.exit(1)); });
