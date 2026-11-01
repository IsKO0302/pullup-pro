import { CH } from '../../components/charts';
import { periodName, periodSeg, periodSince } from '../../components/period';
import { pbar } from '../../components/ui';
import { goalFor, kpi, pageHead, segBtns, setSeg } from '../../components/view';
import { $ } from '../../core/dom';
import { ACT } from '../../core/events';
import { ico } from '../../core/icons';
import { ROUTES, rerender } from '../../core/router';
import { S } from '../../core/state';
import { LG } from '../../services/logic';
import { ACH, PROGM, PROGRAMS, TITLES, XP_RULES } from '@pullup/shared/catalog/programs';
import { MONTHS, MONTHS_S, WD, addDays, dayKey, fmtDay, fmtDayShort, fmtDayW, fmtMin, pad, parseDay, startOfWeek, todayKey } from '@pullup/shared/dates';
import { W, esc, fmtNum, pl, plural, round1 } from '@pullup/shared/util';
import { exOf } from '@pullup/shared/catalog/exercises';
import { strengthChanges } from '@pullup/shared/report';
import { isWorkout, prHistory, sessionVolume, weeklyActivity, weightSeries } from '@pullup/shared/stats';
import { daysBetween, fmtSec } from '@pullup/shared/dates';

/* ================= Statistics, levels, achievements ================= */
export const STV = { vol: 'reps', period: '90' };
ROUTES.stats = {
  title: 'Прогресс',
  render() {
    const D = LG.derive(), now = new Date(), goal = goalFor(), P = PROGM[S.profile.program] || PROGRAMS[0];
    const wks = Array.from({ length: 12 }, (_, i) => dayKey(addDays(startOfWeek(now), (i - 11) * 7)));
    const wkv = k => D.byWeek[k] || { n: 0, pull: 0, reps: 0, ton: 0, dur: 0 };
    const wkLab = wks.map(k => fmtDayShort(k)), wkTip = wks.map(k => `Неделя с ${fmtDay(k)}`);
    const mx = Object.entries<any>(D.maxSeries).sort((a, b) => a[0] < b[0] ? -1 : 1), tBy = {};
    S.tests.forEach(x => { tBy[x.date] = Math.max(tBy[x.date] || 0, x.pullups || 0); });
    let runBest = 0; const bestLine = mx.map(([, v]) => (runBest = Math.max(runBest, v)));
    const exitMax = (P.exit.find(x => x.metric === 'max') || {}).target;
    const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; });
    const mv = m => Object.entries<any>(D.byDay).filter(([k]) => k.startsWith(m)).reduce((a, [, v]) => (a.pull += v.pull, a.n += v.workouts, a), { pull: 0, n: 0 });
    const d30 = Array.from({ length: 30 }, (_, i) => dayKey(addDays(now, i - 29)));
    const unlocked = ACH.filter(a => S.ach[a.id]).length, lvPct = (D.xp - D.lvlFrom) / Math.max(1, D.lvlTo - D.lvlFrom);
    const avg = D.tot.workouts ? Math.round(D.tot.pull / D.tot.workouts) : 0;
    const M = LG.muState();
    return pageHead('Прогресс', 'Результаты, рекорды и изменения силы по вашему журналу, тестам и замерам. Наведите или нажмите на график, чтобы увидеть значения.', `<a class="btn" href="#/report">${ico('report')}Отчёт недели</a><a class="btn" href="#/journal">${ico('list')}Журнал</a>`, 'PROGRESS') + overview() + `
    <div class="sec-t mt-l">Подтягивания и XP · PULLUP PRO 1.0</div>
    <div class="kpis">
      ${kpi('Подтягиваний', fmtNum(D.tot.pull), `в среднем ${avg} за тренировку`, 'prog')}
      ${kpi('Тренировок', D.tot.workouts, `время: ${fmtMin(D.tot.dur)}`, 'cal')}
      ${kpi('Максимум', D.rec.maxPull, D.rec.maxPullDate ? `рекорд · ${fmtDay(D.rec.maxPullDate)}` : (D.rec.maxPull ? 'из профиля' : 'пройдите тест'), 'trophy')}
      ${kpi('Серия', `${D.streak}<small>${plural(D.streak, W.week)}</small>`, `лучшая: ${D.bestStreak}`, 'flame')}
    </div>
    <div class="kpis mt">
      ${kpi('Тоннаж', `${fmtNum(D.tot.ton / 1000)}<small>т</small>`, 'подтягивания × (вес тела + отягощение)', 'weight')}
      ${kpi('Удержания', fmtMin(D.tot.hold), 'висы, планки, уголки', 'timer')}
      ${kpi('Выходы силой', D.tot.mu, D.rec.maxMuSet ? `рекорд подхода: ${D.rec.maxMuSet}` : 'пока впереди', 'zap')}
      ${kpi('Тесты уровня', S.tests.length, S.tests.length ? `последний: ${fmtDayShort([...S.tests].sort((a, b) => a.date < b.date ? 1 : -1)[0].date)}` : 'пройдите первый', 'test')}
    </div>
    <div class="grid g2 mt-l">
      <div class="card"><div class="card-head"><h3>${ico('trophy')}Максимум подтягиваний</h3><span class="hint">тесты и строгие подходы прямым хватом</span></div>
        ${CH.slot({ type: 'line', labels: mx.map(([k]) => fmtDayShort(k)), tips: mx.map(([k]) => fmtDay(k)), series: [{ name: 'Лучший результат', data: bestLine, fmt: v => `${v} ${plural(v, W.rep)}` }, { name: 'Тест уровня', data: mx.map(([k]) => tBy[k] || null), color: '#c2c2cb', dash: [5, 5], noFill: true }],
          goal: exitMax ? { value: exitMax, label: `цель ${P.name}` } : null, legend: true, emptyText: 'Пройдите тест уровня или запишите подход подтягиваний прямым хватом', aria: 'График максимума' }, 240)}</div>
      <div class="card"><div class="card-head"><h3>${ico('cal')}Тренировок в неделю</h3><span class="hint">цель: ${S.profile.weeklyTarget}</span></div>
        ${CH.slot({ type: 'bar', labels: wkLab, tips: wkTip, highlight: 11, series: [{ name: 'Тренировки', data: wks.map(k => wkv(k).n) }], goal: { value: +S.profile.weeklyTarget || 3, label: 'цель' }, emptyText: 'За 12 недель тренировок нет', aria: 'Тренировки по неделям' }, 240)}</div>
      <div class="card"><div class="card-head"><h3>${ico('chart')}Объём по неделям</h3>${segBtns('statVol', [['reps', 'Повторы'], ['ton', 'Тоннаж, кг']], STV.vol)}</div>
        <div id="vol-chart">${volChart(wks, wkLab, wkTip, wkv)}</div></div>
      <div class="card"><div class="card-head"><h3>${ico('sun')}Подтягивания за 30 дней</h3><span class="hint">${goal ? `линия — цель дня ${goal}` : ''}</span></div>
        ${CH.slot({ type: 'bar', labels: d30.map(k => parseDay(k).getDate()), tips: d30.map(k => fmtDayW(k)), highlight: 29, series: [{ name: 'Подтягивания', data: d30.map(k => (D.byDay[k] || {}).pull || 0) }], goal: goal ? { value: goal, label: 'цель' } : null, emptyText: 'За 30 дней подтягиваний нет', aria: 'Подтягивания по дням' }, 240)}</div>
      <div class="card"><div class="card-head"><h3>${ico('cal')}По месяцам</h3><span class="hint">6 месяцев</span></div>
        ${CH.slot({ type: 'bar', labels: months.map(m => MONTHS_S[+m.slice(5) - 1]), tips: months.map(m => `${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)}`), highlight: 5, series: [{ name: 'Подтягивания', data: months.map(m => mv(m).pull) }], extra: i => `<div class="tiny muted">Тренировок: ${mv(months[i]).n}</div>`, emptyText: 'Пока нет данных по месяцам', aria: 'Подтягивания по месяцам' }, 240)}</div>
      <div class="card"><div class="card-head"><h3>${ico('grid')}Активность</h3><span class="hint">16 недель</span></div>${heatmap(D)}</div>
    </div>
    <div class="grid g2 mt-l">
      <div class="card"><div class="card-head"><h3>${ico('bolt')}Путь к Muscle-Up</h3><a class="hint link-btn" href="#/mu">Открыть</a></div>
        <div class="timeline">${M.st.map(s => `<div class="tl ${s.done ? 'done' : M.cur && M.cur.n === s.n ? 'cur' : ''}"><span class="dt"></span><div><b class="small">Этап ${s.n} · ${s.title}</b><div class="tiny muted">${s.done ? 'пройден' : M.cur && M.cur.n === s.n ? `в процессе · критерии ${s.met}/${s.crit.length}` : 'впереди'}</div></div><span class="small ${s.done ? 'ok' : 'muted'}">${s.done ? fmtDayShort(S.mu.done[s.n]) : '—'}</span></div>`).join('')}</div></div>
      <div class="card"><div class="card-head"><h3>${ico('star')}Уровень и XP</h3><span class="hint">${fmtNum(D.xp)} XP</span></div>
        <div class="lv row"><div class="lv-badge">${D.level}</div><div class="grow"><div class="lv-title">${esc(D.title)}</div><div class="small muted">до уровня ${D.level + 1}: ${fmtNum(D.lvlTo - D.xp)} XP</div>${pbar(lvPct, 'mt-s')}</div></div>
        <div class="lvl-ladder mt">${TITLES.map(([l, t], i) => { const nx = TITLES[i + 1]; const cur = D.level >= l && (!nx || D.level < nx[0]); return `<div class="lvl-step ${D.level >= l ? 'on' : ''} ${cur ? 'cur' : ''}"><b>${t}</b><span>уровень ${l}+</span></div>`; }).join('')}</div>
        <div class="tbl-wrap mt"><table class="tbl"><thead><tr><th>За что начисляется</th><th style="text-align:right">XP</th></tr></thead><tbody>${XP_RULES.map(([a, b]) => `<tr><td>${a}</td><td style="text-align:right"><b class="acc">${b}</b></td></tr>`).join('')}</tbody></table></div></div>
    </div>
    <a class="card mt-l link-card" href="#/achievements"><span class="li-ico acc">${ico('medal')}</span><div class="grow"><b>Достижения</b><div class="small muted">Открыто ${Object.keys(S.ach).length} · ACHIEVEMENTS 2.0 и классические награды</div></div>${ico('right', 'muted')}</a>`;
  }
};
/* ---------- Progress 2.0 overview: period filter, weekly results, strength changes, PR history ---------- */
function overview() {
  const per = STV.period, since = periodSince(per), t = todayKey();
  const ws = S.sessions.filter(s => isWorkout(s as any) && (!since || s.date >= since));
  let sets = 0, reps = 0, minutes = 0; for (const s of ws) { const v = sessionVolume(s as any); sets += v.sets; reps += v.reps; minutes += Math.round((s.durationSec || 0) / 60); }
  const prs = prHistory(S as any).filter(p => !since || p.date >= since), wser = weightSeries(S as any), wIn = wser.filter(p => !since || p.date >= since);
  const wBase = since ? ([...wser].reverse().find(p => p.date < since) || wIn[0]) : wser[0], wLast = wser[wser.length - 1];
  const wDelta = wBase && wLast && wLast !== wBase ? round1(wLast.v - wBase.v) : null;
  const first = S.sessions.length ? S.sessions.reduce((a, s) => s.date < a ? s.date : a, t) : t;
  const weeks = Math.max(4, Math.min(per === 'all' ? 104 : 52, Math.ceil((per === 'all' ? daysBetween(first, t) + 1 : +per) / 7)));
  const rows = weeklyActivity(S as any, weeks), lab = rows.map(r => fmtDayShort(r.wk)), tips = rows.map(r => `Неделя с ${fmtDay(r.wk)}`);
  const used = [...new Set(ws.flatMap(s => (s.items || []).map(it => it.ex)))].filter(ex => !['pullup', 'pushup', 'plank', 'squat', 'dips', 'hang'].includes(ex));
  const ch = strengthChanges(S as any, since, used.slice(0, 40)).sort((a, b) => (b.delta > 0 ? 1 : 0) - (a.delta > 0 ? 1 : 0)).slice(0, 12);
  const val = (k: string, v: number) => k === 'time' ? fmtSec(v) : fmtNum(v);
  const prVal = p => p.kind === 'time' ? fmtSec(p.v) : p.kind === 'kg' ? `+${fmtNum(p.v)} кг` : fmtNum(p.v);
  const prPrev = p => p.kind === 'time' ? fmtSec(p.prev) : p.kind === 'kg' ? `+${fmtNum(p.prev)} кг` : fmtNum(p.prev);
  return `<div class="row wrap between mb">${periodSeg('statPer', per)}<span class="tiny muted">${periodName(per)}${since ? ` · с ${fmtDay(since)}` : ''}</span></div>
    <div class="kpis kpis6">
      ${kpi('Тренировки', fmtNum(ws.length), `за ${periodName(per).toLowerCase()}`, 'cal')}
      ${kpi('Подходы', fmtNum(sets), 'выполненные', 'layers')}
      ${kpi('Повторения', fmtNum(reps), 'все упражнения', 'repeat')}
      ${kpi('Время', fmtMin(minutes * 60), 'тренировок', 'clock')}
      ${kpi('Рекорды', fmtNum(prs.length), prs.length ? `последний ${fmtDayShort(prs[prs.length - 1].date)}` : 'пока без новых', 'trophy')}
      ${kpi('Вес', wLast ? `${fmtNum(wLast.v)}<small>кг</small>` : '—', wDelta != null ? `${wDelta > 0 ? '+' : ''}${fmtNum(wDelta)} кг за период` : (wLast ? 'нужен ещё замер' : 'нет замеров'), 'weight')}
    </div>
    <div class="grid g2 mt-l">
      <div class="card"><div class="card-head"><h3>${ico('chart')}Результаты по неделям</h3><span class="hint">тренировки и подходы</span></div>
        ${CH.slot({ type: 'bar', labels: lab, tips, highlight: rows.length - 1, series: [{ name: 'Подходы', data: rows.map(r => r.sets) }], extra: i => `<div class="tiny muted">Тренировок: ${rows[i].workouts} · минут: ${rows[i].minutes}</div>`, emptyText: 'За период нет тренировок', aria: 'Подходы по неделям' }, 240)}</div>
      <div class="card"><div class="card-head"><h3>${ico('weight')}Вес тела</h3><a class="hint link-btn" href="#/body/charts">Все графики тела</a></div>
        ${wIn.length >= 2 ? CH.slot({ type: 'line', labels: wIn.map(p => fmtDayShort(p.date)), tips: wIn.map(p => fmtDay(p.date)), series: [{ name: 'Вес', data: wIn.map(p => p.v), fmt: v => `${fmtNum(v)} кг` }], aria: 'Вес за период' }, 240) : `<div class="chart-empty" style="height:240px">${ico('weight')}<span>Нужно минимум 2 замера веса за период</span><button class="btn btn-sm" data-act="bodyAdd">${ico('plus')}Записать вес</button></div>`}</div>
    </div>
    <div class="grid g2 mt">
      <div class="card"><div class="card-head"><h3>${ico('bolt')}Изменения силы</h3><span class="hint">лучший подход: до периода → за период</span></div>
        ${ch.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Упражнение</th><th style="text-align:right">Было</th><th style="text-align:right">Стало</th><th style="text-align:right">Δ</th></tr></thead><tbody>${ch.map(c => `<tr><td><a class="link-btn" href="#/library/${esc(c.ex)}">${esc(c.label)}</a></td><td style="text-align:right" class="muted">${c.before ? val(c.kind, c.before) : '—'}</td><td style="text-align:right"><b>${val(c.kind, c.now)}</b></td><td style="text-align:right" class="${c.delta > 0 ? 'ok' : c.delta < 0 ? 'bad' : 'muted'}">${c.before ? (c.delta > 0 ? '+' : c.delta < 0 ? '−' : '±') + val(c.kind, Math.abs(c.delta)) : 'новое'}</td></tr>`).join('')}</tbody></table></div>
          <div class="tiny muted mt-s">Без отягощения. «Новое» — упражнения, которых не было до начала периода.</div>` : `<div class="small muted">За период нет подходов в ключевых упражнениях.</div>`}</div>
      <div class="card"><div class="card-head"><h3>${ico('trophy')}История рекордов</h3><span class="hint">${pl(prs.length, ['рекорд', 'рекорда', 'рекордов'])}</span></div>
        ${prs.length ? `<div class="stack s">${prs.slice(-14).reverse().map(p => `<div class="pr-row"><span class="li-ico acc">${ico(p.test ? 'test' : 'trophy')}</span><div class="grow" style="min-width:0"><b class="small ell">${esc(exOf(p.ex).name)}</b><div class="tiny muted">${fmtDay(p.date)}${p.test ? ' · тест уровня' : ''}</div></div><span class="small nowrap"><span class="muted">${prPrev(p)} →</span> <b class="acc">${prVal(p)}</b></span></div>`).join('')}</div>` : `<div class="small muted">Рекорд — результат лучше предыдущего лучшего в том же упражнении. За период их нет.</div>`}</div>
    </div>`;
}
ACT.statPer = el => { STV.period = el.dataset.v; rerender(); };
export function volChart(wks, lab, tip, wkv) {
  const ton = STV.vol === 'ton';
  return CH.slot({ type: 'bar', labels: lab, tips: tip, highlight: 11, series: ton ? [{ name: 'Тоннаж', data: wks.map(k => Math.round(wkv(k).ton)), fmt: v => `${fmtNum(v)} кг` }] : [{ name: 'Подтягивания', data: wks.map(k => wkv(k).pull) }, { name: 'Другие повторы', data: wks.map(k => Math.max(0, wkv(k).reps - wkv(k).pull)), color: '#5f5f6a' }],
    stacked: !ton, legend: !ton, fmt: ton ? (v => v >= 1000 ? `${fmtNum(v / 1000)}т` : fmtNum(v)) : null, emptyText: 'За 12 недель нет объёма', aria: 'Объём по неделям' }, 240);
}
ACT.statVol = el => {
  STV.vol = el.dataset.v; setSeg(el);
  const D = LG.derive(), wks = Array.from({ length: 12 }, (_, i) => dayKey(addDays(startOfWeek(new Date()), (i - 11) * 7))), wkv = k => D.byWeek[k] || { n: 0, pull: 0, reps: 0, ton: 0 };
  const c = $('#vol-chart'); c.innerHTML = volChart(wks, wks.map(k => fmtDayShort(k)), wks.map(k => `Неделя с ${fmtDay(k)}`), wkv); CH.mountAll(c);
};
export function heatmap(D) {
  const t = todayKey(), start = addDays(startOfWeek(new Date()), -15 * 7);
  let cells = '';
  for (let i = 0; i < 16 * 7; i++) {
    const k = dayKey(addDays(start, i)), v = D.byDay[k], p = v ? v.pull : 0, w = v ? v.workouts : 0;
    const l = k > t ? 'fut' : p >= 60 ? 'l4' : p >= 35 ? 'l3' : p >= 15 ? 'l2' : (p > 0 || w > 0) ? 'l1' : '';
    cells += `<i class="${l}" title="${fmtDayW(k)}: ${p} подтяг.${w ? `, ${pl(w, W.work)}` : ''}"></i>`;
  }
  return `<div class="heat-wrap"><div class="heat-days">${WD.map((d, i) => `<span>${i % 2 === 0 ? d : ''}</span>`).join('')}</div><div class="heat" style="grid-auto-columns:minmax(13px,1fr)">${cells}</div></div>
    <div class="row between mt"><span class="tiny muted">${fmtDayShort(dayKey(start))} — сегодня</span><span class="row tiny muted" style="gap:4px">меньше <span class="heat" style="display:flex;gap:3px;overflow:visible"><i style="width:12px;min-width:12px"></i><i class="l1" style="width:12px;min-width:12px"></i><i class="l2" style="width:12px;min-width:12px"></i><i class="l3" style="width:12px;min-width:12px"></i><i class="l4" style="width:12px;min-width:12px"></i></span> больше</span></div>`;
}
