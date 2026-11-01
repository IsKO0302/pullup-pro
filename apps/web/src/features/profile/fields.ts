import { $$ } from '../../core/dom';
import { ico } from '../../core/icons';
import { S } from '../../core/state';
import { esc } from '@pullup/shared/util';

/* ================= Profile form pieces shared by onboarding (ЧАСТЬ 6) and the profile editor ================= */
export const FORMATS: [string, string, string][] = [['home', 'Дома', 'home'], ['outdoor', 'Улица / площадка', 'sun'], ['gym', 'Зал', 'weight'], ['mixed', 'Смешанный', 'layers']];
export const FORMAT_NAME: Record<string, string> = Object.fromEntries(FORMATS.map(f => [f[0], f[1]]));
export const SPLITS: [string, string, string][] = [
  ['auto', 'Авто', 'по дням в неделю и целям'], ['fullbody', 'Full Body', 'всё тело каждую тренировку'], ['upperlower', 'Верх / низ', 'чередование'],
  ['ppl', 'Push / Pull / Legs', 'для 5–6 дней'], ['pullup', 'Подтягивания', 'классические программы 1.0'], ['mu', 'Muscle-Up', 'подготовка к выходу силой']
];
export const SPLIT_NAME: Record<string, string> = Object.fromEntries(SPLITS.map(f => [f[0], f[1]]));
export const EXPERIENCE: [string, string][] = [['none', 'Нет опыта'], ['lt1', 'До 1 года'], ['1to3', '1–3 года'], ['gt3', 'Больше 3 лет']];
export const EXP_NAME: Record<string, string> = Object.fromEntries(EXPERIENCE);
/** current results asked in onboarding/profile; maxPullups lives in the profile root (v1 field) */
export const RESULT_FIELDS: { k: string; l: string; u: string; max: number; step: number }[] = [
  { k: 'maxPullups', l: 'Подтягивания', u: 'повт.', max: 100, step: 1 }, { k: 'pushups', l: 'Отжимания от пола', u: 'повт.', max: 300, step: 1 },
  { k: 'plank', l: 'Планка', u: 'сек', max: 1800, step: 5 }, { k: 'squats', l: 'Приседания', u: 'повт.', max: 500, step: 1 },
  { k: 'dips', l: 'Отжимания на брусьях', u: 'повт.', max: 200, step: 1 }, { k: 'hang', l: 'Вис на перекладине', u: 'сек', max: 900, step: 5 }
];
export const resultOf = (k: string): number => k === 'maxPullups' ? (+S.profile.maxPullups || 0) : +((S.profile.results || {})[k] || 0);

/** single choice: buttons inside one group, handled locally (not through ACT) */
export const pickSeg = (name: string, opts: [string | number, string][], cur: unknown, cls = '') =>
  `<div class="seg pick-seg ${cls}" role="radiogroup" data-pick="${name}">${opts.map(([v, l]) => `<button type="button" role="radio" aria-checked="${String(v) === String(cur)}" data-v="${esc(v)}" class="${String(v) === String(cur) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
/** multiple choice chips with real checkboxes (keyboard & screen-reader friendly) */
export const pickChips = (name: string, opts: { id: string; name: string; hint?: string }[], sel: string[] = []) =>
  `<div class="pick-chips" data-multi="${name}">${opts.map(o => `<label class="pchip"><input type="checkbox" value="${esc(o.id)}" ${sel.includes(o.id) ? 'checked' : ''}><span>${ico('check')}<b>${esc(o.name)}</b>${o.hint ? `<i>${esc(o.hint)}</i>` : ''}</span></label>`).join('')}</div>`;
export function bindPicks(root: HTMLElement, onChange?: () => void) {
  root.addEventListener('click', (e: any) => {
    const b = e.target.closest('[data-pick] > button'); if (!b) return;
    const g = b.parentNode; $$('button', g).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
    if (onChange) onChange();
  });
  if (onChange) root.addEventListener('change', (e: any) => { if (e.target.closest('[data-multi]')) onChange(); });
}
export const pickVal = (root: ParentNode, name: string): string | undefined => { const b = (root as any).querySelector(`[data-pick="${name}"] > button.on`); return b ? b.dataset.v : undefined; };
export const multiVal = (root: ParentNode, name: string): string[] => $$(`[data-multi="${name}"] input:checked`, root as any).map(i => i.value);
