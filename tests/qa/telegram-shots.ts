// Screenshots of the Telegram Mini App (Android / iOS / Desktop sizes) and of the bot replies.
// The real Telegram client cannot run here: the SDK is replaced by tests/e2e/telegram-stub.js and initData is signed like Telegram does
// with a FAKE bot token that the local API is started with. The bot "chat" is a simulated rendering of the real bot texts.
// usage: npx tsx tests/qa/telegram-shots.ts <apiBaseUrl> <outDir>   (CHROMIUM_PATH=<chrome.exe>)
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { signInitData } from '../../apps/api/src/telegram-auth';
import { APP_MSG, HELP, PRIVACY, WELCOME } from '../../apps/telegram-bot/src/texts';
import { COMMANDS_EN } from '../../apps/telegram-bot/src/bot';

const [base = 'http://127.0.0.1:4311', out = 'docs/screenshots/telegram'] = process.argv.slice(2);
const TOKEN = '123456789:AAtest_token_for_e2e_tests_only_00000';       // fake, valid format only
const STUB = readFileSync('tests/e2e/telegram-stub.js', 'utf8');
mkdirSync(out, { recursive: true });
const user = { id: 5550123, first_name: 'Isa', username: 'isa_fit', language_code: 'ru' };
const initData = () => signInitData({ query_id: 'AAHqa', user, auth_date: Math.floor(Date.now() / 1000), chat_type: 'private' }, TOKEN);
const url = (platform: string) => `${base}/#tgWebAppData=${encodeURIComponent(initData())}&tgWebAppVersion=8.0&tgWebAppPlatform=${platform}&tgWebAppThemeParams=${encodeURIComponent('{"bg_color":"#17212b"}')}`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const errors: string[] = [];

for (const [name, platform, w, h, mobile] of [['android', 'android', 390, 844, true], ['ios', 'ios', 430, 932, true], ['desktop', 'tdesktop', 900, 800, false]] as const) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, locale: 'ru-RU', timezoneId: 'Europe/Istanbul', serviceWorkers: 'block' });
  await ctx.route('https://telegram.org/js/telegram-web-app.js', r => r.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: STUB }));
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`${name}: pageerror ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(`${name}: ${m.text()}`); });
  const signIn = page.waitForResponse(r => r.url().endsWith('/api/auth/telegram'));
  await page.goto(url(platform));
  const status = (await signIn).status();
  console.log(`${name}: server validated initData → HTTP ${status}`);
  await page.waitForSelector('.ob-modal');
  await page.screenshot({ path: `${out}/${name}-0-onboarding.png` });
  await page.click('label.check:has([data-ob="ok"]) .box');
  for (let i = 0; i < 6; i++) await page.click('[data-ob="next"]');
  await page.click('[data-ob="demo"]');
  await page.waitForTimeout(800);
  const tgState = await page.evaluate(() => JSON.parse(JSON.stringify((window as any).__tg)));
  console.log(`${name}: SDK calls ${JSON.stringify(tgState.calls)} back=${tgState.back} main=${JSON.stringify(tgState.main)}`);
  for (const r of ['home', 'train', 'mu', 'stats', 'body', 'profile', 'settings']) {
    await page.evaluate(h => { location.hash = '#/' + h; }, r); await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/${name}-${r}.png`, fullPage: false });
  }
  await ctx.close();
}

// simulated Telegram chat with the real bot texts
const cmds = COMMANDS_EN.map(c => `/${c.command} — ${c.description}`).join('<br>');
const bubble = (who: 'me' | 'bot', html: string, btn = '') => `<div class="m ${who}">${html.replace(/\n/g, '<br>')}${btn ? `<div class="btn">${btn}</div>` : ''}</div>`;
const chat = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0e1621;font:15px/1.4 system-ui,sans-serif;color:#fff;padding:16px;width:420px}
.hd{background:#17212b;margin:-16px -16px 14px;padding:12px 16px;font-weight:600}.hd small{display:block;font-weight:400;color:#7f91a4}
.m{max-width:360px;padding:8px 12px;border-radius:12px;margin:8px 0;background:#182533}.m.me{background:#2b5278;margin-left:auto;width:fit-content}
.btn{margin-top:8px;text-align:center;background:#233648;color:#6ab3f3;padding:8px;border-radius:8px;font-weight:600}
.note{color:#7f91a4;font-size:11px;text-align:center;margin-top:12px}</style>
<div class="hd">PULLUP PRO<small>bot · simulated rendering of the real bot texts</small></div>
${bubble('me', '/start')}${bubble('bot', WELCOME, 'OPEN PULLUP PRO')}
${bubble('me', '/app')}${bubble('bot', APP_MSG, 'OPEN PULLUP PRO')}
${bubble('me', '/help')}${bubble('bot', HELP, 'OPEN PULLUP PRO')}
${bubble('me', '/privacy')}${bubble('bot', PRIVACY, '⚙️ Настройки и данные')}
<div class="m"><b>Bot command menu</b><br>${cmds}</div>
<div class="note">Not a screenshot of the real Telegram client — see PROJECT_STATUS.md</div>`;
const p = await (await browser.newContext({ viewport: { width: 452, height: 800 }, deviceScaleFactor: 2 })).newPage();
await p.setContent(chat); await p.screenshot({ path: `${out}/bot-chat-simulated.png`, fullPage: true });
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console/page errors');
