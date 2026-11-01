import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const pkg = JSON.parse(readFileSync(r('./package.json'), 'utf8'));

/** Generates dist/sw.js: precache list = every emitted file (bundle + public dir), version = hash of the files and the SW template. */
function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'pullup-sw',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir.startsWith('/') ? c.build.outDir : join(c.root, c.build.outDir); },
    closeBundle() {
      const files: string[] = [];
      const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else files.push(p); } };
      walk(outDir);
      const list = files.map(f => relative(outDir, f).split(sep).join('/')).filter(f => f !== 'sw.js' && !f.endsWith('.map')).sort();
      const tpl = readFileSync(r('./sw/sw-template.js'), 'utf8');
      const h = createHash('sha256');
      h.update(tpl); // a change of the service worker itself is a new version too
      for (const f of list) { h.update(f); h.update(readFileSync(join(outDir, f))); }
      const version = `${pkg.version}-${h.digest('hex').slice(0, 10)}`;
      const precache = ['./', ...list.map(f => './' + f)];
      writeFileSync(join(outDir, 'sw.js'), tpl.replace("'__VERSION__'", JSON.stringify(version)).replace('__PRECACHE__', JSON.stringify(precache, null, 0)));
      writeFileSync(join(outDir, 'version.json'), JSON.stringify({ version, files: list.length, builtAt: new Date().toISOString() }) + '\n');
      console.log(`[pullup-sw] sw.js ${version}: ${precache.length} files precached`);
    }
  };
}

export default defineConfig({
  base: './',
  resolve: {
    alias: { '@pullup/shared': r('../../packages/shared/src') }
  },
  plugins: [serviceWorker()],
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 900
  },
  server: { port: 5173, proxy: { '/api': 'http://localhost:8080' } },
  preview: { port: 4173, proxy: { '/api': 'http://localhost:8080' } }
});
