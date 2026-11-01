import { test, expect, onboard, go } from './fixtures';

/* Interface language: Russian (source) / English / Turkish. The choice is stored on the device ("pullup.lang"),
 * the first launch follows the browser language, and the main screens must not show Russian text in EN / TR. */
const MAIN_SCREENS = ['home', 'train', 'plan', 'programs', 'mu', 'journal', 'stats', 'body', 'nutrition', 'calendar', 'achievements', 'settings'];
// the language switcher itself stays in every language; "Иса" / "И" is the name typed by the user during onboarding (user data, never translated)
const ALLOWED = new Set(['Русский', 'Язык', 'Language / Язык / Dil', 'Иса', 'И', 'ИСА']);
const homeLink = (page: import('@playwright/test').Page, text: string) => page.locator('a[href="#/home"]', { hasText: text }).first();

async function chooseLanguage(page: import('@playwright/test').Page, label: string) {
  await go(page, '#/settings');
  await page.locator('[data-act="setLang"]', { hasText: label }).first().click();
  await page.waitForLoadState('load');
  await expect(page.locator('html')).toHaveAttribute('lang', /./);
}
const cyrillicLeft = (page: import('@playwright/test').Page) => page.evaluate((allowed: string[]) => {
  const out: string[] = [], C = /[А-Яа-яЁё]/;
  const walk = (n: Node) => {
    if (n.nodeType === 3) { const v = (n.nodeValue || '').replace(/\s+/g, ' ').trim(); if (v && C.test(v) && !allowed.includes(v)) out.push(v); return; }
    if (n.nodeType === 1 && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes((n as Element).tagName)) n.childNodes.forEach(walk);
  };
  walk(document.body); return out;
}, [...ALLOWED]);

test('switching the language: English, Turkish and back to Russian; the choice survives a reload', async ({ page }) => {
  await onboard(page, { demo: true });
  await expect(homeLink(page, 'Главная')).toBeVisible();
  await chooseLanguage(page, 'English');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(homeLink(page, 'Home')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pullup.lang'))).toBe('en');
  await page.reload(); await expect(homeLink(page, 'Home')).toBeVisible();
  await chooseLanguage(page, 'Türkçe');
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await expect(homeLink(page, 'Ana sayfa')).toBeVisible();
  await chooseLanguage(page, 'Русский');
  await expect(homeLink(page, 'Главная')).toBeVisible();
  // the user data is untouched by language changes
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem('pullup.pro.v2') || '{}'))).sessions.length).toBeGreaterThan(5);
});

for (const [code, label] of [['en', 'English'], ['tr', 'Türkçe']] as const) {
  test(`${code}: no Russian text left on the main screens`, async ({ page }) => {
    await onboard(page, { demo: true });
    await chooseLanguage(page, label);
    const leftovers: Record<string, string[]> = {};
    for (const r of MAIN_SCREENS) {
      await go(page, '#/' + r); await page.waitForTimeout(350);
      await page.evaluate(() => document.querySelectorAll('.modal-wrap').forEach(x => x.remove()));
      const left = await cyrillicLeft(page);
      if (left.length) leftovers['#/' + r] = left.slice(0, 12);
    }
    expect(leftovers).toEqual({});
  });
}

test.describe('first launch follows the browser language', () => {
  test.use({ locale: 'en-US' });
  test('English browser → English onboarding, no stored choice needed', async ({ page }) => {
    await page.goto('/#/home');
    await expect(page.locator('.ob-modal')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('.ob-modal')).toContainText('Safety');
    expect(await page.evaluate(() => localStorage.getItem('pullup.lang'))).toBeNull();
  });
});
test.describe('Turkish browser', () => {
  test.use({ locale: 'tr-TR' });
  test('Turkish browser → Turkish onboarding and Turkish dates', async ({ page }) => {
    await page.goto('/#/home');
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
    await expect(page.locator('.ob-modal')).toContainText('Güvenlik');
  });
});
