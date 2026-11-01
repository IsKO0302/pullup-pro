import { $$ } from '../core/dom';
import { ACT } from '../core/events';
import { ico } from '../core/icons';
import { clamp, round1 } from '@pullup/shared/util';

/* ---------- small UI helpers ---------- */
export function ring(pct, size = 120, sw = 11, inner = '', cls = '') {
  const r = (size - sw) / 2, c = 2 * Math.PI * r, p = clamp(pct, 0, 1);
  return `<div class="ring ${cls}" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle class="rg-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${sw}"/><circle class="rg-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${sw}" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-off="${c * (1 - p)}"/></svg><div class="rg-c">${inner}</div></div>`;
}
export function animateRings(root) { requestAnimationFrame(() => requestAnimationFrame(() => $$('.rg-fg[data-off]', root).forEach(el => { el.style.strokeDashoffset = el.dataset.off; }))); }
export const pbar = (pct, cls = '') => `<div class="bar ${cls}"><i style="width:${clamp(pct, 0, 1) * 100}%"></i></div>`;
export const lvlBars = n => `<span class="lvl" title="Сложность ${n} из 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
export function checkbox(name, checked, text, sub = '', attrs = '') {
  return `<label class="check"><input type="checkbox" ${checked ? 'checked' : ''} ${name ? `data-chg="${name}"` : ''} ${attrs}><span class="box">${ico('check')}</span><span class="ct">${text}${sub ? `<span class="cs">${sub}</span>` : ''}</span></label>`;
}
export function stepper(id, val, min = 0, max = 999, step = 1, attrs = '') {
  return `<div class="stepper" data-stepper="${id}" data-min="${min}" data-max="${max}" data-step="${step}"><button type="button" data-act="stepDn" aria-label="Меньше">${ico('minus')}</button><input type="number" inputmode="decimal" id="${id}" value="${val}" min="${min}" max="${max}" step="${step}" ${attrs}><button type="button" data-act="stepUp" aria-label="Больше">${ico('plus')}</button></div>`;
}
ACT.stepUp = el => stepBy(el, 1);
ACT.stepDn = el => stepBy(el, -1);
export function stepBy(el, dir) {
  const w = el.closest('[data-stepper]'), inp = w.querySelector('input');
  const st = +w.dataset.step || 1, v = (parseFloat(String(inp.value).replace(',', '.')) || 0) + st * dir;
  inp.value = round1(clamp(v, +w.dataset.min, +w.dataset.max));
  inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
}
