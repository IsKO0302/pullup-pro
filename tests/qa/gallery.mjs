// Screenshot gallery of the whole web app (needs the dev server: npm run dev — it provides the QA hook window.__pullup).
// usage: node tests/qa/gallery.mjs <baseUrl> <outDir>      (CHROMIUM_PATH=<path to chrome.exe> if Playwright has no browser)
// Writes PNG files into <outDir>/{desktop,mobile,responsive,onboarding,empty,workout,light}/ and <outDir>/report.json
// (per-screen JavaScript errors and horizontal-overflow findings, so the gallery doubles as a visual smoke test).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const [base = 'http://localhost:5173/', out = 'docs/screenshots'] = process.argv.slice(2);
const ROUTES = ['home', 'train', 'group/pull', 'group/push', 'group/shoulders', 'group/core', 'group/legs', 'group/mobility', 'group/muscleup',
  'plan', 'programs', 'mu', 'library', 'library/pullup', 'journal', 'stats', 'report', 'body', 'body/photos', 'nutrition', 'calendar', 'builder', 'builder/new',
  'profile', 'achievements', 'settings'];
const WIDTHS = [[360, 780], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 900], [1920, 1080]];
const report = { generatedAt: new Date().toISOString(), screens: [] };
const slug = r => r.replace(/\//g, '_');
const ensure = p => { mkdirSync(p.replace(/[\\/][^\\/]+$/, ''), { recursive: true }); return p; };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });

async function fresh(w, h, mode, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: opts.dpr || 1, locale: 'ru-RU', timezoneId: 'Europe/Istanbul', isMobile: opts.mobile || false, hasTouch: opts.mobile || false });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.goto(base + '#/home', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__pullup);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__pullup);
  if (mode === 'demo') await page.evaluate(() => window.__pullup.demo());
  else if (mode === 'empty') await page.evaluate(() => window.__pullup.onboard());
  if (opts.theme) await page.evaluate(t => window.__pullup.ACT.setTheme({ dataset: { v: t } }), opts.theme);
  await page.waitForTimeout(300);
  return { ctx, page, errs };
}
async function overflow(page) {
  return page.evaluate(() => {
    const W = innerWidth, bad = [];
    for (const el of document.querySelectorAll('#view *')) {
      const r = el.getBoundingClientRect(); if (!r.width) continue;
      if (r.right > W + 1 && getComputedStyle(el).position !== 'fixed') {
        let p = el.parentElement, clipped = false;
        while (p && p.id !== 'view') { if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowX)) { clipped = true; break; } p = p.parentElement; }
        if (!clipped) bad.push((typeof el.className === 'string' && el.className ? '.' + el.className.split(' ').join('.') : el.tagName) + ' ' + Math.round(r.right));
      }
    }
    return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) };
  });
}
async function shot(page, errs, dir, name, label, full = true) {
  await page.evaluate(() => document.querySelectorAll('.modal-wrap').forEach(x => x.remove())).catch(() => undefined);
  await page.waitForTimeout(600);
  const ov = await overflow(page).catch(() => ({ sw: 0, W: 0, bad: [] }));
  const brokenText = await page.evaluate(() => /Не удалось открыть раздел|Группа не найдена|NaN|undefined|\[object Object\]/.test(document.getElementById('view')?.innerText || '')).catch(() => false);
  await page.screenshot({ path: ensure(`${out}/${dir}/${name}.png`), fullPage: full });
  const rec = { file: `${dir}/${name}.png`, label, errors: errs.splice(0), overflow: ov.sw > ov.W || ov.bad.length ? ov : null, brokenText };
  report.screens.push(rec);
  console.log(`${rec.file}: ${rec.errors.length || rec.overflow || rec.brokenText ? 'ISSUE ' + JSON.stringify({ e: rec.errors, o: rec.overflow, t: rec.brokenText }) : 'ok'}`);
}
async function visit(page, route) { await page.goto(base + '#/' + route, { waitUntil: 'networkidle' }); await page.waitForTimeout(300); }

// 1) every screen, desktop and phone, with the labelled demo history
for (const [dir, w, h, mobile] of [['desktop', 1366, 900, false], ['mobile', 390, 844, true]]) {
  const { ctx, page, errs } = await fresh(w, h, 'demo', { mobile, dpr: mobile ? 2 : 1 });
  let i = 0;
  for (const r of ROUTES) { await visit(page, r); await shot(page, errs, dir, String(++i).padStart(2, '0') + '-' + slug(r), r); }
  await ctx.close();
}
// 2) responsive matrix: three key screens at every required width
for (const [w, h] of WIDTHS) {
  const { ctx, page, errs } = await fresh(w, h, 'demo', { mobile: w < 768 });
  for (const r of ['home', 'train', 'stats']) { await visit(page, r); await shot(page, errs, 'responsive', `${r}-${w}`, `${r} @${w}`, false); }
  await ctx.close();
}
// 3) first launch: onboarding steps (phone)
{
  const { ctx, page, errs } = await fresh(390, 844, 'none', { mobile: true, dpr: 2 });
  await page.waitForSelector('.ob-modal', { timeout: 5000 });
  await page.screenshot({ path: ensure(`${out}/onboarding/01-disclaimer.png`) });
  await page.click('label.check:has([data-ob="ok"]) .box');
  for (let step = 2; step <= 8; step++) {
    const next = page.locator('[data-ob="next"]:visible');
    if (!(await next.count())) break;
    await next.first().click(); await page.waitForTimeout(400);
    await page.screenshot({ path: ensure(`${out}/onboarding/${String(step).padStart(2, '0')}-step.png`) });
  }
  report.screens.push({ file: 'onboarding/*', label: 'onboarding steps', errors: errs.splice(0) });
  await ctx.close();
}
// 4) empty states: a new user without history
{
  const { ctx, page, errs } = await fresh(1366, 900, 'empty');
  for (const r of ['home', 'journal', 'stats', 'body', 'nutrition', 'achievements']) { await visit(page, r); await shot(page, errs, 'empty', r, `${r} (no data)`); }
  await ctx.close();
}
// 5) workout mode: check-in, warm-up, exercise, rest timer, finish (phone and desktop)
for (const [dir, w, h, mobile] of [['workout', 390, 844, true], ['workout/desktop', 1366, 900, false]]) {
  const { ctx, page, errs } = await fresh(w, h, 'demo', { mobile, dpr: mobile ? 2 : 1 });
  await visit(page, 'plan');
  await page.evaluate(() => document.querySelectorAll('.modal-wrap').forEach(x => x.remove()));
  await page.click('[data-act="stEngine"]'); await page.waitForSelector('.modal-wrap.in'); await page.waitForTimeout(400);
  await page.click('[data-pk="feel"][data-v="4"]'); await page.click('[data-pk="sleep"][data-v="7"]'); await page.click('[data-pk="pain"][data-v="no"]');
  await page.waitForTimeout(200); await page.screenshot({ path: ensure(`${out}/${dir}/1-checkin.png`) });
  await page.click('[data-pa="normal"]'); await page.waitForSelector('#train-root:not([hidden])'); await page.waitForTimeout(700);
  await page.screenshot({ path: ensure(`${out}/${dir}/2-warmup.png`) });
  const skip = await page.$('[data-tr="toWork"]');
  if (skip) { await skip.click(); await page.waitForTimeout(500); const c = page.locator('.modal-wrap.in .modal-foot .btn-acc'); if (await c.count()) { await c.first().click(); await page.waitForTimeout(600); } }
  await page.screenshot({ path: ensure(`${out}/${dir}/3-exercise.png`) });
  const done = page.locator('[data-tr="done"]:visible').first();
  if (await done.count()) { await done.click(); await page.waitForTimeout(800); await page.screenshot({ path: ensure(`${out}/${dir}/4-rest-timer.png`) }); }
  const fin = page.locator('[data-tr="finish"]:visible').first();
  if (await fin.count()) { await fin.click(); await page.waitForTimeout(700); await page.screenshot({ path: ensure(`${out}/${dir}/5-finish.png`) }); }
  report.screens.push({ file: `${dir}/*`, label: 'workout flow', errors: errs.splice(0) });
  await ctx.close();
}
// 6) light theme
{
  const { ctx, page, errs } = await fresh(1366, 900, 'demo', { theme: 'light' });
  for (const r of ['home', 'stats', 'library/pullup']) { await visit(page, r); await shot(page, errs, 'light', slug(r), `${r} (light)`); }
  await ctx.close();
}

writeFileSync(ensure(`${out}/report.json`), JSON.stringify(report, null, 2));
const bad = report.screens.filter(s => s.errors?.length || s.overflow || s.brokenText);
console.log(`\n${report.screens.length} records, ${bad.length} with issues`);
await browser.close();
