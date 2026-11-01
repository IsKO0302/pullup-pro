import { FIG } from '../../components/figure';
import { MODALS, confirmBox, openModal } from '../../components/modal';
import { toast } from '../../components/toast';
import { muscleMap } from '../../components/musclemap';
import { pickExercise, setSeg, xpOfSession } from '../../components/view';
import { AUD, buzz } from '../../core/audio';
import { $ } from '../../core/dom';
import { ico } from '../../core/icons';
import { go, render } from '../../core/router';
import { S, runStore, save } from '../../core/state';
import { markPlanDone } from '../journal/journal';
import { showResume } from './resume';
import { LG } from '../../services/logic';
import { EXM, TIER_NAME, exOf, tierOf } from '@pullup/shared/catalog/exercises';
import { PROGM_V2 } from '@pullup/shared/catalog/programs2';
import { ctxOf, doseLabel, doseOf, evaluateSession, materialize } from '@pullup/shared/engine';
import { WARMUP } from '@pullup/shared/catalog/programs';
import { dayKey, fmtClock, fmtSec } from '@pullup/shared/dates';
import { W, clamp, esc, fmtNum, pl, plural, round1, uid } from '@pullup/shared/util';

/* ================= Training overlay: warm-up, sets, rest timer, holds, summary ================= */
export const TR = (() => {
  let run = null, iv: any = 0, wake = null, lastBeep = -1, lastSave = 0;
  const root = () => $('#train-root');
  const now = () => Date.now();
  const item = () => run.items[run.cur];
  const pend = it => it ? it.sets.findIndex(s => s.done === undefined) : -1;
  const fin = it => it.sets.every(s => s.done !== undefined);
  const allFin = () => run.items.length > 0 && run.items.every(fin);
  const act = () => run.activeMs + (run.paused ? 0 : now() - run.tickAt);
  const persist = () => { if (run) { run.savedAt = now(); runStore.set(run); lastSave = now(); } };
  /** warm-up of the run: v2 runs carry a list built from the workout groups, v1 runs use the classic list */
  const warmL = () => run.warmList && run.warmList.length ? run.warmList : WARMUP.map((w, i) => ({ id: String(i), t: w.t, d: w.d, anim: i < 2 ? 'armcircle' : 'scap' }));
  const warmN = () => warmL().filter((_, i) => run.warmChecks[i]).length;
  let fsOwn = false;
  const fsOn = () => !!document.fullscreenElement;
  function fsToggle(on = !fsOn()) {
    try {
      if (on && !fsOn() && document.documentElement.requestFullscreen) { const p = document.documentElement.requestFullscreen({ navigationUI: 'hide' } as any); fsOwn = true; if (p && p.catch) p.catch(() => { fsOwn = false; }); }
      else if (!on && fsOn() && document.exitFullscreen) { document.exitFullscreen().catch(() => { }); fsOwn = false; }
    } catch (e) { fsOwn = false; }
  }
  document.addEventListener('fullscreenchange', () => { if (run) { const b = $('[data-tr="fs"]'); if (b) b.innerHTML = ico(fsOn() ? 'collapse' : 'expand'); } });
  const emit = (active: boolean) => { try { window.dispatchEvent(new CustomEvent('pullup:train', { detail: { active } })); } catch (e) { } };
  const tgt = (e, s) => e.type === 'time' ? `${s.tt} с` : `${s.t} ${plural(s.t, W.rep)}`;
  function nextUnfinished(from) { const n = run.items.length; for (let k = 1; k <= n; k++) { const i = (from + k) % n; if (!fin(run.items[i])) return i; } return -1; }
  function prep() {
    const it = item(); if (!it) return; const j = pend(it); if (j < 0) return;
    const s = it.sets[j], e = exOf(it.ex);
    if (e.type !== 'time') run.cnt = s.t || 1;
    run.wt = it.w || 0;
  }
  function stats() {
    const o = { pull: 0, reps: 0, hold: 0, done: 0, total: 0, mu: 0 };
    for (const it of run.items) { const e = exOf(it.ex); for (const s of it.sets) { o.total++; if (s.done !== true) continue; o.done++; if (e.type === 'time') o.hold += s.time || 0; else { o.reps += s.reps || 0; if (e.count === 'pull') o.pull += s.reps || 0; if (e.count === 'mu') o.mu += s.reps || 0; } } }
    return o;
  }
  function sessItems(onlyDone) {
    return run.items.map(it => { const e = exOf(it.ex); return { ex: it.ex, target: it.target || LG.targetOf(it), sets: it.sets.filter(s => onlyDone ? s.done === true : s.done !== undefined).map(s => e.type === 'time' ? { time: Math.round(s.time || 0), done: s.done } : { reps: s.reps || 0, weight: s.weight || 0, done: s.done }) }; }).filter(it => it.sets.length);
  }
  /* ---------- open / close ---------- */
  function start(r) {
    if (run) { toast('Тренировка уже идёт', 'err'); return; }
    run = r; run.mode = run.phase === 'warmup' ? 'warm' : 'set'; run.tickAt = now();
    if (run.mode === 'set') prep();
    if (S.settings && S.settings.fullscreen) fsToggle(true);
    open(); persist(); AUD.ensure();
  }
  function resume() {
    const r = runStore.get(); if (!r) return;
    run = r; if (!run.paused) { run.activeMs += Math.max(0, (run.savedAt || run.tickAt) - run.tickAt); if (run.mode === 'rest') run.restLeft = Math.max(0, run.restEnd - (run.savedAt || now())); if (run.mode === 'hold') run.mode = 'set'; }
    run.paused = true; run.tickAt = now();
    open();
  }
  function open() {
    const el = root(); el.hidden = false; document.body.classList.add('noscroll');
    const rb = $('#resume-root'); if (rb) rb.innerHTML = '';
    draw(); clearInterval(iv); iv = setInterval(tick, 250); lockWake(); emit(true);
  }
  function close() {
    clearInterval(iv); const el = root(); el.hidden = true; el.innerHTML = ''; run = null;
    if (!MODALS.length) document.body.classList.remove('noscroll');
    try { if (wake) wake.release().catch(() => { }); } catch (e) { } wake = null;
    if (fsOwn) fsToggle(false); emit(false);
    if (typeof showResume === 'function') showResume();
  }
  async function lockWake() { if (S.settings && S.settings.wakeLock === false) return; try { if (run && 'wakeLock' in navigator && !wake && document.visibilityState === 'visible') { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { wake = null; } }
  document.addEventListener('visibilitychange', () => { if (run && document.visibilityState === 'visible') lockWake(); if (run && document.visibilityState === 'hidden') persist(); });
  window.addEventListener('beforeunload', () => persist());

  /* ---------- rendering ---------- */
  function draw() {
    const el = root(); if (!run) return;
    if (run.mode === 'sum') { el.innerHTML = top() + `<div class="tr-body tr-sumb">${summary()}</div>`; FIG.mountAll(el); return; }
    el.innerHTML = top() + `<div class="tr-body"><aside class="tr-list">${list()}</aside><section class="tr-main">${main()}</section><aside class="tr-side">${side()}</aside></div>` +
      (run.paused ? `<div class="tr-paused"><h2>Пауза</h2><p class="muted">Таймер тренировки остановлен. Отдохните, выпейте воды.</p><button class="btn btn-acc btn-xl" data-tr="pause">${ico('play')}Продолжить</button><button class="btn btn-ghost" data-tr="finish">Завершить тренировку</button></div>` : '');
    FIG.mountAll(el); tick(true);
  }
  function top() {
    const sub = run.mode === 'warm' ? 'Разминка' : run.mode === 'sum' ? 'Итоги' : run.sub, o = stats(), pct = o.total ? Math.round(o.done / o.total * 100) : 0;
    const fs = document.fullscreenEnabled && run.mode !== 'sum' ? `<button class="btn btn-ghost btn-icon tr-fs" data-tr="fs" aria-label="Полноэкранный режим" title="Полноэкранный режим (F)">${ico(fsOn() ? 'collapse' : 'expand')}</button>` : '';
    return `<div class="tr-progress" role="progressbar" aria-label="Прогресс тренировки" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div><div class="tr-top">
      ${run.mode === 'sum' ? '' : `<button class="btn btn-ghost btn-icon" data-tr="pause" aria-label="${run.paused ? 'Продолжить' : 'Пауза'}" title="Пауза (P)">${ico(run.paused ? 'play' : 'pause')}</button>`}
      <div class="tr-title"><b>${esc(run.title).split(' · ').map(x => `<span class="tt">${x}</span>`).join('<i class="dsep">·</i>')}</b><span>${esc(sub)}${run.light ? ' · лёгкая версия' : ''}</span></div>
      <div class="tr-clock" id="tr-clock" aria-label="Время тренировки">${fmtClock(act() / 1000)}</div>${fs}
      ${run.mode === 'sum' ? '' : `<button class="btn btn-sm btn-danger" data-tr="pain" title="Отметить боль">${ico('warn')}<span class="tr-hide-m">Боль</span></button><button class="btn btn-sm" data-tr="finish">${ico('check')}<span class="tr-hide-m">Завершить</span></button>`}
    </div>`;
  }
  function list() {
    return `<div class="sec-t">Упражнения · ${run.items.length}</div>` + run.items.map((it, i) => {
      const e = exOf(it.ex), d = it.sets.filter(s => s.done === true).length, f = fin(it);
      return `<button class="tr-li ${i === run.cur && run.mode !== 'warm' ? 'cur' : ''} ${f ? 'fin' : ''}" data-tr="goto" data-i="${i}"><span class="tn">${f ? ico('check') : i + 1}</span><span class="grow"><span class="tl-n" style="display:block">${e.name}</span><span class="tl-s">${d}/${it.sets.length} · ${LG.doseText(it)}</span></span></button>`;
    }).join('') + `<button class="btn btn-sm btn-ghost btn-block mt" data-tr="addEx">${ico('plus')}Добавить упражнение</button>`;
  }
  function chips(it) {
    const e = exOf(it.ex), j = pend(it);
    return `<div class="set-chips" aria-label="Подходы">${it.sets.map((s, k) => s.done === true ? `<span class="sc done" title="Подход ${k + 1}">${e.type === 'time' ? (s.time || 0) + 'с' : s.reps}</span>` : s.done === false ? `<span class="sc miss" title="Пропущен">—</span>` : `<span class="sc ${k === j ? 'cur' : ''}">${e.type === 'time' ? s.tt + 'с' : s.t}</span>`).join('')}</div>`;
  }
  function main() {
    if (run.mode === 'warm') {
      const L = warmL(), n = warmN(), curI = Math.max(0, L.findIndex((_, i) => !run.warmChecks[i])), cw = L[curI] || L[0];
      return `<div class="eyebrow">Шаг 1 · разминка</div><div class="tr-exname">Разминка 7–10 минут</div><div class="tr-target">Подготовка под эту тренировку: суставы, лопатки и мышцы, которые будут работать</div>
        <div class="tr-figwrap${FIG.isLand(cw.anim) ? ' land' : ''}">${FIG.tag(cw.anim, 'data-land="1"')}</div>
        <div class="small muted" style="text-align:center;margin-top:-6px">Сейчас: <b>${esc(cw.t)}</b> — ${esc(cw.d)}</div>
        <div class="warm-list card tight">${L.map((w, i) => `<label class="check"><input type="checkbox" data-trw="${i}" ${run.warmChecks[i] ? 'checked' : ''}><span class="box">${ico('check')}</span><span class="ct">${esc(w.t)}<span class="cs">${esc(w.d)}</span></span></label>`).join('')}</div>
        <div class="tr-actions"><button class="btn btn-acc btn-xl" data-tr="toWork">${ico('play')}К основной части <span id="warm-n" class="small" style="opacity:.8">${n}/${L.length}</span></button></div>
        <button class="btn btn-sm btn-ghost" data-tr="skipWarm">Пропустить разминку</button>`;
    }
    if (!run.items.length) return `<div class="tr-exname">Свободная тренировка</div><div class="tr-target">Добавьте первое упражнение — подходы, таймер отдыха и журнал подключатся автоматически</div>
      <div class="tr-figwrap">${FIG.tag('hero', 'data-label="0"')}</div><div class="tr-actions"><button class="btn btn-acc btn-xl" data-tr="addEx">${ico('plus')}Добавить упражнение</button></div>`;
    if (run.mode === 'done') return `<div class="eyebrow">Финиш</div><div class="tr-exname">Все подходы выполнены</div><div class="tr-target">Отличная работа! Завершите тренировку, чтобы сохранить её в журнал.</div>
      <div class="tr-figwrap">${FIG.tag('hero', 'data-label="0"')}</div>
      <div class="tr-actions"><button class="btn btn-acc btn-xl" data-tr="finish">${ico('check')}Завершить и сохранить</button></div>
      <div class="btns" style="justify-content:center"><button class="btn btn-sm btn-ghost" data-tr="addEx">${ico('plus')}Добавить упражнение</button><button class="btn btn-sm btn-ghost" data-tr="addSet">${ico('plus')}Ещё подход</button></div>`;
    const it = item(), e = exOf(it.ex), j = pend(it), s = it.sets[j], n = run.items.length;
    const nav = `<div class="row" style="gap:6px"><button class="btn btn-ghost btn-icon btn-sm" data-tr="prevEx" ${run.cur > 0 ? '' : 'disabled'} aria-label="Предыдущее упражнение">${ico('left')}</button><span class="small muted">Упражнение ${run.cur + 1} из ${n}</span><button class="btn btn-ghost btn-icon btn-sm" data-tr="nextEx" ${run.cur < n - 1 ? '' : 'disabled'} aria-label="Следующее упражнение">${ico('right')}</button></div>`;
    if (run.mode === 'rest') {
      const ni = item(), nj = pend(ni), ne = exOf(ni.ex);
      return `<div class="rest-view">
        <div class="rest-ring" id="rr"><svg viewBox="0 0 200 200" aria-hidden="true"><circle class="rr-bg" cx="100" cy="100" r="88" fill="none" stroke-width="12"/><circle class="rr-fg" id="rr-fg" cx="100" cy="100" r="88" fill="none" stroke-width="12" stroke-dasharray="552.92" stroke-dashoffset="0"/></svg>
          <div class="rr-c"><div class="rr-v" id="rr-v" aria-live="off">${fmtClock(run.restTotal)}</div><div class="rr-l">Отдых</div></div></div>
        <div class="btns" style="justify-content:center"><button class="btn" data-tr="rest-15" aria-label="Минус 15 секунд">−15 с</button><button class="btn btn-acc" data-tr="restSkip">${ico('skip')}Пропустить</button><button class="btn" data-tr="rest+15" aria-label="Плюс 15 секунд">+15 с</button></div>
        ${nj >= 0 ? `<div class="rest-next"><div class="tiny muted" style="letter-spacing:.14em;font-weight:800">ДАЛЕЕ</div><b>${ne.name}</b><div class="small muted">Подход ${nj + 1} из ${ni.sets.length} · цель ${tgt(ne, ni.sets[nj])}${ni.w && ne.w ? ` · +${fmtNum(ni.w)} кг` : ''}</div></div>` : ''}
        <div class="small muted" style="text-align:center">Дышите ровно, встряхните руки. Сигнал прозвучит за 3 секунды до конца.</div></div>`;
    }
    if (j < 0) return nav + `<div class="tr-exname">${e.name}</div><div class="tr-target">Все подходы этого упражнения выполнены</div>${chips(it)}<div class="btns" style="justify-content:center"><button class="btn" data-tr="addSet">${ico('plus')}Ещё подход</button><button class="btn btn-acc" data-tr="nextEx">Следующее ${ico('right')}</button></div>`;
    let body = '';
    if (e.type === 'time') {
      const hold = run.mode === 'hold';
      body = `<div style="text-align:center"><div class="hold-v" id="hold">${hold ? '3' : '00:00'}</div><div class="cnt-l" id="hold-l">${hold ? 'Приготовьтесь' : `цель ${s.tt} с`}</div></div>
        <div class="bar" style="width:min(420px,100%)"><i id="hold-bar" style="width:0%"></i></div>
        <div class="tr-actions">${hold ? `<button class="btn btn-acc btn-xl" data-tr="holdStop">${ico('check')}Стоп — записать</button>` : `<button class="btn btn-acc btn-xl" data-tr="holdStart">${ico('play')}Старт удержания</button>`}</div>
        <div class="btns" style="justify-content:center">${hold ? `<button class="btn btn-sm btn-ghost" data-tr="holdCancel">Отменить попытку</button>` : `<button class="btn btn-sm btn-ghost" data-tr="skipSet">${ico('skip')}Пропустить подход</button><button class="btn btn-sm btn-ghost" data-tr="addSet">${ico('plus')}Добавить подход</button>`}</div>`;
    } else {
      body = `<div class="counter"><button class="cnt-btn" data-tr="dn" aria-label="Меньше повторов">${ico('minus')}</button><div><div class="cnt-v" id="cnt" aria-live="polite">${run.cnt}</div><div class="cnt-l" id="cnt-l">${plural(run.cnt, W.rep)}</div></div><button class="cnt-btn" data-tr="up" aria-label="Больше повторов">${ico('plus')}</button></div>
        ${e.w ? `<div class="wctl"><span class="small muted">Доп. вес</span><button class="btn btn-sm btn-icon" data-tr="wdn" aria-label="Уменьшить вес">${ico('minus')}</button><b id="wt" class="num" style="min-width:64px;text-align:center">${fmtNum(run.wt)} кг</b><button class="btn btn-sm btn-icon" data-tr="wup" aria-label="Увеличить вес">${ico('plus')}</button></div>` : ''}
        <div class="tr-actions"><button class="btn btn-acc btn-xl" data-tr="done">${ico('check')}Подход выполнен</button></div>
        <div class="btns" style="justify-content:center"><button class="btn btn-sm btn-ghost" data-tr="skipSet">${ico('skip')}Пропустить подход</button><button class="btn btn-sm btn-ghost" data-tr="addSet">${ico('plus')}Добавить подход</button>${S.profile.autoRest ? '' : `<button class="btn btn-sm btn-ghost" data-tr="restStart">${ico('timer')}Отдых ${fmtSec(it.rest)}</button>`}</div>`;
    }
    const swap = it.options && it.options.filter(x => x !== it.ex && EXM[x]).length ? `<button class="btn btn-sm btn-ghost" data-tr="swap">${ico('swap')}Заменить</button>` : '';
    return nav + `<div class="tr-exname">${e.name}</div>
      <div class="tr-target">Подход <b>${j + 1}</b> из ${it.sets.length} · цель: <b>${tgt(e, s)}</b>${e.w && it.w ? ` · +${fmtNum(it.w)} кг` : ''}</div>
      ${it.note || swap ? `<div class="row wrap" style="justify-content:center;gap:8px">${it.note ? `<span class="badge">${esc(it.note)}</span>` : ''}${swap}</div>` : ''}
      <div class="tr-figwrap${FIG.isLand(e.anim) ? ' land' : ''}">${FIG.tag(e.anim, 'data-land="1"')}</div>${chips(it)}${body}`;
  }
  function side() {
    const o = stats(), it = item(), e = it ? exOf(it.ex) : null;
    return `<div class="tr-kpis"><div class="tr-kpi"><b>${o.pull}</b><span>Подтягивания</span></div><div class="tr-kpi"><b>${o.done}/${o.total}</b><span>Подходы</span></div><div class="tr-kpi"><b>${o.reps}</b><span>Повторы</span></div><div class="tr-kpi"><b>${fmtSec(o.hold)}</b><span>Удержания</span></div></div>
      ${run.light ? `<div class="note n-acc small">${ico('info')}<div>Лёгкая версия: меньше подходов и повторов. Прогрессия не повышается.</div></div>` : ''}
      ${cycle()}
      ${e && run.mode !== 'warm' && (e.primary || []).length ? `<div class="card tight"><div class="sec-t">Работают мышцы</div>${muscleMap(e.primary, e.secondary, { cls: 'sm', legend: true })}</div>` : ''}
      ${e && run.mode !== 'warm' ? `<div class="card tight"><div class="sec-t">Техника · ${e.name}</div><ol class="ol small">${e.steps.slice(0, 4).map(x => `<li>${x}</li>`).join('')}</ol><a class="link-btn small" href="#/library/${e.id}" data-tr="lib">Подробнее в библиотеке</a></div>
      <div class="card tight"><div class="sec-t">Частые ошибки</div><ul class="ul small tx2">${e.mistakes.slice(0, 3).map(x => `<li>${x}</li>`).join('')}</ul></div>` : `<div class="card tight"><div class="sec-t">Зачем разминка</div><p class="small tx2" style="margin:0">Тёплые мышцы и связки лучше переносят нагрузку. Не пропускайте разминку перед взрывными подходами и выходом силой.</p></div>`}
      <div class="note n-warn small">${ico('shield')}<div>${e && e.safety ? e.safety : 'Почувствовали боль в суставе — остановитесь и нажмите «Боль». Не тренируйтесь через боль.'}</div></div>
      <div class="tr-hide-m small muted"><div class="sec-t">Клавиши</div><span class="kbd">+</span> <span class="kbd">−</span> повторы · <span class="kbd">Enter</span> подход / старт · <span class="kbd">P</span> пауза</div>`;
  }
  /** progress through the whole program cycle (engine / v1 programs) */
  function cycle() {
    if (!run.ref || (run.source !== 'engine' && run.source !== 'program')) return '';
    const P: any = run.source === 'engine' ? PROGM_V2[run.ref.prog] : null; if (run.source === 'engine' && !P) return '';
    const ws = P ? P.workouts : [], idx = run.ref.idx || 0;
    if (!ws.length) return '';
    return `<div class="card tight"><div class="sec-t">Программа · ${esc(P.name)}</div><div class="cyc">${ws.map((w, i) => `<span class="${i < idx ? 'done' : i === idx ? 'cur' : ''}" title="${esc(w.name)}">${esc(w.id)}</span>`).join('')}</div>
      <div class="tiny muted mt-s">Тренировка ${idx + 1} из ${ws.length} в цикле · ${esc(P.freq)}</div></div>`;
  }
  /* ---------- summary ---------- */
  function prs() {
    const D = LG.derive(), R = D.rec, st: any = LG.sessStats({ items: sessItems(true), source: run.source }), out = [];
    if (st.strict > R.maxPull) out.push(`Новый максимум: ${pl(st.strict, W.rep)} подряд`);
    if (st.pull > R.maxSessPull && R.maxSessPull > 0) out.push(`Больше всего подтягиваний за тренировку: ${st.pull}`);
    const day = LG.dayPull(dayKey(new Date(run.startedAt))) + st.pull; if (st.pull && day > R.maxDayPull && R.maxDayPull > 0) out.push(`Рекорд дня: ${pl(day, W.pull)}`);
    const hb = (st.best.hang || {}).time || 0; if (hb > R.maxHang) out.push(`Самый долгий вис: ${fmtSec(hb)}`);
    let kg = 0; for (const [ex, b] of Object.entries<any>(st.best)) if (exOf(ex).count === 'pull' && b.kg > kg) kg = b.kg; if (kg > R.maxKg) out.push(`Новый рабочий вес: +${fmtNum(kg)} кг`);
    if (st.mu && !D.tot.mu) out.push('Первый выход силой! Поздравляем!'); else if (((st.best.muscleup || {}).reps || 0) > R.maxMuSet && R.maxMuSet > 0) out.push(`Выходов в подходе: ${st.best.muscleup.reps}`);
    for (const [ex, b] of Object.entries<any>(st.best)) { const pb = D.best[ex]; if (!pb || out.length > 5) continue; if (b.reps > (pb.reps || 0) && ex !== 'pullup') out.push(`${exOf(ex).name}: ${pl(b.reps, W.rep)}`); if (b.time > (pb.time || 0) && ex !== 'hang') out.push(`${exOf(ex).name}: ${fmtSec(b.time)}`); }
    return out;
  }
  function summary() {
    const o = stats(), f = run.form || (run.form = { feel: run.check && run.check.feel ? run.check.feel : 0, rir: 1, rpe: 0, tech: 0, pain: !!run.pain, painNote: '', notes: '' });
    const xp = xpOfSession({ items: sessItems(true), source: run.source, completed: allFin() }), P = prs(), FEEL = ['Плохо', 'Так себе', 'Норм', 'Хорошо', 'Отлично'];
    return `<div class="tr-sum">
      <div style="text-align:center"><div class="eyebrow" style="justify-content:center">${allFin() ? 'Тренировка выполнена' : 'Тренировка завершена'}</div><h2 class="disp" style="font-size:clamp(28px,4vw,44px)">${run.pain ? 'Берегите себя' : allFin() ? 'Отличная работа' : o.done >= o.total / 2 ? 'Хорошая работа' : o.done ? 'Каждый подход в зачёт' : 'Тренировка прервана'}</h2>
        <p class="muted">${run.pain ? 'Вы отметили боль: нагрузка в программе будет снижена. Отдохните; если боль не проходит — обратитесь к врачу.' : 'Сохраните тренировку — журнал, рекорды и прогрессия обновятся автоматически.'}</p></div>
      <div class="sum-grid mt"><div class="tr-kpi"><b>${fmtClock(act() / 1000)}</b><span>Время</span></div><div class="tr-kpi"><b>${o.pull}</b><span>Подтягивания</span></div><div class="tr-kpi"><b>${o.done}/${o.total}</b><span>Подходы</span></div><div class="tr-kpi"><b>${o.reps}</b><span>Повторы</span></div><div class="tr-kpi"><b>${fmtSec(o.hold)}</b><span>Удержания</span></div><div class="tr-kpi"><b class="acc">+${xp}</b><span>XP</span></div></div>
      ${P.length ? `<div class="stack s mt">${P.map(x => `<div class="pr-line">${ico('trophy')}${x}</div>`).join('')}</div>` : ''}
      <div class="card mt stack l">
        <div><div class="lbl mb">Как вы себя чувствуете после тренировки?</div><div class="rate">${FEEL.map((x, i) => `<button type="button" data-trf="feel" data-v="${i + 1}" class="${f.feel === i + 1 ? 'on' : ''}">${i + 1}<small>${x}</small></button>`).join('')}</div></div>
        <div><div class="lbl mb">Насколько тяжело было? <span class="muted">RPE 1–10</span></div><div class="rate rate10">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => `<button type="button" data-trf="rpe" data-v="${v}" class="${f.rpe === v ? 'on' : ''}" aria-label="RPE ${v}">${v}</button>`).join('')}</div>
          <div class="tiny muted mt-s">1–4 — легко, 5–7 — рабочая нагрузка, 8 — тяжело, 9–10 — на пределе</div></div>
        <div><div class="lbl mb">Сколько повторов оставалось в запасе в последних подходах?</div><div class="seg">${[[0, '0 — до отказа'], [1, '1–2'], [3, '3 и больше']].map(([v, l]) => `<button type="button" data-trf="rir" data-v="${v}" class="${f.rir === v ? 'on' : ''}">${l}</button>`).join('')}</div>
          <div class="tiny muted mt-s">${run.source === 'engine' || run.source === 'group' ? 'Прогрессия предлагается после 2 стабильных тренировок: все подходы выполнены, запас 1+ повтор, RPE ≤ 8, техника без срывов.' : run.source === 'program' ? 'Если все подходы выполнены и запас 1+ повтор — в следующий раз программа добавит нагрузку.' : 'Оценка сохранится в журнале и поможет анализировать нагрузку.'}</div></div>
        <div><div class="lbl mb">Техника</div><div class="seg">${[[3, 'Чистая'], [2, 'Были неточности'], [1, 'Срывалась']].map(([v, l]) => `<button type="button" data-trf="tech" data-v="${v}" class="${f.tech === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <label class="check"><input type="checkbox" data-trf="pain" ${f.pain ? 'checked' : ''}><span class="box">${ico('check')}</span><span class="ct">Была боль в суставах или мышцах<span class="cs">Нагрузка будет снижена, а приложение порекомендует отдых</span></span></label>
        <label class="field" id="pain-note" ${f.pain ? '' : 'hidden'}><span>Где и какая боль?</span><input class="inp" data-trf="painNote" maxlength="200" value="${esc(f.painNote || '')}" placeholder="Например: правый локоть, на тягах"></label>
        <label class="field"><span>Заметка</span><textarea class="inp" data-trf="notes" maxlength="500" placeholder="Что получилось, что улучшить">${esc(f.notes)}</textarea></label>
      </div>
      <div class="btns mt" style="justify-content:center"><button class="btn btn-acc btn-lg" data-tr="save">${ico('check')}Сохранить тренировку</button>${run.forced ? '' : `<button class="btn btn-lg" data-tr="back">${ico('left')}Вернуться</button>`}<button class="btn btn-ghost" data-tr="discard">Не сохранять</button></div>
    </div>`;
  }
  /* ---------- timers ---------- */
  function tick(force) {
    if (!run) return;
    const c = $('#tr-clock'); if (c) c.textContent = fmtClock(act() / 1000);
    if (run.paused || run.mode === 'sum') return;
    if (run.mode === 'rest') {
      const left = Math.max(0, (run.restEnd - now()) / 1000), sec = Math.ceil(left), fg = $('#rr-fg'), v = $('#rr-v');
      if (fg) fg.style.strokeDashoffset = 552.92 * (1 - left / Math.max(1, run.restTotal));
      if (v) v.textContent = fmtClock(sec);
      const rr = $('#rr'); if (rr) rr.classList.toggle('urgent', sec <= 3);
      if (sec <= 3 && sec >= 1 && lastBeep !== sec && !force) { lastBeep = sec; AUD.tick(); buzz(40); }
      if (left <= 0) { lastBeep = -1; AUD.go(); buzz([220, 90, 220]); run.mode = 'set'; prep(); persist(); draw(); return; }
    }
    if (run.mode === 'hold') {
      const it = item(), s = it && it.sets[pend(it)], el = (now() - run.holdStart) / 1000, h = $('#hold'), l = $('#hold-l'), b = $('#hold-bar');
      if (!s) { run.mode = 'set'; return draw(); }
      if (el < 0) { const n = Math.ceil(-el); if (h) h.textContent = n; if (lastBeep !== n && !force) { lastBeep = n; AUD.tick(); } }
      else {
        if (!run.holdGo) { run.holdGo = true; lastBeep = -1; AUD.go(); buzz(80); }
        if (h) { h.textContent = fmtClock(el); h.classList.toggle('reached', el >= s.tt); }
        if (l) l.textContent = el >= s.tt ? 'Цель достигнута — можно остановиться' : `цель ${s.tt} с · осталось ${Math.ceil(s.tt - el)} с`;
        if (b) b.style.width = Math.min(100, el / s.tt * 100) + '%';
        if (el >= s.tt && !run.holdReached) { run.holdReached = true; AUD.done(); buzz([100, 60, 100]); }
      }
    }
    if (now() - lastSave > 5000) persist();
  }
  /* ---------- actions ---------- */
  function afterSet(it, noRest?) {
    let nx = run.cur;
    if (pend(it) < 0) { nx = nextUnfinished(run.cur); if (nx < 0) { run.mode = 'done'; AUD.done(); buzz([80, 60, 80, 60, 160]); persist(); draw(); return; } }
    const rest = it.rest || 0; run.cur = nx;
    if (!noRest && S.profile.autoRest && rest > 0) startRest(rest); else run.mode = 'set';
    prep(); persist(); draw();
  }
  function startRest(sec) { run.mode = 'rest'; run.restTotal = sec; run.restEnd = now() + sec * 1000; lastBeep = -1; }
  function bump(id) { const v = $(id); if (!v) return; v.classList.remove('bump'); void v.offsetWidth; v.classList.add('bump'); }
  function setCnt(d) { if (run.mode !== 'set') return; const it = item(); if (!it || exOf(it.ex).type === 'time' || pend(it) < 0) return; run.cnt = clamp((run.cnt || 0) + d, 0, 200); const v = $('#cnt'), l = $('#cnt-l'); if (v) v.textContent = run.cnt; if (l) l.textContent = plural(run.cnt, W.rep); bump('#cnt'); AUD.tap(); }
  function setPause(p) {
    if (!run || run.mode === 'sum') return;
    if (p === run.paused) return;
    if (p) { run.activeMs += now() - run.tickAt; run.paused = true; if (run.mode === 'rest') run.restLeft = Math.max(0, run.restEnd - now()); if (run.mode === 'hold') run.mode = 'set'; }
    else { run.paused = false; run.tickAt = now(); if (run.mode === 'rest') run.restEnd = now() + (run.restLeft || 0); }
    persist(); draw();
  }
  function toWork(warmDone, cur = 0) {
    run.warmup = warmDone; run.phase = 'work'; run.mode = 'set'; run.cur = clamp(cur, 0, Math.max(0, run.items.length - 1)); prep(); persist(); draw();
  }
  function goSummary(forced?) { run.prevMode = run.mode === 'sum' ? run.prevMode : run.mode; if (run.mode === 'hold') run.prevMode = 'set'; if (forced) run.forced = true; if (!run.paused) { run.activeMs += now() - run.tickAt; run.tickAt = now(); } run.paused = true; run.mode = 'sum'; persist(); draw(); }
  async function finish() {
    const o = stats();
    if (!o.done) { if (await confirmBox('Выйти из тренировки?', 'Не выполнено ни одного подхода — сохранять нечего. Тренировка будет закрыта.', 'Выйти', true)) { runStore.clear(); close(); toast('Тренировка закрыта без сохранения', 'info'); } return; }
    if (!allFin() && run.mode !== 'done' && !(await confirmBox('Завершить досрочно?', `Выполнено ${o.done} из ${o.total} подходов. Выполненные подходы сохранятся в журнал.`, 'Завершить'))) return;
    goSummary();
  }
  function saveRun() {
    const f = run.form || {}, items = sessItems(false);
    if (!items.some(it => it.sets.some(s => s.done))) return toast('Нет выполненных подходов', 'err');
    const D0 = LG.derive(), lv0 = D0.level, P = prs();
    const s = { id: uid(), date: dayKey(new Date(run.startedAt)), startedAt: run.startedAt, title: run.title, source: run.source, ref: run.ref, durationSec: Math.round(act() / 1000),
      items, feel: f.feel || 0, pain: !!f.pain, notes: (f.notes || '').trim(), completed: allFin() && !f.pain, warmup: !!run.warmup, light: !!run.light } as any;
    if (f.rpe) s.rpe = f.rpe; if (f.rir != null) s.rir = f.rir; if (f.tech) s.tech = f.tech; if (f.pain && (f.painNote || '').trim()) s.painNote = f.painNote.trim().slice(0, 200);
    S.sessions.push(s);
    const ch = LG.applyProgression({ ...run, pain: !!f.pain }, f.rir == null ? 1 : f.rir);
    let ev = { changes: [], proposals: [] };
    if (run.source === 'engine' || run.source === 'group') {
      try { ev = evaluateSession(S as any, s); } catch (e) { console.error(e); }
      if (run.source === 'engine' && run.ref && PROGM_V2[run.ref.prog]) {
        const P = PROGM_V2[run.ref.prog], pr = S.progress[P.id] || (S.progress[P.id] = { next: 0, adj: {} });
        pr.next = ((run.ref.idx || 0) + 1) % P.workouts.length;
        S.engine = S.engine || {}; if (!S.engine.program) S.engine.program = P.id; if (!S.engine.startedAt) S.engine.startedAt = s.date;
      }
    }
    markPlanDone(s, run.plan);
    save(); runStore.clear();
    const xp = xpOfSession(s); close();
    AUD.done(); toast(`Тренировка сохранена · +${xp} XP`, 'xp', 3800);
    if (P.length) setTimeout(() => toast(`Рекорд! ${P[0]}`, 'ach', 4200), 500);
    const up = ch.filter(c => c.d > 0).length, dn = ch.filter(c => c.d < 0).length;
    if (up) setTimeout(() => toast(`Прогрессия: нагрузка повышена в ${pl(up, W.ex)}`, 'ok', 4000), 900);
    if (dn) setTimeout(() => toast(`Нагрузка снижена в ${pl(dn, W.ex)} из-за боли. Отдохните.`, 'info', 4500), 900);
    if (ev.proposals.length) setTimeout(() => toast(`Готово повышение нагрузки: ${esc(ev.proposals[0].text)}${ev.proposals.length > 1 ? ` и ещё ${ev.proposals.length - 1}` : ''}. Решение — в разделе «Мой план».`, 'ok', 6000), 1000);
    if (ev.changes.length) setTimeout(() => toast(esc(ev.changes[0]), 'info', 4500), 1100);
    const D1 = LG.derive(); if (D1.level > lv0) setTimeout(() => { toast(`Новый уровень ${D1.level} · ${esc(D1.title)}`, 'xp', 4500); buzz([60, 40, 60, 40, 200]); }, 1400);
    LG.checkAch(); render();
  }
  function addEx() {
    pickExercise(id => {
      const e = exOf(id), d: any = e.def || {};
      const sets = Array.isArray(d.reps) ? d.reps.map(r => ({ t: r })) : Array.from({ length: d.sets || 3 }, () => e.type === 'time' ? { tt: d.time || 20 } : { t: d.reps || 5 });
      run.items.push({ ex: id, rest: d.rest || S.profile.restDefault, w: 0, idx: null, extra: true, sets });
      if (run.mode !== 'rest') { run.cur = run.items.length - 1; run.mode = 'set'; prep(); }
      persist(); draw(); toast(`Добавлено: ${e.name}`, 'ok', 1600);
    }, 'Добавить упражнение');
  }
  /** replace the current exercise with another option of the same movement slot */
  function swapModal() {
    const it = item(); if (!it || !it.options) return;
    const c = ctxOf(S as any, { light: !!run.light }), opts = it.options.filter(x => x !== it.ex && EXM[x]);
    openModal({
      title: 'Заменить упражнение', cls: 'wide',
      body: `<p class="small muted" style="margin-top:-4px">Варианты того же движения с учётом вашего оборудования. Дозировка подберётся автоматически.</p>
        <div class="picker-list">${opts.map(x => { const e = exOf(x), d = materialize(x, doseOf(x, c), c); return `<button class="pk" data-sw="${x}"><span class="li-ico">${ico('swap')}</span><span class="pk-n">${e.name}<span class="pk-c" style="display:block">${TIER_NAME[tierOf(e)]} · ${doseLabel(d)}</span></span>${ico('right')}</button>`; }).join('')}</div>
        ${it.slot && run.source === 'engine' ? `<label class="check mt"><input type="checkbox" data-swkeep checked><span class="box">${ico('check')}</span><span class="ct">Запомнить замену для программы<span class="cs">В следующих тренировках будет это упражнение</span></span></label>` : ''}`,
      onMount(box, m) {
        box.addEventListener('click', ev => {
          const b = ev.target.closest('[data-sw]'); if (!b) return;
          const x = b.dataset.sw, e = exOf(x), d = materialize(x, doseOf(x, c), c), keep = $('[data-swkeep]', box);
          const sets = Array.from({ length: Math.max(1, d.sets || 1) }, () => e.type === 'time' ? { tt: d.time || 20 } : { t: +d.reps || 5 });
          const nu: any = { ex: x, rest: d.rest || it.rest, w: d.w || 0, idx: it.idx, slot: it.slot, options: it.options, sets };
          nu.target = LG.targetOf(nu);
          const started = it.sets.some(s2 => s2.done !== undefined);
          if (started) { const left = it.sets.filter(s2 => s2.done === undefined).length; it.sets.forEach(s2 => { if (s2.done === undefined) s2.done = false; }); nu.sets = nu.sets.slice(0, Math.max(1, left)); nu.target = LG.targetOf(nu); run.items.splice(run.cur + 1, 0, nu); run.cur++; }
          else run.items[run.cur] = nu;
          if (keep && keep.checked && it.slot) { S.engine = S.engine || {}; (S.engine.swaps = S.engine.swaps || {})[it.slot] = x; save(); }
          run.mode = 'set'; prep(); persist(); m.close(); draw(); toast(`Замена: ${e.name}`, 'ok', 1800);
        });
      }
    });
  }
  function painModal() {
    openModal({
      title: 'Боль или дискомфорт',
      body: `<div class="note n-bad">${ico('warn')}<div><b>Не продолжайте через боль.</b> Острая боль в суставе, щелчок или «простреливание» — сигнал остановиться. Если боль не проходит — обратитесь к врачу или физиотерапевту.</div></div>
        <p class="small muted mt">Отметка боли снизит нагрузку в программе и учтётся в рекомендациях готовности.</p>`,
      cls: 'm-col',
      foot: `<button class="btn btn-danger" data-tp="stop">${ico('x')}Завершить тренировку</button><button class="btn" data-tp="skip">${ico('skip')}Пропустить упражнение</button><button class="btn btn-ghost" data-close data-tp="ok">Это лёгкая мышечная усталость — продолжить</button>`,
      onMount(box, m) {
        box.addEventListener('click', e => {
          const b = e.target.closest('[data-tp]'); if (!b || b.dataset.tp === 'ok') return;
          m.close(); run.pain = true; if (run.form) run.form.pain = true;
          if (b.dataset.tp === 'stop') { goSummary(true); return; }
          const it = item(); if (it) { it.sets.forEach(s => { if (s.done === undefined) s.done = false; }); afterSet(it, true); }
          toast('Упражнение пропущено. Нагрузка в нём будет снижена.', 'info', 3500);
        });
      }
    });
  }
  function doAct(a, b?) {
    if (!run) return;
    const it = item();
    switch (a) {
      case 'pause': return setPause(!run.paused);
      case 'finish': return finish();
      case 'pain': return painModal();
      case 'toWork': { const all = warmL().every((_, i) => run.warmChecks[i]); if (!all && warmN() < 3) { confirmBox('Разминка не завершена', 'Отмечено мало пунктов разминки. Холодные мышцы и связки травмируются легче. Всё равно начать?', 'Начать').then(ok => ok && toWork(false)); return; } return toWork(all); }
      case 'skipWarm': return confirmBox('Пропустить разминку?', 'Без разминки выше риск травмы плеч, локтей и запястий. Рекомендуем хотя бы 3–5 минут суставной разминки.', 'Пропустить').then(ok => ok && toWork(false));
      case 'goto': if (run.mode === 'warm') return toWork(warmL().every((_, i) => run.warmChecks[i]), +b.dataset.i); run.cur = +b.dataset.i; if (run.mode !== 'rest') run.mode = 'set'; prep(); persist(); return draw();
      case 'prevEx': run.cur = Math.max(0, run.cur - 1); run.mode = 'set'; prep(); persist(); return draw();
      case 'nextEx': { const nx = run.cur < run.items.length - 1 ? run.cur + 1 : nextUnfinished(run.cur); if (nx >= 0) run.cur = nx; run.mode = 'set'; prep(); persist(); return draw(); }
      case 'up': return setCnt(1);
      case 'dn': return setCnt(-1);
      case 'wup': case 'wdn': { run.wt = clamp(round1((run.wt || 0) + (a === 'wup' ? 2.5 : -2.5)), 0, 100); it.w = run.wt; const w = $('#wt'); if (w) w.textContent = `${fmtNum(run.wt)} кг`; AUD.tap(); return; }
      case 'done': { const j = pend(it); if (j < 0) return; const s = it.sets[j], e = exOf(it.ex); s.reps = run.cnt || 0; s.weight = e.w ? (run.wt || 0) : 0; s.done = s.reps > 0; if (e.w) it.w = s.weight; AUD.tap(); buzz(30); return afterSet(it); }
      case 'skipSet': { const j = pend(it); if (j < 0) return; it.sets[j].done = false; return afterSet(it, true); }
      case 'addSet': { const last = it.sets[it.sets.length - 1] || {}, e = exOf(it.ex); it.sets.push(e.type === 'time' ? { tt: last.tt || 20 } : { t: last.t || run.cnt || 5 }); if (run.mode === 'done') run.mode = 'set'; prep(); persist(); return draw(); }
      case 'restStart': return (startRest(it.rest || S.profile.restDefault), persist(), draw());
      case 'restSkip': run.mode = 'set'; lastBeep = -1; prep(); persist(); return draw();
      case 'rest-15': case 'rest+15': { run.restEnd = Math.max(now() + 1000, run.restEnd + (a === 'rest+15' ? 15000 : -15000)); run.restTotal = Math.max(run.restTotal, Math.ceil((run.restEnd - now()) / 1000)); lastBeep = -1; persist(); return tick(true); }
      case 'holdStart': run.mode = 'hold'; run.holdStart = now() + 3000; run.holdGo = false; run.holdReached = false; lastBeep = -1; persist(); return draw();
      case 'holdStop': { const el = (now() - run.holdStart) / 1000; if (el <= 0.5) { run.mode = 'set'; return draw(); } const s = it.sets[pend(it)]; s.time = Math.round(el); s.done = true; AUD.tap(); return afterSet(it); }
      case 'holdCancel': run.mode = 'set'; return draw();
      case 'addEx': return addEx();
      case 'swap': return swapModal();
      case 'fs': return fsToggle();
      case 'lib': setPause(true); return;
      case 'save': return saveRun();
      case 'back': run.mode = run.prevMode || 'set'; if (run.mode === 'rest') run.mode = 'set'; run.paused = false; run.tickAt = now(); prep(); persist(); return draw();
      case 'discard': return confirmBox('Не сохранять тренировку?', 'Все подходы этой тренировки будут потеряны.', 'Не сохранять', true).then(ok => { if (ok) { runStore.clear(); close(); toast('Тренировка не сохранена', 'info'); } });
    }
  }
  /* ---------- events ---------- */
  document.addEventListener('click', (e: any) => {
    const tr = root(); if (!run || !tr || !tr.contains(e.target)) return;
    const b = e.target.closest('[data-tr]'); if (b && !b.disabled) { if (b.dataset.tr !== 'lib') e.preventDefault(); AUD.ensure(); doAct(b.dataset.tr, b); if (b.dataset.tr === 'lib') { const h = b.getAttribute('href'); close(); go(h); } return; }
    const f = e.target.closest('[data-trf]'); if (f && f.tagName === 'BUTTON') { run.form[f.dataset.trf] = +f.dataset.v; setSeg(f); persist(); }
  });
  document.addEventListener('change', (e: any) => {
    if (!run) return;
    const w = e.target.closest('[data-trw]'); if (w) { run.warmChecks[w.dataset.trw] = w.checked; persist(); if (run.mode === 'warm') draw(); return; }
    const f = e.target.closest('[data-trf="pain"]'); if (f) { run.form.pain = f.checked; const pn = $('#pain-note'); if (pn) pn.hidden = !f.checked; persist(); }
  });
  document.addEventListener('input', (e: any) => { if (run && run.form && e.target.matches('[data-trf="notes"],[data-trf="painNote"]')) { run.form[e.target.dataset.trf] = e.target.value; } });
  document.addEventListener('keydown', (e: any) => {
    if (!run || root().hidden || MODALS.length) return;
    if (e.target.closest && e.target.closest('input,textarea,select')) return;
    const k = e.key;
    if (k === 'p' || k === 'P' || k === 'з' || k === 'З') { e.preventDefault(); return setPause(!run.paused); }
    if ((k === 'f' || k === 'F' || k === 'а' || k === 'А') && document.fullscreenEnabled) { e.preventDefault(); return fsToggle(); }
    if (run.paused || run.mode === 'sum') return;
    if (k === '+' || k === '=' || k === 'ArrowUp') { e.preventDefault(); return setCnt(1); }
    if (k === '-' || k === 'ArrowDown') { e.preventDefault(); return setCnt(-1); }
    if (k === 'Enter' || k === ' ') {
      if (e.target.closest && e.target.closest('button,a,label')) return;
      e.preventDefault();
      const it = item(), m = run.mode;
      if (m === 'warm') return doAct('toWork');
      if (m === 'rest') return doAct('restSkip');
      if (m === 'hold') return doAct('holdStop');
      if (m === 'done') return doAct('finish');
      if (it && pend(it) >= 0) return doAct(exOf(it.ex).type === 'time' ? 'holdStart' : 'done');
    }
  });
  return { start, resume, active: () => !!run, close };
})();
