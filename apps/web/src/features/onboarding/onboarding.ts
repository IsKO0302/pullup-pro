import { FIG } from '../../components/figure';
import { openModal } from '../../components/modal';
import { toast } from '../../components/toast';
import { stepper } from '../../components/ui';
import { $, numVal } from '../../core/dom';
import { ACT } from '../../core/events';
import { ico } from '../../core/icons';
import { go, render } from '../../core/router';
import { S, save } from '../../core/state';
import { updateShell } from '../../layouts/shell';
import { EXPERIENCE, FORMATS, RESULT_FIELDS, SPLITS, bindPicks, multiVal, pickChips, pickSeg, pickVal, resultOf } from '../profile/fields';
import { upsertWeight } from '../profile/profile';
import { loadDemo } from '../settings/settings';
import { SAFETY_RULES, levelForMax } from '@pullup/shared/catalog/programs';
import { EQUIPMENT, GOALS, PROGM_V2 } from '@pullup/shared/catalog/programs2';
import { LEVEL_DESC, LEVEL_NAME, recommendProgram, suggestLevel } from '@pullup/shared/engine';
import { todayKey } from '@pullup/shared/dates';
import { clamp, esc, round1 } from '@pullup/shared/util';
import type { AppState } from '@pullup/shared/types';

/* ================= Персонализация (ЧАСТЬ 6): first launch and "start over" =================
 * Nothing is saved until the last step; every answer can be changed later in the profile. */
const STEPS = ['Старт', 'Профиль', 'Результаты', 'Оборудование', 'Режим', 'Цели', 'План'];
export function showOnboarding(again?: boolean) {
  const p = S.profile;
  const st: any = {
    step: 0, ok: !!again || !!p.disclaimerAccepted, name: p.name || 'ISA', weight: p.bodyweight || 75, height: p.height || '',
    res: Object.fromEntries(RESULT_FIELDS.map(f => [f.k, resultOf(f.k)])), equipment: Array.isArray(p.equipment) ? [...p.equipment] : ['bar'],
    format: p.format || 'home', days: p.weeklyTarget || 3, exp: p.experience || 'none', split: p.split || 'auto', goals: [...(p.goals || [])]
  };
  let m;
  const preview = (): AppState => {
    const results: any = {}; for (const f of RESULT_FIELDS) if (f.k !== 'maxPullups' && st.res[f.k]) results[f.k] = st.res[f.k];
    const prof: any = { ...S.profile, maxPullups: st.res.maxPullups, results, equipment: st.equipment, weeklyTarget: st.days, experience: st.exp, goals: st.goals, format: st.format };
    if (st.split === 'auto') delete prof.split; else prof.split = st.split;
    delete prof.level;
    return { ...(S as any), profile: prof };
  };
  const dots = () => `<div class="ob-steps" aria-label="Шаг ${st.step + 1} из ${STEPS.length}">${STEPS.map((t, i) => `<span class="${i < st.step ? 'done' : i === st.step ? 'on' : ''}"><i></i><b>${t}</b></span>`).join('')}</div>`;
  const collect = () => {
    const box = m.box;
    if (st.step === 1) { st.name = String($('#ob-name', box).value || '').trim().slice(0, 30) || 'ISA'; st.weight = round1(clamp(numVal('#ob-weight', box, 75), 30, 250)); st.height = String($('#ob-height', box).value || '').trim(); }
    if (st.step === 2) for (const f of RESULT_FIELDS) st.res[f.k] = clamp(Math.round(numVal('#ob-r-' + f.k, box, 0)), 0, f.max);
    if (st.step === 3) { st.equipment = multiVal(box, 'equipment'); st.format = pickVal(box, 'format') || 'home'; }
    if (st.step === 4) { st.days = +(pickVal(box, 'days') || 3); st.exp = pickVal(box, 'exp') || 'none'; st.split = pickVal(box, 'split') || 'auto'; }
    if (st.step === 5) st.goals = multiVal(box, 'goals');
  };
  const validate = (): string => {
    if (st.step === 1 && st.height) { const h = Math.round(parseFloat(String(st.height).replace(',', '.'))); if (!(h >= 100 && h <= 250)) return 'Рост — от 100 до 250 см или оставьте поле пустым.'; }
    return '';
  };
  const nav = (back = true, next = 'Далее') => `${back ? `<button class="btn btn-ghost" data-ob="back">${ico('left')}Назад</button>` : ''}<span class="grow"></span><button class="btn btn-acc" data-ob="next">${next} ${ico('right')}</button>`;
  const draw = () => {
    const box = m.box;
    if (st.step === 0) {
      m.setTitle('PULLUP PRO 2.0');
      m.setBody(dots() + `<div class="ob-hero"><div class="ob-fig">${FIG.tag('muscleup', 'data-label="0"')}</div>
        <div><div class="eyebrow">ISA PERSONAL FITNESS</div><h2 class="disp ob-h">Твой путь<br>к силе начинается здесь</h2>
        <p class="tx2 small">Тренировки на всё тело, программы трёх уровней с понятной прогрессией, путь к Muscle-Up, журнал, замеры тела и прогресс. Ответьте на несколько вопросов — план подстроится под вас.</p></div></div>
        <div class="note n-warn mt">${ico('shield')}<div><b>Безопасность</b><ul class="ul mt-s small">${SAFETY_RULES.slice(0, 5).map(x => `<li>${x}</li>`).join('')}</ul></div></div>
        <label class="check mt"><input type="checkbox" data-ob="ok" ${st.ok ? 'checked' : ''}><span class="box">${ico('check')}</span><span class="ct">Я ознакомился с правилами безопасности и понимаю, что приложение не заменяет врача или тренера<span class="cs">При травмах, болезнях сердца или давления сначала проконсультируйтесь со специалистом</span></span></label>`);
      m.setFoot(`<span class="small muted grow">${st.ok ? '' : 'Отметьте согласие, чтобы продолжить'}</span><button class="btn btn-acc" data-ob="next" ${st.ok ? '' : 'disabled'}>Начать ${ico('right')}</button>`);
    } else if (st.step === 1) {
      m.setTitle('Кто тренируется?');
      m.setBody(dots() + `<div class="form-grid">
        <label class="field"><span>Имя</span><input class="inp" id="ob-name" maxlength="30" value="${esc(st.name)}" placeholder="ISA"></label>
        <div class="field"><span>Вес тела, кг</span>${stepper('ob-weight', st.weight, 30, 250, 0.5)}</div>
        <label class="field"><span>Рост, см — необязательно</span><input class="inp" type="number" inputmode="numeric" id="ob-height" min="100" max="250" value="${esc(st.height)}" placeholder="можно пропустить"></label></div>
        <p class="tiny muted mt">Вес станет первой точкой на графике тела. Данные хранятся на этом устройстве.</p>`);
      m.setFoot(nav());
    } else if (st.step === 2) {
      m.setTitle('Текущие результаты');
      m.setBody(dots() + `<p class="small tx2">Сколько получается сейчас за один подход, без раскачки и с чистой техникой. Не уверены — оставьте 0, позже можно пройти тест уровня.</p>
        <div class="form-grid f3 mt">${RESULT_FIELDS.map(f => `<div class="field"><span>${f.l}, ${f.u}</span>${stepper('ob-r-' + f.k, st.res[f.k] || 0, 0, f.max, f.step)}</div>`).join('')}</div>`);
      m.setFoot(nav());
    } else if (st.step === 3) {
      m.setTitle('Оборудование и формат');
      m.setBody(dots() + `<div class="sec-t">Что есть под рукой?</div>${pickChips('equipment', EQUIPMENT.map(e => ({ id: e.id, name: e.name, hint: e.hint })), st.equipment)}
        <div class="tiny muted mt-s">Пол и стена есть всегда: в каждой группе мышц есть упражнения без оборудования.</div>
        <div class="sec-t mt">Где удобнее тренироваться?</div>${pickSeg('format', FORMATS.map(f => [f[0], f[1]]), st.format, 'wrap')}`);
      m.setFoot(nav());
    } else if (st.step === 4) {
      m.setTitle('Режим тренировок');
      m.setBody(dots() + `<div class="sec-t">Тренировочных дней в неделю</div>${pickSeg('days', [2, 3, 4, 5, 6].map(n => [n, String(n)]), st.days)}
        <div class="tiny muted mt-s">Начинающим обычно достаточно 2–3 тренировок на всё тело: мышцам нужно время на восстановление.</div>
        <div class="sec-t mt">Опыт тренировок</div>${pickSeg('exp', EXPERIENCE, st.exp, 'wrap')}
        <div class="sec-t mt">Схема программы</div>${pickSeg('split', SPLITS.map(s => [s[0], s[1]]), st.split, 'wrap')}
        <div class="tiny muted mt-s">«Авто» подберёт схему по числу дней и целям: 2–3 дня — Full Body, 4 — верх/низ, 5–6 — Push/Pull/Legs.</div>`);
      m.setFoot(nav());
    } else if (st.step === 5) {
      m.setTitle('Основные цели');
      m.setBody(dots() + `<p class="small tx2">Можно выбрать несколько — они влияют на подсказки, акценты плана и рекомендации.</p>${pickChips('goals', GOALS, st.goals)}`);
      m.setFoot(nav(true, 'Готово'));
    } else {
      const tmp = preview(), sug = suggestLevel(tmp), pid = recommendProgram(tmp), P = PROGM_V2[pid];
      m.setTitle('Ваш план готов');
      m.setBody(dots() + `<div class="ob-sum">
        <div class="card accent"><div class="eyebrow">Уровень</div><div class="prog-name">${LEVEL_NAME[sug.level]}</div><div class="small tx2">${LEVEL_DESC[sug.level]}</div>
          ${sug.parts.length ? `<div class="tiny muted mt-s">По ответам: ${sug.parts.map(x => `${esc(x.label)} ${x.score}/${x.max}`).join(' · ')}</div>` : ''}</div>
        <div class="card"><div class="eyebrow">Программа</div><div class="prog-name">${esc(P ? P.name : pid)}</div>${P ? `<div class="small tx2">${esc(P.goal)}</div><div class="row wrap mt-s"><span class="badge">${ico('cal')}${esc(P.freq)}</span><span class="badge">${ico('clock')}${esc(P.dur)}</span></div>` : ''}</div></div>
        <p class="tiny muted mt">Нагрузка растёт только после стабильно выполненных тренировок и с вашего согласия. Уровень, программу и любые ответы можно поменять в профиле и в «Мой план».</p>
        <div class="stack s mt">
          <button class="opt acc" data-ob="finish"><span class="li-ico acc">${ico('play')}</span><span class="grow"><b>Начать с этим планом</b><span class="small muted" style="display:block">Ваш собственный журнал с первого дня</span></span>${ico('right', 'muted')}</button>
          <button class="opt" data-ob="test"><span class="li-ico">${ico('test')}</span><span class="grow"><b>Сначала пройти тест уровня</b><span class="small muted" style="display:block">Точно измерить максимумы и уточнить план</span></span>${ico('right', 'muted')}</button>
          <button class="opt" data-ob="demo"><span class="li-ico">${ico('sparkle')}</span><span class="grow"><b>Посмотреть на демо-данных</b><span class="small muted" style="display:block">Помеченные примеры тренировок, чтобы увидеть графики. Ваши ответы сохранятся, демо можно удалить в любой момент</span></span>${ico('right', 'muted')}</button>
        </div>`);
      m.setFoot(`<button class="btn btn-ghost" data-ob="back">${ico('left')}Назад</button>`);
    }
    bindOnce(box);
  };
  let bound = false;
  const bindOnce = (box) => { if (bound) return; bound = true; bindPicks(box); };
  const commit = () => {
    const pr = S.profile, results: any = { ...(pr.results || {}) };
    for (const f of RESULT_FIELDS) { const v = st.res[f.k] || 0; if (f.k === 'maxPullups') pr.maxPullups = v; else if (v) results[f.k] = v; else delete results[f.k]; }
    pr.name = st.name || 'ISA'; pr.results = results; pr.equipment = st.equipment; pr.format = st.format; pr.weeklyTarget = st.days; pr.experience = st.exp; pr.goals = st.goals;
    const h = st.height ? Math.round(parseFloat(String(st.height).replace(',', '.'))) : 0; if (h) pr.height = h; else delete pr.height;
    if (st.split === 'auto') delete pr.split; else pr.split = st.split;
    pr.program = levelForMax(pr.maxPullups); pr.onboarded = true; pr.disclaimerAccepted = true;
    const lastW = [...S.body].filter(b => b.weight).sort((a, b) => a.date < b.date ? -1 : 1).pop();
    if (!lastW || lastW.weight !== st.weight) upsertWeight(st.weight); else pr.bodyweight = st.weight;
    const pid = recommendProgram(S as any);
    if (PROGM_V2[pid] && S.engine.program !== pid) { S.engine.program = pid; S.engine.startedAt = todayKey(); }
    save(); updateShell();
  };
  m = openModal({
    title: '', cls: 'wide ob-modal', dismiss: !!again,
    onMount(box) {
      box.addEventListener('click', e => {
        const b = e.target.closest('[data-ob]'); if (!b || b.tagName === 'INPUT' || b.disabled) return; const a = b.dataset.ob;
        if (a === 'next') { collect(); const er = validate(); if (er) return toast(er, 'err'); st.step = Math.min(STEPS.length - 1, st.step + 1); draw(); box.querySelector('.modal-body').scrollTop = 0; }
        else if (a === 'back') { collect(); st.step = Math.max(0, st.step - 1); draw(); }
        else if (a === 'finish') { commit(); m.close(); toast(`Профиль сохранён · ${PROGM_V2[S.engine.program] ? PROGM_V2[S.engine.program].name : 'план готов'}`, 'ok'); go('#/home'); render(); }
        else if (a === 'test') { commit(); m.close(); render(); setTimeout(() => ACT.testWizard(), 250); }
        else if (a === 'demo') { commit(); m.close(); loadDemo(); toast('Загружены ДЕМО-данные. Удалить их можно баннером на главной или в настройках.', 'ok', 4500); go('#/home'); }
      });
      box.addEventListener('change', e => { if (e.target.dataset.ob === 'ok') { st.ok = e.target.checked; draw(); } });
    }
  });
  draw();
}
ACT.reOnboard = () => showOnboarding(true);
