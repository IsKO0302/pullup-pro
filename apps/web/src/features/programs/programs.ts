import { CH } from '../../components/charts';
import { FIG } from '../../components/figure';
import { MODALS, confirmBox, openModal } from '../../components/modal';
import { toast } from '../../components/toast';
import { stepper } from '../../components/ui';
import { kpi, pageHead, segBtns, setSeg } from '../../components/view';
import { AUD } from '../../core/audio';
import { $, numVal } from '../../core/dom';
import { ACT } from '../../core/events';
import { ico } from '../../core/icons';
import { ROUTES, rerender } from '../../core/router';
import { S, save } from '../../core/state';
import { LG } from '../../services/logic';
import { exOf } from '@pullup/shared/catalog/exercises';
import { PROGM, PROGRAMS, TEST_RULES, WARMUP, levelForMax } from '@pullup/shared/catalog/programs';
import { fmtDay, fmtDayShort, fmtSec, todayKey } from '@pullup/shared/dates';
import { W, clamp, fmtNum, pl, plural, uid } from '@pullup/shared/util';

/* ================= Programs & level test ================= */
ROUTES.programs = {
  title: id => id && PROGM[id] ? PROGM[id].name : 'Программы',
  render(id) { return id && PROGM[id] ? progDetail(PROGM[id]) : progList(); }
};
export function exitState(P) { return P.exit.map(c => { const cur = LG.metric(c.metric); return { ...c, cur, met: cur >= c.target }; }); }
export const critRow = c => { const u = LG.metricUnit(c.metric); return `<div class="crit ${c.met ? 'met' : ''}">${ico(c.met ? 'check' : 'target')}<span>${c.label}</span><span class="cv">${fmtNum(c.cur)}${u} / ${c.target}${u}</span></div>`; };
export let TH_MODE = 'pullups';
export const TH_OPTS = [['pullups', 'Подтягивания'], ['hang', 'Вис'], ['dips', 'Брусья']];
export function testChart(tests) {
  const m = TH_MODE, name = { pullups: 'Подтягивания', hang: 'Вис, с', dips: 'Отжимания на брусьях' }[m];
  return CH.slot({ type: 'line', labels: tests.map(x => fmtDayShort(x.date)), tips: tests.map(x => fmtDay(x.date)),
    series: [{ name, data: tests.map(x => +x[m] || null) }],
    emptyText: tests.length ? 'В тестах пока нет этого показателя' : 'Пройдите первый тест — здесь появится график прогресса', aria: 'Результаты тестов: ' + name }, 220);
}
ACT.thMode = el => { setSeg(el); TH_MODE = el.dataset.v; const c = $('#th-chart'); if (!c) return; c.innerHTML = testChart([...S.tests].sort((a, b) => a.date < b.date ? -1 : 1)); CH.mountAll(c); };
export function progList() {
  const D = LG.derive(), rec = levelForMax(D.curMax), cur = S.profile.program;
  const tests = [...S.tests].sort((a, b) => a.date < b.date ? -1 : 1);
  const chart = `<div id="th-chart">${testChart(tests)}</div>`;
  return pageHead('Программы <em>тренировок</em>', 'Три уровня с прогрессией: нагрузка растёт, когда все подходы выполнены с запасом, и снижается при боли. Рекомендация основана на вашем текущем максимуме.',
    `<button class="btn btn-acc" data-act="testWizard">${ico('test')}Пройти тест уровня</button>`, 'Тренировочные планы') + `
  <div class="grid g3">${PROGRAMS.map(P => {
    const isCur = P.id === cur, isRec = P.id === rec, nw = LG.nextWorkout(P.id), ex = exitState(P);
    return `<div class="card prog-card ${isCur ? 'cur accent' : ''}"><span class="stripe"></span>
      <div class="pc-top"><div><div class="prog-range">${P.range}</div><div class="prog-name">${P.name}</div><div class="small muted">${P.title}</div></div>
        <div class="stack s" style="align-items:flex-end">${isCur ? '<span class="badge b-solid">Текущая</span>' : ''}${isRec ? '<span class="badge b-ok">Рекомендуем</span>' : ''}</div></div>
      <p class="tx2 small" style="margin:0">${P.desc}</p>
      <div class="row wrap small"><span class="badge">${ico('target')}${P.goal}</span><span class="badge">${ico('cal')}${P.freq}</span><span class="badge">${ico('clock')}${P.dur}</span></div>
      <div class="stack s">${ex.map(critRow).join('')}</div>
      <div class="btns mt-s" style="margin-top:auto">
        ${isCur ? `<button class="btn btn-acc" data-act="stProg" data-p="${P.id}" data-i="${nw.idx}">${ico('play')}${nw.w.name}</button>` : `<button class="btn btn-out" data-act="selProg" data-p="${P.id}">Выбрать</button>`}
        <a class="btn btn-ghost btn-tight" href="#/programs/${P.id}">Подробнее ${ico('right')}</a>
      </div></div>`;
  }).join('')}</div>
  <div class="grid g2 mt-l">
    <div class="card">
      <div class="card-head"><h3>${ico('repeat')}Как работает прогрессия</h3></div>
      <ol class="ol">
        <li>Повторы в процентах (например, «60% макс.») рассчитываются от вашего текущего максимума.</li>
        <li>Выполнили все подходы и в запасе остался 1+ повтор — в следующий раз +1 повтор (или +5 секунд).</li>
        <li>Отметили боль — нагрузка упражнения снижается, а тренировку лучше прекратить.</li>
        <li>Лёгкая версия тренировки не повышает нагрузку — это нормально в дни плохого самочувствия.</li>
        <li>Тест уровня раз в 2–3 недели обновляет максимум и пересчитывает проценты.</li>
      </ol>
    </div>
    <div class="card">
      <div class="card-head"><h3>${ico('test')}История тестов</h3><span class="hint">${pl(S.tests.length, W.test)}</span></div>
      ${tests.length ? `<div class="mb-s">${segBtns('thMode', TH_OPTS, TH_MODE, 'aria-label="Показатель на графике"')}</div>` : ''}
      ${chart}
      ${tests.length ? `<div class="tbl-wrap mt"><table class="tbl"><thead><tr><th>Дата</th><th>Подтяг.</th><th>Вис</th><th>Брусья</th><th></th></tr></thead><tbody>
        ${[...tests].reverse().slice(0, 6).map(x => `<tr><td>${fmtDay(x.date)}</td><td><b>${x.pullups}</b></td><td>${x.hang ? fmtSec(x.hang) : '—'}</td><td>${x.dips || '—'}</td><td style="text-align:right"><button class="btn btn-ghost btn-icon btn-sm" data-act="delTest" data-id="${x.id}" aria-label="Удалить тест">${ico('trash')}</button></td></tr>`).join('')}
      </tbody></table></div>` : ''}
    </div>
  </div>`;
}
export function progDetail(P) {
  const isCur = S.profile.program === P.id, nw = LG.nextWorkout(P.id), ex = exitState(P), allMet = ex.every(c => c.met), NP = PROGM[P.next];
  return `<a class="back" href="#/programs">${ico('left')}Все программы</a>` +
    pageHead(`${P.name} <em>${P.title}</em>`, P.desc, isCur ? '<span class="badge b-solid">Текущая программа</span>' : `<button class="btn btn-out" data-act="selProg" data-p="${P.id}">Сделать текущей</button>`, P.range) + `
  <div class="kpis">${kpi('Цель', `<span style="font-size:18px;white-space:normal">${P.goal}</span>`, '', 'target')}${kpi('Частота', `<span style="font-size:20px">${P.freq}</span>`, 'отдых между тренировками 48 ч', 'cal')}${kpi('Длительность', `<span style="font-size:20px">${P.dur}</span>`, 'включая разминку', 'clock')}${kpi('Ваш максимум', LG.curMax(), 'база для процентов', 'trophy')}</div>
  ${allMet && NP ? `<div class="note n-ok mt-l">${ico('trophy')}<div><b>Критерии выполнены!</b> Вы готовы перейти на ${NP.name}. <button class="link-btn" data-act="selProg" data-p="${NP.id}">Перейти на ${NP.name}</button></div></div>` : ''}
  <div class="grid g3 mt-l">
    <div class="span2 stack l">
      ${P.workouts.map((w, i) => {
        const items = LG.planItems(w.items, { prog: P.id, w: w.id });
        return `<div class="wk"><div class="wk-h"><div><b>${w.name}</b> <span class="small muted">· ${w.focus}</span></div>
          <div class="row">${nw.idx === i ? '<span class="badge b-acc">Следующая</span>' : ''}<button class="btn btn-sm ${nw.idx === i ? 'btn-acc' : ''}" data-act="stProg" data-p="${P.id}" data-i="${i}">${ico('play')}Начать</button></div></div>
          ${items.map(it => `<div class="wk-r"><a href="#/library/${it.ex}">${exOf(it.ex).name}${it.adj ? ` <span class="badge ${it.adj > 0 ? 'b-ok' : 'b-warn'}">${it.adj > 0 ? '+' : ''}${it.adj}${exOf(it.ex).type === 'time' ? '×5 с' : ''}</span>` : ''}</a><span class="dose">${LG.doseText(it)}</span><span class="rest">отдых ${fmtSec(it.rest)}</span></div>`).join('')}
        </div>`;
      }).join('')}
      <div class="small muted">Бейдж «+1» означает автоматическую прогрессию: нагрузка выросла после успешных тренировок.</div>
    </div>
    <div class="stack l">
      <div class="card"><div class="card-head"><h3>${ico('target')}Критерии перехода</h3></div><div class="stack s">${ex.map(critRow).join('')}</div>
        ${NP ? `<div class="small muted mt">Следующая ступень: <a class="link-btn" href="#/programs/${NP.id}">${NP.name}</a></div>` : `<div class="small muted mt">Следующая ступень — <a class="link-btn" href="#/mu">путь к Muscle-Up</a></div>`}</div>
      <div class="card"><div class="card-head"><h3>${ico('list')}Правила</h3></div><ul class="ul small tx2">${P.rules.map(x => `<li>${x}</li>`).join('')}</ul></div>
      <div class="card"><div class="card-head"><h3>${ico('sun')}Разминка</h3><span class="hint">7–10 мин</span></div><ol class="ol small">${WARMUP.map(w => `<li><b>${w.t}</b><br><span class="muted">${w.d}</span></li>`).join('')}</ol></div>
    </div>
  </div>`;
}
ACT.selProg = el => {
  const P = PROGM[el.dataset.p]; if (!P) return;
  const m = LG.curMax(), rec = levelForMax(m);
  const doIt = () => { S.profile.program = P.id; save(); toast(`Текущая программа: ${P.name}`, 'ok'); rerender(); };
  if (P.from > m && rec !== P.id) confirmBox('Программа сложнее вашего уровня', `Ваш текущий максимум — ${pl(m, W.rep)}, а ${P.name} рассчитана на ${P.range}. Слишком высокая нагрузка повышает риск травмы. Рекомендуем ${PROGM[rec].name}.`, 'Всё равно выбрать').then(ok => ok && doIt());
  else doIt();
};
ACT.delTest = async el => {
  if (!(await confirmBox('Удалить тест?', 'Результат будет удалён из истории. Это действие нельзя отменить.', 'Удалить', true))) return;
  S.tests = S.tests.filter(x => x.id !== el.dataset.id); save(); toast('Тест удалён', 'ok'); rerender();
};

/* ---------- level test wizard ---------- */
ACT.testWizard = () => {
  const st = { step: 0, warm: {}, pull: 0, hang: 0, hangOn: false, hangT0: 0, dips: 0, dipsDone: false, setProg: true };
  const prev = [...S.tests].sort((a, b) => a.date < b.date ? -1 : 1).pop();
  let timer: any = 0, m;
  const dots = () => `<div class="steps-dots">${[0, 1, 2, 3, 4].map(i => `<i class="${i <= st.step ? 'on' : ''}"></i>`).join('')}</div>`;
  const counter = (k, label) => `<div class="counter mt"><button class="cnt-btn" data-tw="dn" data-k="${k}" aria-label="Меньше">${ico('minus')}</button><div><div class="cnt-v" data-v>${st[k]}</div><div class="cnt-l">${label}</div></div><button class="cnt-btn" data-tw="up" data-k="${k}" aria-label="Больше">${ico('plus')}</button></div>`;
  const hangVal = () => st.hangOn ? (Date.now() - st.hangT0) / 1000 : st.hang;
  function draw() {
    let b = dots(), f = '';
    if (st.step === 0) {
      b += `<p class="tx2">Тест покажет ваш текущий максимум и подберёт программу. Выполняйте на свежую голову, после отдыха.</p>
        <div class="sec-t mt">Правила засчёта</div><ol class="ol small">${TEST_RULES.map(x => `<li>${x}</li>`).join('')}</ol>
        <div class="sec-t mt">Разминка перед тестом</div>${WARMUP.map((w, i) => `<label class="check"><input type="checkbox" data-tww="${i}" ${st.warm[i] ? 'checked' : ''}><span class="box">${ico('check')}</span><span class="ct">${w.t}<span class="cs">${w.d}</span></span></label>`).join('')}
        <div class="note n-warn mt">${ico('shield')}<div>Тест — максимальное усилие. Есть боль или плохое самочувствие — перенесите тест.</div></div>`;
      const n = Object.values(st.warm).filter(Boolean).length;
      f = `<span class="small muted grow">Разминка: ${n}/${WARMUP.length}</span><button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-acc" data-tw="next">Далее ${ico('right')}</button>`;
    } else if (st.step === 1) {
      b += `<div class="row top"><div style="width:110px;flex-shrink:0">${FIG.tag('pullup', 'data-label="0"')}</div><div><b class="big">Максимум подтягиваний</b><p class="small muted">Один подход до технического отказа: прямой хват, полная амплитуда, без раскачки. Считайте только чистые повторы.</p></div></div>
        ${counter('pull', 'повторов')}<div class="small muted mt" style="text-align:center">Клавиши: <span class="kbd">+</span> <span class="kbd">−</span></div>`;
      f = `<button class="btn btn-ghost" data-tw="back">Назад</button><button class="btn btn-acc" data-tw="next">Далее ${ico('right')}</button>`;
    } else if (st.step === 2) {
      b += `<div class="row top"><div style="width:110px;flex-shrink:0">${FIG.tag('hang', 'data-label="0"')}</div><div><b class="big">Пассивный вис</b><p class="small muted">Отдохните 3–5 минут после подтягиваний. Затем висите на прямых руках как можно дольше. Нажмите «Старт», когда повиснете.</p></div></div>
        <div style="text-align:center" class="mt"><div class="hold-v" data-hv>${fmtSec(hangVal())}</div>
        <div class="btns mt" style="justify-content:center">${st.hangOn ? `<button class="btn btn-acc btn-lg" data-tw="hstop">${ico('pause')}Стоп</button>` : `<button class="btn btn-acc btn-lg" data-tw="hstart">${ico('play')}${st.hang ? 'Заново' : 'Старт'}</button>`}</div>
        <div class="row mt" style="justify-content:center"><span class="small muted">или вручную, сек:</span>${stepper('tw-hang', Math.round(st.hang), 0, 600, 5)}</div></div>`;
      f = `<button class="btn btn-ghost" data-tw="back">Назад</button><button class="btn btn-acc" data-tw="next">${st.hang ? 'Далее' : 'Пропустить'} ${ico('right')}</button>`;
    } else if (st.step === 3) {
      b += `<div class="row top"><div style="width:110px;flex-shrink:0">${FIG.tag('dips', 'data-label="0"')}</div><div><b class="big">Отжимания на брусьях</b><p class="small muted">Необязательно. Нужны для пути к Muscle-Up. Опускайтесь до угла 90° в локтях, без боли в плечах.</p></div></div>${counter('dips', 'повторов')}`;
      f = `<button class="btn btn-ghost" data-tw="back">Назад</button><button class="btn btn-acc" data-tw="next">${st.dips ? 'Далее' : 'Пропустить'} ${ico('right')}</button>`;
    } else {
      const rec = levelForMax(st.pull), RP = PROGM[rec], d = prev ? st.pull - prev.pullups : null;
      b += `<div style="text-align:center"><div class="eyebrow" style="justify-content:center">Результат теста</div><div class="cnt-v">${st.pull}</div><div class="cnt-l">${plural(st.pull, W.pull)}</div>
        ${d != null ? `<div class="mt-s"><span class="badge ${d > 0 ? 'b-ok' : d < 0 ? 'b-warn' : ''}">${d > 0 ? '+' + d : d < 0 ? '−' + Math.abs(d) : '±0'} к прошлому тесту (${fmtDayShort(prev.date)})</span></div>` : ''}</div>
        <div class="rec-grid mt"><div class="rec"><div class="rl">Вис</div><div class="rv">${st.hang ? fmtSec(st.hang) : '—'}</div></div><div class="rec"><div class="rl">Брусья</div><div class="rv">${st.dips || '—'}</div></div></div>
        <div class="note n-acc mt">${ico('prog')}<div>Рекомендуемая программа: <b>${RP.name}</b> (${RP.range}).</div></div>
        ${rec !== S.profile.program ? `<label class="check mt-s"><input type="checkbox" data-twp ${st.setProg ? 'checked' : ''}><span class="box">${ico('check')}</span><span class="ct">Сделать ${RP.name} текущей программой</span></label>` : ''}
        ${st.pull === 0 ? `<div class="note mt">${ico('info')}<div>0 повторов — это нормальная точка старта. BEGINNER построит силу через негативы, вис и австралийские подтягивания.</div></div>` : ''}`;
      f = `<button class="btn btn-ghost" data-tw="back">Назад</button><button class="btn btn-acc" data-tw="save">${ico('check')}Сохранить результат</button>`;
    }
    m.setBody(b); m.setFoot(f);
  }
  m = openModal({
    title: 'Тест уровня', dismiss: true,
    onClose() { clearInterval(timer); document.removeEventListener('keydown', key); },
    onMount(box) {
      box.addEventListener('click', e => {
        const b = e.target.closest('[data-tw]'); if (!b) return; const a = b.dataset.tw;
        if (a === 'up' || a === 'dn') { const k = b.dataset.k; st[k] = clamp(st[k] + (a === 'up' ? 1 : -1), 0, 100); const v = $('[data-v]', box); v.textContent = st[k]; v.classList.remove('bump'); void v.offsetWidth; v.classList.add('bump'); AUD.tap(); return; }
        if (a === 'next') { st.step = Math.min(4, st.step + 1); if (st.hangOn) stopHang(); }
        if (a === 'back') { st.step = Math.max(0, st.step - 1); if (st.hangOn) stopHang(); }
        if (a === 'hstart') { st.hangOn = true; st.hangT0 = Date.now(); AUD.go(); clearInterval(timer); timer = setInterval(() => { const el = $('[data-hv]', box); if (el) el.textContent = fmtSec(hangVal()); }, 200); }
        if (a === 'hstop') stopHang();
        if (a === 'save') return saveTest();
        draw();
      });
      box.addEventListener('change', e => {
        if (e.target.dataset.tww != null) { st.warm[e.target.dataset.tww] = e.target.checked; const n = Object.values(st.warm).filter(Boolean).length; const s = $('.modal-foot .small', box); if (s) s.textContent = `Разминка: ${n}/${WARMUP.length}`; }
        if (e.target.matches('[data-twp]')) st.setProg = e.target.checked;
      });
      box.addEventListener('input', e => { if (e.target.id === 'tw-hang') { st.hang = clamp(numVal(e.target), 0, 600); const el = $('[data-hv]', box); if (el && !st.hangOn) el.textContent = fmtSec(st.hang); const nb = $('[data-tw="next"]', box); if (nb) nb.innerHTML = `${st.hang ? 'Далее' : 'Пропустить'} ${ico('right')}`; } });
      document.addEventListener('keydown', key);
    }
  });
  function key(e) {
    if (MODALS[MODALS.length - 1] !== m || !(st.step === 1 || st.step === 3)) return;
    const k = st.step === 1 ? 'pull' : 'dips';
    if (e.key === '+' || e.key === '=' || e.key === 'ArrowUp') st[k] = Math.min(100, st[k] + 1);
    else if (e.key === '-' || e.key === 'ArrowDown') st[k] = Math.max(0, st[k] - 1); else return;
    e.preventDefault(); const v = $('[data-v]', m.box); if (v) v.textContent = st[k];
  }
  function stopHang() { st.hang = Math.round(hangVal()); st.hangOn = false; clearInterval(timer); AUD.done(); }
  function saveTest() {
    const t = { id: uid(), date: todayKey(), pullups: st.pull, hang: Math.round(st.hang), dips: st.dips };
    S.tests.push(t); S.profile.maxPullups = st.pull; LG.resetPctAdj();
    const rec = levelForMax(st.pull); if (st.setProg && rec !== S.profile.program) S.profile.program = rec;
    save(); m.close(); toast(`Тест сохранён: ${pl(st.pull, W.pull)} · +50 XP`, 'xp', 3600); LG.checkAch(); rerender();
  }
  draw();
};
