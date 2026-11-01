import { CH } from '../components/charts';
import { FIG } from '../components/figure';
import { animateRings } from '../components/ui';
import { emptyBox } from '../components/view';
import { $ } from './dom';
import { updateShell } from '../layouts/shell';
import { esc } from '@pullup/shared/util';
import { S } from './state';
import { ico } from './icons';

/* ================= App shell: router, navigation, shared view helpers ================= */
export const ROUTES: Record<string, any> = {};
export const NAV: { r?: string; t?: string; i?: string; sep?: number }[] = [
  { r: 'home', t: 'Главная', i: 'home' }, { r: 'train', t: 'Тренировки', i: 'fullbody' }, { r: 'plan', t: 'Мой план', i: 'target' },
  { r: 'programs', t: 'Программы', i: 'prog' }, { r: 'mu', t: 'Muscle-Up', i: 'bolt' }, { r: 'library', t: 'Библиотека', i: 'book' },
  { r: 'journal', t: 'Журнал', i: 'list' }, { r: 'stats', t: 'Прогресс', i: 'chart' }, { r: 'body', t: 'Тело', i: 'ruler' },
  { r: 'nutrition', t: 'Питание', i: 'apple' }, { r: 'calendar', t: 'Календарь', i: 'cal' }, { r: 'builder', t: 'Конструктор', i: 'build' },
  { sep: 1 }, { r: 'profile', t: 'Профиль', i: 'user' }, { r: 'achievements', t: 'Достижения', i: 'trophy' }, { r: 'settings', t: 'Настройки', i: 'gear' }
];
/** parent section for sub-pages (highlights the right nav entry) */
export const NAV_PARENT: Record<string, string> = { group: 'train', report: 'stats' };
export let CUR = { name: 'home', params: [] };
export function parseHash() {
  const parts = (location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map(x => { try { return decodeURIComponent(x); } catch (e) { return x; } });
  return ROUTES[parts[0]] ? { name: parts[0], params: parts.slice(1) } : { name: 'home', params: [] };
}
export function go(h) { if (location.hash === h) render(); else location.hash = h; }
export function render(keep?) {
  const r = parseHash(), R = ROUTES[r.name], view = $('#view');
  const same = keep && CUR.name === r.name && CUR.params.join('/') === r.params.join('/'), y = window.scrollY;
  CUR = r; CH.reset();
  let html;
  try { html = R.render(...r.params); } catch (e) { console.error(e); html = emptyBox('Не удалось открыть раздел', esc(e.message), 'warn', '<a class="btn btn-sm" href="#/home">На главную</a>'); }
  // labelled demo data (ЧАСТЬ 20: no unlabelled mock data) — visible on every page
  if (S.meta && S.meta.demo) html = `<div class="demo-strip" role="status">${ico('sparkle')}<span><b>ДЕМО-ДАННЫЕ</b> — пример, а не ваши тренировки</span><button class="btn btn-sm" data-act="demoExit">Вернуть мои данные</button></div>` + html;
  view.innerHTML = html;
  if (!same) { view.style.animation = 'none'; void view.offsetHeight; view.style.animation = ''; }
  FIG.mountAll(view); CH.mountAll(view); animateRings(view);
  try { if (R.mount) R.mount(view, ...r.params); } catch (e) { console.error(e); }
  updateShell();
  const t = typeof R.title === 'function' ? R.title(...r.params) : R.title;
  document.title = (t ? t + ' · ' : '') + 'PULLUP PRO';
  window.scrollTo(0, same ? y : 0);
  try { window.dispatchEvent(new CustomEvent('pullup:render', { detail: { name: r.name } })); } catch (e) { /* old browsers */ }
}
export const rerender = () => render(true);
