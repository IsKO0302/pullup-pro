import { toast } from '../components/toast';
import { DATA_VER, S, save } from '../core/state';
import { exOf } from '@pullup/shared/catalog/exercises';
import { ACH2, achCtx } from '@pullup/shared/catalog/ach2';
import { GROUPM } from '@pullup/shared/catalog/muscles';
import { PROGM_V2 } from '@pullup/shared/catalog/programs2';
import { warmFor, type WarmItem } from '@pullup/shared/catalog/warmup';
import { buildGroupWorkout, buildWorkout } from '@pullup/shared/engine';
import { ACH, DAILY_BASE, DAILY_EXTRA, DAILY_REC, MU_STAGES, PROGM, PROGRAMS, titleFor } from '@pullup/shared/catalog/programs';
import { addDays, dayKey, daysBetween, fmtSec, parseDay, relDay, startOfWeek, todayKey, weekKey } from '@pullup/shared/dates';
import { W, clamp, esc, fmtNum, hashStr, plural, uid } from '@pullup/shared/util';

/* ================= Derived stats, records, XP, recommendations ================= */
export const LG = (() => {
  let cache = null, cacheVer = -1;
  const upd = (o, ex, k, v, d?) => { if (!(v > 0)) return; const b = o[ex] || (o[ex] = {}); if (!(b[k] >= v)) { b[k] = v; if (d) (o._d || (Object.defineProperty(o, '_d', { value: {}, enumerable: false }), o._d))[ex + '.' + k] = d; } };
  const doneSets = it => (it.sets || []).filter(s => s.done !== false);
  function sessStats(s) {
    const bw = +S.profile.bodyweight || 0, o = { pull: 0, reps: 0, hold: 0, mu: 0, ton: 0, sets: 0, best: {}, strict: 0 };
    for (const it of s.items || []) {
      const e = exOf(it.ex);
      for (const st of doneSets(it)) {
        o.sets++;
        if (e.type === 'time') { const t = +st.time || 0; o.hold += t; upd(o.best, it.ex, 'time', t); }
        else {
          const r = +st.reps || 0, w = +st.weight || 0; o.reps += r;
          if (e.count === 'pull') { o.pull += r; o.ton += r * (bw + w); }
          if (e.count === 'mu') o.mu += r;
          if (it.ex === 'pullup' && !(w > 0) && s.source !== 'quick') o.strict = Math.max(o.strict, r);
          upd(o.best, it.ex, 'reps', r); if (w > 0 && r > 0) upd(o.best, it.ex, 'kg', w);
        }
      }
    }
    return o;
  }
  const sortSess = arr => [...arr].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.startedAt || 0) - (b.startedAt || 0));
  function derive() {
    if (cache && cacheVer === DATA_VER) return cache;
    const R: any = { maxPull: +S.profile.maxPullups || 0, maxPullDate: null, maxHang: 0, maxHangDate: null, maxDayPull: 0, maxDayDate: null, maxWeekPull: 0, maxWeekKey: null, maxKg: 0, maxKgDate: null, maxKgReps: 0, maxMuSet: 0, maxMuSession: 0, maxSessPull: 0, maxSessDate: null, dips: 0, sbdips: 0, support: 0, ctb: 0 };
    const D: any = { tot: { pull: 0, reps: 0, hold: 0, mu: 0, ton: 0, dur: 0, workouts: 0 }, rec: R, byDay: {}, byWeek: {}, best: {}, maxSeries: {}, st: new Map(), early: 0, night: 0, warmups: 0 };
    const sess = sortSess(S.sessions); D.sessions = sess;
    for (const s of sess) {
      const st: any = sessStats(s); D.st.set(s.id, st);
      const quick = s.source === 'quick';
      const day = D.byDay[s.date] || (D.byDay[s.date] = { pull: 0, reps: 0, hold: 0, mu: 0, ton: 0, n: 0, workouts: 0, dur: 0, pain: false, ids: [] });
      const wk = weekKey(s.date), W = D.byWeek[wk] || (D.byWeek[wk] = { n: 0, pull: 0, reps: 0, ton: 0, dur: 0 });
      for (const k of ['pull', 'reps', 'hold', 'mu', 'ton']) { D.tot[k] += st[k]; day[k] += st[k]; }
      W.pull += st.pull; W.reps += st.reps; W.ton += st.ton;
      day.n++; day.ids.push(s.id); day.dur += s.durationSec || 0; if (s.pain) day.pain = true;
      D.tot.dur += s.durationSec || 0; W.dur += s.durationSec || 0;
      if (!quick) { D.tot.workouts++; day.workouts++; W.n++; }
      if (s.warmup) D.warmups++;
      if (s.startedAt && !quick) { const h = new Date(s.startedAt).getHours(); if (h < 8) D.early = 1; if (h >= 21) D.night = 1; }
      for (const [ex, b] of Object.entries<any>(st.best)) { for (const [k, v] of Object.entries<any>(b)) upd(D.best, ex, k, v, s.date); }
      if (st.strict > 0) { if (st.strict > R.maxPull || (st.strict === R.maxPull && !R.maxPullDate)) { R.maxPull = st.strict; R.maxPullDate = s.date; } D.maxSeries[s.date] = Math.max(D.maxSeries[s.date] || 0, st.strict); }
      const hb = (st.best.hang || {}).time || 0; if (hb > R.maxHang) { R.maxHang = hb; R.maxHangDate = s.date; }
      for (const it of s.items || []) { const e = exOf(it.ex); if (e.count !== 'pull') continue; for (const x of doneSets(it)) { const w = +x.weight || 0; if (w > R.maxKg || (w === R.maxKg && w > 0 && (+x.reps || 0) > R.maxKgReps)) { R.maxKg = w; R.maxKgReps = +x.reps || 0; R.maxKgDate = s.date; } } }
      { const mus = (st.best.muscleup || {}).reps || 0; if (mus > R.maxMuSet) { R.maxMuSet = mus; R.maxMuDate = s.date; } }
      R.maxMuSession = Math.max(R.maxMuSession, st.mu);
      if (st.pull > R.maxSessPull) { R.maxSessPull = st.pull; R.maxSessDate = s.date; }
    }
    for (const t of S.tests) {
      if ((t.pullups || 0) > R.maxPull || (t.pullups > 0 && t.pullups === R.maxPull && (!R.maxPullDate || t.date < R.maxPullDate))) { R.maxPull = t.pullups; R.maxPullDate = t.date; }
      if ((t.hang || 0) > R.maxHang) { R.maxHang = t.hang; R.maxHangDate = t.date; }
      if ((t.dips || 0) > 0) upd(D.best, 'dips', 'reps', t.dips, t.date);
      if (t.pullups > 0) D.maxSeries[t.date] = Math.max(D.maxSeries[t.date] || 0, t.pullups);
    }
    R.dips = (D.best.dips || {}).reps || 0; R.sbdips = (D.best.sbdips || {}).reps || 0; R.support = (D.best.support || {}).time || 0; R.ctb = (D.best.ctb || {}).reps || 0;
    for (const [k, d] of Object.entries<any>(D.byDay)) if (d.pull > R.maxDayPull) { R.maxDayPull = d.pull; R.maxDayDate = k; }
    for (const [k, w] of Object.entries<any>(D.byWeek)) if (w.pull > R.maxWeekPull) { R.maxWeekPull = w.pull; R.maxWeekKey = k; }
    // weekly consistency streak (>=2 workouts per week)
    const thisW = startOfWeek(new Date()), wn = d => (D.byWeek[dayKey(d)] || {}).n || 0;
    let cur = 0, d = new Date(thisW);
    if (wn(d) < 2) d = addDays(d, -7);
    while (wn(d) >= 2) { cur++; d = addDays(d, -7); }
    let best = 0, run = 0;
    if (sess.length) { let w = startOfWeek(parseDay(sess[0].date)); while (w <= thisW) { if (wn(w) >= 2) { run++; best = Math.max(best, run); } else if (dayKey(w) !== dayKey(thisW)) run = 0; w = addDays(w, 7); } }
    D.streak = cur; D.bestStreak = Math.max(best, cur);
    const goal = +S.profile.goalDaily || 0;
    D.goalDays = goal > 0 ? Object.entries<any>(D.byDay).filter(([k, v]) => v.pull >= goal && !(S.daily[k] || {}).recovery).length : 0;
    D.muDone = Object.keys(S.mu.done || {}).filter(k => S.mu.done[k]).length;
    D.tests = S.tests.length; D.custom = S.custom.length; D.planned = (S.ui && S.ui.planCount) || 0;
    D.recovery = Object.values(S.daily).filter((x: any) => x && x.recovery).length;
    let xp = 0;
    for (const s of sess) { const st = D.st.get(s.id); xp += st.pull * 2 + Math.max(0, st.reps - st.pull - st.mu) + st.hold * .2 + st.mu * 10 + (s.source === 'quick' ? 0 : (s.completed !== false ? 40 : 15)); }
    xp += D.tests * 50 + Object.keys(S.ach).length * 100 + D.muDone * 250 + D.goalDays * 30;
    D.xp = Math.round(xp);
    D.level = Math.max(1, Math.floor((1 + Math.sqrt(1 + 4 * D.xp / 50)) / 2));
    D.lvlFrom = 50 * (D.level - 1) * D.level; D.lvlTo = 50 * D.level * (D.level + 1); D.title = titleFor(D.level);
    // recent max (60 days)
    const lim = dayKey(addDays(new Date(), -60)); let rm = 0;
    for (const [k, v] of Object.entries<any>(D.maxSeries)) if (k >= lim) rm = Math.max(rm, v);
    D.curMax = Math.max(+S.profile.maxPullups || 0, rm) || R.maxPull;
    cache = D; cacheVer = DATA_VER; return D;
  }
  const metric = m => { const D = derive(); return ({ max: D.rec.maxPull, hang: D.rec.maxHang, dips: D.rec.dips, sbdips: D.rec.sbdips, support: D.rec.support, ctb: D.rec.ctb, muTotal: D.tot.mu, muSession: D.rec.maxMuSession })[m] || 0; };
  const metricUnit = m => (m === 'hang' || m === 'support') ? 'с' : '';
  function checkAch(silent?) {
    const D = derive(), newly = [];
    for (const a of ACH) { if (S.ach[a.id]) continue; const [c, t] = a.p(D); if (c >= t) { S.ach[a.id] = todayKey(); newly.push(a); } }
    const C = achCtx(S as any);
    for (const a of ACH2) { if (S.ach[a.id]) continue; const [c, t] = a.p(C); if (c >= t) { S.ach[a.id] = todayKey(); newly.push(a); } }
    if (newly.length) { save(); if (!silent) newly.slice(0, 3).forEach((a, i) => setTimeout(() => toast(`Достижение: <b>${esc(a.name)}</b> · +100 XP`, 'ach', 4200), 400 + i * 1100)); }
    return newly;
  }
  /* ---------- readiness ---------- */
  function readiness() {
    const D = derive(), t = todayKey(), y = dayKey(addDays(new Date(), -1)), y2 = dayKey(addDays(new Date(), -2));
    const dw = k => (D.byDay[k] || {}).workouts || 0, reasons = []; let lvl = 'go';
    const bump = l => { const o = { go: 0, easy: 1, rest: 2 }; if (o[l] > o[lvl]) lvl = l; };
    if ((S.daily[t] || {}).recovery) { bump('rest'); reasons.push('Сегодня включён режим восстановления.'); }
    const painRecent = S.sessions.some(s => s.pain && daysBetween(s.date, t) >= 0 && daysBetween(s.date, t) <= 2);
    if (painRecent) { bump('rest'); reasons.push('За последние 2 дня отмечена боль. Отдохните; если боль повторяется — обратитесь к специалисту.'); }
    if (dw(y) && dw(y2)) { bump('rest'); reasons.push('Два дня подряд с тренировками — тяговым мышцам нужен отдых.'); }
    else if (dw(y)) { bump('easy'); reasons.push('Вчера была тренировка: на восстановление тяговых мышц нужно около 48 часов.'); }
    if (dw(t)) { bump('easy'); reasons.push('Сегодня тренировка уже была.'); }
    const last = [...D.sessions].reverse().find(s => s.source !== 'quick');
    if (last && last.feel && last.feel <= 2 && daysBetween(last.date, t) <= 3) { bump('easy'); reasons.push('Прошлая тренировка далась тяжело — снизьте объём.'); }
    const wk = (D.byWeek[weekKey(new Date())] || {}).n || 0;
    if (wk >= (+S.profile.weeklyTarget || 3) + 1) { bump('easy'); reasons.push('Недельная цель уже перевыполнена.'); }
    if (!reasons.length) reasons.push(last ? `Последняя тренировка — ${relDay(last.date)}. Вы восстановлены, можно тренироваться.` : 'Начните с разминки и первой тренировки программы.');
    return { lvl, reasons, title: { go: 'Готов к тренировке', easy: 'Лёгкая нагрузка', rest: 'Лучше отдохнуть' }[lvl] };
  }
  /* ---------- programs ---------- */
  function nextWorkout(pid?) {
    const P = PROGM[pid || S.profile.program] || PROGRAMS[0], pr: any = S.progress[P.id] || {}, idx = (pr.next || 0) % P.workouts.length;
    return { prog: P, idx, w: P.workouts[idx] };
  }
  const curMax = () => derive().curMax;
  function resolveReps(spec) {
    if (typeof spec === 'number') return spec;
    const m = /^p(\d+)$/.exec(spec || ''); if (m) return Math.max(1, Math.round(curMax() * (+m[1]) / 100));
    return 5;
  }
  function planItems(items, ctx?) {
    const adjAll = ctx ? ((S.progress[ctx.prog] || {}).adj || {}) : {};
    return items.map((it, i) => {
      const e = exOf(it.ex), adj = ctx && !Array.isArray(it.reps) ? (adjAll[`${ctx.w}:${i}`] || 0) : 0;
      let sets;
      if (Array.isArray(it.reps)) sets = it.reps.map(r => ({ t: r }));
      else if (e.type === 'time') sets = Array.from({ length: it.sets || 3 }, () => ({ tt: Math.max(5, (it.time || 20) + adj * 5) }));
      else sets = Array.from({ length: it.sets || 3 }, () => ({ t: Math.max(1, resolveReps(it.reps) + adj) }));
      return { ex: it.ex, rest: it.rest != null ? it.rest : S.profile.restDefault, w: it.w || 0, sets, adj, idx: i };
    });
  }
  function doseText(it) {
    const e = exOf(it.ex);
    if (it.sets && Array.isArray(it.sets) && typeof it.sets[0] === 'object') {
      const ts = it.sets.map(s => e.type === 'time' ? s.tt : s.t), same = ts.every(v => v === ts[0]);
      return (same ? `${ts.length} × ${ts[0]}${e.type === 'time' ? ' с' : ''}` : ts.join('-')) + (it.w ? ` · +${fmtNum(it.w)} кг` : '');
    }
    if (Array.isArray(it.reps)) return it.reps.join('-');
    const r = e.type === 'time' ? `${it.time} с` : (typeof it.reps === 'string' ? `${resolveReps(it.reps)} (${it.reps.slice(1)}% макс.)` : it.reps);
    return `${it.sets} × ${r}${it.w ? ` · +${fmtNum(it.w)} кг` : ''}`;
  }
  function lighten(items) {
    return items.map(it => ({ ...it, sets: it.sets.slice(0, Math.max(1, it.sets.length - 1)).map(s => s.tt ? { tt: Math.max(5, Math.round(s.tt * .8)) } : { t: Math.max(1, Math.round(s.t * .8)) }) }));
  }
  const noWarm = ['plank', 'hollow', 'pushup', 'ytw', 'facepull'];
  /** planned dose of a run item (saved with the session so progression can compare plan vs. fact) */
  function targetOf(it) {
    const e = exOf(it.ex), ts = it.sets.map(s => e.type === 'time' ? s.tt : s.t), same = ts.every(v => v === ts[0]);
    return { ex: it.ex, sets: it.sets.length, ...(e.type === 'time' ? { time: ts[0] || 0 } : { reps: same ? (ts[0] || 0) : ts }), rest: it.rest || 0, ...(it.w ? { w: it.w } : {}) };
  }
  const groupsOfItems = items => { const g = []; for (const it of items) { const x = exOf(it.ex).group; if (x && !g.includes(x)) g.push(x); } return g; };
  function makeRun(o) {
    const items = (o.light && !o.prelight ? lighten(o.items) : o.items).map(it => {
      const r: any = { ex: it.ex, rest: it.rest, w: it.w || 0, idx: it.idx, extra: !!it.extra, sets: it.sets.map(s => ({ ...s })) };
      if (it.slot) r.slot = it.slot; if (it.options) r.options = it.options; if (it.note) r.note = it.note;
      r.target = targetOf(r); return r;
    });
    const warmList: WarmItem[] = o.warmup ? warmFor(groupsOfItems(items) as any) : [];
    return { id: uid(), title: o.title, sub: o.sub || '', source: o.source, ref: o.ref || null, items, cur: 0, phase: o.warmup ? 'warmup' : 'work', warmChecks: {}, warmup: false, warmList, v: 2,
      startedAt: Date.now(), activeMs: 0, tickAt: Date.now(), paused: false, light: !!o.light, pain: false, restEnd: 0, restTotal: 0, restLeft: 0, holdStart: 0, cnt: null, wt: null, log: [] };
  }
  const runProgram = (pid, idx, light) => { const P = PROGM[pid], w = P.workouts[idx]; return makeRun({ title: `${P.name} · ${w.name}`, sub: w.focus, source: 'program', ref: { prog: pid, idx, w: w.id }, items: planItems(w.items, { prog: pid, w: w.id }), warmup: true, light }); };
  const runCustom = (c, light) => makeRun({ title: c.name, sub: 'Своя тренировка', source: 'custom', ref: { cid: c.id }, items: c.items.map(it => { const e = exOf(it.ex); return { ex: it.ex, rest: it.rest, w: it.w || 0, sets: Array.from({ length: it.sets || 1 }, () => e.type === 'time' ? { tt: it.time || 20 } : { t: it.reps || 5 }) }; }), warmup: true, light });
  const runMu = (n, light) => { const st = MU_STAGES[n - 1]; return makeRun({ title: `Muscle-Up · Этап ${n}`, sub: st.title, source: 'mu', ref: { stage: n }, items: planItems(st.work), warmup: true, light }); };
  const runSingle = id => { const e = exOf(id), d = e.def || { sets: 3, reps: 5, rest: 90 }; return makeRun({ title: e.name, sub: 'Одно упражнение', source: 'single', items: planItems([{ ex: id, sets: d.sets, reps: d.reps, time: d.time, rest: d.rest, w: e.wDef || 0 }]), warmup: !noWarm.includes(id) }); };
  /** engine items (already adapted for light / deload by the engine) → run items */
  const engineItems = items => items.map((it, i) => {
    const e = exOf(it.ex), n = Math.max(1, it.sets || 1);
    const sets = Array.isArray(it.reps) ? it.reps.map(r => ({ t: r })) : Array.from({ length: n }, () => e.type === 'time' ? { tt: Math.max(5, it.time || 20) } : { t: Math.max(1, +it.reps || 1) });
    return { ex: it.ex, rest: it.rest != null ? it.rest : S.profile.restDefault, w: it.w || 0, idx: i, slot: it.slot, options: it.options, note: it.note, sets };
  });
  function runEngine(pid, idx, light) {
    const b = buildWorkout(S as any, pid, idx, { light: !!light }); if (!b || !b.items.length) return null;
    const sub = [b.w.focus, b.deload ? 'разгрузочная неделя' : ''].filter(Boolean).join(' · ');
    return makeRun({ title: `${b.prog.name} · ${b.w.name}`, sub, source: 'engine', ref: { prog: pid, idx: b.idx, w: b.w.id, deload: b.deload }, items: engineItems(b.items), warmup: true, light, prelight: true });
  }
  function runGroup(g, light) {
    const b = buildGroupWorkout(S as any, g, { light: !!light }), G = GROUPM[g]; if (!b.items.length) return null;
    return makeRun({ title: `${G.en} · ${G.name}`, sub: b.deload ? 'Тренировка группы · разгрузочная неделя' : 'Тренировка группы мышц', source: 'group', ref: { group: g, deload: b.deload }, items: engineItems(b.items), warmup: g !== 'mobility', light, prelight: true });
  }
  const runFree = () => makeRun({ title: 'Свободная тренировка', sub: 'Добавляйте упражнения по ходу', source: 'free', items: [], warmup: true });
  function runFromPlan(p, light) {
    if (!p) return null;
    if (p.kind === 'program' && PROGM[p.prog]) return runProgram(p.prog, p.idx || 0, light);
    if (p.kind === 'custom') { const c = S.custom.find(x => x.id === p.cid); return c ? runCustom(c, light) : null; }
    if (p.kind === 'mu') return runMu(p.stage || 1, light);
    if (p.kind === 'engine' && PROGM_V2[p.prog]) return runEngine(p.prog, p.idx || 0, light);
    return null;
  }
  function applyProgression(run, rir) {
    if (run.source !== 'program' || !run.ref) return [];
    const P = PROGM[run.ref.prog]; if (!P) return [];
    const pr = S.progress[P.id] || (S.progress[P.id] = { next: 0, adj: {} }); pr.adj = pr.adj || {};
    pr.next = (run.ref.idx + 1) % P.workouts.length;
    const def = P.workouts[run.ref.idx], changes = [];
    run.items.forEach(it => {
      if (it.extra || it.idx == null) return;
      const src = def.items[it.idx]; if (!src || Array.isArray(src.reps)) return;
      const e = exOf(it.ex), key = `${run.ref.w}:${it.idx}`;
      const all = it.sets.length && it.sets.every(s => s.done && (e.type === 'time' ? (s.time || 0) >= s.tt : (s.reps || 0) >= s.t));
      let d = 0;
      if (run.pain) d = -1; else if (all && rir >= 1 && !run.light) d = 1;
      if (d) { pr.adj[key] = clamp((pr.adj[key] || 0) + d, -3, 12); changes.push({ ex: it.ex, d, time: e.type === 'time' }); }
    });
    return changes;
  }
  function resetPctAdj() {
    for (const P of PROGRAMS) { const pr = S.progress[P.id]; if (!pr || !pr.adj) continue; P.workouts.forEach(w => w.items.forEach((it, i) => { if (typeof it.reps === 'string') delete pr.adj[`${w.id}:${i}`]; })); }
  }
  /* ---------- daily ---------- */
  const dayPull = k => ((derive().byDay[k] || {}).pull) || 0;
  function dailyTasks(k = todayKey()) {
    const d = S.daily[k] || {}, rec = !!d.recovery, goal = +S.profile.goalDaily || 0;
    const list = rec ? DAILY_REC.map(x => ({ ...x })) : [...(goal ? [{ id: 'goal', t: `${goal} ${plural(goal, W.pull)} за день`, auto: true }] : []), ...DAILY_BASE.map(x => ({ ...x })), { id: 'x', t: DAILY_EXTRA[hashStr(k) % DAILY_EXTRA.length] }];
    list.forEach((x: any) => { x.done = x.auto ? dayPull(k) >= goal : !!(d.tasks || {})[x.id]; });
    return { rec, list, done: list.filter((x: any) => x.done).length };
  }
  /* ---------- MU ---------- */
  function muState() {
    const st = MU_STAGES.map(s => {
      const crit = s.crit.map(c => { const auto = !!c.metric, cur = auto ? metric(c.metric) : 0; return { ...c, auto, cur, met: auto ? cur >= c.target : !!S.mu.checks[c.id] }; });
      return { ...s, crit, done: !!S.mu.done[s.n], met: crit.filter(c => c.met).length, ready: crit.every(c => c.met) };
    });
    const cur = st.find(s => !s.done) || null, dn = st.filter(s => s.done).length;
    return { st, cur, done: dn, pct: (dn + (cur ? cur.met / cur.crit.length * .9 : 0)) / st.length };
  }
  /* ---------- records list ---------- */
  function records() {
    const D = derive(), R = D.rec;
    return [
      { k: 'max', l: 'Максимум подтягиваний', v: R.maxPull ? `${R.maxPull}` : '—', u: R.maxPull ? plural(R.maxPull, W.rep) : '', d: R.maxPullDate, i: 'trophy' },
      { k: 'kg', l: 'С отягощением', v: R.maxKg ? `+${fmtNum(R.maxKg)} кг` : '—', u: R.maxKg ? `× ${R.maxKgReps}` : '', d: R.maxKgDate, i: 'weight' },
      { k: 'hang', l: 'Самый долгий вис', v: R.maxHang ? fmtSec(R.maxHang) : '—', u: '', d: R.maxHangDate, i: 'grip' },
      { k: 'day', l: 'Подтягиваний за день', v: R.maxDayPull ? `${R.maxDayPull}` : '—', u: '', d: R.maxDayDate, i: 'sun' },
      { k: 'sess', l: 'За тренировку', v: R.maxSessPull ? `${R.maxSessPull}` : '—', u: '', d: R.maxSessDate, i: 'flame' },
      { k: 'week', l: 'За неделю', v: R.maxWeekPull ? `${R.maxWeekPull}` : '—', u: '', d: R.maxWeekKey, i: 'chart' },
      { k: 'mu', l: 'Выходов в подходе', v: R.maxMuSet ? `${R.maxMuSet}` : '—', u: '', d: R.maxMuDate, i: 'bolt' },
      { k: 'dips', l: 'Отжимания на брусьях', v: R.dips ? `${R.dips}` : '—', u: '', d: (D.best._d || {})['dips.reps'] || null, i: 'prog' }
    ];
  }
  return { derive, sessStats, metric, metricUnit, checkAch, readiness, nextWorkout, curMax, resolveReps, planItems, doseText, makeRun, targetOf, runProgram, runCustom, runMu, runSingle, runFree, runEngine, runGroup, engineItems, runFromPlan, applyProgression, resetPctAdj, dailyTasks, dayPull, muState, records, sortSess };
})();
