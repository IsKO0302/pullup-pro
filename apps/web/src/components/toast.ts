import { $ } from '../core/dom';
import { ico } from '../core/icons';

/* ---------- toast ---------- */
export function toast(msg, kind = 'info', ms = 3200) {
  const root = $('#toasts'); if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast t-' + kind;
  el.innerHTML = `${ico(kind === 'ok' ? 'check' : kind === 'err' ? 'warn' : kind === 'xp' ? 'star' : kind === 'ach' ? 'trophy' : 'info')}<span>${msg}</span>`;
  root.appendChild(el);
  while (root.children.length > 3) root.firstElementChild.remove();
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, ms);
}
