/* ================= Pure statistics over AppState (web, bot, API, weekly report) =================
 * No DOM, no globals: every function receives the state. Never invents data — missing values stay 0 / null.
 */
import type { AppState, DayKey, Group, Session, SessionItem, SetLog } from './types';
import { exOf } from './catalog/exercises';
import { addDays, dayKey, daysBetween, parseDay, todayKey, weekKey } from './dates';

export const doneSets = (it: SessionItem): SetLog[] => (it.sets || []).filter(s => s.done !== false);
export const sortSessions = (arr: Session[]): Session[] =>
  [...arr].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.startedAt || 0) - (b.startedAt || 0));
/** quick "+N pull-ups" entries are not workouts */
export const isWorkout = (s: Session): boolean => s.source !== 'quick';

export interface Results { pull: number; push: number; plank: number; squat: number; dips: number; hang: number }
const RESULT_EX: Record<keyof Results, { ex: string; kind: 'reps' | 'time' }> = {
  pull: { ex: 'pullup', kind: 'reps' }, push: { ex: 'pushup', kind: 'reps' }, plank: { ex: 'plank', kind: 'time' },
  squat: { ex: 'squat', kind: 'reps' }, dips: { ex: 'dips', kind: 'reps' }, hang: { ex: 'hang', kind: 'time' }
};
const TEST_KEY: Record<keyof Results, 'pullups' | 'pushups' | 'plank' | 'squats' | 'dips' | 'hang'> = { pull: 'pullups', push: 'pushups', plank: 'plank', squat: 'squats', dips: 'dips', hang: 'hang' };

/** best strict single-set results of the main exercises: profile, fitness tests and logged sets (bodyweight only) */
export function bestResults(S: AppState): Results {
  const p = S.profile || ({} as AppState['profile']), r = p.results || {};
  const o: Results = { pull: +p.maxPullups || 0, push: +(r.pushups || 0), plank: +(r.plank || 0), squat: +(r.squats || 0), dips: +(r.dips || 0), hang: +(r.hang || 0) };
  for (const t of S.tests || []) for (const k of Object.keys(o) as (keyof Results)[]) o[k] = Math.max(o[k], +(t[TEST_KEY[k]] || 0));
  for (const s of S.sessions || []) {
    if (!isWorkout(s)) continue;
    for (const it of s.items || []) for (const k of Object.keys(o) as (keyof Results)[]) {
      const m = RESULT_EX[k]; if (it.ex !== m.ex) continue;
      for (const st of doneSets(it)) {
        if (m.kind === 'time') o[k] = Math.max(o[k], +(st.time || 0));
        else if (!(+(st.weight || 0) > 0)) o[k] = Math.max(o[k], +(st.reps || 0));
      }
    }
  }
  return o;
}

export interface ExBest { reps?: number; repsDate?: DayKey; time?: number; timeDate?: DayKey; kg?: number; kgDate?: DayKey }
export function exerciseBests(S: AppState): Record<string, ExBest> {
  const o: Record<string, ExBest> = {};
  for (const s of sortSessions(S.sessions || [])) {
    if (!isWorkout(s)) continue;
    for (const it of s.items || []) {
      const e = exOf(it.ex), b = o[it.ex] || (o[it.ex] = {});
      for (const st of doneSets(it)) {
        if (e.type === 'time') { const t = +(st.time || 0); if (t > (b.time || 0)) { b.time = t; b.timeDate = s.date; } }
        else {
          const r = +(st.reps || 0), w = +(st.weight || 0);
          if (!(w > 0) && r > (b.reps || 0)) { b.reps = r; b.repsDate = s.date; }
          if (w > 0 && r > 0 && w > (b.kg || 0)) { b.kg = w; b.kgDate = s.date; }
        }
      }
    }
  }
  return o;
}

export interface PR { ex: string; kind: 'reps' | 'time' | 'kg'; v: number; prev: number; date: DayKey; test?: boolean }
/** chronological personal-record events: a value that beats a previous best of the same exercise */
export function prHistory(S: AppState): PR[] {
  type Ev = { date: DayKey; at: number; ex: string; kind: PR['kind']; v: number; test?: boolean };
  const evs: Ev[] = [];
  for (const s of S.sessions || []) {
    if (!isWorkout(s)) continue;
    for (const it of s.items || []) {
      const e = exOf(it.ex);
      for (const st of doneSets(it)) {
        if (e.type === 'time') { if (+(st.time || 0) > 0) evs.push({ date: s.date, at: s.startedAt || 0, ex: it.ex, kind: 'time', v: +(st.time || 0) }); }
        else if (+(st.weight || 0) > 0) { if (+(st.reps || 0) > 0) evs.push({ date: s.date, at: s.startedAt || 0, ex: it.ex, kind: 'kg', v: +(st.weight || 0) }); }
        else if (+(st.reps || 0) > 0) evs.push({ date: s.date, at: s.startedAt || 0, ex: it.ex, kind: 'reps', v: +(st.reps || 0) });
      }
    }
  }
  for (const t of S.tests || []) for (const k of Object.keys(TEST_KEY) as (keyof Results)[]) {
    const v = +(t[TEST_KEY[k]] || 0); if (v > 0) evs.push({ date: t.date, at: 0, ex: RESULT_EX[k].ex, kind: RESULT_EX[k].kind, v, test: true });
  }
  evs.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.at - b.at);
  const best: Record<string, number> = {}, out: PR[] = [];
  for (const e of evs) {
    const key = e.ex + ':' + e.kind, prev = best[key] || 0;
    if (e.v > prev) { if (prev > 0) out.push({ ex: e.ex, kind: e.kind, v: e.v, prev, date: e.date, test: e.test }); best[key] = e.v; }
  }
  return out;
}

export function sessionGroups(s: Session): Group[] {
  const g = new Set<Group>();
  for (const it of s.items || []) if (doneSets(it).length) { const e = exOf(it.ex); g.add(e.group); }
  return [...g];
}
export interface Volume { sets: number; reps: number; hold: number; pull: number; push: number; byGroup: Partial<Record<Group, number>> }
export function sessionVolume(s: Session): Volume {
  const v: Volume = { sets: 0, reps: 0, hold: 0, pull: 0, push: 0, byGroup: {} };
  for (const it of s.items || []) {
    const e = exOf(it.ex), ds = doneSets(it);
    for (const st of ds) {
      v.sets++;
      if (e.type === 'time') v.hold += +(st.time || 0); else { v.reps += +(st.reps || 0); if (e.count === 'pull') v.pull += +(st.reps || 0); if (e.count === 'push') v.push += +(st.reps || 0); }
    }
    if (ds.length) { v.byGroup[e.group] = (v.byGroup[e.group] || 0) + ds.length; for (const g of e.also || []) if (g === 'shoulders' || g === 'push' || g === 'pull') v.byGroup[g] = (v.byGroup[g] || 0) + ds.length * .5; }
  }
  return v;
}

export interface WeekRow { wk: DayKey; workouts: number; sets: number; minutes: number; reps: number }
export function weeklyActivity(S: AppState, weeks = 8, today: DayKey = todayKey()): WeekRow[] {
  const rows: WeekRow[] = [], idx: Record<string, WeekRow> = {};
  const w0 = parseDay(weekKey(today));
  for (let i = weeks - 1; i >= 0; i--) { const wk = dayKey(addDays(w0, -7 * i)); const r = { wk, workouts: 0, sets: 0, minutes: 0, reps: 0 }; rows.push(r); idx[wk] = r; }
  for (const s of S.sessions || []) {
    const r = idx[weekKey(s.date)]; if (!r) continue;
    const v = sessionVolume(s);
    if (isWorkout(s)) { r.workouts++; r.minutes += Math.round((s.durationSec || 0) / 60); }
    r.sets += v.sets; r.reps += v.reps;
  }
  return rows;
}
export function daysActive(S: AppState, days = 7, today: DayKey = todayKey()): { day: DayKey; workouts: number; sets: number }[] {
  const out = Array.from({ length: days }, (_, i) => ({ day: dayKey(addDays(parseDay(today), i - days + 1)), workouts: 0, sets: 0 }));
  const m = Object.fromEntries(out.map(o => [o.day, o]));
  for (const s of S.sessions || []) { const o = m[s.date]; if (!o) continue; if (isWorkout(s)) o.workouts++; o.sets += sessionVolume(s).sets; }
  return out;
}
/** weeks in a row (ending with the current or previous week) where the weekly target was met */
export function consistencyWeeks(S: AppState, today: DayKey = todayKey()): number {
  const target = Math.max(1, +S.profile.weeklyTarget || 3), rows = weeklyActivity(S, 104, today);
  let n = 0, i = rows.length - 1;
  if (rows[i].workouts < target) i--; // current week may still be in progress
  for (; i >= 0; i--) { if (rows[i].workouts >= target) n++; else break; }
  return n;
}

export interface WeightPoint { date: DayKey; v: number }
export function weightSeries(S: AppState): WeightPoint[] {
  return (S.body || []).filter(b => +(b.weight || 0) > 0).map(b => ({ date: b.date, v: +(b.weight as number) })).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}
export function currentWeight(S: AppState): { v: number; date: DayKey | null; fromProfile: boolean } {
  const ws = weightSeries(S), last = ws[ws.length - 1];
  return last ? { v: last.v, date: last.date, fromProfile: false } : { v: +S.profile.bodyweight || 0, date: null, fromProfile: true };
}
export function weightDelta(S: AppState, days: number, today: DayKey = todayKey()): number | null {
  const ws = weightSeries(S); if (ws.length < 2) return null;
  const last = ws[ws.length - 1], from = dayKey(addDays(parseDay(today), -days));
  const base = [...ws].reverse().find(p => p.date <= from) || ws[0];
  if (base === last) return null;
  return Math.round((last.v - base.v) * 10) / 10;
}
export function measurementSeries(S: AppState, field: string): WeightPoint[] {
  return (S.body || []).map(b => ({ date: b.date, v: +(((b as unknown as Record<string, unknown>)[field] as number) ?? (b.custom || {})[field] ?? 0) }))
    .filter(p => p.v > 0).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}

export interface GroupStats { sessions: Session[]; sets: number; reps: number; hold: number; last: DayKey | null; weekly: { wk: DayKey; sets: number }[]; bests: { ex: string; v: number; kind: 'reps' | 'time' | 'kg'; date?: DayKey }[] }
export function groupStats(S: AppState, g: Group, weeks = 8, today: DayKey = todayKey()): GroupStats {
  const inG = (ex: string) => { const e = exOf(ex); return e.group === g || (e.also || []).includes(g); };
  const sessions = sortSessions((S.sessions || []).filter(s => isWorkout(s) && (s.items || []).some(it => inG(it.ex) && doneSets(it).length)));
  const w0 = parseDay(weekKey(today)), weekly = Array.from({ length: weeks }, (_, i) => ({ wk: dayKey(addDays(w0, -7 * (weeks - 1 - i))), sets: 0 }));
  const wm = Object.fromEntries(weekly.map(w => [w.wk, w]));
  let sets = 0, reps = 0, hold = 0;
  for (const s of sessions) for (const it of s.items) {
    if (!inG(it.ex)) continue; const e = exOf(it.ex), ds = doneSets(it);
    sets += ds.length; const w = wm[weekKey(s.date)]; if (w) w.sets += ds.length;
    for (const st of ds) { if (e.type === 'time') hold += +(st.time || 0); else reps += +(st.reps || 0); }
  }
  const B = exerciseBests(S), bests: GroupStats['bests'] = [];
  for (const [ex, b] of Object.entries(B)) {
    if (!inG(ex)) continue;
    if (b.reps) bests.push({ ex, v: b.reps, kind: 'reps', date: b.repsDate });
    if (b.time) bests.push({ ex, v: b.time, kind: 'time', date: b.timeDate });
    if (b.kg) bests.push({ ex, v: b.kg, kind: 'kg', date: b.kgDate });
  }
  return { sessions, sets, reps, hold, last: sessions.length ? sessions[sessions.length - 1].date : null, weekly, bests };
}

export interface Summary {
  workouts: number; weekCount: number; weekTarget: number; lastWorkout: Session | null; lastPR: PR | null; results: Results;
  weight: ReturnType<typeof currentWeight>; weight30: number | null; totalSets: number; totalReps: number; totalMinutes: number; consistency: number;
  daysSinceLast: number | null;
}
export function summary(S: AppState, today: DayKey = todayKey()): Summary {
  const ws = sortSessions((S.sessions || []).filter(isWorkout)), wk = weekKey(today);
  let totalSets = 0, totalReps = 0, totalMinutes = 0;
  for (const s of S.sessions || []) { const v = sessionVolume(s); totalSets += v.sets; totalReps += v.reps; if (isWorkout(s)) totalMinutes += Math.round((s.durationSec || 0) / 60); }
  const prs = prHistory(S), last = ws[ws.length - 1] || null;
  return {
    workouts: ws.length, weekCount: ws.filter(s => weekKey(s.date) === wk).length, weekTarget: +S.profile.weeklyTarget || 3,
    lastWorkout: last, lastPR: prs[prs.length - 1] || null, results: bestResults(S), weight: currentWeight(S), weight30: weightDelta(S, 30, today),
    totalSets, totalReps, totalMinutes, consistency: consistencyWeeks(S, today), daysSinceLast: last ? daysBetween(last.date, today) : null
  };
}

export interface WeekReport {
  from: DayKey; to: DayKey; workouts: number; minutes: number; sets: number; reps: number; pull: number; push: number; hold: number;
  groups: Partial<Record<Group, number>>; prs: PR[]; target: number; prev: { workouts: number; sets: number; reps: number; minutes: number };
  weightStart: number | null; weightEnd: number | null; bestDay: { date: DayKey; sets: number } | null; painDays: number; avgRpe: number | null;
  measurements: number; photos: number;
}
export function weekReport(S: AppState, anyDayOfWeek: DayKey = todayKey()): WeekReport {
  const from = weekKey(anyDayOfWeek), to = dayKey(addDays(parseDay(from), 6)), pfrom = dayKey(addDays(parseDay(from), -7));
  const inR = (d: DayKey, a: DayKey, b: DayKey) => d >= a && d <= b;
  const agg = (a: DayKey, b: DayKey) => {
    const o = { workouts: 0, sets: 0, reps: 0, minutes: 0, pull: 0, push: 0, hold: 0, groups: {} as Partial<Record<Group, number>>, byDay: {} as Record<string, number>, pain: new Set<string>(), rpe: [] as number[] };
    for (const s of S.sessions || []) {
      if (!inR(s.date, a, b)) continue; const v = sessionVolume(s);
      if (isWorkout(s)) { o.workouts++; o.minutes += Math.round((s.durationSec || 0) / 60); if (s.rpe) o.rpe.push(s.rpe); }
      o.sets += v.sets; o.reps += v.reps; o.pull += v.pull; o.push += v.push; o.hold += v.hold; o.byDay[s.date] = (o.byDay[s.date] || 0) + v.sets;
      for (const [g, n] of Object.entries(v.byGroup)) o.groups[g as Group] = (o.groups[g as Group] || 0) + (n as number);
      if (s.pain) o.pain.add(s.date);
    }
    return o;
  };
  const cur = agg(from, to), prev = agg(pfrom, dayKey(addDays(parseDay(from), -1)));
  const ws = weightSeries(S).filter(p => p.date <= to), inWeek = ws.filter(p => p.date >= from);
  const before = ws.filter(p => p.date < from);
  const bd = Object.entries(cur.byDay).sort((a, b) => b[1] - a[1])[0];
  return {
    from, to, workouts: cur.workouts, minutes: cur.minutes, sets: cur.sets, reps: cur.reps, pull: cur.pull, push: cur.push, hold: cur.hold, groups: cur.groups,
    prs: prHistory(S).filter(p => inR(p.date, from, to)), target: +S.profile.weeklyTarget || 3,
    prev: { workouts: prev.workouts, sets: prev.sets, reps: prev.reps, minutes: prev.minutes },
    weightStart: (before[before.length - 1] || inWeek[0] || null)?.v ?? null, weightEnd: inWeek.length ? inWeek[inWeek.length - 1].v : null,
    bestDay: bd ? { date: bd[0], sets: bd[1] } : null, painDays: cur.pain.size,
    avgRpe: cur.rpe.length ? Math.round(cur.rpe.reduce((a, b) => a + b, 0) / cur.rpe.length * 10) / 10 : null,
    measurements: (S.body || []).filter(b => inR(b.date, from, to)).length, photos: (S.photos || []).filter(p => inR(p.date, from, to)).length
  };
}
