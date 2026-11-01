import { FIG } from './figure';
import { $ } from '../core/dom';
import { ico } from '../core/icons';
import { esc } from '@pullup/shared/util';

/* ---------- modal ---------- */
export const MODALS = [];
export interface ModalOptions { title?: string; body?: string; foot?: string; cls?: string; onMount?: (box: any, m: any) => void; onClose?: (v?: any) => void; dismiss?: boolean }
export function openModal({ title = '', body = '', foot = '', cls = '', onMount, onClose, dismiss = true }: ModalOptions): any {
  const root = $('#modal-root');
  const wrap: any = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${esc(String(title).replace(/<[^>]+>/g, ''))}">
    <div class="modal-head"><h3>${title}</h3>${dismiss ? `<button class="btn btn-ghost btn-icon btn-sm" data-close aria-label="Закрыть">${ico('x')}</button>` : ''}</div>
    <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
  root.appendChild(wrap);
  document.body.classList.add('noscroll');
  const m = {
    el: wrap, box: wrap.querySelector('.modal'), closed: false, dismiss,
    close(v?) {
      if (m.closed) return; m.closed = true;
      wrap.classList.remove('in'); setTimeout(() => wrap.remove(), 220);
      MODALS.splice(MODALS.indexOf(m), 1);
      if (!MODALS.length && $('#train-root').hidden) document.body.classList.remove('noscroll');
      onClose && onClose(v);
    },
    setBody(html) { wrap.querySelector('.modal-body').innerHTML = html; FIG.mountAll(wrap); },
    setFoot(html) { let f: any = wrap.querySelector('.modal-foot'); if (!f) { f = document.createElement('div'); f.className = 'modal-foot'; m.box.appendChild(f); } f.innerHTML = html; f.style.display = html ? '' : 'none'; },
    setTitle(html) { wrap.querySelector('.modal-head h3').innerHTML = html; }
  };
  wrap.addEventListener('click', (e: any) => {
    if (dismiss && e.target === wrap) m.close();
    else if (e.target.closest('[data-close]')) m.close();
  });
  MODALS.push(m);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('in')));
  FIG.mountAll(wrap);
  if (onMount) onMount(m.box, m);
  return m;
}
export function confirmBox(title, text, okLabel = 'Подтвердить', danger = false) {
  return new Promise(res => {
    openModal({
      title, body: `<p class="tx2">${text}</p>`,
      foot: `<button class="btn btn-ghost" data-close>Отмена</button><button class="btn ${danger ? 'btn-danger' : 'btn-acc'}" data-ok>${okLabel}</button>`,
      onClose: v => res(!!v),
      onMount: (box, m) => { box.querySelector('[data-ok]').addEventListener('click', () => m.close(true)); }
    });
  });
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && MODALS.length) { const m = MODALS[MODALS.length - 1]; if (m.dismiss) { e.preventDefault(); m.close(); } }
});
