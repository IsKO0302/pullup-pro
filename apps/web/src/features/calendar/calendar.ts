import { openModal } from '../../components/modal';
import { toast } from '../../components/toast';
import { ring } from '../../components/ui';
import { pageHead } from '../../components/view';
import { $, $$ } from '../../core/dom';
import { ACT } from '../../core/events';
import { ico } from '../../core/icons';
import { ROUTES, go, rerender } from '../../core/router';
import { S, save } from '../../core/state';
import { JR } from '../journal/journal';
import { LG } from '../../services/logic';
import { PROGM, PROGRAMS } from '@pullup/shared/catalog/programs';
import { MONTHS, WD, addDays, dayKey, daysBetween, fmtDayShort, fmtDayW, fmtMin, pad, parseDay, relDay, startOfWeek, todayKey, wdIdx, weekKey } from '@pullup/shared/dates';
import { W, clamp, esc, pl, plural, uid } from '@pullup/shared/util';

export const calShort = t => String(t || 'Тренировка').replace(/^(BEGINNER|INTERMEDIATE|ADVANCED)\s*·\s*/i, '').replace(/^Тренировка\s+/, 'Трен. ').replace(/^Muscle-Up\s*·\s*/, 'MU · ');
/* ================= Calendar & planning ================= */
export const CAL = { ym: '', sel: '' };
ROUTES.calendar = {
  title: 'Календарь',
  render() {
    const t = todayKey(); if (!CAL.ym) CAL.ym = t.slice(0, 7); if (!CAL.sel) CAL.sel = t;
    const [y, mo] = CAL.ym.split('-').map(Number), first = new Date(y, mo - 1, 1), start = startOfWeek(first);
    const last = new Date(y, mo, 0), weeks = Math.ceil((daysBetween(dayKey(start), dayKey(last)) + 1) / 7), D = LG.derive();
    let cells = WD.map(d => `<div class="cal-wd">${d}</div>`).join('');
    for (let i = 0; i < weeks * 7; i++) {
      const d = addDays(start, i), k = dayKey(d), other = d.getMonth() !== mo - 1;
      const ss = S.sessions.filter(s => s.date === k), plans = S.plan[k] || [], ev = [];
      ss.filter(s => s.source !== 'quick').forEach(s => ev.push(`<span class="ev done" title="${esc(s.title || 'Тренировка')}">${esc(calShort(s.title))}</span>`));
      const qp = ss.filter(s => s.source === 'quick').reduce((a, s) => a + LG.sessStats(s).pull, 0); if (qp) ev.push(`<span class="ev done">+${qp} подтяг.</span>`);
      plans.forEach(p => ev.push(`<span class="ev plan ${p.done ? 'ok' : k < t ? 'miss' : ''}" title="${esc(p.title)}">${esc(calShort(p.title))}</span>`));
      if ((S.daily[k] || {}).recovery) ev.push('<span class="ev plan">Восстановление</span>');
      const lbl = `${fmtDayW(k)}${ss.length ? `, записей: ${ss.length}` : ''}${plans.length ? `, в плане: ${plans.length}` : ''}`;
      cells += `<button class="cal-d ${other ? 'other' : ''} ${k === t ? 'today' : ''} ${k === CAL.sel ? 'sel' : ''}" data-act="calSel" data-k="${k}" aria-label="${esc(lbl)}"><span class="dn">${d.getDate()}</span>${ev.slice(0, 3).join('')}${ev.length > 3 ? `<span class="tiny muted">+${ev.length - 3}</span>` : ''}</button>`;
    }
    const wkN = (D.byWeek[weekKey(new Date())] || {}).n || 0;
    return pageHead('Календарь <em>тренировок</em>', 'Планируйте тренировки и отслеживайте выполнение. Между тренировками на тягу оставляйте 48 часов.',
      `<button class="btn btn-acc" data-act="autoPlan">${ico('sparkle')}Автоплан</button>`, 'Планирование') + `
    <div class="g-side">
      <div class="card">
        <div class="cal-head"><button class="btn btn-icon btn-sm" data-act="calMove" data-d="-1" aria-label="Предыдущий месяц">${ico('left')}</button><h3>${MONTHS[mo - 1]} ${y}</h3><button class="btn btn-icon btn-sm" data-act="calMove" data-d="1" aria-label="Следующий месяц">${ico('right')}</button>
          <button class="btn btn-sm btn-ghost" data-act="calToday" style="margin-left:auto">Сегодня</button></div>
        <div class="cal">${cells}</div>
        <div class="cal-legend"><span><span class="ev done">&nbsp;&nbsp;&nbsp;</span>выполнено</span><span><span class="ev plan">&nbsp;&nbsp;&nbsp;</span>запланировано</span><span><span class="ev plan ok">&nbsp;&nbsp;&nbsp;</span>план выполнен</span><span><span class="ev miss">&nbsp;&nbsp;&nbsp;</span>пропущено</span></div>
      </div>
      <div class="stack l">
        <div class="card" id="cal-day">${calDay(CAL.sel)}</div>
        <div class="card"><div class="card-head"><h3>${ico('target')}Эта неделя</h3></div>
          <div class="row">${ring(wkN / (+S.profile.weeklyTarget || 3), 76, 8, `<div class="rg-v" style="font-size:18px">${wkN}/${S.profile.weeklyTarget}</div>`, wkN >= S.profile.weeklyTarget ? 'ok' : '')}
          <div class="small muted grow">${wkN >= S.profile.weeklyTarget ? 'Недельная цель выполнена. Дополнительные тренировки — только при хорошем восстановлении.' : `До недельной цели: ${pl(S.profile.weeklyTarget - wkN, W.work)}.`}</div></div></div>
      </div>
    </div>`;
  }
};
export function planOptions() {
  const P = PROGM[S.profile.program] || PROGRAMS[0], M = LG.muState(), o = [];
  P.workouts.forEach((w, i) => o.push({ v: `program:${P.id}:${i}`, l: `${P.name} · ${w.name} (${w.focus})` }));
  if (M.cur) o.push({ v: `mu:${M.cur.n}`, l: `Muscle-Up · Этап ${M.cur.n}` });
  S.custom.forEach(c => o.push({ v: `custom:${c.id}`, l: `Своя: ${c.name}` }));
  return o;
}
export function planFromVal(v) {
  const [kind, a, b] = v.split(':'), id = uid();
  if (kind === 'program') { const P = PROGM[a]; return { id, kind, prog: a, idx: +b, title: `${P.name} · ${P.workouts[+b].name}`, done: false }; }
  if (kind === 'mu') return { id, kind, stage: +a, title: `Muscle-Up · Этап ${a}`, done: false };
  const c = S.custom.find(x => x.id === a); return c ? { id, kind, cid: a, title: c.name, done: false } : null;
}
export function calDay(k) {
  const t = todayKey(), ss = S.sessions.filter(s => s.date === k), plans = S.plan[k] || [], rec = (S.daily[k] || {}).recovery;
  const near = [-1, 1].filter(d => { const x = dayKey(addDays(parseDay(k), d)); return (LG.derive().byDay[x] || {}).workouts || (S.plan[x] || []).length; }).length;
  return `<div class="card-head"><h3>${ico('cal')}${fmtDayW(k)}</h3><span class="hint">${relDay(k)}</span></div>
    ${rec ? `<div class="note n-acc mb">${ico('bed')}<div>День восстановления</div></div>` : ''}
    <div class="sec-t">Выполнено</div>
    ${ss.length ? `<div class="list">${ss.map(s => { const st = LG.sessStats(s); return `<div class="li"><div class="li-ico">${ico(s.source === 'quick' ? 'plus' : 'check')}</div><div class="li-main"><div class="li-t">${esc(s.title || 'Тренировка')}</div><div class="li-s">${st.pull} подтяг. · ${pl(st.sets, W.set)}${s.durationSec ? ' · ' + fmtMin(s.durationSec) : ''}</div></div><a class="btn btn-sm btn-ghost" href="#/journal" data-act="calJr" data-id="${s.id}">Журнал</a></div>`; }).join('')}</div>` : '<div class="small muted mb">Нет записей</div>'}
    <div class="sec-t mt">План</div>
    ${plans.length ? `<div class="list">${plans.map(p => `<div class="li"><div class="li-ico ${p.done ? '' : 'acc'}">${ico(p.done ? 'check' : p.kind === 'mu' ? 'zap' : p.kind === 'custom' ? 'build' : 'bolt')}</div><div class="li-main"><div class="li-t">${esc(p.title)}</div><div class="li-s">${p.done ? 'выполнено' : k < t ? 'пропущено' : 'запланировано'}</div></div>
      <div class="row" style="gap:4px">${!p.done && k === t ? `<button class="btn btn-sm btn-acc" data-act="stPlan" data-k="${k}" data-id="${p.id}">${ico('play')}Начать</button>` : ''}
      ${k <= t ? `<button class="btn btn-sm btn-ghost" data-act="planDone" data-k="${k}" data-id="${p.id}">${p.done ? 'Снять' : 'Выполнено'}</button>` : ''}
      <button class="btn btn-icon btn-sm btn-ghost" data-act="planDel" data-k="${k}" data-id="${p.id}" aria-label="Удалить из плана">${ico('trash')}</button></div></div>`).join('')}</div>` : '<div class="small muted mb">Ничего не запланировано</div>'}
    ${k >= t ? `<div class="divider"></div><div class="field"><span>Запланировать тренировку</span><select class="inp" id="plan-sel">${planOptions().map(o => `<option value="${esc(o.v)}">${esc(o.l)}</option>`).join('')}</select></div>
      ${near ? `<div class="note n-warn mt-s">${ico('info')}<div class="small">Рядом уже есть тренировка. Оставьте 48 часов между тренировками на тягу.</div></div>` : ''}
      <button class="btn btn-block mt" data-act="planAdd" data-k="${k}">${ico('plus')}Добавить в план</button>` : ''}`;
}
export const calRefresh = () => rerender();
ACT.calSel = el => { CAL.sel = el.dataset.k; $$('.cal-d').forEach(c => c.classList.toggle('sel', c === el)); const d = $('#cal-day'); if (d) d.innerHTML = calDay(CAL.sel); if (window.innerWidth <= 1100 && d) d.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
ACT.calMove = el => { const [y, m] = CAL.ym.split('-').map(Number), d = new Date(y, m - 1 + (+el.dataset.d), 1); CAL.ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; calRefresh(); };
ACT.calToday = () => { CAL.ym = todayKey().slice(0, 7); CAL.sel = todayKey(); calRefresh(); };
ACT.calJr = el => { JR.open[el.dataset.id] = true; JR.period = 'all'; go('#/journal'); };
ACT.planAdd = el => {
  const k = el.dataset.k, sel = $('#plan-sel'); if (!sel) return;
  const p = planFromVal(sel.value); if (!p) return toast('Не удалось добавить', 'err');
  (S.plan[k] = S.plan[k] || []).push(p); S.ui.planCount = (S.ui.planCount || 0) + 1; save();
  toast(`Запланировано: ${esc(p.title)} · ${fmtDayShort(k)}`, 'ok'); LG.checkAch(); calRefresh();
};
ACT.planDone = el => { const p = (S.plan[el.dataset.k] || []).find(x => x.id === el.dataset.id); if (!p) return; p.done = !p.done; save(); calRefresh(); };
ACT.planDel = el => { const k = el.dataset.k; S.plan[k] = (S.plan[k] || []).filter(x => x.id !== el.dataset.id); if (!S.plan[k].length) delete S.plan[k]; save(); toast('Удалено из плана', 'ok'); calRefresh(); };
ACT.autoPlan = () => {
  const tgt = clamp(+S.profile.weeklyTarget || 3, 2, 5), presets = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5] };
  const st = { days: new Set(presets[tgt]), weeks: 4, replace: true };
  const P = PROGM[S.profile.program] || PROGRAMS[0];
  let m;
  const draw = () => {
    const arr = [...st.days].sort(), cons = arr.some((d: any, i) => arr.includes(d + 1) || (d === 6 && arr.includes(0)));
    m.setBody(`<p class="tx2 small">Тренировки ${P.name} будут расставлены по выбранным дням недели в порядке A → B → C, начиная со следующей тренировки программы.</p>
      <div class="lbl mb-s" style="margin-bottom:8px">Дни недели</div><div class="wd-pick">${WD.map((d, i) => `<button type="button" data-ap="${i}" class="${st.days.has(i) ? 'on' : ''}" aria-pressed="${st.days.has(i)}">${d}</button>`).join('')}</div>
      <div class="lbl mt" style="margin-bottom:8px">Период</div><div class="seg">${[2, 4, 6].map(w => `<button type="button" data-aw="${w}" class="${st.weeks === w ? 'on' : ''}">${w} ${plural(w, W.week)}</button>`).join('')}</div>
      <label class="check mt"><input type="checkbox" data-ar ${st.replace ? 'checked' : ''}><span class="box">${ico('check')}</span><span class="ct">Заменить существующие планы программы в этот период</span></label>
      ${cons ? `<div class="note n-warn mt">${ico('warn')}<div>Есть тренировки в соседние дни. Тяговым мышцам нужно ~48 часов на восстановление — лучше чередовать дни.</div></div>` : ''}
      ${st.days.size > 4 ? `<div class="note n-warn mt">${ico('info')}<div>Больше 4 тренировок в неделю подходит только опытным атлетам.</div></div>` : ''}`);
    m.setFoot(`<button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-acc" data-ap-go ${st.days.size ? '' : 'disabled'}>Составить план</button>`);
  };
  m = openModal({
    title: 'Автоплан',
    onMount(box) {
      box.addEventListener('click', e => {
        const d = e.target.closest('[data-ap]'); if (d) { const i = +d.dataset.ap; st.days.has(i) ? st.days.delete(i) : st.days.add(i); return draw(); }
        const w = e.target.closest('[data-aw]'); if (w) { st.weeks = +w.dataset.aw; return draw(); }
        if (e.target.closest('[data-ap-go]')) {
          const t = todayKey(), trainedToday = (LG.derive().byDay[t] || {}).workouts > 0;
          let idx = LG.nextWorkout(P.id).idx, n = 0;
          for (let i = trainedToday ? 1 : 0; i < st.weeks * 7; i++) {
            const d = addDays(new Date(), i), k = dayKey(d);
            if (st.replace && S.plan[k]) { S.plan[k] = S.plan[k].filter(p => p.kind !== 'program' || p.done); if (!S.plan[k].length) delete S.plan[k]; }
            if (!st.days.has(wdIdx(d))) continue;
            (S.plan[k] = S.plan[k] || []).push({ id: uid(), kind: 'program', prog: P.id, idx, title: `${P.name} · ${P.workouts[idx].name}`, done: false });
            idx = (idx + 1) % P.workouts.length; n++;
          }
          S.ui.planCount = (S.ui.planCount || 0) + n; save(); m.close();
          toast(`Запланировано ${pl(n, W.work)} на ${pl(st.weeks, W.week)}`, 'ok'); LG.checkAch(); calRefresh();
        }
      });
      box.addEventListener('change', e => { if (e.target.matches('[data-ar]')) st.replace = e.target.checked; });
    }
  });
  draw();
};
