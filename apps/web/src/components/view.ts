import { FIG } from './figure';
import { openModal } from './modal';
import { lvlBars } from './ui';
import { $, $$ } from '../core/dom';
import { ACT } from '../core/events';
import { ico } from '../core/icons';
import { S } from '../core/state';
import { LG } from '../services/logic';
import { CATM, CATS, EX } from '@pullup/shared/catalog/exercises';
import { weekKey } from '@pullup/shared/dates';
import { pl } from '@pullup/shared/util';

/* ---------- shared view helpers ---------- */
export const pageHead = (title, sub = '', right = '', eyebrow = '') => `<div class="page-head"><div>${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}<h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${right ? `<div class="btns">${right}</div>` : ''}</div>`;
export const kpi = (l, v, s = '', i = '') => { const n = String(v).replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, '_').length; return `<div class="kpi"><div class="kpi-l">${i ? ico(i) : ''}${l}</div><div class="kpi-v${n > 12 ? ' long' : n > 8 ? ' mid' : ''}">${v}</div>${s ? `<div class="kpi-s">${s}</div>` : ''}</div>`; };
export const emptyBox = (t, s = '', i = 'info', btn = '') => `<div class="empty">${ico(i)}<b>${t}</b>${s}${btn ? `<div class="mt">${btn}</div>` : ''}</div>`;
export const SRC = { program: 'Программа', custom: 'Своя', mu: 'Muscle-Up', single: 'Упражнение', free: 'Свободная', manual: 'Вручную', quick: 'Быстрые', test: 'Тест уровня', engine: 'План', group: 'Группа мышц' };
export const segBtns = (act, opts, cur, attrs = '') => `<div class="seg" ${attrs}>${opts.map(([v, l]) => `<button type="button" data-act="${act}" data-v="${v}" class="${String(v) === String(cur) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
export const setSeg = el => $$('button', el.parentNode).forEach(b => b.classList.toggle('on', b === el));
export const goalFor = () => +S.profile.goalDaily || 0;
export function xpOfSession(s) { const st = LG.sessStats(s); return Math.round(st.pull * 2 + Math.max(0, st.reps - st.pull - st.mu) + st.hold * .2 + st.mu * 10 + (s.source === 'quick' ? 0 : (s.completed !== false ? 40 : 15))); }
ACT.figSpeed = el => { setSeg(el); const f = el.closest('.fig-box, .modal, .tr-main'); const fe = f && $('[data-fig]', f); if (fe) FIG.setSpeed(fe, +el.dataset.v); };
export const speedSeg = () => segBtns('figSpeed', [['0.5', '0.5×'], ['1', '1×'], ['1.5', '1.5×']], '1', 'aria-label="Скорость анимации" style="flex-wrap:nowrap;flex-shrink:0"');

/* ---------- exercise picker ---------- */
export function pickExercise(onPick, title = 'Выберите упражнение') {
  const st = { q: '', cat: 'all' };
  const list = () => {
    const q = st.q.trim().toLowerCase();
    const xs = EX.filter(e => (st.cat === 'all' || e.cat === st.cat) && (!q || (e.name + ' ' + e.muscles.join(' ')).toLowerCase().includes(q)));
    return xs.length ? xs.map(e => `<button class="pk" data-pk="${e.id}"><span class="li-ico">${ico(CATM[e.cat].icon)}</span><span class="pk-n">${e.name}<span class="pk-c" style="display:block">${CATM[e.cat].name} · ${e.type === 'time' ? 'на время' : 'на повторы'}</span></span>${lvlBars(e.lvl)}</button>`).join('') : emptyBox('Ничего не найдено', '', 'search');
  };
  openModal({
    title, cls: 'wide',
    body: `<div class="search" style="max-width:none">${ico('search')}<input class="inp" type="search" placeholder="Поиск упражнения" data-pq aria-label="Поиск упражнения"></div>
      <div class="chips mt">${[['all', 'Все'], ...CATS.map(c => [c.id, c.name])].map(([v, l]) => `<button class="chip ${v === 'all' ? 'on' : ''}" data-pc="${v}">${l}</button>`).join('')}</div>
      <div class="picker-list" data-pl>${list()}</div>`,
    onMount(box, m) {
      const pl = $('[data-pl]', box), inp = $('[data-pq]', box);
      inp.addEventListener('input', () => { st.q = inp.value; pl.innerHTML = list(); });
      box.addEventListener('click', e => {
        const c = e.target.closest('[data-pc]'); if (c) { st.cat = c.dataset.pc; $$('[data-pc]', box).forEach(x => x.classList.toggle('on', x === c)); pl.innerHTML = list(); return; }
        const p = e.target.closest('[data-pk]'); if (p) { m.close(); onPick(p.dataset.pk); }
      });
      if (window.innerWidth > 900) setTimeout(() => inp.focus(), 60);
    }
  });
}

/* ---------- start flow ---------- */
export function weekMuCount() { const wk = weekKey(new Date()); return S.sessions.filter(s => s.source === 'mu' && weekKey(s.date) === wk).length; }
