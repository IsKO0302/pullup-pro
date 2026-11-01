import { muscleMap } from '../../components/musclemap';
import { EQUIPMENT, PROGRAMS_V2, SLOTS } from '@pullup/shared/catalog/programs2';
import { GROUPM, GROUPS, MUSCLEM } from '@pullup/shared/catalog/muscles';
import { TIER_NAME, exInGroup, tierOf } from '@pullup/shared/catalog/exercises';
import { activeProgram, buildWorkout, ctxOf, doseLabel, doseOf, equipmentOf, materialize } from '@pullup/shared/engine';
import { FIG } from '../../components/figure';
import { openModal } from '../../components/modal';
import { toast } from '../../components/toast';
import { lvlBars } from '../../components/ui';
import { emptyBox, pageHead, segBtns, setSeg, speedSeg } from '../../components/view';
import { $, $$ } from '../../core/dom';
import { ACT } from '../../core/events';
import { ico } from '../../core/icons';
import { ROUTES, go, rerender } from '../../core/router';
import { S, save } from '../../core/state';
import { LG } from '../../services/logic';
import { EX, EXM, exOf } from '@pullup/shared/catalog/exercises';
import { PROGRAMS } from '@pullup/shared/catalog/programs';
import { fmtSec, todayKey } from '@pullup/shared/dates';
import { W, esc, fmtNum, pl, plural, uid } from '@pullup/shared/util';

/* ================= Exercise library 2.0 ================= */
export const LIB = { q: '', group: 'all', tier: 'all', mine: false };
const EQN: Record<string, string> = { ...Object.fromEntries(EQUIPMENT.map(x => [x.id, x.name])), wall: 'Стена', floor: 'Пол', rings: 'Кольца' };
ROUTES.library = {
  title: id => id && EXM[id] ? EXM[id].name : 'Библиотека',
  render(id) { return id && EXM[id] ? libDetail(EXM[id]) : libList(); }
};
const hay = e => (e.name + ' ' + (e.en || '') + ' ' + e.desc + ' ' + e.muscles.join(' ') + ' ' + (GROUPM[e.group] ? GROUPM[e.group].name + ' ' + GROUPM[e.group].en : '') + ' ' + (e.tags || []).join(' ')).toLowerCase();
export function libFiltered() {
  const q = LIB.q.trim().toLowerCase(), eq = LIB.mine ? equipmentOf(S as any) : null;
  return EX.filter(e => (LIB.group === 'all' || e.group === LIB.group || (e.also || []).includes(LIB.group as any))
    && (LIB.tier === 'all' || tierOf(e) === LIB.tier) && (!eq || (e.needs || []).every(n => eq.has(n))) && (!q || hay(e).includes(q)));
}
const needsTxt = e => { const n = (e.needs || []).filter(x => x !== 'floor' && x !== 'wall'); return n.length ? ' · ' + n.map(x => EQN[x] || x).join(', ') : ' · без оборудования'; };
export const exCard = e => `<a class="ex-card" href="#/library/${e.id}">
  <div class="ex-fig">${FIG.tag(e.anim, `data-label="0" data-seed="${e.id}"`)}</div>
  <div class="ex-b"><div class="row between"><span class="tiny muted ex-g">${GROUPM[e.group] ? GROUPM[e.group].en : ''}</span>${lvlBars(e.lvl)}</div>
  <div class="ex-n">${e.name}</div><div class="ex-m">${TIER_NAME[tierOf(e)]} · ${e.type === 'time' ? 'на время' : 'на повторы'}${needsTxt(e)}</div></div></a>`;
export function libGrid() {
  const xs = libFiltered();
  return xs.length ? `<div class="ex-grid">${xs.map(exCard).join('')}</div>` : emptyBox('Ничего не найдено', 'Попробуйте другой запрос или сбросьте фильтры.', 'search', '<button class="btn btn-sm" data-act="libReset">Сбросить фильтры</button>');
}
export function libList() {
  const cnt = g => exInGroup(g).length;
  return pageHead('Библиотека <em>упражнений</em>', `${pl(EX.length, W.ex)}: анимация техники, фазы движения, схема мышц, ошибки и дозировка. Нажмите на карточку, чтобы открыть подробности.`, '', 'Техника') + `
  <div class="lib-tools">
    <label class="search">${ico('search')}<input class="inp" id="lib-q" type="search" placeholder="Поиск: название, мышцы, PULL, CORE…" value="${esc(LIB.q)}" data-inp="libSearch" aria-label="Поиск упражнений"></label>
    ${segBtns('libTier', [['all', 'Любой уровень'], ['beginner', 'Начальный'], ['intermediate', 'Средний'], ['advanced', 'Продвинутый']], LIB.tier, 'id="lib-tier"')}
    <label class="switch-row small"><span class="switch"><input type="checkbox" data-chg="libMine" ${LIB.mine ? 'checked' : ''}><i></i></span>Только с моим оборудованием</label>
  </div>
  <div class="chips mb-l" id="lib-groups">${[['all', 'Все', EX.length], ...GROUPS.map(g => [g.id, g.en, cnt(g.id)])].map(([v, l, n]) => `<button class="chip ${LIB.group === v ? 'on' : ''}" data-act="libGroup" data-g="${v}">${l}<span class="cnt">${n}</span></button>`).join('')}</div>
  <div class="small muted mb" id="lib-count">Показано: ${libFiltered().length}</div>
  <div id="lib-grid">${libGrid()}</div>`;
}
export function updLib() { const g = $('#lib-grid'); if (!g) return; g.innerHTML = libGrid(); FIG.mountAll(g); const c = $('#lib-count'); if (c) c.textContent = `Показано: ${libFiltered().length}`; }
ACT.libSearch = el => { LIB.q = el.value; updLib(); };
ACT.libGroup = el => { LIB.group = el.dataset.g; $$('#lib-groups .chip').forEach(c => c.classList.toggle('on', c === el)); updLib(); };
ACT.libTier = el => { LIB.tier = el.dataset.v; setSeg(el); updLib(); };
ACT.libMine = el => { LIB.mine = el.checked; updLib(); };
ACT.libReset = () => { LIB.q = ''; LIB.group = 'all'; LIB.tier = 'all'; LIB.mine = false; rerender(); };
const exRef = (v?: string) => !v ? '' : EXM[v] ? `<a class="chip" href="#/library/${v}">${EXM[v].name}${ico('right')}</a>` : `<span class="small tx2">${esc(v)}</span>`;
export function libDetail(e) {
  const D = LG.derive(), b = D.best[e.id] || {}, g = GROUPM[e.group];
  const pb = e.type === 'time' ? (b.time ? fmtSec(b.time) : '—') : (b.reps ? pl(b.reps, W.rep) : '—');
  const rel = EX.filter(x => (x.group === e.group || (x.also || []).includes(e.group)) && x.id !== e.id).sort((x, y) => Math.abs(x.lvl - e.lvl) - Math.abs(y.lvl - e.lvl)).slice(0, 6);
  const usedIn = [...PROGRAMS.flatMap(P => P.workouts.filter(w => w.items.some(i => i.ex === e.id)).map(w => `${P.name} · ${w.id}`)),
    ...PROGRAMS_V2.filter(P => P.workouts.some(w => w.slots.some(sd => SLOTS[sd.slot] && SLOTS[sd.slot].ladder.some(st => st.ex === e.id)))).map(P => P.name)];
  const P = activeProgram(S as any), inPlan = P.workouts.map((_, i) => buildWorkout(S as any, P.id, i)).flatMap(w => w ? w.items : []).find(it => it.ex === e.id);
  const c = ctxOf(S as any), my = inPlan || (e.group !== 'muscleup' ? materialize(e.id, doseOf(e.id, c), c) : null);
  const needs = (e.needs || []).filter(x => x !== 'floor');
  const prim = (e.primary || []).map(m => MUSCLEM[m] ? MUSCLEM[m].name : m), sec = (e.secondary || []).map(m => MUSCLEM[m] ? MUSCLEM[m].name : m);
  const info = (i, t, v) => v ? `<div class="card tight"><div class="sec-t">${ico(i)}${t}</div><p class="small tx2" style="margin:0">${esc(v)}</p></div>` : '';
  return `<a class="back" href="#/library">${ico('left')}Библиотека</a>
  <div class="ex-detail">
    <div class="ex-side">
      <div class="fig-box">${FIG.tag(e.anim, 'data-prog="1" data-land="1"')}
        <div class="row between mt">${speedSeg()}<span class="tiny muted">Нажмите на фигуру — пауза</span></div>
        <div class="small muted mt">Оранжевым подсвечены основные работающие звенья. Подпись показывает текущую фазу движения.</div></div>
      ${(e.primary || []).length ? `<div class="card mt"><div class="card-head"><h3>${ico('core')}Анатомия: работающие мышцы</h3></div>${muscleMap(e.primary, e.secondary, { legend: true })}</div>` : ''}
    </div>
    <div class="stack l">
      <div><div class="eyebrow">${g ? `${g.en} · ${g.name}` : ''}</div><h1 class="disp" style="font-size:clamp(28px,3.4vw,42px)">${e.name}</h1>${e.en ? `<div class="small muted">${esc(e.en)}</div>` : ''}
        <div class="row wrap mt-s">${lvlBars(e.lvl)}<span class="badge">${TIER_NAME[tierOf(e)]}</span><span class="badge">${e.type === 'time' ? 'На время' : 'На повторы'}</span>${e.w ? '<span class="badge">Можно с отягощением</span>' : ''}${e.unilateral ? '<span class="badge">На каждую сторону</span>' : ''}</div></div>
      <p class="tx2" style="margin:0">${e.desc}</p>
      <div class="btns"><button class="btn btn-acc" data-act="stSingle" data-id="${e.id}">${ico('play')}Начать упражнение</button><button class="btn" data-act="addToCustom" data-id="${e.id}">${ico('plus')}В свою тренировку</button></div>
      <div class="card"><div class="card-head"><h3>${ico('layers')}Фазы движения</h3><span class="hint">начало · середина · конец</span></div>${FIG.frames(e.anim)}</div>
      <div class="card"><div class="card-head"><h3>${ico('list')}Пошаговая техника</h3></div><ol class="ol">${e.steps.map(x => `<li>${x}</li>`).join('')}</ol></div>
      <div class="grid g3">${info('edit', 'Локти', e.elbows)}${info('sliders', 'Амплитуда', e.rom)}${info('drop', 'Дыхание', e.breath)}</div>
      <div class="grid g2">
        <div class="card"><div class="card-head"><h3>${ico('core')}Мышцы</h3></div>
          ${prim.length ? `<div class="tiny muted mb-s">Основные</div><div class="tags">${prim.map(x => `<span class="tag acc">${esc(x)}</span>`).join('')}</div>` : `<div class="tags">${e.muscles.map(x => `<span class="tag">${x}</span>`).join('')}</div>`}
          ${sec.length ? `<div class="tiny muted mb-s mt">Вспомогательные</div><div class="tags">${sec.map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div>` : ''}</div>
        <div class="card"><div class="card-head"><h3>${ico('repeat')}Дозировка</h3></div><p class="tx2 small" style="margin-bottom:8px">${e.dose}</p>
          ${my ? `<div class="small">Для вас сейчас: <b class="acc">${doseLabel(my)}</b>${inPlan ? ' · из «Мой план»' : ''}</div>` : ''}
          <div class="small muted mt-s">Лучший результат: <b>${pb}</b>${b.kg ? ` · +${fmtNum(b.kg)} кг` : ''}</div></div>
      </div>
      <div class="card"><div class="card-head"><h3>${ico('warn')}Частые ошибки</h3></div><ul class="ul small tx2">${e.mistakes.map(x => `<li>${x}</li>`).join('')}</ul></div>
      ${e.easier || e.harder ? `<div class="grid g2"><div class="card tight"><div class="sec-t">${ico('down')}Легче</div>${exRef(e.easier) || '<span class="small muted">Это базовый вариант</span>'}</div><div class="card tight"><div class="sec-t">${ico('up')}Сложнее</div>${exRef(e.harder) || '<span class="small muted">Вершина этой прогрессии</span>'}</div></div>` : ''}
      <div class="card tight"><div class="sec-t">${ico('build')}Оборудование</div><div class="tags">${needs.length ? needs.map(x => `<span class="tag">${esc(EQN[x] || x)}</span>`).join('') : '<span class="tag">Без оборудования</span>'}</div>${e.home ? `<p class="small tx2 mt-s" style="margin-bottom:0"><b>Дома:</b> ${esc(e.home)}</p>` : ''}${e.equip ? `<p class="tiny muted mt-s" style="margin-bottom:0">${esc(e.equip)}</p>` : ''}</div>
      <div class="note ${e.safety ? 'n-bad' : 'n-warn'}">${ico('shield')}<div><b>Безопасность.</b> ${e.safety || 'Разомнитесь перед выполнением. Остановитесь при боли в суставах — не тренируйтесь через боль.'}</div></div>
      ${usedIn.length ? `<div class="small muted">Входит в программы: ${usedIn.map(esc).join(', ')}</div>` : ''}
      <div><div class="sec-t">Похожие упражнения</div><div class="chips">${rel.map(x => `<a class="chip" href="#/library/${x.id}">${x.name}</a>`).join('')}</div></div>
    </div>
  </div>`;
}
ACT.addToCustom = el => {
  const id = el.dataset.id, e = exOf(id);
  const mk = () => ({ ex: id, sets: e.def.sets || 3, reps: Array.isArray(e.def.reps) ? 5 : (e.def.reps || 5), time: e.def.time || 20, rest: e.def.rest || S.profile.restDefault, w: 0 });
  openModal({
    title: 'Добавить в тренировку',
    body: `<p class="small muted">${e.name} — ${e.def.sets} × ${e.type === 'time' ? (e.def.time || 20) + ' с' : (Array.isArray(e.def.reps) ? 5 : e.def.reps)}</p>
      <div class="picker-list" style="margin-top:0">${S.custom.map(c => `<button class="pk" data-cid="${c.id}"><span class="li-ico">${ico('build')}</span><span class="pk-n">${esc(c.name)}<span class="pk-c" style="display:block">${c.items.length} ${plural(c.items.length, W.ex)}</span></span>${ico('plus')}</button>`).join('')}
      <button class="pk" data-cid="new"><span class="li-ico acc">${ico('plus')}</span><span class="pk-n">Новая тренировка<span class="pk-c" style="display:block">Создать и открыть в конструкторе</span></span></button></div>`,
    onMount(box, m) {
      box.addEventListener('click', ev => {
        const b = ev.target.closest('[data-cid]'); if (!b) return;
        if (b.dataset.cid === 'new') { const c = { id: uid(), name: `Тренировка ${S.custom.length + 1}`, items: [mk()], created: todayKey() }; S.custom.push(c); save(); LG.checkAch(); m.close(); toast('Тренировка создана', 'ok'); go(`#/builder/${c.id}`); return; }
        const c = S.custom.find(x => x.id === b.dataset.cid); if (!c) return;
        c.items.push(mk()); save(); m.close(); toast(`Добавлено в «${esc(c.name)}»`, 'ok');
      });
    }
  });
};
