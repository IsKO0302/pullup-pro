import { test as base, expect, type Page } from '@playwright/test';

/** every test fails on uncaught JS errors and console errors (CSP violations included) */
export const test = base.extend<{ errors: string[] }>({
  errors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errors.push('console: ' + m.text()); });
    await use(errors);
    expect(errors, 'JavaScript / console errors').toEqual([]);
  }, { auto: true }]
});
export { expect };

/** first launch: the 7-step personalisation ("registration") */
export async function onboard(page: Page, o: { name?: string; demo?: boolean; days?: number } = {}) {
  await page.goto('/#/home');
  await completeOnboarding(page, o);
}
/** walks through the onboarding dialog that is already shown (first launch or after «Сбросить данные») */
export async function completeOnboarding(page: Page, o: { name?: string; demo?: boolean; days?: number } = {}) {
  const m = page.locator('.ob-modal');
  await expect(m).toBeVisible();
  await page.click('label.check:has([data-ob="ok"]) .box');
  await page.click('[data-ob="next"]');
  await page.fill('#ob-name', o.name || 'Иса');
  await page.fill('#ob-height', '180');
  await page.click('[data-ob="next"]');                       // results
  await page.click('[data-ob="next"]');                       // equipment
  if (o.days) await page.click(`[data-pick="days"] [data-v="${o.days}"], [data-k="days"][data-v="${o.days}"]`).catch(() => undefined);
  await page.click('[data-ob="next"]');                       // schedule
  await page.click('[data-ob="next"]');                       // goals
  await page.click('[data-ob="next"]');                       // summary
  await page.click(o.demo ? '[data-ob="demo"]' : '[data-ob="finish"]');
  await expect(m).toHaveCount(0);
}
/** clicks the OK button of the confirmation dialog */
export async function confirm(page: Page) { await page.locator('.modal-wrap.in [data-ok]').last().click(); }
export const go = (page: Page, hash: string) => page.evaluate(h => { location.hash = h; }, hash);

/** the app state persisted in localStorage */
export const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('pullup.pro.v2') || '{}'));
/** the latest toast message */
export const lastToast = (page: Page) => page.locator('#toasts .toast').last();
