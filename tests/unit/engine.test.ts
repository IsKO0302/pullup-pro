import { describe, expect, it } from 'vitest';
import { EXM, activeProgram, buildWorkout, deloadStatus, evaluateSession, lightAdvice, nextIndex, resolveProposal, startDeload, type Session } from '@pullup/shared';
import { sess, state } from './helpers';

/** a logged engine session that exactly fulfils the built workout */
function fulfil(S: ReturnType<typeof state>, date: string, id: string, extra: Partial<Session> = {}): Session {
  const P = activeProgram(S), bw = buildWorkout(S, P.id, nextIndex(S, P.id), { today: date })!;
  return {
    id, date, startedAt: Date.parse(date), title: bw.w.name, source: 'engine', durationSec: 1800, rpe: 7, rir: 2, tech: 3,
    items: bw.items.map(it => ({ ex: it.ex, target: { sets: it.sets, reps: it.reps, time: it.time }, sets: Array.from({ length: it.sets || 1 }, () => ({ reps: typeof it.reps === 'number' ? it.reps : 0, time: it.time || 0, done: true })) })),
    ...extra
  } as unknown as Session;
}

describe('training engine', () => {
  it('builds a workout only from available equipment', () => {
    const S = state(S => { S.profile.equipment = ['floor']; });
    const P = activeProgram(S), bw = buildWorkout(S, P.id, 0, { today: '2026-03-02' })!;
    expect(bw.items.length).toBeGreaterThan(2);
    for (const it of bw.items) {
      const eq = EXM[it.ex].needs || [];
      expect(eq.filter((e: string) => !['floor', 'wall'].includes(e))).toEqual([]);
    }
  });
  it('every built item has a dose (sets and reps or time)', () => {
    const S = state();
    for (const pid of ['fb_abc', 'ppl', 'ul']) {
      const bw = buildWorkout(S, pid, 0, { today: '2026-03-02' })!;
      expect(bw).not.toBeNull();
      for (const it of bw.items) { expect(it.sets).toBeGreaterThan(0); expect((it.reps ?? it.time)).toBeTruthy(); }
    }
  });
  it('proposes progression after two easy successful sessions — never applies it silently', () => {
    const S = state();
    const a = fulfil(S, '2026-03-02', 's1'); S.sessions.push(a); evaluateSession(S, a);
    expect(S.engine.proposals || []).toHaveLength(0);
    const b = fulfil(S, '2026-03-04', 's2'); S.sessions.push(b); const r = evaluateSession(S, b);
    expect(r.proposals.length).toBeGreaterThan(0);
    const p = r.proposals[0], before = { ...S.engine.doses![p.ex] };
    resolveProposal(S, p.id, true, '2026-03-04');
    const after = S.engine.doses![p.ex];
    expect(JSON.stringify(after)).not.toBe(JSON.stringify(before));
    expect(S.engine.log!.some(l => l.text.startsWith('Принято'))).toBe(true);
  });
  it('pain lowers the load and removes pending proposals', () => {
    const S = state();
    const a = fulfil(S, '2026-03-02', 's1'); evaluateSession(S, a);
    const b = fulfil(S, '2026-03-04', 's2'); evaluateSession(S, b);
    const ex = S.engine.proposals![0].ex;
    const c = fulfil(S, '2026-03-06', 's3', { pain: true }); const r = evaluateSession(S, c);
    expect(r.changes.some(t => t.includes('снижена'))).toBe(true);
    expect(S.engine.proposals!.some(p => p.ex === ex)).toBe(false);
  });
  it('suggests a light session after a very hard workout yesterday', () => {
    const S = state(S => { S.sessions.push(sess('h', '2026-03-03', [['pullup', [5]]], { rpe: 9.5 })); });
    const a = lightAdvice(S, '2026-03-04');
    expect(a.suggest).toBe(true); expect(a.reasons.join(' ')).toContain('RPE');
  });
  it('deload becomes due after 6 regular training weeks and lowers the volume when started', () => {
    const S = state(S => {
      const mondays = ['2026-01-19', '2026-01-26', '2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23'];
      mondays.forEach((d, i) => { S.sessions.push(sess('a' + i, d, [['pullup', [5]]])); S.sessions.push(sess('b' + i, d.replace(/-(\d\d)$/, (_, x) => '-' + String(+x + 2).padStart(2, '0')), [['pullup', [5]]])); });
    });
    expect(deloadStatus(S, '2026-03-02').due).toBe(true);
    const normal = buildWorkout(S, 'fb_abc', 0, { today: '2026-03-02' })!;
    startDeload(S, '2026-03-02');
    expect(deloadStatus(S, '2026-03-03').active).toBe(true);
    const light = buildWorkout(S, 'fb_abc', 0, { today: '2026-03-03' })!;
    expect(light.deload).toBe(true);
    const vol = (w: typeof normal) => w.items.reduce((a, it) => a + (it.sets || 0), 0);
    expect(vol(light)).toBeLessThan(vol(normal));
  });
});
