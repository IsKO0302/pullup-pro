import { describe, expect, it } from 'vitest';
import { bestResults, isWorkout, prHistory, summary, weekReport, weightDelta, consistencyWeeks } from '@pullup/shared';
import { sess, state } from './helpers';

describe('statistics (pure, never invented)', () => {
  it('empty state gives zeros and nulls, not fake numbers', () => {
    const s = summary(state(), '2026-03-04');
    expect(s.workouts).toBe(0); expect(s.lastWorkout).toBeNull(); expect(s.lastPR).toBeNull();
    expect(s.weight30).toBeNull(); expect(s.totalSets).toBe(0); expect(s.daysSinceLast).toBeNull();
  });
  it('counts workouts, sets, reps and the current week', () => {
    const S = state(S => {
      S.sessions.push(sess('a', '2026-03-02', [['pullup', [5, 5, 4]], ['pushup', [12, 10]]]));
      S.sessions.push(sess('b', '2026-03-04', [['pullup', [6, 5]]]));
      S.sessions.push(sess('q', '2026-03-04', [['pullup', [3]]], { source: 'quick' }));
    });
    const s = summary(S, '2026-03-05');
    expect(s.workouts).toBe(2);                 // the quick "+3" entry is not a workout
    expect(s.weekCount).toBe(2); expect(s.totalSets).toBe(8); expect(s.totalReps).toBe(50);
    expect(s.results.pull).toBe(6); expect(s.results.push).toBe(12);
    expect(s.daysSinceLast).toBe(1);
    expect(isWorkout(S.sessions[2])).toBe(false);
  });
  it('detects personal records chronologically', () => {
    const S = state(S => {
      S.sessions.push(sess('a', '2026-03-02', [['pullup', [5, 5]]]));
      S.sessions.push(sess('b', '2026-03-04', [['pullup', [7]]]));
      S.sessions.push(sess('c', '2026-03-06', [['pullup', [6]]]));
    });
    const prs = prHistory(S).filter(p => p.ex === 'pullup');
    expect(prs.at(-1)).toMatchObject({ ex: 'pullup', v: 7, prev: 5, date: '2026-03-04' });
    expect(prs.some(p => p.date === '2026-03-06')).toBe(false);
  });
  it('best results take profile, tests and bodyweight sets — weighted sets do not count as strict reps', () => {
    const S = state(S => {
      S.profile.maxPullups = 4;
      S.tests.push({ id: 't1', date: '2026-03-01', pullups: 8 } as any);
      S.sessions.push(sess('a', '2026-03-02', [['pullup', [{ reps: 12, weight: 10 }]]]));
    });
    expect(bestResults(S).pull).toBe(8);
  });
  it('weekly report compares with the previous week and finds pain days', () => {
    const S = state(S => {
      S.sessions.push(sess('p1', '2026-02-24', [['pullup', [5]]]));
      S.sessions.push(sess('c1', '2026-03-02', [['pullup', [5, 5]]], { rpe: 8 }));
      S.sessions.push(sess('c2', '2026-03-04', [['pullup', [6]]], { pain: true, rpe: 9 }));
    });
    const r = weekReport(S, '2026-03-05');
    expect(r.from).toBe('2026-03-02'); expect(r.to).toBe('2026-03-08');
    expect(r.workouts).toBe(2); expect(r.prev.workouts).toBe(1); expect(r.sets).toBe(3);
    expect(r.painDays).toBe(1); expect(r.avgRpe).toBe(8.5);
  });
  it('weight delta needs two real points', () => {
    const S = state(S => { S.body.push({ id: 'w1', date: '2026-02-01', weight: 80 } as any); });
    expect(weightDelta(S, 30, '2026-03-05')).toBeNull();
    S.body.push({ id: 'w2', date: '2026-03-04', weight: 78.5 } as any);
    expect(weightDelta(S, 30, '2026-03-05')).toBe(-1.5);
  });
  it('consistency counts consecutive weeks that met the weekly target', () => {
    const S = state(S => {
      S.profile.weeklyTarget = 2;
      for (const [i, d] of ['2026-02-16', '2026-02-18', '2026-02-23', '2026-02-25', '2026-03-02'].entries()) S.sessions.push(sess('s' + i, d, [['pullup', [5]]]));
    });
    expect(consistencyWeeks(S, '2026-03-03')).toBe(2);   // current week (1 of 2) is still in progress
  });
});
