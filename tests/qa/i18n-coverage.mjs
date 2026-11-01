// Collects the Cyrillic texts the app shows (text nodes and placeholder/title/aria-label/alt) on every screen and in the main dialogs.
// ru → the complete list of source strings to translate;  en | tr → only the strings that are still NOT translated.
// Needs the dev server (npm run dev: it provides window.__pullup).
// usage: node tests/qa/i18n-coverage.mjs <baseUrl> <ru|en|tr> <out.json>     (CHROMIUM_PATH=<chrome.exe>)
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const [base = 'http://localhost:5173/', lang = 'ru', out = 'i18n-' + lang + '.json'] = process.argv.slice(2);
const ROUTES = ['home', 'train', 'group/pull', 'group/push', 'group/shoulders', 'group/core', 'group/legs', 'group/mobility', 'group/muscleup',
  'plan', 'programs', 'mu', 'library', 'library/pullup', 'library/plank', 'journal', 'stats', 'report', 'body', 'body/photos', 'nutrition', 'calendar',
  'builder', 'builder/new', 'profile', 'achievements', 'settings'];
const seen = new Map();   // normalized string -> { n, at: Set }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
async function session(w, h, mode) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: lang === 'tr' ? 'tr-TR' : lang === 'en' ? 'en-US' : 'ru-RU', timezoneId: 'Europe/Istanbul' });
  await ctx.addInitScript(l => { try { localStorage.setItem('pullup.lang', l); } catch (e) { /* ignore */ } }, lang);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.goto(base + '#/home', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__pullup);
  await page.evaluate(() => { const l = localStorage.getItem('pullup.lang'); localStorage.clear(); localStorage.setItem('pullup.lang', l); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__pullup);
  if (mode === 'demo') await page.evaluate(() => window.__pullup.demo());
  else if (mode === 'empty') await page.evaluate(() => window.__pullup.onboard());
  await page.waitForTimeout(300);
  return { ctx, page };
}
async function collect(page, where) {
  const items = await page.evaluate(() => {
    const res = [], CYR = /[А-Яа-яЁё]/, ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
    const walk = n => {
      if (n.nodeType === 3) { const v = n.nodeValue.replace(/\s+/g, ' ').trim(); if (v && CYR.test(v)) res.push(v); return; }
      if (n.nodeType !== 1 || ['SCRIPT', 'STYLE'].includes(n.tagName)) return;
      for (const a of ATTRS) { const v = (n.getAttribute(a) || '').replace(/\s+/g, ' ').trim(); if (v && CYR.test(v)) res.push(v); }
      n.childNodes.forEach(walk);
    };
    walk(document.body); const t = document.title; if (CYR.test(t)) res.push(t);
    return res;
  });
  for (const s of items) { const e = seen.get(s) || { n: 0, at: new Set() }; e.n++; e.at.add(where); seen.set(s, e); }
}
const visit = async (page, r) => { await page.goto(base + '#/' + r, { waitUntil: 'networkidle' }); await page.waitForTimeout(500); await page.evaluate(() => document.querySelectorAll('.modal-wrap').forEach(x => x.remove())); await collect(page, r); };
const click = async (page, sel, where, wait = 500) => { const el = page.locator(sel).first(); if (!(await el.count())) return false; await el.click({ timeout: 3000 }).catch(() => undefined); await page.waitForTimeout(wait); await collect(page, where); return true; };

// 1) every screen, with demo data (desktop) and for a new user without data
{
  const { ctx, page } = await session(1366, 900, 'demo');
  for (const r of ROUTES) await visit(page, r);
  // dialogs reachable from the main screens
  for (const [route, sel, where] of [['home', '[data-act="startMenu"]', 'dlg:startMenu'], ['train', '[data-act="testWizard"]', 'dlg:testWizard'], ['body', '[data-act="bodyAdd"]', 'dlg:bodyAdd'],
    ['profile', '[data-act="profEdit"]', 'dlg:profEdit'], ['settings', '[data-act="reOnboard"]', 'dlg:reOnboard'], ['nutrition', '[data-act="nuFoodAdd"]', 'dlg:food'], ['journal', '[data-act="jrAdd"]', 'dlg:journalAdd']]) {
    await visit(page, route); await click(page, sel, where); await page.evaluate(() => document.querySelectorAll('.modal-wrap').forEach(x => x.remove()));
  }
  // workout: check-in → warm-up → exercise → rest → finish
  await visit(page, 'plan');
  if (await click(page, '[data-act="stEngine"]', 'workout:checkin')) {
    await page.locator('[data-pk="feel"][data-v="4"]').click().catch(() => undefined); await page.locator('[data-pk="sleep"][data-v="7"]').click().catch(() => undefined); await page.locator('[data-pk="pain"][data-v="no"]').click().catch(() => undefined);
    await collect(page, 'workout:checkin2');
    if (await click(page, '[data-pa="normal"]', 'workout:warmup', 900)) {
      await click(page, '[data-tr="toWork"]', 'workout:toWork'); await click(page, '.modal-wrap.in .modal-foot .btn-acc', 'workout:confirm');
      await collect(page, 'workout:exercise');
      await click(page, '[data-tr="done"]:visible', 'workout:rest', 900);
      await click(page, '[data-tr="finish"]:visible', 'workout:finish', 700);
      await click(page, '.modal-wrap.in .modal-foot .btn-acc', 'workout:finish2', 700);
    }
  }
  await ctx.close();
}
{
  const { ctx, page } = await session(1366, 900, 'empty');
  for (const r of ['home', 'journal', 'stats', 'body', 'nutrition', 'achievements', 'calendar', 'plan']) await visit(page, r + '');
  await ctx.close();
}
// 2) first launch: onboarding
{
  const { ctx, page } = await session(900, 800, 'none');
  await page.waitForSelector('.ob-modal', { timeout: 5000 }).catch(() => undefined);
  await collect(page, 'onboarding:0');
  await page.click('label.check:has([data-ob="ok"]) .box').catch(() => undefined);
  for (let i = 1; i <= 7; i++) { const nx = page.locator('[data-ob="next"]:visible'); if (!(await nx.count())) break; await nx.first().click(); await page.waitForTimeout(350); await collect(page, 'onboarding:' + i); }
  await ctx.close();
}
await browser.close();
const list = [...seen.entries()].map(([s, e]) => ({ s, n: e.n, at: [...e.at].slice(0, 3) })).sort((a, b) => a.s.localeCompare(b.s, 'ru'));
writeFileSync(out, JSON.stringify(list, null, 1));
console.log(`${lang}: ${list.length} distinct Cyrillic strings → ${out}`);
