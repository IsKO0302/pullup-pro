import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, expect, completeOnboarding, go, saved } from './fixtures';

/* The single-file build (npm run build:single → dist-single/PULLUP-PRO-2.0.0.html) must open from disk (file://),
 * without a web server and without internet: no request may leave the file, no service worker, data persists. */
const DIR = join(process.cwd(), 'dist-single');
const FILE = readdirSync(DIR).find(f => /^PULLUP-PRO-.*\.html$/.test(f));
const URL_ = pathToFileURL(join(DIR, FILE || 'missing.html')).href;

test('single file: opens from disk, works without network, keeps the data after reopening', async ({ page }) => {
  expect(FILE, 'run npm run build:single first').toBeTruthy();
  const external: string[] = [];
  page.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) external.push(r.url()); });

  await page.goto(URL_ + '#/home');
  await completeOnboarding(page, { name: 'Иса', demo: true });
  await expect(page.locator('#view')).toContainText('START TRAINING');
  for (const r of ['train', 'plan', 'stats', 'body', 'nutrition', 'calendar', 'library', 'report', 'achievements']) {
    await go(page, '#/' + r);
    await expect(page.locator('#view')).not.toBeEmpty();
    await expect(page.locator('#view')).not.toContainText(/\bNaN\b|\bundefined\b/);
  }
  const sessions = (await saved(page)).sessions.length;
  expect(sessions).toBeGreaterThan(10);

  // the file knows what it is: no install offer, no sync attempts, a clear note instead
  await go(page, '#/settings');
  await expect(page.locator('#view')).toContainText('Открыта версия в одном файле');
  await expect(page.locator('#sync-box')).toContainText('все данные хранятся только в этом браузере');
  // on file:// the browser refuses service workers altogether (SecurityError) — either way none may be registered
  expect(await page.evaluate(async () => { try { return (await navigator.serviceWorker.getRegistrations()).length; } catch (e) { return 0; } })).toBe(0);

  // reopen the file: the data is still there
  await page.goto('about:blank');
  await page.goto(URL_ + '#/journal');
  await expect(page.locator('.ob-modal')).toHaveCount(0);
  await expect(page.locator('#view')).toContainText('Журнал');
  expect((await saved(page)).sessions.length).toBe(sessions);

  expect(external, 'requests outside the file').toEqual([]);
});
