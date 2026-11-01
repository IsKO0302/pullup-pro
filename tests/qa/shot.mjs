// usage: node tests/qa/shot.mjs <url> <out.png> [width=1400] [height=900] [full=1] [waitMs=600]
import { chromium } from 'playwright';
const [url, out, w = '1400', h = '900', full = '1', waitMs = '600'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(+waitMs);
await page.screenshot({ path: out, fullPage: full === '1' });
console.log(errs.length ? errs.join('\n') : 'no errors');
await browser.close();
