// Builds PULLUP PRO as ONE self-contained HTML file from apps/web/dist: JavaScript, CSS and icons are inlined,
// so the file opens by double click (file://) without a web server and without internet.
// A normal build (apps/web/dist) cannot be opened from disk: browsers block module scripts and CORS styles on file://.
// The single file has no service worker, no installation and no sync (the app detects it: isSingleFile());
// data stays in this browser (localStorage + IndexedDB) and moves between devices via «Экспорт JSON» / «Импорт».
// usage: npm run build:single   (runs the web build first)  →  dist-single/PULLUP-PRO-<version>.html
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'apps/web/dist');
const outDir = join(root, 'dist-single');
if (!existsSync(join(dist, 'index.html'))) { console.error('apps/web/dist is missing — run npm run build:web first'); process.exit(1); }

const { version } = JSON.parse(readFileSync(join(dist, 'version.json'), 'utf8'));
let html = readFileSync(join(dist, 'index.html'), 'utf8');
const read = f => readFileSync(join(dist, f.replace(/^\.\//, '')));
/** inline code must not be able to close its own element or open an HTML comment inside <script> */
const safe = (code, tag) => {
  for (const bad of [`</${tag}`, '<!--', '<script']) if (code.toLowerCase().includes(bad)) throw new Error(`cannot inline: ${tag} contains "${bad}"`);
  return code;
};
let js = 0, css = 0;
html = html.replace(/<script type="module"[^>]*\ssrc="([^"]+\.js)"[^>]*><\/script>/g, (_, f) => { js++; return `<script type="module">\n${safe(read(f).toString('utf8'), 'script')}\n</script>`; });
html = html.replace(/<link rel="stylesheet"[^>]*\shref="([^"]+\.css)"[^>]*>/g, (_, f) => { css++; return `<style>\n${safe(read(f).toString('utf8'), 'style')}\n</style>`; });
if (js !== 1 || css !== 1) throw new Error(`expected exactly one JS and one CSS file, found ${js} / ${css}`);
const dataUri = (f, type) => `data:${type};base64,${read(f).toString('base64')}`;
html = html.replace(/\s*<link rel="manifest"[^>]*>/, '')
  .replace('href="./icons/favicon.svg"', `href="${dataUri('icons/favicon.svg', 'image/svg+xml')}"`)
  .replace('href="./icons/favicon-32.png"', `href="${dataUri('icons/favicon-32.png', 'image/png')}"`)
  .replace('href="./icons/apple-touch-icon.png"', `href="${dataUri('icons/apple-touch-icon.png', 'image/png')}"`)
  .replace('<html lang="ru">', '<html lang="ru" data-build="single">')
  .replace('<!DOCTYPE html>', `<!DOCTYPE html>\n<!-- PULLUP PRO ${version} · версия в одном файле: открывается двойным щелчком, работает без сервера и интернета -->`);
const left = html.match(/(?:src|href)="\.\/[^"]+"/g);
if (left) throw new Error('unresolved local references: ' + left.join(', '));
if (!html.includes('data-build="single"')) throw new Error('html tag not marked as single-file build');

mkdirSync(outDir, { recursive: true });
const name = `PULLUP-PRO-${version.split('-')[0]}.html`;
writeFileSync(join(outDir, name), html);
console.log(`[single-file] dist-single/${name}: ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB (${version})`);
