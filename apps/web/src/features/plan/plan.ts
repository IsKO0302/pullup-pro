import { openModal } from '../../components/modal';
import { toast } from '../../components/toast';
import { pbar } from '../../components/ui';
import { pageHead, segBtns } from '../../components/view';
import { ACT } from '../../core/events';
import { ico } from '../../core/icons';
import { ROUTES, rerender } from '../../core/router';
import { S, save } from '../../core/state';
import { EXM, TIER_NAME, exOf, tierOf } from '@pullup/shared/catalog/exercises';
import { GOALM, PROGRAMS_V2, PROGM_V2, PROGRESSION_RULES, SLOTS } from '@pullup/shared/catalog/programs2';
import { LEVEL_DESC, LEVEL_NAME, activeProgram, buildWorkout, ctxOf, declineDeload, deloadStatus, doseLabel, doseOf, lightAdvice, materialize, nextIndex, recommendProgram, resolveProposal, slotOptions, startDeload, suggestLevel, userLevel } from '@pullup/shared/engine';
import { daysBetween, fmtDay, fmtDayShort, todayKey } from '@pullup/shared/dates';
import { W, esc, pl } from '@pullup/shared/util';

/* ================= Мой план: personal program engine (ЧАСТЬ 4) ================= */
const KIND: Record<string, string> = { fullbody: 'FULL BODY', split: 'SPLIT', focus: 'FOCUS', mu: 'MUSCLE-UP' };
function whyRecommended(): string {
  const p = S.profile, days = +(p.weeklyTarget || 3), goals = (p.goals || []).map(g => GOALM[g] ? GOALM[g].name.toLowerCase() : '').filter(Boolean);
  const parts = [`${pl(days, W.work)} в неделю`];
  if (p.split && p.split !== 'pullup') parts.push('выбранный формат сплита');
  if (goals.length) parts.push('цели: ' + goals.slice(0, 2).join(', '));
  return parts.join(' · ');
}
const exLink = (id: string) => EXM[id] ? `<a href="#/library/${id}">${esc(exOf(id).name)}</a>` : esc(id);
ROUTES.plan = {
  title: 'Мой план',
  render() {
    const P = activeProgram(S as any), chosen = !!(S.engine && S.engine.program && PROGM_V2[S.engine.program]);
    const idx = nextIndex(S as any, P.id), lvl = userLevel(S as any), sl = suggestLevel(S as any), dl = deloadStatus(S as any), la = lightAdvice(S as any);
    const E: any = S.engine || {}, props = E.proposals || [], log = (E.log || []).slice(-12).reverse();
    const week = E.startedAt ? Math.floor(Math.max(0, daysBetween(E.startedAt, todayKey())) / 7) + 1 : 1;
    const built = P.workouts.map((_, i) => buildWorkout(S as any, P.id, i));
    const nw = built[idx];
    const start = (i: number, cls = 'btn-acc') => `<button class="btn ${cls}" data-act="stEngine" data-p="${P.id}" data-i="${i}">${ico('play')}${i === idx ? 'START TRAINING' : 'Начать'}</button>`;
    return pageHead('Мой <em>план</em>', 'Упражнения подбираются по уровню, результатам и оборудованию. Нагрузка растёт только после стабильных тренировок — и только с вашего согласия.', start(idx), 'ISA PERSONAL PLAN') + `
    ${chosen ? '' : `<div class="note n-acc mb">${ico('sparkle')}<div><b>Программа подобрана автоматически: ${esc(P.name)}.</b> Основание: ${esc(whyRecommended())}. Можно выбрать другую — история тренировок сохранится.<div class="mt-s"><button class="btn btn-sm" data-act="planPick">${ico('swap')}Выбрать программу</button> <button class="btn btn-sm btn-acc" data-act="planChoose" data-p="${P.id}">${ico('check')}Оставить ${esc(P.name)}</button></div></div></div>`}
    <div class="plan-hero card accent">
      <div class="ph-l">
        <div class="eyebrow">${KIND[P.kind] || 'PROGRAM'} · ${esc(P.en)}</div>
        <h2 class="disp ph-name">${esc(P.name)}</h2>
        <p class="tx2 small" style="margin:6px 0 10px">${esc(P.goal)}</p>
        <div class="row wrap" style="gap:6px"><span class="badge b-acc">${LEVEL_NAME[lvl]}</span><span class="badge">${ico('cal')}${esc(P.freq)}</span><span class="badge">${ico('timer')}${esc(P.dur)}</span>${chosen ? `<span class="badge">Неделя ${week}</span>` : ''}</div>
        <p class="small muted mt">${esc(P.desc)}</p>
        <div class="btns mt">${start(idx)}<button class="btn" data-act="planPick">${ico('swap')}Сменить программу</button></div>
      </div>
      <div class="ph-r">
        <div class="sec-t">Следующая тренировка · ${esc(nw ? nw.w.name : '')}</div>
        ${nw ? `<div class="tiny muted mb-s">${esc(nw.w.focus)}${nw.deload ? ' · разгрузка −40%' : ''}</div><div class="ph-list">${nw.items.map((it, i) => `<div class="ph-it"><span class="n">${i + 1}</span><span class="grow">${exLink(it.ex)}<span class="tiny muted" style="display:block">${esc(SLOTS[it.slot] ? SLOTS[it.slot].name : '')}</span></span><b class="small nowrap">${doseLabel(it)}</b></div>`).join('')}</div>` : '<div class="small muted">Нет доступных упражнений: проверьте оборудование в профиле.</div>'}
      </div>
    </div>
    ${dl.active ? `<div class="note n-ok mt">${ico('bed')}<div><b>Разгрузочная неделя до ${fmtDay(dl.until)}.</b> Объём снижен примерно на 40%, прогрессия на паузе. После разгрузки нагрузка вернётся автоматически.</div></div>` : ''}
    ${dl.due ? `<div class="card mt plan-alert"><div class="row wrap between" style="gap:12px"><div class="row" style="gap:12px;align-items:flex-start"><span class="li-ico acc">${ico('bed')}</span><div><b>Предлагаем разгрузочную неделю</b><div class="small muted">${esc(dl.reason || '')}</div></div></div><div class="btns"><button class="btn btn-acc btn-sm" data-act="planDeload">Начать разгрузку</button><button class="btn btn-ghost btn-sm" data-act="planDeloadNo">Не сейчас</button></div></div></div>` : ''}
    ${la.suggest && !dl.active ? `<div class="note n-warn mt">${ico('info')}<div><b>Сегодня рекомендуем лёгкую версию.</b> ${la.reasons.map(esc).join(' ')} Выберите «Лёгкая версия» в проверке самочувствия перед стартом.</div></div>` : ''}
    <div class="card mt-l"><div class="card-head"><h3>${ico('sparkle')}Предложения прогрессии</h3><span class="hint">${props.length ? pl(props.length, W.ex) : 'нет новых'}</span></div>
      ${props.length ? `<div class="stack s">${props.map(p => `<div class="prop-row"><span class="li-ico ${p.kind === 'easier' ? '' : 'acc'}">${ico(p.kind === 'easier' ? 'down' : p.kind === 'harder' ? 'up' : 'plus')}</span><div class="grow"><b class="small">${esc(p.text)}</b><div class="tiny muted">${p.kind === 'easier' ? 'Облегчение после двух невыполненных тренировок' : 'Две стабильные тренировки подряд: все подходы, запас 1+ повтор, RPE ≤ 8'} · ${fmtDayShort(p.date)}</div></div><div class="btns"><button class="btn btn-sm btn-acc" data-act="planProp" data-id="${p.id}" data-a="1">${ico('check')}Принять</button><button class="btn btn-sm btn-ghost" data-act="planProp" data-id="${p.id}" data-a="0">Позже</button></div></div>`).join('')}</div>`
      : `<p class="small muted" style="margin:0">Повышение появится после 2 тренировок подряд, где в упражнении выполнены все подходы с запасом 1+ повтор, RPE не выше 8 и без срыва техники. Оцените тренировку в конце — это главный сигнал для прогрессии.</p>`}
    </div>
    <div class="sec-t mt-l">Тренировки программы · цикл из ${P.workouts.length}</div>
    <div class="grid g-auto plan-ws">${built.map((b, i) => b ? `<div class="card ${i === idx ? 'cur' : ''}">
      <div class="card-head"><h3><span class="pw-id">${esc(b.w.id)}</span>${esc(b.w.name)}</h3>${i === idx ? '<span class="badge b-acc">Следующая</span>' : ''}</div>
      <div class="tiny muted mb-s">${esc(b.w.focus)}</div>
      <div class="ph-list">${b.items.map(it => `<div class="ph-it"><span class="grow">${exLink(it.ex)}<span class="tiny muted" style="display:block">${esc(SLOTS[it.slot] ? SLOTS[it.slot].name : '')} · ${TIER_NAME[tierOf(exOf(it.ex))]}</span></span><b class="small nowrap">${doseLabel(it)}</b>${it.options.length > 1 ? `<button class="btn btn-ghost btn-icon btn-sm" data-act="planSwap" data-slot="${it.slot}" data-ex="${it.ex}" aria-label="Заменить упражнение" title="Заменить">${ico('swap')}</button>` : ''}</div>`).join('')}</div>
      <div class="btns mt">${start(i, i === idx ? 'btn-acc btn-sm' : 'btn-sm')}</div></div>` : '').join('')}</div>
    <div class="grid g2 mt-l">
      <div class="card"><div class="card-head"><h3>${ico('star')}Уровень · ${LEVEL_NAME[lvl]}</h3><span class="hint">${S.profile.level ? 'выбран вручную' : 'определён автоматически'}</span></div>
        <p class="small tx2" style="margin-top:0">${LEVEL_DESC[lvl]}. Уровень определяется по нескольким показателям, не только по подтягиваниям.</p>
        <div class="stack s">${sl.parts.map(p => `<div><div class="row between tiny"><span>${esc(p.label)}</span><span class="muted">${p.score} / ${p.max}</span></div>${pbar(p.score / p.max, 'thin')}</div>`).join('')}</div>
        <div class="tiny muted mt-s">Рекомендация по показателям: <b>${LEVEL_NAME[sl.level]}</b></div>
        <div class="mt">${segBtns('planLevel', [['auto', 'Авто'], ['beginner', 'BEGINNER'], ['intermediate', 'INTERMEDIATE'], ['advanced', 'ADVANCED']], S.profile.level || 'auto', 'style="flex-wrap:wrap"')}</div></div>
      <div class="card"><div class="card-head"><h3>${ico('list')}Правила прогрессии</h3></div><ol class="ol small">${(P.rules || PROGRESSION_RULES).map(r => `<li>${esc(r)}</li>`).join('')}</ol></div>
    </div>
    <div class="card mt-l"><div class="card-head"><h3>${ico('clock')}История изменений нагрузки</h3><span class="hint">прозрачно: что и почему изменилось</span></div>
      ${log.length ? `<div class="stack s">${log.map(l => `<div class="row small" style="gap:10px"><span class="muted nowrap" style="min-width:60px">${fmtDayShort(l.date)}</span><span>${esc(l.text)}</span></div>`).join('')}</div>` : '<p class="small muted" style="margin:0">Пока изменений не было. Здесь появятся повышения, облегчения, замены и разгрузочные недели.</p>'}
    </div>
    <p class="small muted mt">Программы подтягиваний PULLUP PRO 1.0 (BEGINNER / INTERMEDIATE / ADVANCED) по-прежнему доступны в разделе <a href="#/programs">Программы</a>.</p>`;
  }
};
ACT.planPick = () => {
  const cur = activeProgram(S as any).id, rec = recommendProgram(S as any);
  openModal({
    title: 'Выбор программы', cls: 'wide',
    body: `<div class="stack s">${PROGRAMS_V2.map(p => `<button class="opt ${p.id === cur ? 'acc' : ''}" data-close data-act="planChoose" data-p="${p.id}"><span class="li-ico ${p.id === cur ? 'acc' : ''}">${ico(p.kind === 'mu' ? 'bolt' : p.kind === 'focus' ? 'target' : 'fullbody')}</span><span class="grow"><b>${esc(p.name)}</b>${p.id === rec ? ' <span class="badge b-acc">рекомендуем</span>' : ''}<span class="small muted" style="display:block">${esc(p.goal)}</span><span class="tiny muted" style="display:block">${esc(p.freq)} · ${esc(p.dur)}</span></span>${p.id === cur ? ico('check', 'acc') : ico('right', 'muted')}</button>`).join('')}</div>
      <p class="tiny muted mt">Смена программы не удаляет журнал и рекорды. Дозировки упражнений сохраняются и переносятся в новую программу.</p>`
  });
};
ACT.planChoose = el => {
  const P = PROGM_V2[el.dataset.p]; if (!P) return;
  S.engine = S.engine || {}; const changed = S.engine.program !== P.id;
  S.engine.program = P.id; if (changed || !S.engine.startedAt) { S.engine.startedAt = todayKey(); (S.engine.log = S.engine.log || []).push({ date: todayKey(), ex: '', text: `Выбрана программа ${P.name}` }); }
  save(); toast(`Программа: ${esc(P.name)}`, 'ok'); rerender();
};
ACT.planSwap = el => {
  const slot = el.dataset.slot, c = ctxOf(S as any), opts = slotOptions(slot, c), cur = el.dataset.ex, has = !!(S.engine && S.engine.swaps && S.engine.swaps[slot]);
  openModal({
    title: `Замена · ${esc(SLOTS[slot].name)}`, cls: 'wide',
    body: `<p class="small muted" style="margin-top:-4px">Варианты движения с учётом вашего оборудования, от простого к сложному.</p>
      <div class="picker-list">${opts.map(x => { const e = exOf(x), d = materialize(x, doseOf(x, c), c); return `<button class="pk ${x === cur ? 'on' : ''}" data-close data-act="planSwapSet" data-slot="${slot}" data-x="${x}"><span class="li-ico ${x === cur ? 'acc' : ''}">${ico(x === cur ? 'check' : 'swap')}</span><span class="pk-n">${esc(e.name)}<span class="pk-c" style="display:block">${TIER_NAME[tierOf(e)]} · ${doseLabel(d)}</span></span></button>`; }).join('')}
      ${has ? `<button class="pk" data-close data-act="planSwapSet" data-slot="${slot}" data-x=""><span class="li-ico">${ico('refresh')}</span><span class="pk-n">Автоматический выбор<span class="pk-c" style="display:block">Самое сложное подходящее по уровню и результатам</span></span></button>` : ''}</div>`
  });
};
ACT.planSwapSet = el => {
  S.engine = S.engine || {}; const sw = S.engine.swaps = S.engine.swaps || {}, slot = el.dataset.slot, x = el.dataset.x;
  if (x) sw[slot] = x; else delete sw[slot];
  (S.engine.log = S.engine.log || []).push({ date: todayKey(), ex: x || '', text: x ? `Замена: ${SLOTS[slot].name} → ${exOf(x).name}` : `${SLOTS[slot].name}: автоматический выбор` });
  save(); toast(x ? `Замена сохранена: ${esc(exOf(x).name)}` : 'Автоматический выбор', 'ok'); rerender();
};
ACT.planProp = el => {
  const p = resolveProposal(S as any, el.dataset.id, el.dataset.a === '1'); if (!p) return;
  save(); toast(el.dataset.a === '1' ? `Принято: ${esc(p.text)}` : 'Предложение отложено — оценим следующие тренировки', el.dataset.a === '1' ? 'ok' : 'info', 3500); rerender();
};
ACT.planDeload = () => { startDeload(S as any); save(); toast('Разгрузочная неделя началась: объём −40%', 'ok'); rerender(); };
ACT.deloadStart = () => ACT.planDeload();
ACT.planDeloadNo = () => { declineDeload(S as any); save(); toast('Напомним через неделю', 'info'); rerender(); };
ACT.planLevel = el => { const v = el.dataset.v; if (v === 'auto') delete S.profile.level; else S.profile.level = v; save(); toast(`Уровень: ${v === 'auto' ? 'автоматически' : LEVEL_NAME[v]}`, 'ok', 1600); rerender(); };
