import { AUD } from './audio';

/* ---------- event delegation ---------- */
/** action registry for delegated events: data-act / data-chg / data-inp */
export const ACT: Record<string, (el?: any, ev?: any) => any> = {};
document.addEventListener('click', (e: any) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || el.classList.contains('disabled')) return;
  const fn = ACT[el.dataset.act];
  if (fn) { e.preventDefault(); AUD.ensure(); fn(el, e); }
});
document.addEventListener('change', (e: any) => { const el = e.target.closest('[data-chg]'); if (el && ACT[el.dataset.chg]) ACT[el.dataset.chg](el, e); });
document.addEventListener('input', (e: any) => { const el = e.target.closest('[data-inp]'); if (el && ACT[el.dataset.inp]) ACT[el.dataset.inp](el, e); });
