// Bundles a Node.js service (API or bot) into one ESM file with esbuild.
// Workspace packages (@pullup/*, TypeScript sources) are inlined; npm dependencies stay external
// and are loaded from node_modules at runtime (install with `npm ci --omit=dev`).
// usage: node scripts/bundle.mjs <entry.ts> <out.js>   (paths relative to the repository root)
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const [entry, out] = process.argv.slice(2);
if (!entry || !out) { console.error('usage: node scripts/bundle.mjs <entry.ts> <out.js>'); process.exit(2); }

const externalDeps = {
  name: 'external-npm-deps',
  setup(b) {
    b.onResolve({ filter: /^[^./]/ }, args => {
      if (args.path.startsWith('@pullup/') || args.path.startsWith('node:')) return undefined;
      return { path: args.path, external: true };
    });
  }
};
const r = await build({
  entryPoints: [resolve(root, entry)], outfile: resolve(root, out), bundle: true, platform: 'node', format: 'esm',
  target: 'node22', sourcemap: true, legalComments: 'none', logLevel: 'warning', metafile: true,
  tsconfig: resolve(root, 'tsconfig.base.json'), plugins: [externalDeps],
  banner: { js: "import { createRequire as __pullupCreateRequire } from 'node:module'; const require = __pullupCreateRequire(import.meta.url);" }
});
const bytes = Object.values(r.metafile.outputs).reduce((a, o) => a + o.bytes, 0);
console.log(`[bundle] ${out} (${Math.round(bytes / 1024)} KB incl. source map)`);
