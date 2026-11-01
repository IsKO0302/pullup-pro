// Screenshots of the main screens for a visual report, taken from the single-file build (npm run build:single):
// the app runs from disk with its own demo history (labelled «ДЕМО-ДАННЫЕ» in the app), no server and no dev hooks.
// usage: node tests/qa/screens.mjs <outDir>      (browser: Playwright's Chromium or CHROMIUM_PATH)
import { chromium } from 'playwright';
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = process.argv[2] || 'qa-screens';
mkdirSync(out, { recursive: true });
const dir = join(process.cwd(), 'dist-single'), file = readdirSync(dir).find(f => /^PULLUP-PRO-.*\.html$/.test(f));
if (!file) { console.error('dist-single/*.html not found — run npm run build:single'); process.exit(1); }
const URL_ = pathToFileURL(join(dir, file)).href;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const errors = [];

async function session(name, opts, fn) {
  const ctx = await browser.newContext(opts), page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  const shot = async (n, o = {}) => { await page.waitForTimeout(o.wait ?? 450); await page.screenshot({ path: join(out, `${name}-${n}.png`), fullPage: !!o.full }); };
  const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(350); await page.evaluate(() => window.scrollTo(0, 0)); };
  await page.goto(URL_ + '#/home');
  await fn(page, shot, go);
  await ctx.close();
}
/** onboarding (7 steps) → demo history; screenshots of the first steps when `shots` is set */
async function onboarding(page, shot, shots) {
  await page.waitForSelector('.ob-modal');
  if (shots) await shot('01-welcome');
  await page.click('label.check:has([data-ob="ok"]) .box'); await page.click('[data-ob="next"]');
  await page.fill('#ob-name', 'Иса'); await page.fill('#ob-height', '180');
  if (shots) await shot('02-profile');
  await page.click('[data-ob="next"]'); await page.click('[data-ob="next"]');    // results → equipment
  if (shots) await shot('03-equipment');
  await page.click('[data-ob="next"]'); await page.click('[data-ob="next"]');    // schedule → goals
  if (shots) await shot('04-goals');
  await page.click('[data-ob="next"]');                                         // plan
  if (shots) await shot('05-plan');
  await page.click('[data-ob="demo"]');
  await page.waitForSelector('.ob-modal', { state: 'detached' });
  await page.evaluate(() => document.querySelectorAll('#toasts .toast').forEach(t => t.remove()));
}

const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
await session('phone', phone, async (page, shot, go) => {
  await onboarding(page, shot, true);
  for (const [h, n] of [['#/home', '10-home'], ['#/plan', '11-plan'], ['#/stats', '12-stats'], ['#/report', '13-report'], ['#/body', '14-body'],
    ['#/calendar', '15-calendar'], ['#/mu', '16-mu'], ['#/achievements', '17-achievements'], ['#/library', '18-library'], ['#/library/pullup', '19-exercise'],
    ['#/settings', '20-settings']]) { await go(h); await shot(n, { wait: 700 }); }
  await go('#/nutrition'); await page.click('[data-act="nutOn"]'); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelectorAll('#toasts .toast').forEach(t => t.remove())); await shot('21-nutrition');
  // workout: readiness check → warm-up → set → rest timer → summary
  await go('#/plan');
  await page.locator('#view [data-act="stEngine"]').first().click();
  await page.click('[data-pk="feel"][data-v="4"]'); await page.click('[data-pk="sleep"][data-v="7"]'); await page.click('[data-pk="pain"][data-v="no"]');
  await shot('30-check');
  await page.click('[data-pa="normal"]'); await page.waitForSelector('#train-root:not([hidden])');
  await shot('31-warmup');
  const boxes = page.locator('#train-root .warm-list label.check .box'), n = await boxes.count();
  for (let i = 0; i < n; i++) await boxes.nth(i).click();
  await page.click('[data-tr="toWork"]'); await shot('32-set');
  await page.locator('[data-tr="done"]:visible').click(); await shot('33-rest', { wait: 1300 });
  await page.click('[data-tr="restSkip"]'); await page.locator('[data-tr="done"]:visible').click(); await page.click('[data-tr="restSkip"]');
  await page.locator('.tr-top [data-tr="finish"], [data-tr="finish"]').first().click();
  await page.locator('.modal-wrap.in [data-ok]').last().click();
  await page.click('[data-trf="feel"][data-v="4"]'); await page.click('[data-trf="rpe"][data-v="7"]');
  await shot('34-summary');
});
const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
await session('desktop', desktop, async (page, shot, go) => {
  await onboarding(page, shot, false);
  for (const [h, n] of [['#/home', '40-home'], ['#/stats', '41-stats'], ['#/report', '42-report'], ['#/library/pullup', '43-exercise'],
    ['#/calendar', '44-calendar'], ['#/body', '45-body'], ['#/plan', '46-plan'], ['#/programs', '47-programs']]) { await go(h); await shot(n, { wait: 800 }); }
});
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : `ok: ${readdirSync(out).length} screenshots in ${out}`);
