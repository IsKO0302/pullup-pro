import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import type { Bot } from 'grammy';
import type { Page } from '@playwright/test';
import { test, expect, onboard, completeOnboarding, confirm, go, saved, lastToast } from './fixtures';
import { signInitData } from '../../apps/api/src/telegram-auth';
import { createBot } from '../../apps/telegram-bot/src/bot';
import { E2E_BOT_TOKEN, E2E_BOT_USERNAME, E2E_DB_URL, E2E_WEBAPP_URL } from './env';

/* Telegram Mini App E2E. The real Telegram client cannot run here, so:
 *  - telegram-web-app.js is replaced by tests/e2e/telegram-stub.js (records every SDK call);
 *  - initData is signed exactly like Telegram does, with the (fake) bot token the server is configured with;
 *  - the bot is the real grammY bot from apps/telegram-bot, fed with updates, its Bot API calls recorded. */
const STUB = readFileSync(path.resolve('tests/e2e/telegram-stub.js'), 'utf8');
const ISA = { id: 5550001, first_name: 'Isa', last_name: 'R', username: 'isa_fit', language_code: 'ru' };
const now = () => Math.floor(Date.now() / 1000);
const initData = (o: Record<string, any> = {}, token = E2E_BOT_TOKEN) => signInitData({ query_id: 'AAHe2eQuery', user: ISA, auth_date: now(), chat_type: 'private', ...o }, token);
const tgUrl = (data: string, o: { screen?: string; platform?: string; version?: string } = {}) =>
  `/${o.screen ? `?screen=${o.screen}` : ''}#tgWebAppData=${encodeURIComponent(data)}&tgWebAppVersion=${o.version || '8.0'}&tgWebAppPlatform=${o.platform || 'android'}&tgWebAppThemeParams=${encodeURIComponent('{"bg_color":"#17212b"}')}`;
const tg = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as any).__tg)));
const authOf = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('pullup.pro.auth') || 'null'));

test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ context }) => {
  await context.route('https://telegram.org/js/telegram-web-app.js', r => r.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: STUB }));
});

test('Mini App: launch, deep link, safe area, BackButton, MainButton, automatic sign-in', async ({ page }) => {
  const signIn = page.waitForResponse(r => r.url().endsWith('/api/auth/telegram'));
  await page.goto(tgUrl(initData(), { screen: 'stats' }));
  await expect(page.locator('body')).toHaveClass(/\bin-tg\b/);
  await expect(page).toHaveURL(/\?screen=stats#\/stats$/);                    // deep link from the bot button
  let T = await tg(page);
  expect(T.calls).toEqual(expect.arrayContaining(['ready', 'expand', 'disableVerticalSwipes']));
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tg-top').trim())).toBe('70px');   // safe area + content safe area
  expect(T.back).toBe(true);                                                          // inner screen → BackButton
  // the server validated initData and created the account
  expect((await signIn).status()).toBe(200);
  await expect.poll(async () => (await authOf(page))?.user?.telegramId).toBe(ISA.id);
  const A = await authOf(page);
  const acc = await page.request.get('/api/account', { headers: { authorization: `Bearer ${A.token}` } });
  expect(acc.status()).toBe(200);
  expect((await acc.json()).user).toMatchObject({ telegramId: ISA.id, username: 'isa_fit' });
  // first launch → personalisation
  await completeOnboarding(page);
  // BackButton: visible on inner screens, hidden on the home screen, navigates back
  await go(page, '#/home');
  await expect.poll(async () => (await tg(page)).back).toBe(false);
  await go(page, '#/journal');
  await expect.poll(async () => (await tg(page)).back).toBe(true);
  await page.evaluate(() => (window as any).__tgBack());
  await expect(page).toHaveURL(/#\/home$/);
  await expect.poll(async () => (await tg(page)).back).toBe(false);
  // MainButton mirrors «Начать тренировку» and is hidden while a dialog is open
  await expect.poll(async () => (await tg(page)).main).toEqual({ visible: true, text: 'НАЧАТЬ ТРЕНИРОВКУ' });
  await page.evaluate(() => (window as any).__tgMain());
  await expect(page.locator('.modal-wrap.in [data-pk="feel"]').first()).toBeVisible();       // pre-workout check-in
  await expect.poll(async () => (await tg(page)).main.visible).toBe(false);
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal-wrap')).toHaveCount(0);
  await expect.poll(async () => (await tg(page)).main.visible).toBe(true);
  // start a workout: closing confirmation on, MainButton hidden, full screen on a phone (Bot API 8.0)
  await page.evaluate(() => (window as any).__tgMain());
  await page.click('[data-pk="feel"][data-v="4"]'); await page.click('[data-pk="sleep"][data-v="7"]'); await page.click('[data-pk="pain"][data-v="no"]');
  await page.click('[data-pa="normal"]');
  await expect(page.locator('#train-root')).toBeVisible();
  T = await tg(page);
  expect(T.closingConfirmation).toBe(true); expect(T.main.visible).toBe(false);
  // leaving the workout (no sets done → nothing to save) restores the normal Telegram controls
  await page.locator('.tr-top [data-tr="finish"]').click(); await confirm(page);
  await expect(page.locator('#train-root')).toBeHidden();
  await expect.poll(async () => (await tg(page)).closingConfirmation).toBe(false);
  await expect.poll(async () => (await tg(page)).main.visible).toBe(true);
});

test('Mini App: theme «Системная» follows the Telegram color scheme; PULLUP PRO dark stays the default', async ({ page }) => {
  await page.goto(tgUrl(initData()));
  await completeOnboarding(page);
  await expect(page.locator('body')).not.toHaveClass(/\blight\b/);          // default: PULLUP PRO dark theme
  await page.evaluate(() => (window as any).__tgEmit('themeChanged', { colorScheme: 'light' }));
  await expect(page.locator('body')).not.toHaveClass(/\blight\b/);          // explicit dark is kept
  await go(page, '#/settings');
  await page.locator('#view [data-act="setTheme"][data-v="system"]').click();
  await expect(page.locator('body')).toHaveClass(/\blight\b/);              // follows Telegram (light)
  await page.evaluate(() => (window as any).__tgEmit('themeChanged', { colorScheme: 'dark' }));
  await expect(page.locator('body')).not.toHaveClass(/\blight\b/);
});

test('Mini App: forged, tampered and expired initData are rejected', async ({ page }) => {
  // signed with another bot token → the automatic sign-in fails, the app keeps working locally
  const signIn = page.waitForResponse(r => r.url().endsWith('/api/auth/telegram'));
  await page.goto(tgUrl(initData({}, '987654321:AAforged_token_not_the_real_one_000')));
  const r = await signIn;
  expect(r.status()).toBe(401);
  expect(await r.json()).toMatchObject({ code: 'initdata_bad_hash' });
  await completeOnboarding(page);
  expect(await authOf(page)).toBeNull();
  await go(page, '#/settings');
  await page.locator('#view [data-act="tgLogin"]').click();
  await expect(lastToast(page)).toContainText('Вход не удался');
  expect(await authOf(page)).toBeNull();
  // the user id is replaced after signing → hash mismatch
  const tampered = initData().replace(encodeURIComponent(JSON.stringify(ISA)), encodeURIComponent(JSON.stringify({ ...ISA, id: 1 })));
  const t = await page.request.post('/api/auth/telegram', { data: { initData: tampered } });
  expect(t.status()).toBe(401); expect((await t.json()).code).toBe('initdata_bad_hash');
  // a correctly signed but two-day-old initData
  const old = await page.request.post('/api/auth/telegram', { data: { initData: initData({ auth_date: now() - 2 * 86400 }) } });
  expect(old.status()).toBe(401); expect((await old.json()).code).toBe('initdata_expired');
});

/* ---------- Mini App + browser + bot through the real server ---------- */
const botInfo = { id: 999, is_bot: true as const, first_name: 'PULLUP PRO', username: E2E_BOT_USERNAME, can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false, allows_users_to_create_topics: false, can_manage_bots: false, supports_join_request_queries: false };
let upd = 1;
const command = (text: string) => ({ update_id: upd++, message: { message_id: upd, date: now(), chat: { id: ISA.id, type: 'private' as const, first_name: ISA.first_name }, from: { ...ISA, is_bot: false }, text, entities: [{ type: 'bot_command' as const, offset: 0, length: text.split(' ')[0].length }] } });
function recordedBot(pool: pg.Pool) {
  const bot: Bot = createBot(E2E_BOT_TOKEN, { pool: pool as any, webAppUrl: E2E_WEBAPP_URL, defaultTz: 'Europe/Istanbul', log: () => undefined }, { botInfo });
  const sent: any[] = [];
  bot.api.config.use(async (_prev, method, payload: any) => {
    if (method === 'sendMessage') sent.push(payload);
    return { ok: true, result: method === 'sendMessage' ? { message_id: sent.length, date: 0, chat: { id: payload.chat_id, type: 'private' }, text: payload.text } : true } as any;
  });
  return { bot, sent, ask: async (text: string) => { const n = sent.length; await bot.handleUpdate(command(text) as any); return sent.slice(n).map(m => m.text).join('\n'); } };
}
const serverRecords = async (page: Page, token: string) => {
  const r = await page.request.get('/api/sync/pull?since=0&limit=1000', { headers: { authorization: `Bearer ${token}` } });
  expect(r.status()).toBe(200); return (await r.json()).records as any[];
};

test('sync: Mini App → server → bot, browser sign-in via the bot, offline change and reconnection', async ({ page, browser }) => {
  const pool = new pg.Pool({ connectionString: E2E_DB_URL, max: 3 });
  const { ask } = recordedBot(pool);
  const V1 = JSON.parse(readFileSync(path.resolve('tests/fixtures/v1-backup.json'), 'utf8'));
  const nWork = V1.data.sessions.filter((s: any) => s.source !== 'quick').length;
  try {
    /* device A: Telegram Mini App — imports the history and turns sync on */
    await page.goto(tgUrl(initData()));
    await completeOnboarding(page);
    await expect.poll(async () => (await authOf(page))?.token || null).not.toBeNull();
    const tokenA = (await authOf(page)).token;
    await go(page, '#/settings');
    await page.setInputFiles('input[data-chg="impJson"]', path.resolve('tests/fixtures/v1-backup.json'));
    await confirm(page);
    await expect(lastToast(page)).toContainText('импортированы');
    expect(await ask('/stats')).toContain('Данных из приложения пока нет');  // nothing on the server yet
    await page.locator('label.switch:has(input[data-chg="cloudSw"])').click();
    await expect(lastToast(page)).toContainText('Синхронизировано');
    const recs = await serverRecords(page, tokenA);
    expect(recs.filter(r => r.c === 'sessions' && !r.deleted)).toHaveLength(V1.data.sessions.length);
    // the bot answers from the synced data
    expect(await ask('/stats')).toContain(`Тренировок всего: <b>${nWork}</b>`);

    /* device B: ordinary browser, signs in through the bot with a one-time code */
    const ctxB = await browser.newContext({ serviceWorkers: 'block' });
    const pageB = await ctxB.newPage();
    const errorsB: string[] = [];
    pageB.on('pageerror', e => errorsB.push(e.message));
    await onboard(pageB, { name: 'Ноутбук' });
    await go(pageB, '#/settings');
    await pageB.locator('#view [data-act="linkStart"]').click();
    const code = (await pageB.locator('.lc-code').textContent())!.trim();
    expect(code).toMatch(/^[A-Z0-9]{8}$/);
    const reply = await ask(`/start link_${code}`);
    expect(reply).toContain('Вход подтверждён');
    await expect(pageB.locator('.modal-wrap.in')).toContainText('Включить синхронизацию?', { timeout: 15_000 });
    await confirm(pageB);
    await expect(lastToast(pageB)).toContainText('Синхронизация включена');
    await expect.poll(async () => (await saved(pageB)).sessions.length).toBe(V1.data.sessions.length);
    expect((await authOf(pageB)).user.telegramId).toBe(ISA.id);

    /* device B goes offline, records a weigh-in, comes back online → pushed automatically */
    await ctxB.setOffline(true);
    await go(pageB, '#/body');
    await pageB.locator('#view [data-act="bodyAdd"]').first().click();
    await pageB.locator('.modal-wrap.in [data-bf="weight"]').fill('77.7');
    await pageB.locator('.modal-wrap.in [data-bsave]').click();
    await expect(pageB.locator('.modal-wrap.in')).toHaveCount(0);
    await expect.poll(() => pageB.evaluate(() => JSON.parse(localStorage.getItem('pullup.pro.sync') || '{}'))).toBeTruthy();
    await pageB.waitForTimeout(3000);                                           // the debounced sync attempt happens while offline
    expect((await serverRecords(page, tokenA)).some(r => r.c === 'body' && r.d && r.d.weight === 77.7)).toBe(false);
    await ctxB.setOffline(false);
    await expect.poll(async () => (await serverRecords(page, tokenA)).some(r => r.c === 'body' && r.d && r.d.weight === 77.7), { timeout: 15_000 }).toBe(true);

    /* device A pulls the change */
    await go(page, '#/settings');
    await page.locator('#view [data-act="syncGo"]').click();
    await expect.poll(async () => (await saved(page)).body.some((b: any) => b.weight === 77.7)).toBe(true);
    expect(await ask('/stats')).toContain('Вес: <b>77,7 кг</b>');
    expect(errorsB).toEqual([]);
    await ctxB.close();
  } finally { await pool.end(); }
});

test('Mini App on a 390 px phone: no horizontal overflow on the main screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(tgUrl(initData(), { platform: 'ios' }));
  await completeOnboarding(page, { demo: true });
  for (const r of ['home', 'train', 'plan', 'stats', 'journal', 'body', 'nutrition', 'calendar', 'achievements', 'profile', 'settings']) {
    await go(page, `#/${r}`);
    await expect(page.locator('#view')).not.toBeEmpty();
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(w, `#/${r} scrollWidth`).toBeLessThanOrEqual(390);
  }
});
