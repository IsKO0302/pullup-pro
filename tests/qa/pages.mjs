// needs the dev server (npm run dev): uses the dev-only hook window.__pullup
// usage: node tests/qa/pages.mjs <baseUrl> <outDir> <width> <height> <mode: demo|empty> <routes comma-separated>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const [base, out, w = '1366', h = '900', mode = 'demo', routes = 'home'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
let errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
await page.goto(base + '#/home', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__pullup);
await page.evaluate(m => { localStorage.clear(); }, mode);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__pullup);
await page.evaluate(m => { if (m === 'demo') window.__pullup.demo(); else window.__pullup.onboard(); }, mode);
await page.waitForTimeout(400);
if (process.env.THEME) await page.evaluate(t => window.__pullup.ACT.setTheme({ dataset: { v: t } }), process.env.THEME);
for (const r of routes.split(',')) {
  errs = [];
  await page.goto(base + '#/' + r, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.querySelectorAll('.modal-wrap').forEach(x => x.remove()));
  await page.waitForTimeout(700);
  const ov = await page.evaluate(() => {
    const W = window.innerWidth, bad = [];
    for (const el of document.querySelectorAll('#view *')) {
      const r = el.getBoundingClientRect(); if (!r.width) continue;
      if (r.right > W + 1 && getComputedStyle(el).position !== 'fixed') {
        let p = el.parentElement, clipped = false;
        while (p && p.id !== 'view') { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { clipped = true; break; } p = p.parentElement; }
        if (!clipped) bad.push((el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : el.tagName) + ' ' + Math.round(r.right));
      }
    }
    return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 6) };
  });
  const name = r.replace(/\//g, '_') || 'home';
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log(`${r}: ${errs.length ? errs.join(' | ') : 'ok'}${ov.sw > ov.W || ov.bad.length ? ` OVERFLOW sw=${ov.sw} W=${ov.W} ${ov.bad.join(', ')}` : ''}`);
}
await browser.close();
