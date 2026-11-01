import { confirmBox } from '../../components/modal';
import { toast } from '../../components/toast';
import { emptyBox, pageHead, pickExercise } from '../../components/view';
import { $, numVal } from '../../core/dom';
import { ACT } from '../../core/events';
import { ico } from '../../core/icons';
import { ROUTES, go, rerender } from '../../core/router';
import { S, save } from '../../core/state';
import { LG } from '../../services/logic';
import { CATM, exOf } from '@pullup/shared/catalog/exercises';
import { fmtMin, todayKey } from '@pullup/shared/dates';
import { W, clamp, esc, pl, sum, uid } from '@pullup/shared/util';

/* ================= Custom workout builder ================= */
export let BL = null;
export const BL_TPL = [
  { name: 'Хват и вис', d: 'Предплечья и выносливость хвата', items: [['hang', 3, 0, 30, 60], ['activehang', 3, 0, 20, 60], ['flexhang', 3, 0, 15, 90], ['towel', 2, 0, 15, 90]] },
  { name: 'Кор для Muscle-Up', d: 'Корпус и контроль в висе', items: [['hollow', 3, 0, 30, 60], ['kneeraise', 3, 10, 0, 60], ['lsit', 3, 0, 10, 90], ['plank', 2, 0, 45, 60]] },
  { name: 'Здоровые плечи', d: 'Лопатки, ротаторы, осанка', items: [['scap', 3, 10, 0, 60], ['facepull', 3, 15, 0, 60], ['ytw', 2, 8, 0, 60], ['activehang', 2, 0, 20, 60]] },
  { name: 'Взрывной день', d: 'Скорость тяги для выхода силой', items: [['explosive', 5, 3, 0, 150], ['ctb', 3, 3, 0, 150], ['sbdips', 3, 6, 0, 120], ['hollow', 2, 0, 30, 60]] }
];
export const blItem = (ex, sets?, reps?, time?, rest?) => { const e = exOf(ex); return { ex, sets: sets || e.def.sets || 3, reps: reps || (Array.isArray(e.def.reps) ? 5 : e.def.reps) || 5, time: time || e.def.time || 20, rest: rest != null ? rest : (e.def.rest || S.profile.restDefault), w: 0 }; };
export function estDur(items) {
  let s = 300;
  for (const it of items) { const e = exOf(it.ex), work = e.type === 'time' ? (+it.time || 20) : (+it.reps || 5) * 3.5; s += (+it.sets || 1) * work + Math.max(0, (+it.sets || 1) - 1) * (+it.rest || 0) + 60; }
  return s;
}
ROUTES.builder = {
  title: id => id ? 'Редактор тренировки' : 'Конструктор',
  render(id) {
    if (id) {
      if (!BL || BL._key !== id) { const c = S.custom.find(x => x.id === id); if (id !== 'new' && !c) return blList(); BL = c ? JSON.parse(JSON.stringify(c)) : { id: null, name: `Тренировка ${S.custom.length + 1}`, items: [], created: todayKey() }; BL._key = id; }
      return blEdit();
    }
    return blList();
  }
};
export function blList() {
  return pageHead('Конструктор <em>тренировок</em>', 'Соберите собственную тренировку из упражнений библиотеки: подходы, повторы или время и отдых. Запускается с таймером, разминкой и журналом.',
    `<a class="btn btn-acc" href="#/builder/new">${ico('plus')}Новая тренировка</a>`, 'Свои тренировки') + `
  ${S.custom.length ? `<div class="grid g3">${S.custom.map(c => `<div class="card stack">
      <div class="row between top"><div><b class="big">${esc(c.name)}</b><div class="small muted">${pl(c.items.length, W.ex)} · ~${fmtMin(estDur(c.items))}</div></div></div>
      <div class="next-ex" style="margin:0">${c.items.slice(0, 5).map(it => { const e = exOf(it.ex); return `<div><span>${e.name}</span><span>${it.sets} × ${e.type === 'time' ? it.time + ' с' : it.reps}</span></div>`; }).join('')}${c.items.length > 5 ? `<div class="small muted" style="background:none">и ещё ${c.items.length - 5}</div>` : ''}</div>
      <div class="btns" style="margin-top:auto"><button class="btn btn-acc btn-sm" data-act="stCustom" data-id="${c.id}" ${c.items.length ? '' : 'disabled'}>${ico('play')}Начать</button><a class="btn btn-sm" href="#/builder/${c.id}">${ico('edit')}Изменить</a>
        <button class="btn btn-sm btn-ghost btn-icon" data-act="blDup" data-id="${c.id}" aria-label="Дублировать" title="Дублировать">${ico('copy')}</button><button class="btn btn-sm btn-ghost btn-icon" data-act="blDel" data-id="${c.id}" aria-label="Удалить" title="Удалить">${ico('trash')}</button></div>
    </div>`).join('')}</div>` : `<div class="card">${emptyBox('Своих тренировок пока нет', 'Создайте с нуля или начните с шаблона ниже.', 'build', '<a class="btn btn-acc btn-sm" href="#/builder/new">Создать тренировку</a>')}</div>`}
  <div class="sec-t mt-l">Шаблоны</div>
  <div class="grid g4">${BL_TPL.map((t, i) => `<div class="card flat stack s"><b>${t.name}</b><div class="small muted">${t.d}</div><div class="tags">${t.items.map((x: any) => `<span class="tag">${exOf(x[0]).name}</span>`).join('')}</div>
    <button class="btn btn-sm btn-out mt-s" style="margin-top:auto" data-act="blTpl" data-i="${i}">${ico('copy')}Создать из шаблона</button></div>`).join('')}</div>`;
}
export function blRows() {
  if (!BL.items.length) return emptyBox('Добавьте упражнения', 'Нажмите «Добавить упражнение» и выберите из библиотеки.', 'list');
  return BL.items.map((it, i) => {
    const e = exOf(it.ex);
    return `<div class="bl-row"><span class="num-i">${i + 1}</span><div class="bl-n">${e.name}<small>${CATM[e.cat].name}</small></div>
      <div class="bl-f">
        <label>Подходы<input class="inp sm" type="number" inputmode="numeric" min="1" max="20" value="${it.sets}" data-inp="blF" data-i="${i}" data-f="sets"></label>
        ${e.type === 'time' ? `<label>Секунды<input class="inp sm" type="number" inputmode="numeric" min="5" max="600" value="${it.time}" data-inp="blF" data-i="${i}" data-f="time"></label>` : `<label>Повторы<input class="inp sm" type="number" inputmode="numeric" min="1" max="100" value="${it.reps}" data-inp="blF" data-i="${i}" data-f="reps"></label>`}
        <label>Отдых, с<input class="inp sm" type="number" inputmode="numeric" min="0" max="600" step="15" value="${it.rest}" data-inp="blF" data-i="${i}" data-f="rest"></label>
      </div>
      <div class="bl-acts"><button class="btn btn-ghost btn-icon btn-sm" data-act="blMove" data-i="${i}" data-d="-1" ${i ? '' : 'disabled'} aria-label="Выше">${ico('up')}</button><button class="btn btn-ghost btn-icon btn-sm" data-act="blMove" data-i="${i}" data-d="1" ${i < BL.items.length - 1 ? '' : 'disabled'} aria-label="Ниже">${ico('down')}</button><button class="btn btn-ghost btn-icon btn-sm" data-act="blRm" data-i="${i}" aria-label="Удалить">${ico('trash')}</button></div></div>`;
  }).join('');
}
export const blSummary = () => `${pl(BL.items.length, W.ex)} · ${pl(sum(BL.items.map(x => +x.sets || 0)), W.set)} · ~${fmtMin(estDur(BL.items))}`;
export function blEdit() {
  return `<a class="back" href="#/builder">${ico('left')}Конструктор</a>` + pageHead(BL.id ? 'Редактор <em>тренировки</em>' : 'Новая <em>тренировка</em>', 'Порядок важен: сложные и взрывные упражнения ставьте в начало, кор и растяжку — в конец.') + `
  <div class="grid g3"><div class="card span2 stack l">
    <label class="field"><span>Название</span><input class="inp" maxlength="50" value="${esc(BL.name)}" data-inp="blName" placeholder="Например: Тяга + хват"></label>
    <div><div class="row between mb"><div class="sec-t" style="margin:0">Упражнения</div><span class="small muted" id="bl-sum">${blSummary()}</span></div>
      <div id="bl-rows">${blRows()}</div>
      <button class="btn mt-s" data-act="blAdd">${ico('plus')}Добавить упражнение</button></div>
    <div class="btns"><button class="btn btn-acc" data-act="blSave">${ico('check')}Сохранить</button><button class="btn" data-act="blSaveStart">${ico('play')}Сохранить и начать</button><button class="btn btn-ghost" data-act="blCancel">Отмена</button></div>
  </div>
  <div class="stack l">
    <div class="card"><div class="card-head"><h3>${ico('info')}Подсказки</h3></div><ul class="ul small tx2"><li>4–6 упражнений достаточно для 30–45 минут.</li><li>Отдых 2–3 минуты для силовых и взрывных подходов, 60–90 с — для вспомогательных.</li><li>Разминка добавляется автоматически при запуске.</li><li>Добавляйте упражнения на плечи (тяга к лицу, Y-T-W) — для баланса.</li></ul></div>
    <div class="note n-warn">${ico('shield')}<div>Своя тренировка не заменяет постепенность: не добавляйте сразу много сложных упражнений и не тренируйтесь через боль.</div></div>
  </div></div>`;
}
export const blRedraw = () => { const r = $('#bl-rows'); if (r) r.innerHTML = blRows(); const s = $('#bl-sum'); if (s) s.textContent = blSummary(); };
ACT.blName = el => { BL.name = el.value; };
ACT.blF = el => { const it = BL.items[+el.dataset.i], f = el.dataset.f, lim = { sets: [1, 20], reps: [1, 100], time: [5, 600], rest: [0, 600] }[f]; it[f] = clamp(Math.round(numVal(el, document, lim[0])), lim[0], lim[1]); const s = $('#bl-sum'); if (s) s.textContent = blSummary(); };
ACT.blAdd = () => pickExercise(id => { BL.items.push(blItem(id)); blRedraw(); });
ACT.blRm = el => { BL.items.splice(+el.dataset.i, 1); blRedraw(); };
ACT.blMove = el => { const i = +el.dataset.i, j = i + (+el.dataset.d); if (j < 0 || j >= BL.items.length) return; [BL.items[i], BL.items[j]] = [BL.items[j], BL.items[i]]; blRedraw(); };
ACT.blCancel = () => { BL = null; go('#/builder'); };
export function blCommit() {
  if (!BL.name.trim()) { toast('Введите название тренировки', 'err'); return null; }
  if (!BL.items.length) { toast('Добавьте хотя бы одно упражнение', 'err'); return null; }
  const c = { id: BL.id || uid(), name: BL.name.trim(), items: BL.items.map(x => ({ ...x })), created: BL.created || todayKey() };
  const i = S.custom.findIndex(x => x.id === c.id); if (i >= 0) S.custom[i] = c; else S.custom.push(c);
  save(); LG.checkAch(); BL = null; return c;
}
ACT.blSave = () => { const c = blCommit(); if (c) { toast(`Сохранено: ${esc(c.name)}`, 'ok'); go('#/builder'); } };
ACT.blSaveStart = () => { const c = blCommit(); if (c) { go('#/builder'); setTimeout(() => ACT.stCustom({ dataset: { id: c.id } }), 50); } };
ACT.blDup = el => { const c = S.custom.find(x => x.id === el.dataset.id); if (!c) return; S.custom.push({ ...JSON.parse(JSON.stringify(c)), id: uid(), name: `${c.name} (копия)`, created: todayKey() }); save(); toast('Копия создана', 'ok'); rerender(); };
ACT.blDel = async el => {
  const c = S.custom.find(x => x.id === el.dataset.id); if (!c) return;
  if (!(await confirmBox('Удалить тренировку?', `«${esc(c.name)}» будет удалена. Записи в журнале сохранятся.`, 'Удалить', true))) return;
  S.custom = S.custom.filter(x => x !== c);
  for (const k of Object.keys(S.plan)) { S.plan[k] = S.plan[k].filter(p => !(p.kind === 'custom' && p.cid === c.id && !p.done)); if (!S.plan[k].length) delete S.plan[k]; }
  save(); toast('Тренировка удалена', 'ok'); rerender();
};
ACT.blTpl = el => {
  const t = BL_TPL[+el.dataset.i]; const c = { id: uid(), name: t.name, items: t.items.map((x: any) => (blItem as any)(...x)), created: todayKey() };
  S.custom.push(c); save(); LG.checkAch(); toast(`Создано из шаблона: ${t.name}`, 'ok'); go(`#/builder/${c.id}`);
};
