import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, onboard, go, saved, lastToast } from './fixtures';
import { E2E_WEB_DIR } from './env';

/* PWA against the production build: manifest, install prompt, service worker, offline start and saving,
 * update of the app shell. The server serves a copy of apps/web/dist (E2E_WEB_DIR), so the update test
 * can publish a modified sw.js and restore it afterwards. */
const controlled = (page: Page) => page.evaluate(() => !!navigator.serviceWorker.controller);
const cacheKeys = (page: Page) => page.evaluate(() => caches.keys());
async function readyOffline(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect.poll(() => controlled(page), { timeout: 15_000 }).toBe(true);             // clients.claim() on activation
}
const pngSize = (b: Buffer) => `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;

test('manifest, icons and install metadata', async ({ page, request }) => {
  const r = await request.get('/manifest.webmanifest');
  expect(r.status()).toBe(200);
  expect(r.headers()['content-type']).toMatch(/application\/manifest\+json/);
  expect(r.headers()['cache-control']).toMatch(/no-cache/);
  const M = await r.json();
  expect(M.name).toContain('PULLUP PRO'); expect(M.short_name).toBeTruthy();
  expect(M.display).toBe('standalone'); expect(M.start_url).toBeTruthy(); expect(M.scope).toBeTruthy();
  expect(M.theme_color).toMatch(/^#[0-9a-f]{6}$/i); expect(M.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  expect(M.icons.map((i: any) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(M.icons.some((i: any) => /maskable/.test(i.purpose || ''))).toBe(true);
  for (const i of M.icons) {                                                           // every icon exists and has the declared size
    const ir = await request.get('/' + String(i.src).replace(/^\.?\//, ''));
    expect(ir.status(), i.src).toBe(200);
    expect(ir.headers()['content-type']).toBe(i.type);
    if (i.type === 'image/png') expect(pngSize(await ir.body()), i.src).toBe(i.sizes);
  }
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  expect(await page.title()).toContain('PULLUP PRO');
});

test('install: the dashboard banner uses the browser install prompt', async ({ page }) => {
  await onboard(page);
  // Chromium fires beforeinstallprompt only after its own engagement heuristics; the event is dispatched here
  await page.evaluate(() => {
    const e: any = new Event('beforeinstallprompt', { cancelable: true });
    (window as any).__prompted = 0;
    e.prompt = () => { (window as any).__prompted++; return Promise.resolve(); };
    e.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
    window.dispatchEvent(e);
  });
  const banner = page.locator('#view .install-banner');
  await expect(banner).toBeVisible();
  await banner.locator('[data-act="pwaInstall"]').click();
  expect(await page.evaluate(() => (window as any).__prompted)).toBe(1);
  await expect(lastToast(page)).toContainText('Устанавливаем');
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(lastToast(page)).toContainText('установлен');
  await go(page, '#/stats'); await go(page, '#/home');
  await expect(page.locator('#view .install-banner')).toHaveCount(0);
});

test('offline: the app starts, works and saves without network', async ({ page, context }) => {
  await onboard(page);
  await readyOffline(page);
  expect(await cacheKeys(page)).toEqual([expect.stringMatching(/^pullup-pro-shell-/)]);
  await context.setOffline(true);
  expect(await page.evaluate(() => fetch('/api/health').then(() => 'reachable', () => 'offline'))).toBe('offline');
  // cold start without network: the shell comes from the service worker cache
  const res = await page.reload();
  expect(res && res.fromServiceWorker()).toBe(true);
  await expect(page.locator('#view')).not.toBeEmpty();
  await expect(page.locator('.net-badge:visible')).toHaveCount(1);                      // offline indicator (sidebar on desktop)
  await expect(page.locator('.ob-modal')).toHaveCount(0);                              // local data is there
  // navigate and save offline
  for (const r of ['stats', 'library', 'plan', 'calendar']) { await go(page, `#/${r}`); await expect(page.locator('#view')).not.toBeEmpty(); }
  await go(page, '#/body');
  await page.locator('#view [data-act="bodyAdd"]').first().click();
  await page.locator('.modal-wrap.in [data-bf="weight"]').fill('76.2');
  await page.locator('.modal-wrap.in [data-bsave]').click();
  await expect(lastToast(page)).toContainText('Замеры сохранены');
  await page.reload();
  await expect(page.locator('#view')).not.toBeEmpty();
  expect((await saved(page)).body.some((b: any) => b.weight === 76.2)).toBe(true);    // persisted while offline
  // back online
  await context.setOffline(false);
  await expect(lastToast(page)).toContainText('Снова онлайн');
  await expect(page.locator('.net-badge:visible')).toHaveCount(0);
});

test('update: a new version waits, is offered, applied on demand; user data is kept', async ({ page }) => {
  const swPath = path.join(E2E_WEB_DIR, 'sw.js'), original = readFileSync(swPath, 'utf8');
  const oldVersion = /const VERSION = "([^"]+)"/.exec(original)![1];
  try {
    await onboard(page);
    await go(page, '#/body');
    await page.locator('#view [data-act="bodyAdd"]').first().click();
    await page.locator('.modal-wrap.in [data-bf="weight"]').fill('80.5');
    await page.locator('.modal-wrap.in [data-bsave]').click();
    await readyOffline(page);
    expect(await cacheKeys(page)).toEqual([`pullup-pro-shell-${oldVersion}`]);
    // deploy a "new version" of the app shell
    writeFileSync(swPath, original.replace(`const VERSION = "${oldVersion}"`, `const VERSION = "${oldVersion}-next"`));
    await go(page, '#/settings');
    await page.locator('#view [data-act="pwaCheck"]').click();
    await expect(page.locator('#upd-bar')).toBeVisible();
    await expect(page.locator('#upd-bar')).toContainText('Данные сохранятся');
    // the new worker waits: the old one keeps control and its cache until the user agrees
    expect(await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => !!(r && r.waiting)))).toBe(true);
    expect(await cacheKeys(page)).toContain(`pullup-pro-shell-${oldVersion}`);
    await Promise.all([page.waitForEvent('load'), page.locator('#upd-bar [data-act="pwaUpdate"]').click()]);   // SKIP_WAITING → controllerchange → reload
    await expect.poll(() => cacheKeys(page)).toEqual([`pullup-pro-shell-${oldVersion}-next`]);              // old cache removed
    await expect(page.locator('#upd-bar')).toHaveCount(0);
    const S = await saved(page);
    expect(S.body.some((b: any) => b.weight === 80.5)).toBe(true);
    expect(S.profile.onboarded).toBe(true);
  } finally { writeFileSync(swPath, original); }
});
