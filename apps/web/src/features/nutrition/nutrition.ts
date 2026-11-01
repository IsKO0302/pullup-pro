import { CH } from '../../components/charts';
import { confirmBox, openModal } from '../../components/modal';
import { toast } from '../../components/toast';
import { pbar, stepper } from '../../components/ui';
import { pageHead, segBtns, setSeg } from '../../components/view';
import { $, $$, numVal } from '../../core/dom';
import { ACT } from '../../core/events';
import { ico } from '../../core/icons';
import { ROUTES, rerender } from '../../core/router';
import { S, save } from '../../core/state';
import { addDays, dayKey, fmtDayShort, fmtDayW, parseDay, relDay, todayKey } from '@pullup/shared/dates';
import { currentWeight } from '@pullup/shared/stats';
import { clamp, esc, fmtNum, round1, uid } from '@pullup/shared/util';
import type { FoodEntry, Meal, Product } from '@pullup/shared/types';

/* ================= Питание (ЧАСТЬ 8) — optional food diary =================
 * Manual entries only: no paid APIs, no food database downloads, no medical diets.
 * Every number is either typed in by the user or calculated from the user's own product (per 100 g),
 * so totals are always labelled as an estimate. */
export const MEALS: [Meal, string, string][] = [['breakfast', 'Завтрак', 'sun'], ['lunch', 'Обед', 'apple'], ['dinner', 'Ужин', 'moon'], ['snack', 'Перекус', 'drop']];
const MEALM = Object.fromEntries(MEALS.map(m => [m[0], m])) as Record<Meal, [Meal, string, string]>;
export const GLASS_ML = 250;
const MACROS: [keyof Product & keyof FoodEntry, string, string, number][] = [['kcal', 'Калории', 'ккал', 20000], ['protein', 'Белки', 'г', 2000], ['fat', 'Жиры', 'г', 2000], ['carbs', 'Углеводы', 'г', 2000]];
export const NUT = { chart: 'kcal', allProducts: false };
const isDay = (k: string) => /^\d{4}-\d{2}-\d{2}$/.test(k || '') && !isNaN(parseDay(k).getTime());
const foodsOf = (day: string) => (S.foods || []).filter(f => f.date === day);
export function dayTotals(day: string) {
  const xs = foodsOf(day), t = { kcal: 0, protein: 0, fat: 0, carbs: 0, n: xs.length, noKcal: 0 };
  for (const f of xs) { for (const [k] of MACROS) t[k] += +(f[k] || 0); if (f.kcal == null) t.noKcal++; }
  for (const [k] of MACROS) t[k] = round1(t[k]);
  return t;
}
const v1 = (n: any) => n == null || n === '' ? '' : fmtNum(n);
/** protein reference from research (Morton 2018: ~1.6 g/kg/day; ISSN 2017: 1.4–2.0 g/kg/day) — an orientation, not a prescription */
export const proteinRef = () => { const w = currentWeight(S as any).v; return w > 0 ? { w, lo: Math.round(w * 1.4), mid: Math.round(w * 1.6), hi: Math.round(w * 2) } : null; };

ROUTES.nutrition = {
  title: 'Питание',
  render(dayArg = '') {
    const N = S.nutrition;
    if (!N.enabled) return pageHead('Питание <em>по желанию</em>', 'Дневник питания выключен. Тренировки, прогресс и план работают без него.', '', 'NUTRITION') + `
      <div class="card accent nut-intro"><div class="row top wrap" style="gap:18px"><span class="li-ico acc big-ico">${ico('apple')}</span>
        <div class="grow" style="flex:1 1 280px;min-width:0"><h3>Простой дневник без диет</h3>
          <ul class="ul small tx2 mt-s"><li>Записи по приёмам пищи: завтрак, обед, ужин, перекусы.</li><li>Свои продукты с калорийностью и БЖУ на 100 г — считаются по граммам.</li><li>Калории и БЖУ необязательны: можно записывать только названия.</li><li>Вода и полезные привычки — отметками за день.</li></ul>
          <div class="row wrap mt"><button class="btn btn-acc" data-act="nutOn">${ico('check')}Включить дневник питания</button></div></div></div></div>
      ${eduCards()}`;
    const day = isDay(dayArg) ? dayArg : todayKey(), t = todayKey();
    const prev = dayKey(addDays(parseDay(day), -1)), next = dayKey(addDays(parseDay(day), 1));
    const T = dayTotals(day);
    return pageHead('Питание <em>и восстановление</em>', 'Все значения — оценка по данным, которые вы ввели сами.', `<button class="btn btn-acc" data-act="nutAdd" data-day="${day}">${ico('plus')}Добавить запись</button>`, 'NUTRITION · ПО ЖЕЛАНИЮ') + `
      <div class="day-nav card flat"><a class="btn btn-sm btn-ghost btn-icon" href="#/nutrition/${prev}" aria-label="Предыдущий день">${ico('left')}</a>
        <div class="grow center"><b>${fmtDayW(day)}</b><div class="tiny muted">${relDay(day)}</div></div>
        ${day !== t ? `<a class="btn btn-sm" href="#/nutrition">Сегодня</a>` : ''}
        <a class="btn btn-sm btn-ghost btn-icon ${next > t ? 'disabled' : ''}" href="${next > t ? '#/nutrition/' + day : '#/nutrition/' + next}" aria-label="Следующий день" ${next > t ? 'aria-disabled="true" tabindex="-1"' : ''}>${ico('right')}</a></div>
      <div class="grid g-side mt">
        <div class="stack">
          ${totalsCard(day, T)}
          ${MEALS.map(m => mealCard(day, m[0])).join('')}
        </div>
        <div class="stack">
          ${waterCard(day)}
          ${habitsCard(day)}
          <div class="card"><div class="card-head"><h3>${ico('chart')}7 дней</h3>${segBtns('nutChart', [['kcal', 'Ккал'], ['protein', 'Белок'], ['water', 'Вода']], NUT.chart)}</div>${weekChart(day)}</div>
          ${productsCard()}
        </div>
      </div>
      ${eduCards()}
      <div class="row wrap between mt-l"><span class="tiny muted">Записей за всё время: ${(S.foods || []).length} · продуктов: ${(S.products || []).length}</span><button class="btn btn-sm btn-ghost" data-act="nutOff">${ico('eye')}Выключить дневник питания</button></div>`;
  }
};

function totalsCard(day: string, T) {
  const N = S.nutrition, pr = proteinRef();
  const row = (k, l, u, target?) => `<div class="nut-tot"><span class="tiny muted">${l}</span><b class="num">${fmtNum(T[k])}<small> ${u}</small></b>${target ? `${pbar(T[k] / target, 'thin')}<span class="tiny muted">цель ${fmtNum(target)} ${u}</span>` : ''}</div>`;
  return `<div class="card"><div class="card-head"><h3>${ico('target')}Итог дня</h3><button class="btn btn-sm btn-ghost" data-act="nutTargets">${ico('sliders')}Ориентиры</button></div>
    <div class="nut-tots">${row('kcal', 'Калории', 'ккал', N.kcalTarget)}${row('protein', 'Белки', 'г', N.proteinTarget)}${row('fat', 'Жиры', 'г')}${row('carbs', 'Углеводы', 'г')}</div>
    <div class="tiny muted mt-s">${T.n ? `Оценка по ${T.n} ${T.n === 1 ? 'записи' : 'записям'}${T.noKcal ? ` · ${T.noKcal} без калорийности — итог неполный` : ''}.` : 'За этот день записей нет.'}${!N.proteinTarget && pr ? ` Ориентир по белку из исследований: ~${pr.mid} г в сутки (1,6 г/кг при весе ${fmtNum(pr.w)} кг).` : ''}</div></div>`;
}
function mealCard(day: string, meal: Meal) {
  const [, name, icon] = MEALM[meal], xs = foodsOf(day).filter(f => f.meal === meal), kcal = xs.reduce((a, f) => a + (+f.kcal || 0), 0);
  const y = dayKey(addDays(parseDay(day), -1)), ys = foodsOf(y).filter(f => f.meal === meal);
  return `<div class="card meal"><div class="card-head"><h3>${ico(icon)}${name}</h3><span class="hint">${xs.length ? `${fmtNum(round1(kcal))} ккал` : ''}</span></div>
    ${xs.length ? `<div class="food-list">${xs.map(f => `<div class="food"><div class="grow" style="min-width:0"><b class="small ell">${esc(f.name)}</b>
      <div class="tiny muted">${[f.grams ? `${fmtNum(f.grams)} г` : '', f.kcal != null ? `${fmtNum(f.kcal)} ккал` : 'ккал не указаны', f.protein != null ? `Б ${fmtNum(f.protein)}` : '', f.fat != null ? `Ж ${fmtNum(f.fat)}` : '', f.carbs != null ? `У ${fmtNum(f.carbs)}` : ''].filter(Boolean).join(' · ')}${f.note ? ` · ${esc(f.note)}` : ''}</div></div>
      <button class="btn btn-ghost btn-icon btn-sm" data-act="nutEdit" data-id="${esc(f.id)}" aria-label="Изменить">${ico('edit')}</button><button class="btn btn-ghost btn-icon btn-sm" data-act="nutDel" data-id="${esc(f.id)}" aria-label="Удалить">${ico('trash')}</button></div>`).join('')}</div>` : ''}
    <div class="row wrap ${xs.length ? 'mt-s' : ''}"><button class="btn btn-sm" data-act="nutAdd" data-day="${day}" data-meal="${meal}">${ico('plus')}Добавить</button>${!xs.length && ys.length ? `<button class="btn btn-sm btn-ghost" data-act="nutRepeat" data-day="${day}" data-meal="${meal}">${ico('repeat')}Как вчера (${ys.length})</button>` : ''}</div></div>`;
}
function waterCard(day: string) {
  const w = (S.daily[day] || {}).water || 0, target = S.nutrition.waterTarget || 8;
  return `<div class="card water"><div class="card-head"><h3>${ico('drop')}Вода</h3><span class="hint">1 стакан = ${GLASS_ML} мл</span></div>
    <div class="row between"><div><div class="water-v num">${w}<small> / ${target}</small></div><div class="tiny muted">${fmtNum(w * GLASS_ML / 1000)} л из ${fmtNum(target * GLASS_ML / 1000)} л</div></div>
      <div class="row" style="gap:8px"><button class="btn btn-icon" data-act="nutWater" data-day="${day}" data-d="-1" aria-label="Убрать стакан" ${w ? '' : 'disabled'}>${ico('minus')}</button><button class="btn btn-acc btn-icon" data-act="nutWater" data-day="${day}" data-d="1" aria-label="Добавить стакан">${ico('plus')}</button></div></div>
    <div class="glasses mt-s" aria-hidden="true">${Array.from({ length: Math.max(target, w) }, (_, i) => `<i class="${i < w ? 'on' : ''}"></i>`).join('')}</div>
    <div class="tiny muted mt-s">Ориентир EFSA для взрослых — около 2,0 л (женщины) и 2,5 л (мужчины) воды в сутки с учётом еды; при жаре и тренировках потребность выше.</div></div>`;
}
function habitsCard(day: string) {
  const hs = (S.nutrition.habits || []).filter(h => h.on), d = (S.daily[day] || {}).habits || {}, done = hs.filter(h => d[h.id]).length;
  return `<div class="card"><div class="card-head"><h3>${ico('check')}Привычки дня</h3><button class="btn btn-sm btn-ghost" data-act="nutHabits">${ico('sliders')}Настроить</button></div>
    ${hs.length ? `<div class="stack s">${hs.map(h => `<label class="check"><input type="checkbox" data-chg="nutHabit" data-day="${day}" data-id="${esc(h.id)}" ${d[h.id] ? 'checked' : ''}><span class="box">${ico('check')}</span><span class="ct">${esc(h.name)}</span></label>`).join('')}</div>
      <div class="tiny muted mt-s">Выполнено: ${done} из ${hs.length}</div>` : `<div class="small muted">Привычки выключены. Нажмите «Настроить», чтобы выбрать.</div>`}</div>`;
}
function weekChart(day: string) {
  const days = Array.from({ length: 7 }, (_, i) => dayKey(addDays(parseDay(day), i - 6))), k = NUT.chart;
  const data = days.map(d => k === 'water' ? ((S.daily[d] || {}).water || 0) : dayTotals(d)[k]);
  const goal = k === 'kcal' ? S.nutrition.kcalTarget : k === 'protein' ? S.nutrition.proteinTarget : S.nutrition.waterTarget;
  const unit = k === 'kcal' ? 'ккал' : k === 'protein' ? 'г' : 'стак.';
  return CH.slot({ type: 'bar', labels: days.map(d => fmtDayShort(d)), tips: days.map(d => fmtDayW(d)), highlight: 6, series: [{ name: k === 'kcal' ? 'Калории' : k === 'protein' ? 'Белок' : 'Вода', data, fmt: v => `${fmtNum(v)} ${unit}` }],
    goal: goal ? { value: goal, label: 'ориентир' } : null, emptyText: 'За 7 дней нет записей', aria: 'Питание за 7 дней' }, 200);
}
function productsCard() {
  const ps = [...(S.products || [])].sort((a, b) => a.name.localeCompare(b.name, 'ru')), show = NUT.allProducts ? ps : ps.slice(0, 8);
  return `<div class="card"><div class="card-head"><h3>${ico('list')}Мои продукты</h3><button class="btn btn-sm" data-act="nutProd">${ico('plus')}Продукт</button></div>
    ${ps.length ? `<div class="tiny muted mb-s">Значения на 100 г — при записи пересчитываются по граммам.</div><div class="food-list">${show.map(p => `<div class="food"><div class="grow" style="min-width:0"><b class="small ell">${esc(p.name)}</b>
      <div class="tiny muted">${[p.kcal != null ? `${fmtNum(p.kcal)} ккал` : '', p.protein != null ? `Б ${fmtNum(p.protein)}` : '', p.fat != null ? `Ж ${fmtNum(p.fat)}` : '', p.carbs != null ? `У ${fmtNum(p.carbs)}` : ''].filter(Boolean).join(' · ') || 'без значений'}</div></div>
      <button class="btn btn-ghost btn-icon btn-sm" data-act="nutProd" data-id="${esc(p.id)}" aria-label="Изменить">${ico('edit')}</button><button class="btn btn-ghost btn-icon btn-sm" data-act="nutProdDel" data-id="${esc(p.id)}" aria-label="Удалить">${ico('trash')}</button></div>`).join('')}</div>
      ${ps.length > 8 ? `<button class="link-btn small mt-s" data-act="nutAllProd">${NUT.allProducts ? 'Свернуть' : `Показать все (${ps.length})`}</button>` : ''}`
    : `<div class="small muted">Добавьте продукты, которые едите часто (данные с упаковки, на 100 г) — записи будут занимать секунды.</div>`}</div>`;
}
export function eduCards() {
  return `<div class="sec-t mt-l">Как питание помогает тренировкам</div>
  <div class="grid g4 edu">
    <div class="card flat"><h4>${ico('apple', 'acc')}Еда и тренировки</h4><p class="small tx2">Основа — обычная разнообразная еда: овощи и фрукты (ВОЗ: от 400 г в день), бобовые, цельные злаки, меньше сахара и соли. Дневник нужен, чтобы видеть привычки, а не ради идеальных цифр.</p></div>
    <div class="card flat"><h4>${ico('bolt', 'acc')}Белок</h4><p class="small tx2">Мета-анализ Morton et al. (2018): прирост мышц от силовых тренировок перестаёт заметно расти выше ~1,6 г белка на кг веса в сутки. ISSN (2017) советует распределять белок по 3–4 приёмам пищи.</p></div>
    <div class="card flat"><h4>${ico('bed', 'acc')}Восстановление</h4><p class="small tx2">Мышцы адаптируются между тренировками. Взрослым рекомендуется спать 7+ часов (AASM/SRS, 2015), пить воду и не тренировать одни и те же мышцы тяжело два дня подряд.</p></div>
    <div class="card flat"><h4>${ico('flame', 'acc')}Постоянство</h4><p class="small tx2">Результат дают недели регулярных тренировок и сна, а не отдельный «идеальный» день. Отмечайте 2–3 простые привычки и смотрите на тренд за неделю.</p></div>
  </div>
  <div class="note n-warn mt">${ico('shield')}<div class="small">PULLUP PRO не назначает диеты и не рассчитывает лечебное питание. При заболеваниях (например, почек, ЖКТ, диабете), беременности или проблемах с пищевым поведением — обсудите питание с врачом или диетологом.</div></div>`;
}

/* ---------- actions ---------- */
ACT.nutOn = () => { S.nutrition.enabled = true; save(); toast('Дневник питания включён', 'ok'); rerender(); };
ACT.nutOff = async () => {
  if (!(await confirmBox('Выключить дневник питания?', 'Раздел скроется из ежедневной миссии. Все записи, продукты и отметки сохранятся — их можно снова включить в любой момент.', 'Выключить'))) return;
  S.nutrition.enabled = false; save(); toast('Дневник питания выключен, записи сохранены', 'ok'); rerender();
};
ACT.nutChart = el => { NUT.chart = el.dataset.v; setSeg(el); rerender(); };
ACT.nutAllProd = () => { NUT.allProducts = !NUT.allProducts; rerender(); };
ACT.nutAdd = el => entryModal(el.dataset.day || todayKey(), (el.dataset.meal || defaultMeal()) as Meal);
ACT.nutEdit = el => { const f = (S.foods || []).find(x => x.id === el.dataset.id); if (f) entryModal(f.date, f.meal, f); };
ACT.nutDel = async el => {
  const i = (S.foods || []).findIndex(x => x.id === el.dataset.id); if (i < 0) return;
  if (!(await confirmBox('Удалить запись?', `«${esc(S.foods[i].name)}» будет удалена из дневника.`, 'Удалить', true))) return;
  S.foods.splice(i, 1); save(); toast('Запись удалена', 'ok'); rerender();
};
ACT.nutRepeat = el => {
  const day = el.dataset.day, meal = el.dataset.meal, y = dayKey(addDays(parseDay(day), -1));
  const xs = foodsOf(y).filter(f => f.meal === meal); if (!xs.length) return;
  for (const f of xs) S.foods.push({ ...f, id: uid(), date: day });
  save(); toast(`Добавлено как вчера: ${xs.length}`, 'ok'); rerender();
};
ACT.nutWater = el => {
  const day = el.dataset.day || todayKey(), d = S.daily[day] || (S.daily[day] = {});
  d.water = clamp((d.water || 0) + (+el.dataset.d || 0), 0, 40); save();
  if (el.dataset.d === '1' && d.water === (S.nutrition.waterTarget || 8)) toast('Цель по воде на сегодня выполнена', 'ok');
  rerender();
};
ACT.nutHabit = el => {
  const day = el.dataset.day || todayKey(), d = S.daily[day] || (S.daily[day] = {});
  d.habits = d.habits || {}; if (el.checked) d.habits[el.dataset.id] = true; else delete d.habits[el.dataset.id];
  save(); rerender();
};
function defaultMeal(): Meal { const h = new Date().getHours(); return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack'; }

function entryModal(day: string, meal: Meal, ent?: FoodEntry) {
  const st = { meal, per: null as Product | null, manual: {} as Record<string, boolean> };
  const names = [...new Set([...(S.products || []).map(p => p.name), ...[...(S.foods || [])].reverse().map(f => f.name)])].slice(0, 200);
  const numInp = (k, l, u, v) => `<label class="field"><span>${l}, ${u}</span><input class="inp" type="number" inputmode="decimal" min="0" step="0.1" id="nf-${k}" value="${v == null ? '' : v}" placeholder="—"></label>`;
  const known = (n: string) => (S.products || []).find(p => p.name.trim().toLowerCase() === n.trim().toLowerCase()) || null;
  openModal({
    title: ent ? 'Изменить запись' : 'Новая запись', cls: 'wide',
    body: `<div class="field"><span>Приём пищи</span>${segBtns('nfMeal', MEALS.map(m => [m[0], m[1]]), meal, 'data-nf-meal style="flex-wrap:wrap"')}</div>
      <div class="form-grid mt">
        <label class="field"><span>Продукт или блюдо</span><input class="inp" id="nf-name" maxlength="120" list="nf-names" autocomplete="off" value="${esc(ent ? ent.name : '')}" placeholder="Например: овсянка на молоке"><datalist id="nf-names">${names.map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist></label>
        <label class="field"><span>Количество, г</span><input class="inp" type="number" inputmode="decimal" min="0" step="1" id="nf-grams" value="${ent && ent.grams != null ? ent.grams : ''}" placeholder="необязательно"></label>
      </div>
      <div class="form-grid g4f mt">${MACROS.map(([k, l, u]) => numInp(k, l, u, ent ? ent[k] : null)).join('')}</div>
      <div class="tiny muted mt-s" id="nf-hint">Калории и БЖУ необязательны. Если выбрать продукт из «Моих продуктов», значения посчитаются по граммам.</div>
      <label class="field mt"><span>Заметка</span><input class="inp" id="nf-note" maxlength="200" value="${esc(ent && ent.note || '')}" placeholder="необязательно"></label>
      <label class="check mt" id="nf-save-w" ${ent ? 'hidden' : ''}><input type="checkbox" id="nf-save"><span class="box">${ico('check')}</span><span class="ct">Сохранить в «Мои продукты»<span class="cs">Значения пересчитаются на 100 г по указанным граммам</span></span></label>
      <div class="note n-bad mt" id="nf-err" hidden></div>`,
    foot: `<button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-acc" data-nf-ok>${ico('check')}Сохранить</button>`,
    onMount(box, m) {
      const inp = (k: string) => $('#nf-' + k, box);
      const recalc = () => {
        const g = numVal(inp('grams'), box, 0); if (!st.per || !(g > 0)) return;
        for (const [k] of MACROS) if (!st.manual[k] && st.per[k] != null) inp(k).value = String(round1(+st.per[k] * g / 100));
      };
      const onName = () => {
        const p = known(inp('name').value); st.per = p;
        $('#nf-save-w', box).hidden = !!(ent || p);
        $('#nf-hint', box).innerHTML = p ? `${ico('info')} «${esc(p.name)}» из ваших продуктов: ${[p.kcal != null ? `${fmtNum(p.kcal)} ккал` : '', p.protein != null ? `Б ${fmtNum(p.protein)}` : '', p.fat != null ? `Ж ${fmtNum(p.fat)}` : '', p.carbs != null ? `У ${fmtNum(p.carbs)}` : ''].filter(Boolean).join(' · ')} на 100 г. Укажите граммы — значения посчитаются.` : 'Калории и БЖУ необязательны. Если выбрать продукт из «Моих продуктов», значения посчитаются по граммам.';
        if (p) { st.manual = {}; recalc(); }
      };
      inp('name').addEventListener('input', onName); inp('grams').addEventListener('input', recalc);
      for (const [k] of MACROS) inp(k).addEventListener('input', () => { st.manual[k] = true; });
      if (ent) { st.per = known(ent.name); st.manual = { kcal: true, protein: true, fat: true, carbs: true }; }
      box.addEventListener('click', e => { const b = e.target.closest('[data-act="nfMeal"]'); if (b) { e.stopPropagation(); st.meal = b.dataset.v; $$('[data-act="nfMeal"]', box).forEach(x => x.classList.toggle('on', x === b)); } }, true);
      $('[data-nf-ok]', box).addEventListener('click', () => {
        const err = (t: string) => { const n = $('#nf-err', box); n.hidden = false; n.innerHTML = `${ico('warn')}<div>${t}</div>`; };
        const name = inp('name').value.trim(); if (!name) return err('Укажите продукт или блюдо.');
        const num = (k: string, max: number) => { const raw = String(inp(k).value).trim(); if (!raw) return undefined; const v = parseFloat(raw.replace(',', '.')); return isFinite(v) && v >= 0 && v <= max ? round1(v) : NaN; };
        const grams = num('grams', 10000); if (Number.isNaN(grams)) return err('Количество — от 0 до 10 000 г.');
        const vals: any = {}; for (const [k, l, , max] of MACROS) { const v = num(k, max); if (Number.isNaN(v)) return err(`${l}: значение от 0 до ${fmtNum(max)}.`); vals[k] = v; }
        const rec: FoodEntry = { id: ent ? ent.id : uid(), date: day, meal: st.meal as Meal, name: name.slice(0, 120), grams, ...vals, note: inp('note').value.trim().slice(0, 200) || undefined };
        for (const k of Object.keys(rec)) if (rec[k] === undefined) delete rec[k];
        if (ent) { const i = S.foods.findIndex(x => x.id === ent.id); if (i >= 0) S.foods[i] = rec; } else S.foods.push(rec);
        let prodMsg = '';
        if (!ent && $('#nf-save', box).checked && !known(name)) {
          if (!(grams > 0)) return err('Чтобы сохранить продукт на 100 г, укажите количество в граммах.');
          const per: Product = { id: uid(), name: name.slice(0, 120) };
          for (const [k] of MACROS) if (vals[k] != null) (per as any)[k] = round1(vals[k] / grams * 100);
          S.products.push(per); prodMsg = ' · продукт сохранён';
        }
        save(); m.close(); toast(`Записано: ${esc(name)}${prodMsg}`, 'ok'); rerender();
      });
      setTimeout(() => { if (window.innerWidth > 900) inp('name').focus(); }, 60);
    }
  });
}
ACT.nfMeal = () => { /* handled inside the entry modal */ };

ACT.nutProd = el => {
  const p = (S.products || []).find(x => x.id === el.dataset.id);
  openModal({
    title: p ? 'Изменить продукт' : 'Новый продукт',
    body: `<label class="field"><span>Название</span><input class="inp" id="np-name" maxlength="120" value="${esc(p ? p.name : '')}" placeholder="Например: творог 5%"></label>
      <div class="tiny muted mt">Значения на 100 г — их можно взять с упаковки. Любое поле можно оставить пустым.</div>
      <div class="form-grid g4f mt-s">${MACROS.map(([k, l, u]) => `<label class="field"><span>${l}, ${u}</span><input class="inp" type="number" inputmode="decimal" min="0" step="0.1" id="np-${k}" value="${p && p[k] != null ? p[k] : ''}" placeholder="—"></label>`).join('')}</div>
      <div class="note n-bad mt" id="np-err" hidden></div>`,
    foot: `<button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-acc" data-np-ok>${ico('check')}Сохранить</button>`,
    onMount(box, m) {
      $('[data-np-ok]', box).addEventListener('click', () => {
        const err = (t: string) => { const n = $('#np-err', box); n.hidden = false; n.innerHTML = `${ico('warn')}<div>${t}</div>`; };
        const name = $('#np-name', box).value.trim(); if (!name) return err('Укажите название.');
        if ((S.products || []).some(x => x.id !== (p && p.id) && x.name.trim().toLowerCase() === name.toLowerCase())) return err('Продукт с таким названием уже есть.');
        const rec: Product = { id: p ? p.id : uid(), name: name.slice(0, 120) };
        for (const [k, l] of MACROS) {
          const raw = String($('#np-' + k, box).value).trim(); if (!raw) continue;
          const v = parseFloat(raw.replace(',', '.')), max = k === 'kcal' ? 900 : 100;
          if (!isFinite(v) || v < 0 || v > max) return err(`${l} на 100 г — от 0 до ${max}.`);
          (rec as any)[k] = round1(v);
        }
        if ((rec.protein || 0) + (rec.fat || 0) + (rec.carbs || 0) > 101) return err('Белки + жиры + углеводы не могут быть больше 100 г на 100 г продукта.');
        if (p) { const i = S.products.findIndex(x => x.id === p.id); S.products[i] = rec; } else S.products.push(rec);
        save(); m.close(); toast(p ? 'Продукт обновлён' : 'Продукт добавлен', 'ok'); rerender();
      });
    }
  });
};
ACT.nutProdDel = async el => {
  const i = (S.products || []).findIndex(x => x.id === el.dataset.id); if (i < 0) return;
  if (!(await confirmBox('Удалить продукт?', `«${esc(S.products[i].name)}» исчезнет из подсказок. Уже сделанные записи останутся без изменений.`, 'Удалить', true))) return;
  S.products.splice(i, 1); save(); toast('Продукт удалён', 'ok'); rerender();
};
ACT.nutTargets = () => {
  const N = S.nutrition, pr = proteinRef();
  openModal({
    title: 'Ориентиры на день',
    body: `<p class="small tx2">Ориентиры необязательны и задаются вами. Приложение не рассчитывает «норму калорий»: для этого нужны данные, которых у него нет, а потребности индивидуальны.</p>
      <div class="form-grid mt">
        <label class="field"><span>Калории, ккал</span><input class="inp" type="number" inputmode="numeric" min="0" max="10000" id="nt-kcal" value="${N.kcalTarget || ''}" placeholder="без ориентира"></label>
        <label class="field"><span>Белок, г</span><input class="inp" type="number" inputmode="numeric" min="0" max="500" id="nt-protein" value="${N.proteinTarget || ''}" placeholder="без ориентира"></label>
      </div>
      ${pr ? `<div class="note n-acc mt">${ico('info')}<div class="small">Исследования силовых тренировок: польза белка выходит на плато около <b>1,6 г/кг в сутки</b> (Morton et al., 2018), ISSN называет диапазон 1,4–2,0 г/кг. При вашем весе ${fmtNum(pr.w)} кг это ≈ ${pr.lo}–${pr.hi} г. <button class="link-btn" data-nt-fill>Подставить ${pr.mid} г</button></div></div>` : ''}
      <div class="field mt"><span>Вода, стаканов по ${GLASS_ML} мл</span>${stepper('nt-water', N.waterTarget || 8, 2, 20, 1)}</div>
      <div class="note n-bad mt" id="nt-err" hidden></div>`,
    foot: `<button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-acc" data-nt-ok>${ico('check')}Сохранить</button>`,
    onMount(box, m) {
      const fill = $('[data-nt-fill]', box); if (fill) fill.addEventListener('click', () => { $('#nt-protein', box).value = String(pr.mid); });
      $('[data-nt-ok]', box).addEventListener('click', () => {
        const rd = (id: string, max: number) => { const raw = String($(id, box).value).trim(); if (!raw) return undefined; const v = Math.round(parseFloat(raw.replace(',', '.'))); return isFinite(v) && v > 0 && v <= max ? v : NaN; };
        const kcal = rd('#nt-kcal', 10000), protein = rd('#nt-protein', 500);
        if (Number.isNaN(kcal) || Number.isNaN(protein)) { const n = $('#nt-err', box); n.hidden = false; n.innerHTML = `${ico('warn')}<div>Калории — до 10 000 ккал, белок — до 500 г. Поле можно оставить пустым.</div>`; return; }
        if (kcal) N.kcalTarget = kcal; else delete N.kcalTarget;
        if (protein) N.proteinTarget = protein; else delete N.proteinTarget;
        N.waterTarget = clamp(Math.round(numVal('#nt-water', box, 8)), 2, 20);
        save(); m.close(); toast('Ориентиры сохранены', 'ok'); rerender();
      });
    }
  });
};
ACT.nutHabits = () => {
  const draw = () => `<div class="stack s">${(S.nutrition.habits || []).map(h => `<div class="row between hab-row"><label class="switch"><input type="checkbox" data-hb-on="${esc(h.id)}" ${h.on ? 'checked' : ''}><i></i><span class="small">${esc(h.name)}</span></label>
      ${h.id.startsWith('h_') ? `<button class="btn btn-ghost btn-icon btn-sm" data-hb-del="${esc(h.id)}" aria-label="Удалить">${ico('trash')}</button>` : ''}</div>`).join('')}</div>
    <div class="row mt"><input class="inp grow" id="hb-new" maxlength="60" placeholder="Своя привычка, например «Без сладких напитков»"><button class="btn" data-hb-add>${ico('plus')}Добавить</button></div>`;
  openModal({
    title: 'Привычки дня', body: draw(), foot: `<button class="btn btn-acc" data-close>Готово</button>`,
    onClose: () => rerender(),
    onMount(box, m) {
      box.addEventListener('change', e => { const id = e.target.dataset.hbOn; if (!id) return; const h = S.nutrition.habits.find(x => x.id === id); if (h) { h.on = e.target.checked; save(); } });
      box.addEventListener('click', e => {
        const del = e.target.closest('[data-hb-del]'); if (del) { S.nutrition.habits = S.nutrition.habits.filter(x => x.id !== del.dataset.hbDel); save(); m.setBody(draw()); return; }
        if (e.target.closest('[data-hb-add]')) {
          const v = String($('#hb-new', box).value || '').trim(); if (!v) return toast('Введите название привычки', 'err');
          if (S.nutrition.habits.length >= 12) return toast('Можно до 12 привычек', 'err');
          S.nutrition.habits.push({ id: 'h_' + uid(), name: v.slice(0, 60), on: true }); save(); m.setBody(draw());
        }
      });
    }
  });
};
