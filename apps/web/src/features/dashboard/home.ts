import { CH } from '../../components/charts';
import { FIG } from '../../components/figure';
import { toast } from '../../components/toast';
import { checkbox, pbar } from '../../components/ui';
import { emptyBox, goalFor, kpi } from '../../components/view';
import { AUD, buzz } from '../../core/audio';
import { $ } from '../../core/dom';
import { ACT } from '../../core/events';
import { ico } from '../../core/icons';
import { ROUTES, rerender } from '../../core/router';
import { S, save } from '../../core/state';
import { displayName } from '../../layouts/shell';
import { installBanner } from '../../services/pwa';
import { LG } from '../../services/logic';
import { exOf } from '@pullup/shared/catalog/exercises';
import { ACH, MOTTOS, TIPS } from '@pullup/shared/catalog/programs';
import { ACH2 } from '@pullup/shared/catalog/ach2';
import { coachTips } from '@pullup/shared/coach';
import { dailyMission } from '@pullup/shared/mission';
import { LEVEL_NAME, activeProgram, buildWorkout, deloadStatus, doseLabel, nextIndex, userLevel } from '@pullup/shared/engine';
import { daysActive, prHistory, summary, weekReport, weeklyActivity } from '@pullup/shared/stats';
import { WD, fmtDay, fmtDayShort, fmtDayW, fmtMin, fmtSec, parseDay, relDay, todayKey, wdIdx } from '@pullup/shared/dates';
import { W, esc, fmtNum, pl, uid } from '@pullup/shared/util';

/* ================= Dashboard 2.0 (ЧАСТЬ 9) ================= */
export let MOTTO_T: any = 0;
const TONE_I: Record<string, string> = { warn: 'n-warn', info: 'n-acc', ok: 'n-ok', up: 'n-acc' };
ROUTES.home = {
  title: 'Главная',
  render() {
    const D = LG.derive(), t = todayKey(), sm = summary(S as any, t), R = sm.results, name = displayName().toUpperCase();
    const P = activeProgram(S as any), idx = nextIndex(S as any, P.id), nw = buildWorkout(S as any, P.id, idx), r = LG.readiness(), dl = deloadStatus(S as any, t);
    const mission = dailyMission(S as any, t), tips = coachTips(S as any, t, 4), days = daysActive(S as any, 7, t), weeks = weeklyActivity(S as any, 8, t);
    const h = new Date().getHours(), greet = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
    const goal = goalFor(), dp = LG.dayPull(t), quickToday = S.sessions.find(x => x.source === 'quick' && x.date === t);
    const w = sm.weight, wd = sm.weight30, lp = sm.lastPR, prs = prHistory(S as any).slice(-3).reverse();
    const achAll = ACH.length + ACH2.length, achOn = Object.keys(S.ach).filter(k => ACH.some(a => a.id === k) || ACH2.some(a => a.id === k)).length;
    const plans = upcomingPlans(3), wr = weekReport(S as any, t);
    const prV = (x: any) => x.kind === 'time' ? fmtSec(x.v) : x.kind === 'kg' ? `+${fmtNum(x.v)} кг` : pl(x.v, W.rep);
    const ch7 = CH.slot({ type: 'bar', labels: days.map(d => WD[wdIdx(parseDay(d.day))]), tips: days.map(d => fmtDayW(d.day)), highlight: 6,
      series: [{ name: 'Подходы', data: days.map(d => d.sets) }], emptyText: 'За 7 дней тренировок нет — самое время начать', aria: 'Подходы за 7 дней' }, 190);
    const ch8 = CH.slot({ type: 'bar', labels: weeks.map(x => fmtDayShort(x.wk)), tips: weeks.map(x => `Неделя с ${fmtDay(x.wk)}`), highlight: weeks.length - 1,
      series: [{ name: 'Тренировки', data: weeks.map(x => x.workouts) }], goal: { value: sm.weekTarget, label: 'цель' }, emptyText: 'Пока нет тренировок', aria: 'Тренировки по неделям' }, 190);
    return `${installBanner()}
    <section class="hero hero2">
      <div class="hero-l">
        <div class="eyebrow">${greet} · ${LEVEL_NAME[userLevel(S as any)]}</div>
        <h1>${esc(name)}<span>PERSONAL</span></h1>
        <div class="hero-motto" id="motto">${MOTTOS[(new Date().getDate() + h) % MOTTOS.length]}</div>
        <div class="hero-sub">${nw ? `Следующая: <b>${esc(P.name)} · ${esc(nw.w.name)}</b> — ${esc(nw.w.focus)}.` : ''} ${esc(r.title)}.</div>
        <div class="hero-cta">
          <button class="btn btn-acc btn-xl" data-act="startMenu">${ico('play')}START TRAINING</button>
          <a class="btn btn-lg" href="#/plan">${ico('target')}Мой план</a>
        </div>
        <div class="hero-chips">
          <span class="badge b-acc">${ico('cal')}Неделя: ${sm.weekCount} / ${sm.weekTarget}</span>
          <a class="badge" href="#/profile">${ico('star')}Уровень ${D.level} · ${fmtNum(D.xp)} XP</a>
          <span class="badge">${ico('flame')}Регулярность: ${pl(sm.consistency, W.week)}</span>
        </div>
      </div>
      <div class="hero-r">${FIG.tag('hero', 'data-label="0"')}</div>
    </section>

    <div class="quick-acts mt">
      <button class="qa qa-acc" data-act="startMenu">${ico('play')}<b>START TRAINING</b><span>Начать тренировку</span></button>
      <a class="qa" href="#/journal/new">${ico('edit')}<b>LOG WORKOUT</b><span>Записать вручную</span></a>
      <button class="qa" data-act="bodyAdd">${ico('ruler')}<b>ADD BODY MEASUREMENT</b><span>Вес и обхваты</span></button>
      <a class="qa" href="#/stats">${ico('chart')}<b>VIEW PROGRESS</b><span>Графики и рекорды</span></a>
      <a class="qa" href="#/mu">${ico('bolt')}<b>MUSCLE-UP</b><span>Путь к выходу силой</span></a>
    </div>

    <div class="sec-t mt-l">Сегодня</div>
    <div class="grid g3">
      <div class="card ${mission.kind === 'train' ? 'accent' : ''}">
        <div class="card-head"><h3>${ico(mission.kind === 'train' ? 'flag' : mission.kind === 'done' ? 'check' : 'bed')}${esc(mission.title)}</h3><span class="hint">${mission.done}/${mission.items.length}</span></div>
        <p class="small muted" style="margin-top:-4px">${esc(mission.sub)}</p>
        ${pbar(mission.items.length ? mission.done / mission.items.length : 0, 'thin mb')}
        <div class="tasks stack s">${mission.items.map(x => x.auto
          ? `<div class="check auto ${x.done ? 'met' : ''}"><span class="box">${ico('check')}</span><span class="ct">${x.href ? `<a href="${x.href}">${esc(x.t)}</a>` : esc(x.t)}<span class="cs">${x.done ? 'выполнено' : 'отмечается автоматически'}</span></span></div>`
          : checkbox('missionTick', x.done, x.href ? `${esc(x.t)} <a class="tiny" href="${x.href}">открыть</a>` : esc(x.t), '', `data-id="${x.id}"`)).join('')}</div>
        ${dl.active ? `<div class="note n-ok mt small">${ico('bed')}<div>Разгрузочная неделя до ${fmtDay(dl.until)}.</div></div>` : ''}
      </div>
      <div class="card">
        <div class="card-head"><h3>${ico('bolt')}Следующая тренировка</h3><a class="hint link-btn" href="#/plan">${esc(P.name)}</a></div>
        ${nw ? `<div class="lv-title">${esc(nw.w.name)}</div><div class="eyebrow-s">${esc(nw.w.focus)}</div>
        <div class="next-ex">${nw.items.map(it => `<div><span>${esc(exOf(it.ex).name)}</span><span>${doseLabel(it)}</span></div>`).join('')}</div>
        <div class="ready ${r.lvl}"><span class="dotc"></span><div><b>${r.title}</b><div class="small muted">${r.reasons[0] || ''}</div></div></div>
        <button class="btn btn-acc btn-block mt" data-act="stEngine" data-p="${P.id}" data-i="${idx}">${ico('play')}Начать: ${esc(nw.w.name)}</button>` : emptyBox('Нет доступных упражнений', 'Укажите оборудование в профиле.', 'info', '<a class="btn btn-sm" href="#/profile">Профиль</a>')}
      </div>
      <div class="card">
        <div class="card-head"><h3>${ico('coach')}Тренер</h3><span class="hint">советы по вашим данным</span></div>
        ${tips.length ? `<div class="stack s">${tips.map(x => `<div class="note ${TONE_I[x.tone] || 'n-acc'} small coach-tip">${ico(x.icon)}<div><b>${esc(x.title)}</b> ${esc(x.text)}${x.href ? ` <a href="${x.href}">${esc(x.actLabel || 'Открыть')}</a>` : x.act ? ` <button class="link-btn" data-act="${x.act}">${esc(x.actLabel || 'Сделать')}</button>` : ''}</div></div>`).join('')}</div>`
          : '<p class="small muted" style="margin:0">Всё по плану. Продолжайте в том же ритме.</p>'}
      </div>
    </div>

    <div class="sec-t mt-l">Мой прогресс</div>
    <div class="kpis kpis6">
      ${kpi('Вес', w.v ? `${fmtNum(w.v)}<small>кг</small>` : '—', w.v ? (wd != null ? `${wd > 0 ? '+' : ''}${fmtNum(wd)} кг за 30 дней` : w.fromProfile ? 'из профиля' : fmtDay(w.date)) : '<a href="#/body">добавить</a>', 'weight')}
      ${kpi('Подтягивания', R.pull || '—', 'максимум за подход', 'prog')}
      ${kpi('Отжимания', R.push || '—', 'максимум за подход', 'push')}
      ${kpi('Планка', R.plank ? fmtSec(R.plank) : '—', 'лучшее удержание', 'timer')}
      ${kpi('Тренировок', sm.workouts, sm.totalMinutes ? `всего ${fmtMin(sm.totalMinutes * 60)}` : 'начните первую', 'cal')}
      ${kpi('Последний рекорд', lp ? prV(lp) : '—', lp ? `${esc(exOf(lp.ex).name)} · ${fmtDayShort(lp.date)}` : 'впереди', 'trophy')}
    </div>

    <div class="grid g2 mt">
      <div class="card"><div class="card-head"><h3>${ico('chart')}Активность за неделю</h3><span class="hint">подходы по дням</span></div>${ch7}</div>
      <div class="card"><div class="card-head"><h3>${ico('cal')}Тренировки по неделям</h3><span class="hint">цель: ${sm.weekTarget}</span></div>${ch8}</div>
    </div>

    <div class="grid g3 mt">
      <div class="card">
        <div class="card-head"><h3>${ico('trophy')}Рекорды и достижения</h3><a class="hint link-btn" href="#/achievements">${achOn} / ${achAll}</a></div>
        ${prs.length ? `<div class="stack s">${prs.map(x => `<div class="pr-line">${ico('trophy')}<span class="grow">${esc(exOf(x.ex).name)}: <b>${prV(x)}</b></span><span class="tiny muted">${fmtDayShort(x.date)}</span></div>`).join('')}</div>` : '<p class="small muted">Первые рекорды появятся после тренировок.</p>'}
        ${pbar(achAll ? achOn / achAll : 0, 'thin mt')}<a class="btn btn-sm btn-block mt" href="#/achievements">${ico('medal')}Все достижения</a>
      </div>
      <div class="card">
        <div class="card-head"><h3>${ico('report')}Отчёт недели</h3><a class="hint link-btn" href="#/report">Открыть</a></div>
        <div class="mini3"><div class="rec"><div class="rv">${wr.workouts}</div><div class="rl">тренировок</div></div><div class="rec"><div class="rv">${wr.sets}</div><div class="rl">подходов</div></div><div class="rec"><div class="rv">${wr.prs.length}</div><div class="rl">рекордов</div></div></div>
        <p class="small muted mt-s">Прошлая неделя: ${pl(wr.prev.workouts, W.work)}, ${pl(wr.prev.sets, W.set)}.</p>
        <a class="btn btn-sm btn-block" href="#/report">${ico('image')}Сохранить карточку недели</a>
      </div>
      <div class="card">
        ${goal > 0 ? `<div class="card-head"><h3>${ico('target')}Цель дня: подтягивания</h3><span class="hint">${dp} / ${goal}</span></div>
          ${pbar(dp / goal, (dp >= goal ? 'ok ' : '') + 'mb')}
          <div class="quick">${[1, 3, 5, 10].map(n => `<button class="btn btn-sm" data-act="quickAdd" data-n="${n}" aria-label="Добавить ${n}">+${n}</button>`).join('')}</div>
          ${quickToday ? `<button class="link-btn small mt-s" data-act="quickUndo">${ico('refresh')} Отменить последнее</button>` : ''}
          <div class="divider"></div>` : ''}
        <div class="card-head"><h3>${ico('cal')}Запланировано</h3><a class="hint link-btn" href="#/calendar">Календарь</a></div>
        ${plans.length ? `<div class="list">${plans.map(([k, p]) => `<div class="li"><div class="li-ico">${ico(p.kind === 'mu' ? 'zap' : p.kind === 'custom' ? 'build' : 'bolt')}</div><div class="li-main"><div class="li-t">${esc(p.title)}</div><div class="li-s">${fmtDayW(k)} · ${relDay(k)}</div></div></div>`).join('')}</div>`
          : `<p class="small muted" style="margin:0">Нет запланированных тренировок. <a href="#/calendar">Составить расписание</a></p>`}
      </div>
    </div>
    <div class="note n-warn mt-l">${ico('shield')}<div>Не тренируйтесь через боль. Острая боль в суставах — сигнал остановиться. PULLUP PRO не заменяет консультацию врача.</div></div>`;
  },
  mount() {
    clearInterval(MOTTO_T);
    let i = (new Date().getDate() + new Date().getHours()) % MOTTOS.length;
    MOTTO_T = setInterval(() => {
      const el = $('#motto'); if (!el) return clearInterval(MOTTO_T);
      el.classList.add('out');
      setTimeout(() => { i = (i + 1) % MOTTOS.length; el.textContent = MOTTOS[i]; el.classList.remove('out'); }, 420);
    }, 6500);
  }
};
ACT.missionTick = el => {
  const k = todayKey(), d = S.daily[k] || (S.daily[k] = {}); d.mission = d.mission || {}; d.mission[el.dataset.id] = el.checked; save(); rerender();
};
export function upcomingPlans(n) {
  const t = todayKey(), out = [];
  Object.keys(S.plan).filter(k => k >= t).sort().forEach(k => (S.plan[k] || []).forEach(p => { if (!p.done) out.push([k, p]); }));
  return out.slice(0, n);
}
export function quickSession(k, create?) {
  let s = S.sessions.find(x => x.source === 'quick' && x.date === k);
  if (!s && create) { s = { id: uid(), date: k, startedAt: Date.now(), title: 'Быстрые подтягивания', source: 'quick', ref: null, durationSec: 0, items: [{ ex: 'pullup', sets: [] }], feel: 0, pain: false, notes: '', completed: true, warmup: false }; S.sessions.push(s); }
  return s;
}
ACT.quickAdd = el => {
  const n = +el.dataset.n, k = todayKey(), goal = goalFor(), before = LG.dayPull(k);
  const s = quickSession(k, true); s.items[0].sets.push({ reps: n, weight: 0, done: true }); save();
  const after = LG.dayPull(k); AUD.tap(); buzz(20);
  toast(`+${n} · сегодня ${pl(after, W.pull)}`, 'ok', 1800);
  if (goal && before < goal && after >= goal) { AUD.done(); toast('Цель дня выполнена! +30 XP', 'xp', 3600); }
  LG.checkAch(); rerender();
};
ACT.quickUndo = () => {
  const s = quickSession(todayKey()); if (!s) return;
  const x = s.items[0].sets.pop();
  if (!s.items[0].sets.length) S.sessions = S.sessions.filter(v => v !== s);
  save(); toast(`Отменено: +${x ? x.reps : 0}`, 'info', 1800); rerender();
};
ACT.dayTask = el => { const k = todayKey(), d = S.daily[k] || (S.daily[k] = {}); d.tasks = d.tasks || {}; d.tasks[el.dataset.id] = el.checked; save(); LG.checkAch(); rerender(); };
ACT.recToggle = el => {
  const k = todayKey(); S.daily[k] = { ...(S.daily[k] || {}), recovery: el.checked }; save();
  toast(el.checked ? 'День восстановления: лёгкая мобилити, сон и прогулка' : 'Режим восстановления выключен', 'ok');
  LG.checkAch(); rerender();
};
ACT.nextTip = () => { S.ui.tip = ((S.ui.tip || 0) + 1) % TIPS.length; save(); const el = $('#tip'); if (el) el.textContent = TIPS[S.ui.tip]; };
