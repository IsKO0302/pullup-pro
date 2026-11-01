import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkBackup, migrateState, summary, unwrapBackup } from '@pullup/shared';

// produced by the original PULLUP PRO 1.0 app (scripts/fixtures/make-v1-backup.mjs)
const v1 = JSON.parse(readFileSync(new URL('../fixtures/v1-backup.json', import.meta.url), 'utf8'));

describe('v1 → v2 migration', () => {
  it('recognises a v1 backup file', () => {
    const c = checkBackup(unwrapBackup(v1));
    expect(c.ok).toBe(true); expect(c.sessions).toBe(v1.data.sessions.length); expect(c.invalidSessions).toBe(0);
  });
  it('keeps every v1 record, id and field', () => {
    const r = migrateState(unwrapBackup(v1), Date.parse('2026-11-01T00:00:00Z'));
    expect(r.from).toBe(1); expect(r.migrated).toBe(true); expect(r.state.v).toBe(2);
    expect(r.state.sessions.map(s => s.id)).toEqual(v1.data.sessions.map((s: any) => s.id));
    expect(r.state.tests).toHaveLength(v1.data.tests.length);
    expect(r.state.profile.name).toBe(v1.data.profile.name);
    expect(r.state.profile.maxPullups).toBe(v1.data.profile.maxPullups);
    const sets = (x: any[]) => x.reduce((a, s) => a + s.items.reduce((b: number, it: any) => b + it.sets.length, 0), 0);
    expect(sets(r.state.sessions)).toBe(sets(v1.data.sessions));
    expect(r.state.meta.migratedFrom).toBe(1);
  });
  it('adds the v2 collections with safe defaults', () => {
    const S = migrateState(unwrapBackup(v1)).state;
    for (const k of ['body', 'bodyFields', 'photos', 'foods', 'products', 'reminders'] as const) expect(Array.isArray(S[k])).toBe(true);
    expect(S.settings.cloud.enabled).toBe(false); expect(S.settings.bot.reminders).toBe(false);
  });
  it('statistics work on migrated data', () => {
    const S = migrateState(unwrapBackup(v1)).state, s = summary(S, '2026-11-01');
    expect(s.workouts).toBeGreaterThan(0); expect(s.totalSets).toBeGreaterThan(0);
  });
  it('repairs broken structures instead of resetting the data', () => {
    const r = migrateState({ profile: { name: 'Isa' }, sessions: [{ id: 'x', date: '2026-01-01', items: [{ ex: 'pullup', sets: 'oops' }] }, 'junk'], tests: null });
    expect(r.state.sessions).toHaveLength(1); expect(r.state.sessions[0].items[0].sets).toEqual([]);
    expect(r.state.tests).toEqual([]); expect(r.state.profile.name).toBe('Isa');
  });
  it('ignores prototype-pollution keys', () => {
    const evil = JSON.parse('{"profile":{"__proto__":{"polluted":true}},"sessions":[]}');
    migrateState(evil);
    expect(({} as any).polluted).toBeUndefined();
  });
  it('rejects files that are not backups', () => {
    expect(checkBackup([]).ok).toBe(false); expect(checkBackup({ foo: 1 }).ok).toBe(false);
  });
});
