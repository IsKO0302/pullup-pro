import { test, expect, onboard, go } from './fixtures';

test('first launch: personalisation creates the profile and a plan', async ({ page }) => {
  await onboard(page, { name: 'Иса' });
  await expect(page.locator('#view')).toContainText(/иса/i);   // the hero shows the name in capitals
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('pullup.pro.v2') || localStorage.getItem('pullup.pro.v1') || '{}'));
  expect(st.profile.onboarded).toBe(true); expect(st.profile.height).toBe(180); expect(st.engine.program).toBeTruthy();
  expect(st.sessions).toEqual([]);                    // nothing invented
});

test('navigation between all sections', async ({ page }) => {
  await onboard(page);
  for (const r of ['home', 'train', 'plan', 'programs', 'mu', 'library', 'journal', 'stats', 'calendar', 'body', 'nutrition', 'achievements', 'report', 'profile', 'settings', 'builder']) {
    await go(page, '#/' + r);
    await expect(page.locator('#view')).not.toContainText('Не удалось открыть раздел');
    await expect(page.locator('#view h1, #view .page-head, #view .hero, #view .card').first()).toBeVisible();
  }
});
