import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as db from '@pullup/db';
import { migrateState, toRecords, type SyncRecord } from '@pullup/shared';
import { EX } from '@pullup/shared/catalog/exercises';
import { PROGRAMS } from '@pullup/shared/catalog/programs';
import { PROGRAMS_V2 } from '@pullup/shared/catalog/programs2';
import { freshPool, haveDb } from './helpers';

/* Relational model (migration 002): catalog tables + entity views over the synced records,
 * checked against a real PULLUP PRO 1.0 backup migrated to 2.0 and pushed like the app does. */
describe.skipIf(!haveDb)('DB entities: catalog tables and views', () => {
  let pool: db.Pool, uid: string;
  const S: any = migrateState(JSON.parse(readFileSync('tests/fixtures/v1-backup.json', 'utf8')).data).state;
  beforeAll(async () => {
    pool = await freshPool();
    const u = await db.upsertTelegramUser(pool, { id: 777001, first_name: 'Isa' });
    uid = u.id;
    // extra entities the 1.0 backup does not have
    S.custom = [{ id: 'cw1', name: 'Моя тяга', items: [{ ex: 'pullup', sets: 3, reps: 5, rest: 120 }, { ex: 'plank', sets: 2, time: 40, rest: 60 }] }];
    S.plan = { '2026-11-02': [{ id: 'p1', kind: 'custom', cid: 'cw1', title: 'Моя тяга', done: false }] };
    S.reminders = [{ id: 'r1', kind: 'workout', time: '18:30', days: [1, 3, 5], enabled: true }];
    S.body = [...(S.body || []), { id: 'b-x', date: '2026-10-30', weight: 78.4, waist: 82 }];
    S.photos = [{ id: 'ph1', date: '2026-10-30', pose: 'front', w: 900, h: 1200, size: 120000, mime: 'image/jpeg' }];
    S.profile.goals = ['strength', 'muscleup'];
    const recs: SyncRecord[] = [...toRecords(S).values()].map(r => ({ ...r, u: Date.now() }));
    const res = await db.pushRecords(pool, uid, recs, 'test');
    expect(res.accepted.length).toBe(recs.length);
  });
  afterAll(async () => { await pool?.end(); });
  const q = async (sql: string, p: unknown[] = []) => (await pool.query(sql, p)).rows;

  it('catalog mirror: every exercise and program of this release, idempotent', async () => {
    const k = await db.syncCatalog(pool);
    expect(k).toMatchObject({ exercises: EX.length, programs: PROGRAMS.length + PROGRAMS_V2.length });
    expect((await db.syncCatalog(pool)).changed).toBe(0);
    const [e] = await q(`SELECT * FROM exercises WHERE id = 'pullup'`);
    expect(e).toMatchObject({ type: 'reps', body_group: EX.find(x => x.id === 'pullup')!.group });
    expect(e.primary_muscles.length).toBeGreaterThan(0);
    expect((await q('SELECT count(*)::int AS n FROM workout_programs WHERE generation = 2'))[0].n).toBe(PROGRAMS_V2.length);
  });
  it('profiles and goals', async () => {
    const [p] = await q('SELECT * FROM v_profiles WHERE user_id = $1', [uid]);
    expect(p).toMatchObject({ name: S.profile.name, onboarded: true });
    expect(Number(p.bodyweight_kg)).toBe(S.profile.bodyweight);
    const g = await q('SELECT goal FROM v_user_goals WHERE user_id = $1 ORDER BY goal', [uid]);
    expect(g.map(x => x.goal)).toEqual(['muscleup', 'strength']);
  });
  it('workout sessions and sets match the app data', async () => {
    const ss = await q('SELECT * FROM v_workout_sessions WHERE user_id = $1', [uid]);
    expect(ss).toHaveLength(S.sessions.length);
    const sets = S.sessions.reduce((a: number, s: any) => a + s.items.reduce((b: number, it: any) => b + it.sets.length, 0), 0);
    const done = S.sessions.reduce((a: number, s: any) => a + s.items.reduce((b: number, it: any) => b + it.sets.filter((x: any) => x.done).length, 0), 0);
    expect(ss.reduce((a, s) => a + s.sets_total, 0)).toBe(sets);
    expect(ss.reduce((a, s) => a + s.sets_done, 0)).toBe(done);
    expect((await q('SELECT count(*)::int AS n FROM v_workout_sets WHERE user_id = $1', [uid]))[0].n).toBe(sets);
    const reps = S.sessions.reduce((a: number, s: any) => a + s.items.filter((it: any) => it.ex === 'pullup').reduce((b: number, it: any) => b + it.sets.filter((x: any) => x.done).reduce((c: number, x: any) => c + (x.reps || 0), 0), 0), 0);
    expect(Number((await q(`SELECT COALESCE(sum(reps), 0) AS n FROM v_workout_sets WHERE user_id = $1 AND exercise_id = 'pullup' AND done`, [uid]))[0].n)).toBe(reps);
  });
  it('personal records: best set per exercise and best pull-up test', async () => {
    const best = Math.max(...S.sessions.flatMap((s: any) => s.items.filter((it: any) => it.ex === 'pullup').flatMap((it: any) => it.sets.filter((x: any) => x.done).map((x: any) => x.reps || 0))));
    const [pr] = await q(`SELECT * FROM v_personal_records WHERE user_id = $1 AND exercise_id = 'pullup' AND metric = 'reps'`, [uid]);
    expect(Number(pr.value)).toBe(best);
    const [t] = await q(`SELECT * FROM v_personal_records WHERE user_id = $1 AND metric = 'test_max_reps'`, [uid]);
    expect(Number(t.value)).toBe(Math.max(...S.tests.map((x: any) => x.pullups)));
  });
  it('body measurements, progress photos (metadata only without consent), achievements', async () => {
    // day::text — the pg driver turns DATE into a local-midnight Date, which shifts the day in time zones east of UTC
    const [b] = await q(`SELECT *, day::text AS day_text FROM v_body_measurements WHERE user_id = $1 AND id = 'b-x'`, [uid]);
    expect(Number(b.weight_kg)).toBe(78.4); expect(Number(b.waist_cm)).toBe(82);
    expect(b.day_text).toBe('2026-10-30');
    const [ph] = await q('SELECT * FROM v_progress_photos WHERE user_id = $1', [uid]);
    expect(ph).toMatchObject({ id: 'ph1', pose: 'front', stored_on_server: false });
    const ach = await q('SELECT * FROM v_achievements WHERE user_id = $1', [uid]);
    expect(ach.length).toBe(Object.keys(S.ach).length);
    expect(ach.every(a => a.earned_on instanceof Date)).toBe(true);
  });
  it('calendar plans, custom workouts, reminders', async () => {
    expect(await q('SELECT day::text, kind, title, done FROM v_calendar_plans WHERE user_id = $1', [uid])).toEqual([{ day: '2026-11-02', kind: 'custom', title: 'Моя тяга', done: false }]);
    expect(await q('SELECT name, exercises_count FROM v_custom_workouts WHERE user_id = $1', [uid])).toEqual([{ name: 'Моя тяга', exercises_count: 2 }]);
    expect(await q('SELECT kind, local_time, weekdays, enabled FROM v_reminders WHERE user_id = $1', [uid])).toEqual([{ kind: 'workout', local_time: '18:30', weekdays: [1, 3, 5], enabled: true }]);
  });
  it('deleted records disappear from the views; malformed values become NULL instead of failing', async () => {
    await db.pushRecords(pool, uid, [{ c: 'custom', id: 'cw1', u: Date.now() + 1000, del: true }], 'test');
    expect(await q('SELECT * FROM v_custom_workouts WHERE user_id = $1', [uid])).toEqual([]);
    await pool.query(`INSERT INTO records (user_id, c, id, u, rev, d) VALUES ($1, 'body', 'bad', 1, 999999, '{"date":"2026-02-30","weight":"heavy"}')`, [uid]);
    const [bad] = await q(`SELECT day, weight_kg FROM v_body_measurements WHERE user_id = $1 AND id = 'bad'`, [uid]);
    expect(bad).toEqual({ day: null, weight_kg: null });
  });
});
