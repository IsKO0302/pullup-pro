import { confirmBox } from '../../components/modal';
import { toast } from '../../components/toast';
import { checkbox, stepper } from '../../components/ui';
import { SRC, emptyBox, pageHead, pickExercise, segBtns, setSeg } from '../../components/view';
import { $, download, numVal } from '../../core/dom';
import { ACT } from '../../core/events';
import { ico } from '../../core/icons';
import { ROUTES, go, rerender } from '../../core/router';
import { S, save } from '../../core/state';
import { LG } from '../../services/logic';
import { exOf } from '@pullup/shared/catalog/exercises';
import { MONTHS, WD, addDays, dayKey, fmtDay, fmtMin, fmtSec, parseDay, todayKey, wdIdx } from '@pullup/shared/dates';
import { W, clamp, esc, fmtNum, pl, plural, uid } from '@pullup/shared/util';

/* ================= Journal: history, manual entry, CSV export ================= */
export const JR = { period: '90', type: 'all', q: '', open: {} };
export let ED = null;
ROUTES.journal = {
  title: a => a === 'new' ? 'Новая запись' : a === 'edit' ? 'Редактирование' : 'Журнал',
  render(a, b) {
    if (a === 'new' || (a === 'edit' && S.sessions.some(s => s.id === b))) { const key = a + (b || ''); if (!ED || ED._key !== key) edInit(a === 'edit' ? b : null, key); return edView(); }
    return jrList();
  }
};
export const fmtSet = (e, s) => s.done === false ? '<i>пропуск</i>' : e.type === 'time' ? `${s.time || 0} с` : `${s.reps || 0}${s.weight ? `<i> +${fmtNum(s.weight)} кг</i>` : ''}`;
export function jrEntries() {
  const lim = JR.period === 'all' ? '' : dayKey(addDays(new Date(), -(+JR.period) + 1)), q = JR.q.trim().toLowerCase();
  const out = [];
  if (JR.type === 'all' || JR.type !== 'test') for (const s of S.sessions) {
    if (lim && s.date < lim) continue;
    if (JR.type !== 'all' && s.source !== JR.type && !(JR.type === 'custom' && (s.source === 'single' || s.source === 'free'))) continue;
    if (q && !((s.title || '') + ' ' + (s.notes || '') + ' ' + (s.items || []).map(i => exOf(i.ex).name).join(' ')).toLowerCase().includes(q)) continue;
    out.push({ k: 's', date: s.date, ts: s.startedAt || 0, s });
  }
  if (JR.type === 'all' || JR.type === 'test') for (const t of S.tests) {
    if (lim && t.date < lim) continue;
    if (q && !'тест уровня'.includes(q)) continue;
    out.push({ k: 't', date: t.date, ts: 0, t });
  }
  return out.sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : b.ts - a.ts);
}
export function jrBody() {
  const E = jrEntries(), D = LG.derive();
  const tot = E.reduce((o, x) => { if (x.k === 's') { const st = D.st.get(x.s.id) || LG.sessStats(x.s); o.pull += st.pull; o.dur += x.s.durationSec || 0; if (x.s.source !== 'quick') o.n++; } return o; }, { pull: 0, dur: 0, n: 0 });
  let html = '', mk = '';
  for (const x of E) {
    const m = x.date.slice(0, 7);
    if (m !== mk) {
      mk = m; const d = parseDay(x.date), inM = E.filter(y => y.date.slice(0, 7) === m && y.k === 's');
      const mp = inM.reduce((a, y) => a + (D.st.get(y.s.id) || LG.sessStats(y.s)).pull, 0), mn = inM.filter(y => y.s.source !== 'quick').length;
      html += `<div class="month-h">${MONTHS[d.getMonth()]} ${d.getFullYear()}<small>${pl(mn, W.work)} · ${pl(mp, W.pull)}</small></div>`;
    }
    html += x.k === 's' ? sessCard(x.s) : testCard(x.t);
  }
  return `<div class="small muted">Найдено: ${E.length} · ${pl(tot.n, W.work)} · ${pl(tot.pull, W.pull)} · ${fmtMin(tot.dur)}</div>
      <div id="jr-list">${E.length ? html : emptyBox(S.sessions.length || S.tests.length ? 'Нет записей по фильтру' : 'Журнал пока пуст', S.sessions.length ? 'Измените период, тип или запрос.' : 'Завершите первую тренировку или добавьте запись вручную.', 'list', S.sessions.length ? '' : '<button class="btn btn-sm btn-acc" data-act="startMenu">Начать тренировку</button>')}</div>`;
}
export function jrList() {
  const recs = LG.records();
  return pageHead('Журнал <em>тренировок</em>', 'Все тренировки, быстрые подходы и тесты. Нажмите на запись, чтобы увидеть подходы.',
    `<a class="btn btn-acc" href="#/journal/new">${ico('plus')}Добавить вручную</a><button class="btn" data-act="exportCsv">${ico('download')}CSV</button>`, 'История') + `
  <div class="g-side">
    <div>
      <div class="lib-tools">
        <label class="search">${ico('search')}<input class="inp" type="search" id="jr-q" placeholder="Поиск: упражнение, заметка…" value="${esc(JR.q)}" data-inp="jrSearch" aria-label="Поиск по журналу"></label>
        ${segBtns('jrPeriod', [['7', '7 дней'], ['30', '30 дней'], ['90', '90 дней'], ['all', 'Всё время']], JR.period)}
      </div>
      <div class="chips mb">${[['all', 'Все'], ['program', 'Программы'], ['mu', 'Muscle-Up'], ['custom', 'Свои'], ['manual', 'Вручную'], ['quick', 'Быстрые'], ['test', 'Тесты']].map(([v, l]) => `<button class="chip ${JR.type === v ? 'on' : ''}" data-act="jrType" data-v="${v}">${l}</button>`).join('')}</div>
      <div id="jr-body">${jrBody()}</div>
    </div>
    <div class="stack l">
      <div class="card"><div class="card-head"><h3>${ico('trophy')}Личные рекорды</h3></div>
        <div class="list">${recs.map(r => `<div class="li"><div class="li-ico">${ico(r.i)}</div><div class="li-main"><div class="li-t">${r.l}</div><div class="li-s">${r.d ? fmtDay(r.d) : (r.v === '—' ? 'пока нет' : 'из профиля')}</div></div><b class="num">${r.v}${r.u ? ` <span class="small muted">${r.u}</span>` : ''}</b></div>`).join('')}</div></div>
      <div class="card"><div class="card-head"><h3>${ico('file')}Экспорт</h3></div><p class="small muted">CSV открывается в Excel и Google Таблицах. Полная резервная копия (JSON) — в настройках.</p>
        <div class="btns"><button class="btn btn-sm" data-act="exportCsv">${ico('download')}Скачать CSV</button><a class="btn btn-sm btn-ghost" href="#/settings">Резервная копия</a></div></div>
    </div>
  </div>`;
}
export function sessCard(s) {
  const st = LG.derive().st.get(s.id) || LG.sessStats(s), d = parseDay(s.date), open = JR.open[s.id];
  const meta = [s.durationSec ? `${ico('clock')} <b>${fmtMin(s.durationSec)}</b>` : '', st.pull ? `<b>${st.pull}</b> подтяг.` : '', st.reps - st.pull > 0 ? `<b>${st.reps - st.pull}</b> прочих повт.` : '', st.hold ? `<b>${fmtSec(st.hold)}</b> удерж.` : '', `<b>${st.sets}</b> ${plural(st.sets, W.set)}`, s.feel ? `самочувств. <b>${s.feel}/5</b>` : ''].filter(Boolean).map(x => `<span class="nowrap">${x}</span>`).join('<span>·</span>');
  return `<div class="sess ${open ? 'open' : ''}" data-sid="${s.id}">
    <div class="sess-h" data-act="jrToggle" data-id="${s.id}" role="button" tabindex="0" aria-expanded="${open ? 'true' : 'false'}">
      <div class="sess-date"><b>${d.getDate()}</b><span>${WD[wdIdx(d)]}</span></div>
      <div class="grow"><div class="row wrap" style="gap:8px"><b>${esc(s.title || 'Тренировка')}</b><span class="badge">${SRC[s.source] || 'Тренировка'}</span>${s.light ? '<span class="badge b-warn">лёгкая</span>' : ''}${s.pain ? '<span class="badge b-bad">боль</span>' : ''}${s.completed === false ? '<span class="badge">досрочно</span>' : ''}</div>
        <div class="sess-meta">${meta}</div></div>
      <span class="sess-chev">${ico('down')}</span></div>
    <div class="sess-b">
      ${(s.items || []).map(it => { const e = exOf(it.ex); return `<div class="set-line"><span class="sl-n">${e.name}</span><span class="sl-v">${(it.sets || []).map(x => fmtSet(e, x)).join(', ') || '—'}</span></div>`; }).join('')}
      ${s.notes ? `<div class="note mt-s">${ico('edit')}<div>${esc(s.notes)}</div></div>` : ''}
      <div class="btns mt">${s.source !== 'quick' ? `<a class="btn btn-sm" href="#/journal/edit/${s.id}">${ico('edit')}Изменить</a>` : ''}<button class="btn btn-sm btn-danger" data-act="delSess" data-id="${s.id}">${ico('trash')}Удалить</button></div>
    </div></div>`;
}
export const testCard = t => { const d = parseDay(t.date); return `<div class="sess"><div class="sess-h" style="cursor:default"><div class="sess-date"><b>${d.getDate()}</b><span>${WD[wdIdx(d)]}</span></div>
  <div class="grow"><div class="row wrap" style="gap:8px"><b>Тест уровня</b><span class="badge b-acc">${ico('test')}тест</span></div><div class="sess-meta"><b>${t.pullups}</b> подтяг.${t.hang ? `<span>·</span>вис <b>${fmtSec(t.hang)}</b>` : ''}${t.dips ? `<span>·</span>брусья <b>${t.dips}</b>` : ''}</div></div>
  <button class="btn btn-ghost btn-icon btn-sm" data-act="delTest" data-id="${t.id}" aria-label="Удалить тест">${ico('trash')}</button></div></div>`; };
ACT.jrToggle = el => { const id = el.dataset.id, c = el.closest('.sess'); JR.open[id] = !JR.open[id]; c.classList.toggle('open', JR.open[id]); el.setAttribute('aria-expanded', JR.open[id] ? 'true' : 'false'); };
document.addEventListener('keydown', (e: any) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.sess-h[data-act]')) { e.preventDefault(); ACT.jrToggle(e.target); } });
export let JR_T: any = 0;
ACT.jrSearch = el => { JR.q = el.value; clearTimeout(JR_T); JR_T = setTimeout(() => { const b = $('#jr-body'); if (b) b.innerHTML = jrBody(); }, 200); };
ACT.jrPeriod = el => { JR.period = el.dataset.v; rerender(); };
ACT.jrType = el => { JR.type = el.dataset.v; rerender(); };
ACT.delSess = async el => {
  const s = S.sessions.find(x => x.id === el.dataset.id); if (!s) return;
  if (!(await confirmBox('Удалить запись?', `«${esc(s.title || 'Тренировка')}» от ${fmtDay(s.date)} будет удалена без возможности восстановления.`, 'Удалить', true))) return;
  S.sessions = S.sessions.filter(x => x !== s); save(); toast('Запись удалена', 'ok');
  if (ED && ED.id === s.id) { ED = null; go('#/journal'); } else rerender();
};
ACT.exportCsv = () => {
  const q = v => { v = String(v == null ? '' : v); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  const rows: any[][] = [['Дата', 'Тренировка', 'Тип', 'Упражнение', 'Подход', 'Повторы', 'Время, с', 'Вес, кг', 'Выполнен', 'Самочувствие', 'Боль', 'Длительность, мин', 'Заметки']];
  for (const s of LG.sortSess(S.sessions)) for (const it of s.items || []) (it.sets || []).forEach((x, i) => rows.push([s.date, s.title, SRC[s.source] || '', exOf(it.ex).name, i + 1, exOf(it.ex).type === 'time' ? '' : x.reps || 0, exOf(it.ex).type === 'time' ? x.time || 0 : '', x.weight || '', x.done === false ? 'нет' : 'да', s.feel || '', s.pain ? 'да' : '', Math.round((s.durationSec || 0) / 60), i === 0 ? s.notes || '' : '']));
  for (const t of S.tests) rows.push([t.date, 'Тест уровня', 'Тест', 'Максимум подтягиваний', 1, t.pullups, '', '', 'да', '', '', '', `вис ${t.hang || 0} с; брусья ${t.dips || 0}`]);
  if (rows.length === 1) return toast('Нет данных для экспорта', 'err');
  download(`pullup-pro-journal-${todayKey()}.csv`, '\ufeff' + rows.map(r => r.map(q).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  toast(`Экспортировано строк: ${rows.length - 1}`, 'ok');
};

/* ---------- manual entry editor ---------- */
export function edInit(id, key) {
  const s = id && S.sessions.find(x => x.id === id);
  ED = s ? JSON.parse(JSON.stringify(s)) : { id: null, date: todayKey(), title: 'Тренировка', source: 'manual', durationSec: 1800, items: [{ ex: 'pullup', sets: [{ reps: 5, weight: 0, done: true }, { reps: 5, weight: 0, done: true }] }], feel: 3, pain: false, notes: '', completed: true, warmup: true };
  ED._key = key; ED._dur = Math.round((ED.durationSec || 0) / 60);
}
export function edItems() {
  if (!ED.items.length) return emptyBox('Нет упражнений', 'Добавьте хотя бы одно упражнение.', 'list');
  return ED.items.map((it, i) => {
    const e = exOf(it.ex);
    return `<div class="ed-item"><div class="row between"><b>${i + 1}. ${e.name}</b><div class="row" style="gap:4px">
      <button class="btn btn-ghost btn-icon btn-sm" data-act="edMove" data-i="${i}" data-d="-1" ${i ? '' : 'disabled'} aria-label="Выше">${ico('up')}</button>
      <button class="btn btn-ghost btn-icon btn-sm" data-act="edMove" data-i="${i}" data-d="1" ${i < ED.items.length - 1 ? '' : 'disabled'} aria-label="Ниже">${ico('down')}</button>
      <button class="btn btn-ghost btn-icon btn-sm" data-act="edRmEx" data-i="${i}" aria-label="Удалить упражнение">${ico('trash')}</button></div></div>
      <div class="ed-sets">${it.sets.map((s, j) => `<div class="ed-set"><span class="sn">${j + 1}</span>
        ${e.type === 'time' ? `<label class="field"><span class="tiny muted">Секунды</span><input class="inp sm" type="number" inputmode="numeric" min="0" max="900" value="${s.time || 0}" data-inp="edS" data-i="${i}" data-j="${j}" data-f="time"></label><span></span>`
        : `<label class="field"><span class="tiny muted">Повторы</span><input class="inp sm" type="number" inputmode="numeric" min="0" max="200" value="${s.reps || 0}" data-inp="edS" data-i="${i}" data-j="${j}" data-f="reps"></label>
           ${e.w ? `<label class="field"><span class="tiny muted">Доп. вес, кг</span><input class="inp sm" type="number" inputmode="decimal" min="0" max="150" step="0.5" value="${s.weight || 0}" data-inp="edS" data-i="${i}" data-j="${j}" data-f="weight"></label>` : '<span></span>'}`}
        <button class="btn btn-ghost btn-icon btn-sm" data-act="edRmSet" data-i="${i}" data-j="${j}" aria-label="Удалить подход" style="align-self:end">${ico('x')}</button></div>`).join('')}</div>
      <button class="btn btn-sm btn-ghost mt-s" data-act="edAddSet" data-i="${i}">${ico('plus')}Подход</button></div>`;
  }).join('');
}
export function edView() {
  const FEEL = ['Плохо', 'Так себе', 'Норм', 'Хорошо', 'Отлично'];
  return `<a class="back" href="#/journal">${ico('left')}Журнал</a>` + pageHead(ED.id ? 'Редактирование' : 'Новая <em>запись</em>', 'Запишите тренировку, выполненную без таймера. Рекорды и статистика обновятся автоматически.') + `
  <div class="grid g3"><div class="card span2 stack l">
    <div class="form-grid">
      <label class="field"><span>Дата</span><input type="date" class="inp" value="${ED.date}" max="${todayKey()}" data-inp="edF" data-f="date"></label>
      <label class="field"><span>Название</span><input class="inp" value="${esc(ED.title)}" maxlength="60" data-inp="edF" data-f="title"></label>
      <div class="field"><span>Длительность, мин</span>${stepper('ed-dur', ED._dur, 0, 300, 5, 'data-inp="edF" data-f="_dur"')}</div>
      <div class="field"><span>Самочувствие</span><div class="rate">${FEEL.map((f, i) => `<button type="button" data-act="edFeel" data-v="${i + 1}" class="${ED.feel === i + 1 ? 'on' : ''}">${i + 1}<small>${f}</small></button>`).join('')}</div></div>
    </div>
    <div><div class="sec-t">Упражнения и подходы</div><div id="ed-items">${edItems()}</div><button class="btn" data-act="edAddEx">${ico('plus')}Добавить упражнение</button></div>
    ${checkbox('edPain', ED.pain, 'Была боль или сильный дискомфорт', 'Нагрузка в программе будет снижена, а готовность к тренировке — пересчитана')}
    <label class="field"><span>Заметки</span><textarea class="inp" maxlength="500" data-inp="edF" data-f="notes" placeholder="Как прошла тренировка, что улучшить…">${esc(ED.notes || '')}</textarea></label>
    <div class="btns"><button class="btn btn-acc" data-act="edSave">${ico('check')}Сохранить</button><button class="btn btn-ghost" data-act="edCancel">Отмена</button>${ED.id ? `<button class="btn btn-danger" data-act="delSess" data-id="${ED.id}" style="margin-left:auto">${ico('trash')}Удалить</button>` : ''}</div>
  </div>
  <div class="stack l"><div class="note n-acc">${ico('info')}<div>Строгий максимум считается по подходам «Подтягивания прямым хватом» без отягощения. Для теста используйте «Тест уровня».</div></div>
    <div class="card"><div class="card-head"><h3>${ico('shield')}Помните</h3></div><ul class="ul small tx2"><li>Записывайте честно: прогрессия опирается на ваши данные.</li><li>Отмечайте боль — приложение снизит нагрузку.</li><li>Между тренировками на тягу — 48 часов.</li></ul></div></div></div>`;
}
export const edRedraw = () => { const c = $('#ed-items'); if (c) c.innerHTML = edItems(); };
ACT.edF = el => { if (!ED) return; const f = el.dataset.f; ED[f] = f === '_dur' ? clamp(Math.round(numVal(el)), 0, 300) : el.value; };
ACT.edS = el => { if (!ED) return; const s = ED.items[+el.dataset.i].sets[+el.dataset.j]; const f = el.dataset.f; s[f] = clamp(numVal(el), 0, f === 'time' ? 900 : f === 'weight' ? 150 : 200); s.done = true; };
ACT.edFeel = el => { ED.feel = +el.dataset.v; setSeg(el); };
ACT.edPain = el => { ED.pain = el.checked; };
ACT.edAddSet = el => { const it = ED.items[+el.dataset.i], last = it.sets[it.sets.length - 1] || { reps: 5, time: 20, weight: 0 }; it.sets.push({ reps: last.reps || 0, time: last.time || 0, weight: last.weight || 0, done: true }); edRedraw(); };
ACT.edRmSet = el => { const it = ED.items[+el.dataset.i]; it.sets.splice(+el.dataset.j, 1); if (!it.sets.length) ED.items.splice(+el.dataset.i, 1); edRedraw(); };
ACT.edRmEx = el => { ED.items.splice(+el.dataset.i, 1); edRedraw(); };
ACT.edMove = el => { const i = +el.dataset.i, j = i + (+el.dataset.d); if (j < 0 || j >= ED.items.length) return; [ED.items[i], ED.items[j]] = [ED.items[j], ED.items[i]]; edRedraw(); };
ACT.edAddEx = () => pickExercise(id => { const e = exOf(id); ED.items.push({ ex: id, sets: [0, 1, 2].map(() => e.type === 'time' ? { time: e.def.time || 20, done: true } : { reps: Array.isArray(e.def.reps) ? 5 : (e.def.reps || 5), weight: 0, done: true }) }); edRedraw(); });
ACT.edCancel = () => { ED = null; go('#/journal'); };
ACT.edSave = () => {
  if (!ED) return;
  if (!ED.date || ED.date > todayKey()) return toast('Укажите дату не позже сегодняшней', 'err');
  const items = ED.items.map(it => ({ ex: it.ex, sets: it.sets.filter(s => exOf(it.ex).type === 'time' ? s.time > 0 : s.reps > 0).map(s => exOf(it.ex).type === 'time' ? { time: Math.round(s.time), done: true } : { reps: Math.round(s.reps), weight: +s.weight || 0, done: true }) })).filter(it => it.sets.length);
  if (!items.length) return toast('Добавьте хотя бы один подход с результатом больше нуля', 'err');
  const D0 = LG.derive().level;
  const s = { ...ED, items, title: (ED.title || '').trim() || 'Тренировка', durationSec: (ED._dur || 0) * 60 };
  delete s._key; delete s._dur;
  if (ED.id) { const i = S.sessions.findIndex(x => x.id === ED.id); if (i >= 0) S.sessions[i] = s; }
  else { s.id = uid(); s.startedAt = parseDay(s.date).getTime() + 18 * 3600e3; S.sessions.push(s); markPlanDone(s); }
  const wasEdit = !!ED.id; save(); ED = null; toast(wasEdit ? 'Изменения сохранены' : 'Запись сохранена', 'ok');
  const D1 = LG.derive(); if (D1.level > D0) toast(`Новый уровень ${D1.level} · ${esc(D1.title)}`, 'xp', 4200);
  LG.checkAch(); go('#/journal');
};
/* mark a matching planned workout as done */
export function markPlanDone(s, ref?) {
  const list = S.plan[(ref && ref.k) || s.date]; if (!list || !list.length) return;
  let p = ref ? list.find(x => x.id === ref.id) : null;
  if (!p) p = list.find(x => !x.done && ((x.kind === 'program' && s.source === 'program' && s.ref && x.prog === s.ref.prog) || (x.kind === 'mu' && s.source === 'mu') || (x.kind === 'custom' && s.source === 'custom' && s.ref && s.ref.cid === x.cid)));
  if (!p && s.source !== 'quick') p = list.find(x => !x.done);
  if (p) p.done = true;
}
