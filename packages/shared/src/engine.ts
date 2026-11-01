/* ================= Program engine & personal progression (ЧАСТЬ 4.3–4.4) =================
 * Pure functions over AppState. The engine:
 *  - suggests a level from several indicators (not only pull-ups), the user may override it;
 *  - picks an exercise for every movement slot from a ladder (level, results, equipment, manual swaps);
 *  - computes doses and adapts them for light sessions / deload weeks;
 *  - evaluates finished sessions and *proposes* progression only after stable performance.
 */
import type { AppState, DayKey, DoseState, Equipment, Group, Level, PlanItemDose, Proposal, Session } from './types';
import { EX, EXM, exOf } from './catalog/exercises';
import { MU_STAGES } from './catalog/programs';
import { PROGM_V2, PROGRAMS_V2, SLOTS, type ProgramV2, type SlotId, type WorkoutV2 } from './catalog/programs2';
import { addDays, dayKey, daysBetween, parseDay, todayKey, weekKey } from './dates';
import { bestResults, doneSets, isWorkout, sortSessions, type Results } from './stats';
import { clamp, uid } from './util';

const LV: Record<Level, number> = { beginner: 0, intermediate: 1, advanced: 2 };
export const LEVEL_NAME: Record<Level, string> = { beginner: 'BEGINNER', intermediate: 'INTERMEDIATE', advanced: 'ADVANCED' };
export const LEVEL_DESC: Record<Level, string> = {
  beginner: 'Освоение базовой техники',
  intermediate: 'Рост силы, объёма и выносливости',
  advanced: 'Сложные движения, взрывная сила, прогрессивная перегрузка'
};

/* ---------- level (ЧАСТЬ 4.3: not only pull-ups) ---------- */
export interface LevelSuggestion { level: Level; score: number; parts: { label: string; score: number; max: number }[] }
export function suggestLevel(S: AppState): LevelSuggestion {
  const R = bestResults(S), eq = equipmentOf(S), parts: LevelSuggestion['parts'] = [];
  const band = (v: number, cuts: number[]) => cuts.filter(c => v >= c).length;
  if (eq.has('bar') || R.pull > 0) parts.push({ label: 'Подтягивания', score: band(R.pull, [1, 5, 10, 15]), max: 4 });
  parts.push({ label: 'Отжимания', score: band(R.push, [5, 15, 30, 45]), max: 4 });
  if (R.plank > 0) parts.push({ label: 'Планка', score: band(R.plank, [30, 60, 120]), max: 3 });
  if (R.squat > 0) parts.push({ label: 'Приседания', score: band(R.squat, [15, 30, 50]), max: 3 });
  if (R.dips > 0) parts.push({ label: 'Брусья', score: band(R.dips, [5, 12, 20]), max: 3 });
  const exp = S.profile.experience;
  if (exp) parts.push({ label: 'Опыт тренировок', score: { none: 0, lt1: 1, '1to3': 2, gt3: 3 }[exp], max: 3 });
  const score = parts.length ? parts.reduce((a, p) => a + p.score / p.max, 0) / parts.length : 0;
  return { level: score >= .62 ? 'advanced' : score >= .3 ? 'intermediate' : 'beginner', score: Math.round(score * 100) / 100, parts };
}
export const userLevel = (S: AppState): Level => (S.profile.level as Level) || S.engine?.level || suggestLevel(S).level;
export function equipmentOf(S: AppState): Set<Equipment> {
  const s = new Set<Equipment>(['wall', 'floor']);
  const eq = S.profile.equipment;
  if (Array.isArray(eq)) eq.forEach(e => s.add(e as Equipment));
  else { s.add('bar'); } // v1 users trained on a bar
  return s;
}

/* ---------- context ---------- */
export interface Ctx { S: AppState; level: Level; eq: Set<Equipment>; R: Results; today: DayKey; deload: boolean; light: boolean; muStage: number }
export function ctxOf(S: AppState, opts: { light?: boolean; today?: DayKey } = {}): Ctx {
  const today = opts.today || todayKey();
  return { S, level: userLevel(S), eq: equipmentOf(S), R: bestResults(S), today, deload: deloadStatus(S, today).active, light: !!opts.light, muStage: muCurrentStage(S) };
}
export const muCurrentStage = (S: AppState): number => { for (const st of MU_STAGES) if (!(S.mu && S.mu.done && S.mu.done[st.n])) return st.n; return 6; };

/* ---------- slot → exercise ---------- */
const stepOk = (st: { need?: Equipment[]; min?: Partial<Record<string, number>>; lvl?: Level }, c: Ctx) =>
  (st.need || []).every(e => c.eq.has(e)) && Object.entries(st.min || {}).every(([k, v]) => (c.R as unknown as Record<string, number>)[k] >= (v as number)) && (!st.lvl || LV[c.level] >= LV[st.lvl]);
export function slotOptions(slot: SlotId, c: Ctx): string[] {
  const seen = new Set<string>();
  return SLOTS[slot].ladder.filter(st => (st.need || []).every(e => c.eq.has(e))).map(st => st.ex).filter(x => !seen.has(x) && !!seen.add(x));
}
/** hardest qualifying exercise of the ladder that is not already used in the workout */
export function pickExercise(slot: SlotId, c: Ctx, used: Set<string> = new Set()): string | null {
  const sw = c.S.engine?.swaps?.[slot];
  if (sw && EXM[sw] && !used.has(sw) && slotOptions(slot, c).includes(sw)) return sw;
  const L = SLOTS[slot].ladder; let pick: string | null = null, qualified = -1;
  L.forEach((st, i) => { if (stepOk(st, c)) qualified = i; });
  for (let i = qualified; i >= 0 && !pick; i--) if (!used.has(L[i].ex) && (L[i].need || []).every(e => c.eq.has(e))) pick = L[i].ex;
  if (!pick) { const any = L.find(st => !used.has(st.ex) && (st.need || []).every(e => c.eq.has(e))); pick = any ? any.ex : null; }
  return pick;
}

/* ---------- doses ---------- */
const REL_PULL: Record<string, number> = { pullup: .6, chinup: .65, neutral: .6, close: .6, wide: .5, pause: .4 };
const REL_PUSH: Record<string, number> = { knee_pushup: 1, pushup: .6, wide_pushup: .55, close_pushup: .5, diamond_pushup: .4, decline_pushup: .45, pp_pushup: .25, pike_pushup: .35, elev_pike: .25, hspu_wall: .1 };
const REL_SQUAT: Record<string, number> = { squat: .6, rev_lunge: .3, fwd_lunge: .3, bulgarian: .25 };
const REL_PLANK: Record<string, number> = { plank: .6, hollow: .35, side_plank: .4 };
const maxSets = (l: Level) => [3, 4, 5][LV[l]];
export function initialDose(ex: string, c: Ctx): DoseState {
  const e = exOf(ex), d = e.def || { sets: 3, reps: 8, rest: 90 }, L = LV[c.level];
  const sets = e.group === 'mobility' ? d.sets : clamp(d.sets + (L - 1), 2, maxSets(c.level));
  if (e.type === 'time') {
    let t = d.time || 30;
    if (REL_PLANK[ex] && c.R.plank > 0) t = clamp(Math.round(c.R.plank * REL_PLANK[ex] / 5) * 5, 15, 90);
    return { sets, time: t, base: t, stable: 0, fail: 0 };
  }
  let r = typeof d.reps === 'number' ? d.reps : 8;
  if (REL_PULL[ex] && c.R.pull > 0) r = clamp(Math.round(c.R.pull * REL_PULL[ex]), 1, 12);
  else if (REL_PUSH[ex] && c.R.push > 0) r = clamp(Math.round(c.R.push * REL_PUSH[ex]), 3, 20);
  else if (REL_SQUAT[ex] && c.R.squat > 0) r = clamp(Math.round(c.R.squat * REL_SQUAT[ex]), 6, 20);
  else if (ex === 'dips' && c.R.dips > 0) r = clamp(Math.round(c.R.dips * .6), 3, 15);
  return { sets, reps: r, base: r, stable: 0, fail: 0 };
}
export const doseOf = (ex: string, c: Ctx): DoseState => c.S.engine?.doses?.[ex] || initialDose(ex, c);
/** last weight the user actually used for an exercise (carried over automatically) */
export function lastWeight(S: AppState, ex: string): number {
  const ss = sortSessions(S.sessions || []);
  for (let i = ss.length - 1; i >= 0; i--) for (const it of ss[i].items || []) if (it.ex === ex) { const w = doneSets(it).map(s => +(s.weight || 0)).filter(Boolean); if (w.length) return Math.max(...w); }
  return 0;
}
export function materialize(ex: string, dose: DoseState, c: Ctx, note?: string): PlanItemDose {
  const e = exOf(ex); let sets = dose.sets, reps = dose.reps, time = dose.time;
  if (c.deload) { sets = Math.max(1, Math.round(sets * .6)); if (reps) reps = Math.max(1, Math.round(reps * .8)); if (time) time = Math.max(10, Math.round(time * .8 / 5) * 5); }
  else if (c.light) { sets = Math.max(1, sets - 1); if (reps) reps = Math.max(1, Math.round(reps * .8)); if (time) time = Math.max(10, Math.round(time * .8 / 5) * 5); }
  const w = dose.w || (e.w ? lastWeight(c.S, ex) : 0);
  return { ex, sets, ...(e.type === 'time' ? { time } : { reps }), rest: e.def?.rest ?? 90, ...(w ? { w } : {}), ...(note ? { note } : {}) };
}

/* ---------- workouts ---------- */
export interface BuiltItem extends PlanItemDose { slot: SlotId; options: string[] }
export interface BuiltWorkout { prog: ProgramV2; idx: number; w: WorkoutV2; items: BuiltItem[]; deload: boolean; light: boolean; muStage?: number }
export function buildWorkout(S: AppState, progId: string, idx: number, opts: { light?: boolean; today?: DayKey } = {}): BuiltWorkout | null {
  const P = PROGM_V2[progId]; if (!P) return null;
  const w = P.workouts[((idx % P.workouts.length) + P.workouts.length) % P.workouts.length], c = ctxOf(S, opts), items: BuiltItem[] = [], used = new Set<string>();
  for (const sd of w.slots) {
    if (sd.slot === 'mu_main' || sd.slot === 'mu_assist') {
      const st = MU_STAGES[c.muStage - 1], work = sd.slot === 'mu_main' ? st.work.slice(0, 2) : st.work.slice(2);
      for (const it of work) {
        const e = exOf(it.ex), reps = typeof it.reps === 'string' ? Math.max(1, Math.round(c.R.pull * (+(it.reps.slice(1)) || 60) / 100)) : it.reps;
        const base: DoseState = { sets: it.sets || 3, ...(e.type === 'time' ? { time: it.time || 20 } : { reps: Array.isArray(reps) ? reps[0] : (reps as number) || 3 }), base: 0, stable: 0, fail: 0 };
        if (used.has(it.ex)) continue; used.add(it.ex);
        items.push({ ...materialize(it.ex, c.S.engine?.doses?.[it.ex] || base, c, `Этап ${c.muStage}: ${st.title}`), slot: sd.slot, options: [it.ex] });
      }
      continue;
    }
    const ex = pickExercise(sd.slot, c, used); if (!ex) continue;
    used.add(ex);
    items.push({ ...materialize(ex, doseOf(ex, c), c, sd.note), slot: sd.slot, options: slotOptions(sd.slot, c) });
  }
  return { prog: P, idx: PROGM_V2[progId].workouts.indexOf(w), w, items, deload: c.deload, light: c.light, muStage: P.kind === 'mu' ? c.muStage : undefined };
}
export const nextIndex = (S: AppState, progId: string): number => { const P = PROGM_V2[progId]; return P ? ((S.progress?.[progId]?.next || 0) % P.workouts.length) : 0; };
export function recommendProgram(S: AppState): string {
  const p = S.profile, days = +(p.weeklyTarget || 3), goals = p.goals || [];
  if (p.split === 'ppl') return 'ppl'; if (p.split === 'upperlower') return 'ul'; if (p.split === 'fullbody') return 'fb_abc';
  if (p.split === 'mu') return 'mu_prep';
  if (days >= 5) return 'ppl'; if (days === 4) return 'ul';
  if (goals.includes('muscleup') && bestResults(S).pull >= 10) return 'mu_prep';
  return 'fb_abc';
}
export const activeProgram = (S: AppState): ProgramV2 => PROGM_V2[S.engine?.program || ''] || PROGM_V2[recommendProgram(S)] || PROGRAMS_V2[0];

/* ---------- deload & light sessions ---------- */
export function deloadStatus(S: AppState, today: DayKey = todayKey()): { active: boolean; until?: DayKey; due: boolean; reason?: string } {
  const E = S.engine || {};
  if (E.deloadFrom && E.deloadTo && today >= E.deloadFrom && today <= E.deloadTo) return { active: true, until: E.deloadTo, due: false };
  if (E.deloadDeclined && daysBetween(E.deloadDeclined, today) < 7) return { active: false, due: false };
  const ws = (S.sessions || []).filter(s => isWorkout(s) && (!E.lastDeloadEnd || s.date > E.lastDeloadEnd));
  const perWeek: Record<string, number> = {};
  for (const s of ws) perWeek[weekKey(s.date)] = (perWeek[weekKey(s.date)] || 0) + 1;
  const trainingWeeks = Object.values(perWeek).filter(n => n >= 2).length;
  if (trainingWeeks >= 6) return { active: false, due: true, reason: `${trainingWeeks} недель регулярных тренировок без разгрузки — неделя с меньшим объёмом поможет восстановиться и продолжить прогресс.` };
  const recent = ws.filter(s => daysBetween(s.date, today) <= 10);
  const hard = recent.filter(s => (s.rpe || 0) >= 9 || (s.feel > 0 && s.feel <= 2)).length;
  const fails = Object.values(E.doses || {}).filter(d => d.fail >= 2).length;
  if (hard >= 2 && (fails >= 2 || recent.filter(s => s.pain).length >= 1)) return { active: false, due: true, reason: 'Признаки накопленной усталости: несколько очень тяжёлых тренировок подряд и снижение результатов.' };
  return { active: false, due: false };
}
export function startDeload(S: AppState, today: DayKey = todayKey()): void {
  S.engine = S.engine || {}; S.engine.deloadFrom = today; S.engine.deloadTo = dayKey(addDays(parseDay(today), 6)); S.engine.lastDeloadEnd = S.engine.deloadTo;
  (S.engine.log = S.engine.log || []).push({ date: today, ex: '', text: 'Начата разгрузочная неделя (−40% объёма)' });
}
export function declineDeload(S: AppState, today: DayKey = todayKey()): void { S.engine = S.engine || {}; S.engine.deloadDeclined = today; }
export function lightAdvice(S: AppState, today: DayKey = todayKey()): { suggest: boolean; reasons: string[] } {
  const ws = sortSessions((S.sessions || []).filter(isWorkout)), reasons: string[] = [];
  if ((S.daily?.[today] || {}).recovery) reasons.push('Включён режим восстановления.');
  const last = ws[ws.length - 1];
  if (last && daysBetween(last.date, today) <= 1) {
    if ((last.rpe || 0) >= 9) reasons.push('Прошлая тренировка была очень тяжёлой (RPE 9–10).');
    if (last.feel > 0 && last.feel <= 2) reasons.push('После прошлой тренировки самочувствие было плохим.');
  }
  if (ws.some(s => s.pain && daysBetween(s.date, today) <= 3)) reasons.push('За последние 3 дня отмечена боль — снизьте нагрузку; при повторении обратитесь к специалисту.');
  const y = dayKey(addDays(parseDay(today), -1)), y2 = dayKey(addDays(parseDay(today), -2));
  if (ws.some(s => s.date === y) && ws.some(s => s.date === y2)) reasons.push('Два дня подряд с тренировками.');
  return { suggest: reasons.length > 0, reasons };
}

/* ---------- progression ---------- */
function nextStep(ex: string, d: DoseState, c: Ctx): { kind: Proposal['kind']; text: string; to: Proposal['to'] } | null {
  const e = exOf(ex), ms = e.group === 'mobility' ? d.sets : maxSets(c.level);
  if (e.type === 'time') {
    const t = d.time || 30, hi = Math.min(120, Math.max(d.base * 2, d.base + 20));
    if (t < hi) { const nt = Math.min(hi, t + (t < 30 ? 5 : 10)); return { kind: 'time', text: `${e.name}: ${d.sets} × ${t} с → ${d.sets} × ${nt} с`, to: { time: nt } }; }
    if (d.sets < ms) return { kind: 'set', text: `${e.name}: +1 подход (${d.sets + 1} × ${d.base} с)`, to: { sets: d.sets + 1, time: d.base } };
  } else {
    const r = d.reps || 8, hi = d.base + Math.max(2, Math.round(d.base * .5));
    if (r < hi) { const nr = Math.min(hi, r + (d.base >= 10 ? 2 : 1)); return { kind: 'reps', text: `${e.name}: ${d.sets} × ${r} → ${d.sets} × ${nr}`, to: { reps: nr } }; }
    if (d.sets < ms) return { kind: 'set', text: `${e.name}: +1 подход (${d.sets + 1} × ${d.base})`, to: { sets: d.sets + 1, reps: d.base } };
  }
  const h = e.harder && EXM[e.harder] ? EXM[e.harder] : null;
  if (h) { const nd = initialDose(h.id, c); return { kind: 'harder', text: `Переход: ${e.name} → ${h.name} (${nd.sets} × ${h.type === 'time' ? nd.time + ' с' : nd.reps})`, to: { ex: h.id, sets: nd.sets, reps: nd.reps, time: nd.time, base: nd.base } }; }
  if (e.w) { const nw = (d.w || lastWeight(c.S, ex)) + (e.count === 'pull' || e.count === 'dip' ? 2.5 : 1); return { kind: 'weight', text: `${e.name}: добавить вес — ${nw} кг`, to: { w: nw, reps: d.base } }; }
  return null;
}
export interface EvalResult { changes: string[]; proposals: Proposal[] }
/** called once after an engine session is saved; mutates S.engine (doses, proposals, log) */
export function evaluateSession(S: AppState, s: Session, today: DayKey = s.date): EvalResult {
  const out: EvalResult = { changes: [], proposals: [] };
  if (s.source !== 'engine' && s.source !== 'group') return out;
  const c = ctxOf(S, { today }), E = S.engine = S.engine || {}, doses = E.doses = E.doses || {}, props = E.proposals = E.proposals || [], log = E.log = E.log || [];
  const easy = (s.rir == null || s.rir >= 1) && (s.rpe == null || s.rpe <= 8) && (s.tech == null || s.tech >= 2);
  for (const it of s.items || []) {
    const t = it.target; if (!t || !EXM[it.ex] || exOf(it.ex).group === 'muscleup') continue;
    const e = exOf(it.ex), d: DoseState = doses[it.ex] ? { ...doses[it.ex] } : initialDose(it.ex, c);
    const ok = (it.sets || []).filter(x => x.done === true), planned = t.sets || ok.length;
    const tr = typeof t.reps === 'number' ? t.reps : 0, tt = t.time || 0;
    const success = ok.length >= planned && ok.every(x => e.type === 'time' ? (+(x.time || 0) >= tt) : (+(x.reps || 0) >= tr));
    d.last = s.date;
    if (s.pain) {
      if (e.type === 'time') d.time = Math.max(10, (d.time || 20) - 5); else if ((d.reps || 1) > Math.max(1, Math.round(d.base * .8))) d.reps = Math.max(1, (d.reps || 1) - 1); else d.sets = Math.max(1, d.sets - 1);
      d.stable = 0; d.fail = 0; const txt = `${e.name}: нагрузка снижена из-за боли`; out.changes.push(txt); log.push({ date: s.date, ex: it.ex, text: txt });
      for (let i = props.length - 1; i >= 0; i--) if (props[i].ex === it.ex) props.splice(i, 1);
    } else if (!success) {
      d.fail++; d.stable = 0;
      if (d.fail >= 2 && !props.some(p => p.ex === it.ex)) {
        const to = e.type === 'time' ? { time: Math.max(10, (d.time || 20) - 5) } : ((d.reps || 1) > 1 ? { reps: Math.max(1, (d.reps || 1) - 2) } : { sets: Math.max(1, d.sets - 1) });
        const p: Proposal = { id: uid(), ex: it.ex, kind: 'easier', date: s.date, to, text: `${e.name}: две тренировки подряд план не выполнен — облегчить до ${e.type === 'time' ? `${d.sets} × ${to.time} с` : `${to.sets || d.sets} × ${to.reps || d.reps}`}` };
        props.push(p); out.proposals.push(p);
      }
    } else if (easy && !s.light && !c.deload) { d.stable++; d.fail = 0; }
    else d.fail = 0;
    if (d.stable >= 2 && !props.some(p => p.ex === it.ex)) {
      const st = nextStep(it.ex, d, c);
      if (st) { const p: Proposal = { id: uid(), ex: it.ex, kind: st.kind, text: st.text, to: st.to, date: s.date }; props.push(p); out.proposals.push(p); }
    }
    doses[it.ex] = d;
  }
  return out;
}
export function resolveProposal(S: AppState, id: string, accept: boolean, today: DayKey = todayKey()): Proposal | null {
  const E = S.engine = S.engine || {}, props = E.proposals || [], i = props.findIndex(p => p.id === id); if (i < 0) return null;
  const p = props.splice(i, 1)[0], doses = E.doses = E.doses || {}, log = E.log = E.log || [];
  const d = doses[p.ex]; if (d) { d.stable = 0; d.fail = 0; }
  if (accept) {
    if (p.kind === 'harder' && p.to.ex) {
      doses[p.to.ex] = { sets: p.to.sets || 3, reps: p.to.reps, time: p.to.time, base: p.to.base || p.to.reps || p.to.time || 0, stable: 0, fail: 0 };
      const swaps = E.swaps = E.swaps || {};
      for (const [slot, ex] of Object.entries(swaps)) if (ex === p.ex) swaps[slot] = p.to.ex;
      for (const sl of Object.values(SLOTS)) if (sl.ladder.some(st => st.ex === p.ex) && sl.ladder.some(st => st.ex === p.to.ex) && !swaps[sl.id]) swaps[sl.id] = p.to.ex;
    } else if (d) Object.assign(d, Object.fromEntries(Object.entries(p.to).filter(([k]) => k !== 'ex')));
    log.push({ date: today, ex: p.ex, text: 'Принято: ' + p.text });
  } else log.push({ date: today, ex: p.ex, text: 'Отложено: ' + p.text });
  return p;
}

/* ---------- single-group workouts (ЧАСТЬ 3: training by body part) ---------- */
export const GROUP_SLOTS: Record<Group, SlotId[]> = {
  pull: ['vpull', 'hpull', 'chin', 'reardelt', 'grip'],
  push: ['hpush', 'pushv', 'dip', 'triceps', 'scap'],
  shoulders: ['vpush', 'latdelt', 'frontdelt', 'reardelt', 'scap'],
  core: ['core_stab', 'core_rectus', 'core_obl', 'core_pelvis', 'core_dyn'],
  legs: ['squat', 'split', 'hinge', 'calf', 'wallsit'],
  fullbody: ['vpull', 'hpush', 'squat', 'hpull', 'core_stab', 'latdelt'],
  mobility: [],
  muscleup: ['mu_main', 'mu_assist', 'core_stab']
};
export interface GroupWorkout { group: Group; items: BuiltItem[]; deload: boolean; light: boolean; muStage?: number }
export function buildGroupWorkout(S: AppState, g: Group, opts: { light?: boolean; today?: DayKey } = {}): GroupWorkout {
  const c = ctxOf(S, opts), items: BuiltItem[] = [], used = new Set<string>();
  if (g === 'mobility') {
    for (const e of EX.filter(x => x.group === 'mobility')) {
      const d = e.def || { sets: 2, time: 30, rest: 15 };
      items.push({ ex: e.id, sets: d.sets || 2, time: d.time || 30, rest: d.rest ?? 15, slot: 'core_dyn', options: [e.id] });
    }
    return { group: g, items, deload: c.deload, light: !!opts.light };
  }
  for (const slot of GROUP_SLOTS[g]) {
    if (slot === 'mu_main' || slot === 'mu_assist') {
      const st = MU_STAGES[c.muStage - 1], work = slot === 'mu_main' ? st.work.slice(0, 2) : st.work.slice(2);
      for (const it of work) {
        if (used.has(it.ex)) continue; used.add(it.ex);
        const e = exOf(it.ex), reps = typeof it.reps === 'string' ? Math.max(1, Math.round(c.R.pull * (+(it.reps.slice(1)) || 60) / 100)) : it.reps;
        const base: DoseState = { sets: it.sets || 3, ...(e.type === 'time' ? { time: it.time || 20 } : { reps: Array.isArray(reps) ? reps[0] : (reps as number) || 3 }), base: 0, stable: 0, fail: 0 };
        items.push({ ...materialize(it.ex, c.S.engine?.doses?.[it.ex] || base, c, `Этап ${c.muStage}: ${st.title}`), slot, options: [it.ex] });
      }
      continue;
    }
    const ex = pickExercise(slot, c, used); if (!ex) continue;
    used.add(ex);
    items.push({ ...materialize(ex, doseOf(ex, c), c), slot, options: slotOptions(slot, c) });
  }
  return { group: g, items, deload: c.deload, light: c.light, muStage: g === 'muscleup' ? c.muStage : undefined };
}
/** human readable dose of a built item: 3 × 8 · +5 кг / 3 × 30 с */
export function doseLabel(it: PlanItemDose): string {
  const e = exOf(it.ex), r = e.type === 'time' ? `${it.time || 0} с` : Array.isArray(it.reps) ? it.reps.join('-') : String(it.reps ?? '');
  return `${it.sets || 1} × ${r}${it.w ? ` · +${it.w} кг` : ''}`;
}
