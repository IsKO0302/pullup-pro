import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect, onboard, completeOnboarding, confirm, go, saved, lastToast } from './fixtures';

const V1_FIXTURE = path.resolve('tests/fixtures/v1-backup.json');

test('body: measurements, validation and body weight', async ({ page }) => {
  await onboard(page);
  // the weight entered during onboarding is the first weigh-in
  const ob = (await saved(page)).body;
  expect(ob).toHaveLength(1); expect(ob[0].weight).toBe(75);
  await go(page, '#/body');
  await page.locator('#view [data-act="bodyAdd"]').first().click();
  const m = page.locator('.modal-wrap.in');
  // out-of-range value is rejected and nothing is saved
  await m.locator('[data-bf="weight"]').fill('1000');
  await m.locator('[data-bsave]').click();
  await expect(lastToast(page)).toContainText('Проверьте значение: Вес');
  expect((await saved(page)).body).toEqual(ob);
  // a valid entry
  await m.locator('[data-bf="weight"]').fill('81.4');
  await m.locator('[data-bf="waist"]').fill('84');
  await m.locator('[data-bf="note"]').fill('утром натощак');
  await m.locator('[data-bsave]').click();
  await expect(page.locator('.modal-wrap.in')).toHaveCount(0);
  let S = await saved(page);
  expect(S.body).toHaveLength(1);                                  // same day → the entry is updated, not duplicated
  expect(S.body[0]).toMatchObject({ id: ob[0].id, weight: 81.4, waist: 84, note: 'утром натощак' });
  expect(S.profile.bodyweight).toBe(81.4);                       // body weight follows the latest weigh-in
  await expect(page.locator('#view')).toContainText('81,4');
  // an older entry (two weeks ago) is stored but does not replace the current body weight
  const older = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 14); return d.toLocaleDateString('sv-SE'); });
  await page.locator('#view [data-act="bodyAdd"]').first().click();
  await m.locator('[data-bf="date"]').fill(older);
  await m.locator('[data-bf="weight"]').fill('83');
  await m.locator('[data-bsave]').click();
  await expect(page.locator('.modal-wrap.in')).toHaveCount(0);
  S = await saved(page);
  expect(S.body).toHaveLength(2);
  expect(S.body.find((b: any) => b.date === older).weight).toBe(83);
  expect(S.profile.bodyweight).toBe(81.4);
  // the profile editor shows the same weight; changing it there records today's weigh-in
  await go(page, '#/profile');
  await page.locator('#view [data-act="profEdit"]').first().click();
  await expect(page.locator('.modal-wrap.in #pf-weight')).toHaveValue('81.4');
  await page.locator('.modal-wrap.in #pf-weight').fill('80.9');
  await page.locator('.modal-wrap.in [data-pf-ok]').click();
  await expect(page.locator('.modal-wrap.in')).toHaveCount(0);
  S = await saved(page);
  expect(S.profile.bodyweight).toBe(80.9);
  expect(S.body).toHaveLength(2);                                  // today's entry updated, not duplicated
  expect(S.body.find((b: any) => b.date !== older).weight).toBe(80.9);
});

test('backup: export JSON → reset all data → import restores everything', async ({ page }) => {
  await onboard(page);
  // some user data: a measurement, a custom workout and a planned day
  await go(page, '#/body');
  await page.locator('#view [data-act="bodyAdd"]').first().click();
  await page.locator('.modal-wrap.in [data-bf="weight"]').fill('79.5');
  await page.locator('.modal-wrap.in [data-bsave]').click();
  await go(page, '#/builder/new');
  await page.fill('[data-inp="blName"]', 'Резерв');
  await page.click('[data-act="blAdd"]'); await page.click('[data-pk="pullup"]');
  await page.click('[data-act="blSave"]');
  await go(page, '#/calendar');
  await page.locator('#view [data-act="planAdd"]').click();
  const before = await saved(page);
  expect(before.body).toHaveLength(1); expect(before.custom).toHaveLength(1); expect(Object.keys(before.plan)).toHaveLength(1);
  // export
  await go(page, '#/settings');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#view [data-act="expJson"]').click()]);
  expect(dl.suggestedFilename()).toMatch(/^pullup-pro-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await dl.path();
  const B = JSON.parse(readFileSync(file, 'utf8'));
  expect(B).toMatchObject({ app: 'pullup-pro', schema: 2 });
  expect(B.data.body).toHaveLength(1); expect(B.data.custom[0].name).toBe('Резерв');
  // reset → empty app, onboarding again
  await page.locator('#view [data-act="resetAll"]').click();
  await confirm(page);
  await expect(page.locator('.ob-modal')).toBeVisible();
  const empty = await saved(page);
  expect(empty.body).toHaveLength(0); expect(empty.custom).toHaveLength(0); expect(empty.plan).toEqual({});
  await completeOnboarding(page, { name: 'Временно' });
  // import the backup
  await go(page, '#/settings');
  await page.setInputFiles('input[data-chg="impJson"]', file);
  await expect(page.locator('.modal-wrap.in')).toContainText('PULLUP PRO 2.0');
  await confirm(page);
  await expect(lastToast(page)).toContainText('Данные импортированы');
  const after = await saved(page);
  expect(after.body).toEqual(before.body);
  expect(after.custom).toEqual(before.custom);
  expect(after.plan).toEqual(before.plan);
  expect(after.profile.name).toBe(before.profile.name);
  // a copy of the replaced data is kept and listed
  await expect(page.locator('#view')).toContainText(/копи/i);
});

test('backup: a broken file is rejected without touching the data', async ({ page }) => {
  await onboard(page);
  await go(page, '#/settings');
  await page.setInputFiles('input[data-chg="impJson"]', { name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"sessions": [1, 2') });
  await expect(lastToast(page)).toContainText('не читается как JSON');
  await page.setInputFiles('input[data-chg="impJson"]', { name: 'other.json', mimeType: 'application/json', buffer: Buffer.from('{"hello": "world"}') });
  await expect(lastToast(page)).toHaveClass(/t-err/);
  await expect(page.locator('.modal-wrap.in')).toHaveCount(0);
  expect((await saved(page)).profile.name).toBe('Иса');
});

test('import of a real PULLUP PRO 1.0 backup: migration, journal, statistics, calendar, achievements', async ({ page }) => {
  const V1 = JSON.parse(readFileSync(V1_FIXTURE, 'utf8'));
  const n = V1.data.sessions.length, nWork = V1.data.sessions.filter((x: any) => x.source !== 'quick').length;   // quick logs are not workouts
  await onboard(page);
  await go(page, '#/settings');
  await page.setInputFiles('input[data-chg="impJson"]', V1_FIXTURE);
  const dlg = page.locator('.modal-wrap.in');
  await expect(dlg).toContainText('PULLUP PRO 1.0');
  await expect(dlg).toContainText(`${n} тренировок`);
  await confirm(page);
  await expect(lastToast(page)).toContainText('Данные 1.0 импортированы');
  const S = await saved(page);
  expect(S.v).toBe(2);
  expect(S.sessions).toHaveLength(n);
  expect(S.tests).toHaveLength(V1.data.tests.length);
  expect(S.profile.maxPullups).toBe(V1.data.profile.maxPullups);
  // every imported session keeps its sets
  const sets = (x: any) => x.items.reduce((a: number, it: any) => a + it.sets.length, 0);
  expect(S.sessions.map(sets)).toEqual(V1.data.sessions.map(sets));
  // journal: all time
  await go(page, '#/journal');
  await page.locator('#view [data-act="jrPeriod"][data-v="all"]').click();
  await expect(page.locator('#view')).toContainText(`Найдено: ${n + V1.data.tests.length} · ${nWork} тренировк`);
  // statistics render charts from the imported history
  await go(page, '#/stats');
  await expect(page.locator('#view svg').first()).toBeVisible();
  await expect(page.locator('#view')).not.toContainText(/NaN|undefined|Infinity/);
  // calendar shows the month of the latest imported workout with done days
  await go(page, '#/calendar');
  await expect(page.locator('#view')).not.toContainText(/NaN|undefined/);
  // achievements earned from the real history
  await go(page, '#/achievements');
  expect(await page.locator('#view .medal-card.on, #view .ach.on').count()).toBeGreaterThan(0);
});

test('calendar: plan a workout for today and auto-plan 4 weeks', async ({ page }) => {
  await onboard(page);
  await go(page, '#/calendar');
  await page.locator('#view [data-act="planAdd"]').click();
  await expect(lastToast(page)).toContainText('Запланировано');
  let S = await saved(page);
  const days = Object.keys(S.plan);
  expect(days).toHaveLength(1);
  await expect(page.locator('#view [data-act="stPlan"]')).toBeVisible();   // today → «Начать»
  // mark as done and remove
  await page.locator('#view [data-act="planDone"]').click();
  S = await saved(page); expect(S.plan[days[0]][0].done).toBe(true);
  await page.locator('#view [data-act="planDel"]').click();
  S = await saved(page); expect(S.plan).toEqual({});
  // auto plan
  await page.locator('#view [data-act="autoPlan"]').first().click();
  await page.locator('.modal-wrap.in [data-ap-go]').click();
  S = await saved(page);
  const planned = Object.values(S.plan).flat() as any[];
  expect(planned.length).toBeGreaterThanOrEqual(8);                     // 3 per week × 4 weeks (from today)
  expect(planned.every(p => p.title && p.done === false)).toBe(true);
});
