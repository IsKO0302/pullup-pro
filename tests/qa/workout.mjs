// needs the dev server (npm run dev): uses the dev-only hook window.__pullup
// usage: node tests/qa/workout.mjs <baseUrl> <outDir> <width> <height> [light]
// Starts the recommended plan workout from demo data and screenshots the workout screens.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const [base, out, w = '1366', h = '900', theme = ''] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: +w, height: +h } })).newPage();
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
await page.goto(base + '#/home', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__pullup);
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__pullup);
await page.evaluate(() => window.__pullup.demo());
if (theme) await page.evaluate(t => window.__pullup.ACT.setTheme({ dataset: { v: t } }), theme);
await page.goto(base + '#/plan', { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const pre = await page.evaluate(() => [...document.querySelectorAll('.modal-wrap')].map(m => m.innerText.slice(0, 160)));
if (pre.length) console.log('pre-modals:', JSON.stringify(pre));
await page.evaluate(() => document.querySelectorAll('.modal-wrap').forEach(x => x.remove()));
await page.click('[data-act="stEngine"]');
await page.waitForSelector('.modal-wrap.in');
await page.waitForTimeout(400);
await page.click('[data-pk="feel"][data-v="4"]');
await page.click('[data-pk="sleep"][data-v="7"]');
await page.click('[data-pk="pain"][data-v="no"]');
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/1-precheck.png` });
await page.click('[data-pa="normal"]');
await page.waitForSelector('#train-root:not([hidden])');
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/2-warmup.png` });
// skip warm-up if offered
const skip = await page.$('[data-tr="toWork"]');
if (skip) { await skip.click(); await page.waitForTimeout(500); const c = page.locator('.modal-wrap.in .modal-foot .btn-acc'); if (await c.count()) { await c.first().click(); await page.waitForTimeout(600); } }
await page.screenshot({ path: `${out}/3-exercise.png` });
const done = page.locator('[data-tr="done"]:visible').first();
if (await done.count()) { await done.click(); await page.waitForTimeout(700); await page.screenshot({ path: `${out}/4-rest.png` }); }
const fin = page.locator('[data-tr="finish"]:visible').first(); if (await fin.count()) { await fin.click(); await page.waitForTimeout(600); await page.screenshot({ path: `${out}/5-finish.png` }); }
const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, W: innerWidth, tr: (() => { const r = document.getElementById('train-root'); return r ? r.scrollWidth - r.clientWidth : 0; })() }));
console.log(JSON.stringify({ errs, ov, buttons: await page.$$eval('#train-root [data-tr]', xs => [...new Set(xs.map(x => x.dataset.tr))]) }));
await browser.close();
