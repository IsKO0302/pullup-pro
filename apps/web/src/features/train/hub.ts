import { CH } from '../../components/charts';
import { emptyBox, kpi, pageHead } from '../../components/view';
import { ico } from '../../core/icons';
import { ROUTES } from '../../core/router';
import { S } from '../../core/state';
import { exCard } from '../exercises/library';
import { LG } from '../../services/logic';
import { TIER_NAME, exInGroup, exOf, tierOf } from '@pullup/shared/catalog/exercises';
import { CORE_DIRS, GROUPM, GROUPS } from '@pullup/shared/catalog/muscles';
import { PROGRAMS_V2, SLOTS, type SlotId } from '@pullup/shared/catalog/programs2';
import { GROUP_SLOTS, activeProgram, buildGroupWorkout, buildWorkout, doseLabel, nextIndex } from '@pullup/shared/engine';
import { groupStats, sessionGroups, sessionVolume, sortSessions } from '@pullup/shared/stats';
import { fmtDay, fmtDayShort, fmtSec, relDay } from '@pullup/shared/dates';
import { W, esc, fmtNum, pl } from '@pullup/shared/util';
import type { Group, Level } from '@pullup/shared/types';

/* ================= Тренировки: hub by muscle group + group pages (ЧАСТЬ 3) ================= */
const startG = (g: string, label = 'START TRAINING', cls = 'btn-acc') => `<button class="btn ${cls}" data-act="stGroup" data-g="${g}">${ico('play')}${label}</button>`;
ROUTES.train = {
  title: 'Тренировки',
  render() {
    const P = activeProgram(S as any), idx = nextIndex(S as any, P.id), nw = buildWorkout(S as any, P.id, idx);
    const cards = GROUPS.map(g => {
      const st = groupStats(S as any, g.id, 1), n = exInGroup(g.id).length, wk = st.weekly.length ? st.weekly[st.weekly.length - 1].sets : 0;
      return `<a class="grp-card" href="#/group/${g.id}"><div class="gc-top"><span class="gc-ico">${ico(g.icon)}</span><span class="tiny muted">${pl(n, W.ex)}</span></div>
        <div class="gc-en">${g.en}</div><div class="gc-n">${g.name}</div><div class="gc-d">${g.desc}</div>
        <div class="gc-m"><span>${st.last ? 'последняя: ' + relDay(st.last) : 'ещё не тренировали'}</span>${wk ? `<span class="acc">${pl(wk, W.set)} за неделю</span>` : ''}</div></a>`;
    }).join('');
    return pageHead('Тренировки', 'Персональная программа, тренировки по группам мышц, Muscle-Up и свои комплексы. Все упражнения — с анимацией техники.', `<button class="btn btn-acc" data-act="startMenu">${ico('play')}START TRAINING</button>`, 'ISA PERSONAL') + `
    ${nw ? `<div class="card accent train-next"><div class="row wrap between" style="gap:14px"><div><div class="eyebrow">Рекомендуем сегодня · Мой план</div><h2 class="disp" style="font-size:clamp(22px,2.6vw,30px);margin:2px 0">${esc(P.name)} · ${esc(nw.w.name)}</h2>
      <div class="small muted">${esc(nw.w.focus)} · ${nw.items.map(it => esc(exOf(it.ex).name)).join(' · ')}</div></div>
      <div class="btns"><button class="btn btn-acc btn-lg" data-act="stEngine" data-p="${P.id}" data-i="${idx}">${ico('play')}Начать</button><a class="btn" href="#/plan">${ico('target')}Мой план</a></div></div></div>` : ''}
    <div class="sec-t mt-l">Группы мышц</div>
    <div class="grp-grid">${cards}</div>
    <div class="grid g4 mt-l train-quick">
      <a class="card link" href="#/builder"><b>${ico('build')}Конструктор</b><div class="small muted">Соберите свою тренировку</div></a>
      <button class="card link" data-act="stFree"><b>${ico('plus')}Свободная</b><div class="small muted">Упражнения по ходу</div></button>
      <a class="card link" href="#/programs"><b>${ico('prog')}Программы 1.0</b><div class="small muted">Подтягивания по уровням</div></a>
      <button class="card link" data-act="testWizard"><b>${ico('test')}Тест уровня</b><div class="small muted">Максимум и вис</div></button>
    </div>`;
  }
};
const CORE_SLOT: Record<string, SlotId> = { stability: 'core_stab', rectus: 'core_rectus', obliques: 'core_obl', pelvis: 'core_pelvis' };
ROUTES.group = {
  title: id => GROUPM[id] ? `${GROUPM[id].en} · ${GROUPM[id].name}` : 'Группа',
  render(id) {
    const g = GROUPM[id as Group];
    if (!g) return emptyBox('Группа не найдена', '', 'search', '<a class="btn btn-sm" href="#/train">К тренировкам</a>');
    const xs = exInGroup(g.id), st = groupStats(S as any, g.id, 8), b = buildGroupWorkout(S as any, g.id);
    const tiers: Level[] = ['beginner', 'intermediate', 'advanced'];
    const progs = PROGRAMS_V2.filter(p => p.group === g.id || p.workouts.some(w => w.slots.some(sd => SLOTS[sd.slot] && SLOTS[sd.slot].group === g.id)));
    const hist = sortSessions(S.sessions as any).filter(s => sessionGroups(s).includes(g.id)).reverse().slice(0, 6);
    const M = g.id === 'muscleup' ? LG.muState() : null;
    const last = st.weekly.length - 1;
    const bestV = x => x.kind === 'time' ? fmtSec(x.v) : x.kind === 'kg' ? `+${fmtNum(x.v)} кг` : pl(x.v, W.rep);
    return `<a class="back" href="#/train">${ico('left')}Тренировки</a>
    <div class="grp-hero card accent"><div class="gh-ico">${ico(g.icon)}</div><div class="grow"><div class="eyebrow">${g.en}</div><h1 class="disp" style="font-size:clamp(28px,3.6vw,44px);margin:0">${g.name}</h1><p class="tx2" style="margin:8px 0 12px">${g.desc}</p>
      <div class="chips">${g.focus.map(f => `<span class="chip" style="cursor:default">${esc(f)}</span>`).join('')}</div>
      <div class="btns mt">${M && M.cur ? `<button class="btn btn-acc" data-act="stMu" data-n="${M.cur.n}">${ico('play')}Этап ${M.cur.n}: ${esc(M.cur.title)}</button><a class="btn" href="#/mu">${ico('bolt')}Путь Muscle-Up</a>` : startG(g.id, `Тренировка ${g.en}`)}</div></div></div>
    ${b.items.length ? `<div class="card mt"><div class="card-head"><h3>${ico('list')}Тренировка группы сегодня</h3><span class="hint">подобрано по уровню и оборудованию</span></div>
      <div class="ph-list">${b.items.map((it, i) => `<div class="ph-it"><span class="n">${i + 1}</span><span class="grow"><a href="#/library/${it.ex}">${esc(exOf(it.ex).name)}</a><span class="tiny muted" style="display:block">${esc(SLOTS[it.slot] && g.id !== 'mobility' ? SLOTS[it.slot].name : TIER_NAME[tierOf(exOf(it.ex))])}</span></span><b class="small nowrap">${doseLabel(it)}</b></div>`).join('')}</div></div>` : ''}
    ${g.id === 'core' ? `<div class="sec-t mt-l">4 направления корпуса</div><div class="grid g4">${CORE_DIRS.map(d => { const sl = SLOTS[CORE_SLOT[d.id]]; return `<div class="card tight"><b class="small">${esc(d.name)}</b><div class="tiny muted mt-s">${sl ? sl.ladder.map(x => esc(exOf(x.ex).name)).filter((v, i, a) => a.indexOf(v) === i).join(' → ') : ''}</div></div>`; }).join('')}</div>
      <div class="note n-warn mt">${ico('info')}<div>Упражнения на пресс укрепляют мышцы, но не сжигают жир локально на животе. Рельеф зависит от общего процента жира — питания, активности и сна.</div></div>` : ''}
    <div class="kpis mt-l">
      ${kpi('Тренировок', st.sessions.length, 'за 8 недель', 'cal')}
      ${kpi('Подходов', st.sets, 'за 8 недель', 'layers')}
      ${kpi(g.id === 'core' || g.id === 'mobility' ? 'Удержания' : 'Повторы', g.id === 'core' || g.id === 'mobility' ? fmtSec(st.hold) : fmtNum(st.reps), 'за 8 недель', g.id === 'core' ? 'timer' : 'repeat')}
      ${kpi('Последняя', st.last ? relDay(st.last) : '—', st.last ? fmtDay(st.last) : 'ещё не было', 'clock')}
    </div>
    <div class="grid g2 mt">
      <div class="card"><div class="card-head"><h3>${ico('chart')}Подходы по неделям</h3><span class="hint">8 недель</span></div>
        ${CH.slot({ type: 'bar', labels: st.weekly.map(w => fmtDayShort(w.wk)), tips: st.weekly.map(w => `Неделя с ${fmtDay(w.wk)}`), highlight: last, series: [{ name: 'Подходы', data: st.weekly.map(w => w.sets) }], emptyText: 'Пока нет тренировок этой группы', aria: 'Подходы по неделям' }, 200)}</div>
      <div class="card"><div class="card-head"><h3>${ico('trophy')}Лучшие результаты</h3></div>
        ${st.bests.length ? `<div class="stack s">${st.bests.slice(0, 6).map(x => `<div class="row between small"><a href="#/library/${x.ex}">${esc(exOf(x.ex).name)}</a><span><b class="acc">${bestV(x)}</b>${x.date ? ` <span class="tiny muted">${fmtDayShort(x.date)}</span>` : ''}</span></div>`).join('')}</div>` : '<p class="small muted" style="margin:0">Результаты появятся после первой тренировки.</p>'}</div>
    </div>
    ${tiers.map(t => { const list = xs.filter(e => tierOf(e) === t); return list.length ? `<div class="sec-t mt-l">${TIER_NAME[t]} уровень · ${list.length}</div><div class="ex-grid">${list.map(exCard).join('')}</div>` : ''; }).join('')}
    ${progs.length ? `<div class="sec-t mt-l">Программы с этой группой</div><div class="chips">${progs.map(p => `<a class="chip" href="#/plan" title="${esc(p.goal)}">${esc(p.name)}</a>`).join('')}</div>` : ''}
    <div class="card mt-l"><div class="card-head"><h3>${ico('list')}История</h3><a class="hint link-btn" href="#/journal">Журнал</a></div>
      ${hist.length ? `<div class="stack s">${hist.map(s => `<button class="row between small hist-row" data-act="calJr" data-id="${s.id}"><span><b>${esc(s.title)}</b><span class="tiny muted" style="display:block">${fmtDay(s.date)}</span></span><span class="muted">${pl(sessionVolume(s).byGroup[g.id] || 0, W.set)}</span></button>`).join('')}</div>` : '<p class="small muted" style="margin:0">Тренировок этой группы пока нет.</p>'}</div>`;
  }
};
export { GROUP_SLOTS };
