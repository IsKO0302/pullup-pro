// E2E web server: resets the disposable E2E database, copies the production web build to a temporary
// folder (the PWA update test modifies sw.js there) and starts the built API, which also serves the web app.
import { cpSync, existsSync, rmSync } from 'node:fs';
import pg from 'pg';

const url = process.env.DATABASE_URL, web = process.env.E2E_WEB_DIR;
if (!/_e2e|_test/.test(url || '')) { console.error('refusing to reset a database whose name does not contain _e2e/_test:', url); process.exit(1); }
if (!existsSync('apps/web/dist/index.html') || !existsSync('apps/api/dist/server.js')) { console.error('build first: npm run build'); process.exit(1); }
if (!web || !/pullup-pro-e2e-web$/.test(web)) { console.error('E2E_WEB_DIR is not set'); process.exit(1); }
rmSync(web, { recursive: true, force: true }); cpSync('apps/web/dist', web, { recursive: true });
const c = new pg.Client({ connectionString: url });
await c.connect(); await c.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'); await c.end();
await import('../../apps/api/dist/server.js');
