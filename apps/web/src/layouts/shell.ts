import { pbar } from '../components/ui';
import { $ } from '../core/dom';
import { ico } from '../core/icons';
import { CUR, NAV, NAV_PARENT } from '../core/router';
import { S } from '../core/state';
import { LG } from '../services/logic';
import { LEVEL_NAME, userLevel } from '@pullup/shared/engine';
import { esc, fmtNum } from '@pullup/shared/util';

/** profile avatar: uploaded image (small data URL kept in the profile) or initials */
export function avatar(cls = '') {
  const name = (S.profile.name || 'ISA').trim(), a = S.profile.avatar;
  if (a && /^data:image\/(jpeg|png|webp);base64,/.test(a)) return `<span class="avatar ${cls}"><img src="${a}" alt="${esc(name)}"></span>`;
  return `<span class="avatar ${cls}" aria-hidden="true">${esc(name.slice(0, 1).toUpperCase() || 'I')}</span>`;
}
export const displayName = () => (S.profile.name || 'ISA').trim() || 'ISA';

export function updateShell() {
  const D = LG.derive(), n = NAV_PARENT[CUR.name] || CUR.name, pct = (D.xp - D.lvlFrom) / Math.max(1, D.lvlTo - D.lvlFrom);
  $('#nav').innerHTML = NAV.map(x => x.sep ? '<div class="nav-sep"></div>' : `<a href="#/${x.r}" class="${n === x.r ? 'on' : ''}" ${n === x.r ? 'aria-current="page"' : ''}>${ico(x.i)}<span>${x.t}</span></a>`).join('');
  const tab = (r, i, t) => `<a href="#/${r}" class="${n === r ? 'on' : ''}" ${n === r ? 'aria-current="page"' : ''}>${ico(i)}<span>${t}</span></a>`;
  $('#tabbar').innerHTML = tab('home', 'home', 'Главная') + tab('train', 'fullbody', 'Тренировки') +
    `<button class="tab-start" data-act="startMenu" aria-label="Начать тренировку"><span class="ts">${ico('play')}</span><span>Старт</span></button>` + tab('stats', 'chart', 'Прогресс') +
    `<button data-act="moreMenu" class="${['home', 'train', 'stats'].includes(n) ? '' : 'on'}">${ico('more')}<span>Ещё</span></button>`;
  $('#side-level').innerHTML = `<span class="net-badge side-net" ${navigator.onLine ? 'hidden' : ''} role="status">${ico('wifioff')}Офлайн · данные сохраняются на устройстве</span><a href="#/profile" class="row side-prof">${avatar('sm')}<div class="grow" style="min-width:0"><b class="small ell">${esc(displayName())}</b><div class="tiny muted">${LEVEL_NAME[userLevel(S)]} · ур. ${D.level}</div></div></a>
    ${pbar(pct, 'thin mt')}<div class="tiny muted mt-s">${fmtNum(D.xp)} / ${fmtNum(D.lvlTo)} XP · ${esc(D.title)}</div>
    <button class="btn btn-acc btn-block btn-sm mt" data-act="startMenu">${ico('play')}START TRAINING</button>`;
  $('#top-level').innerHTML = `<span class="net-badge" id="net-badge" ${navigator.onLine ? 'hidden' : ''}>${ico('wifioff')}Офлайн</span><a href="#/profile" class="row" style="gap:8px" aria-label="Профиль">${avatar('xs')}<span class="small">${fmtNum(D.xp)} XP</span></a>`;
}
export function updateNetBadge() {
  document.querySelectorAll<HTMLElement>('.net-badge').forEach(b => { b.hidden = navigator.onLine; });
  document.body.classList.toggle('is-offline', !navigator.onLine);
}
