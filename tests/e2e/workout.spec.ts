import { test, expect, onboard, confirm, go } from './fixtures';
import type { Page } from '@playwright/test';

const run = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('pullup.pro.run') || 'null'));
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('pullup.pro.v2') || '{}'));

async function startPlanWorkout(page: Page) {
  await go(page, '#/plan');
  await page.locator('#view [data-act="stEngine"]').first().click();
  await page.click('[data-pk="feel"][data-v="4"]'); await page.click('[data-pk="sleep"][data-v="7"]'); await page.click('[data-pk="pain"][data-v="no"]');
  await page.click('[data-pa="normal"]');
  await expect(page.locator('#train-root')).toBeVisible();
}

test('workout: program choice, sets, rest timer, pause/resume, restore after reload, saving, statistics', async ({ page }) => {
  await onboard(page);
  // choose a program explicitly: «Мой план» → «Выбор программы» → Upper / Lower
  await go(page, '#/plan');
  await page.locator('#view [data-act="planPick"]').first().click();
  await page.click('.modal-wrap.in [data-act="planChoose"][data-p="ul"]');
  expect((await saved(page)).engine.program).toBe('ul');
  await startPlanWorkout(page);
  // warm-up → main part
  const boxes = page.locator('#train-root .warm-list label.check .box'), nWarm = await boxes.count();
  expect(nWarm).toBeGreaterThan(2);
  for (let i = 0; i < nWarm; i++) await boxes.nth(i).click();
  await expect(page.locator('#warm-n')).toHaveText(`${nWarm}/${nWarm}`);
  expect(Object.values((await run(page)).warmChecks).filter(Boolean)).toHaveLength(nWarm);
  await page.click('[data-tr="toWork"]');
  await expect(page.locator('[data-tr="done"]:visible')).toBeVisible();
  // complete the first set → rest timer runs
  await page.locator('[data-tr="done"]:visible').click();
  await expect(page.locator('#rr-v')).toBeVisible();
  const t1 = await page.locator('#rr-v').textContent();
  await page.waitForTimeout(1600);
  expect(await page.locator('#rr-v').textContent()).not.toBe(t1);       // counting down
  await page.click('[data-tr="restSkip"]');
  await expect(page.locator('[data-tr="done"]:visible')).toBeVisible();
  // pause and continue
  await page.locator('.tr-top [data-tr="pause"], [data-tr="pause"]').first().click();
  await expect(page.locator('.tr-paused')).toBeVisible();
  expect((await run(page)).paused).toBe(true);
  await page.locator('.tr-paused [data-tr="pause"]').click();
  await expect(page.locator('.tr-paused')).toHaveCount(0);
  await page.locator('[data-tr="done"]:visible').click();
  await page.click('[data-tr="restSkip"]');
  const doneBefore = (await run(page)).items.reduce((a: number, it: any) => a + it.sets.filter((s: any) => s.done === true).length, 0);
  expect(doneBefore).toBe(2);
  // the tab is closed in the middle of the workout → the workout is restored
  await page.reload();
  await expect(page.locator('#resume-root .resume')).toBeVisible();
  await expect(page.locator('#resume-root')).toContainText('2 подхода');
  await page.click('[data-act="resumeRun"]');
  await expect(page.locator('#train-root')).toBeVisible();
  // a restored workout opens paused: time spent with the tab closed is not counted
  await expect(page.locator('.tr-paused')).toBeVisible();
  await page.locator('.tr-paused [data-tr="pause"]').click();
  await expect(page.locator('.tr-paused')).toHaveCount(0);
  expect((await run(page)).items.reduce((a: number, it: any) => a + it.sets.filter((s: any) => s.done === true).length, 0)).toBe(2);
  // finish early → summary → save
  await page.locator('.tr-top [data-tr="finish"], [data-tr="finish"]').first().click();
  await confirm(page);
  await page.click('[data-trf="feel"][data-v="4"]'); await page.click('[data-trf="rpe"][data-v="7"]');
  await page.click('[data-tr="save"]');
  await expect(page.locator('#train-root')).toBeHidden();
  const S = await saved(page);
  expect(S.sessions).toHaveLength(1);
  expect(S.sessions[0].items.reduce((a: number, it: any) => a + it.sets.filter((s: any) => s.done).length, 0)).toBe(2);
  expect(S.sessions[0].rpe).toBe(7);
  expect(await run(page)).toBeNull();
  // journal, statistics, calendar and achievements reflect the saved workout
  await go(page, '#/journal'); await expect(page.locator('#view')).toContainText(S.sessions[0].title);
  await go(page, '#/stats'); await expect(page.locator('#view')).not.toContainText('Не удалось');
  await go(page, '#/calendar'); await expect(page.locator('#view .cal-day.has, #view [data-act="calJr"], #view .cal-d.done, #view .cal').first()).toBeVisible();
  await go(page, '#/achievements'); await expect(page.locator('#view')).toContainText(/Первая|первая/);
});

test('custom workout: build, save and start it', async ({ page }) => {
  await onboard(page);
  await go(page, '#/builder/new');
  await page.fill('[data-inp="blName"]', 'Моя тяга');
  await page.click('[data-act="blAdd"]'); await page.click('[data-pk="pullup"]');
  await page.click('[data-act="blAdd"]'); await page.click('[data-pk="plank"]');
  await expect(page.locator('#bl-rows .bl-row')).toHaveCount(2);
  await page.click('[data-act="blSave"]');
  const S = await saved(page);
  expect(S.custom).toHaveLength(1); expect(S.custom[0].name).toBe('Моя тяга'); expect(S.custom[0].items.map((i: any) => i.ex)).toEqual(['pullup', 'plank']);
  await expect(page.locator('#view')).toContainText('Моя тяга');
});
