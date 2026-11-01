import { CH } from '../../components/charts';
import { confirmBox, openModal } from '../../components/modal';
import { toast } from '../../components/toast';
import { pbar, stepper } from '../../components/ui';
import { emptyBox, kpi, pageHead } from '../../components/view';
import { $, numVal } from '../../core/dom';
import { ACT } from '../../core/events';
import { ico } from '../../core/icons';
import { ROUTES, rerender } from '../../core/router';
import { S, save } from '../../core/state';
import { avatar, displayName, updateShell } from '../../layouts/shell';
import { LG } from '../../services/logic';
import { EXP_NAME, EXPERIENCE, FORMAT_NAME, FORMATS, RESULT_FIELDS, SPLIT_NAME, SPLITS, bindPicks, multiVal, pickChips, pickSeg, pickVal, resultOf } from './fields';
import { ACH2, achCtx } from '@pullup/shared/catalog/ach2';
import { exOf } from '@pullup/shared/catalog/exercises';
import { ACH, MU_STAGES } from '@pullup/shared/catalog/programs';
import { EQUIPMENT, GOALM, GOALS, PROGM_V2 } from '@pullup/shared/catalog/programs2';
import { fmtDay, fmtDayShort, fmtMin, fmtSec, todayKey } from '@pullup/shared/dates';
import { LEVEL_DESC, LEVEL_NAME, activeProgram, nextIndex, recommendProgram, suggestLevel, userLevel } from '@pullup/shared/engine';
import { bestResults, isWorkout, sessionVolume, sortSessions, summary, weightSeries } from '@pullup/shared/stats';
import { clamp, esc, fmtNum, pl, round1, uid } from '@pullup/shared/util';
import type { Level } from '@pullup/shared/types';

/* ================= ISA PERSONAL FITNESS PROFILE (ЧАСТЬ 6) ================= */
const sign = (d: number) => (d > 0 ? '+' : '') + fmtNum(round1(d));
const AVATAR_MAX = 60 * 1024;

ROUTES.profile = {
  title: 'Профиль',
  render() {
    const p = S.profile, D = LG.derive(), Sm = summary(S as any), lv = userLevel(S as any), sug = suggestLevel(S as any);
    const P = activeProgram(S as any), w = P.workouts[nextIndex(S as any, P.id)], R = bestResults(S as any);
    const ws = weightSeries(S as any), wt = Sm.weight, eq = (p.equipment || []).map(id => (EQUIPMENT.find(e => e.id === id) || { name: id }).name);
    const allAch = [...ACH2, ...ACH], got = allAch.filter(a => S.ach[a.id]).sort((a, b) => S.ach[a.id] < S.ach[b.id] ? 1 : -1);
    const recent = sortSessions(S.sessions.filter(isWorkout) as any).reverse().slice(0, 5);
    const lvPct = (D.xp - D.lvlFrom) / Math.max(1, D.lvlTo - D.lvlFrom);
    const best = (l: string, v: string, s = '') => `<div class="best"><span class="tiny muted">${l}</span><b class="num">${v}</b>${s ? `<span class="tiny muted">${s}</span>` : ''}</div>`;
    return `<section class="prof-hero">
        <div class="ph-ava">${avatar('xl')}<div class="ph-ava-b"><label class="btn btn-sm" title="Загрузить фото">${ico('camera')}Фото<input type="file" accept="image/jpeg,image/png,image/webp" data-chg="profAvatar" class="sr"></label>${p.avatar ? `<button class="btn btn-sm btn-ghost btn-icon" data-act="profAvatarDel" aria-label="Удалить фото">${ico('trash')}</button>` : ''}</div></div>
        <div class="ph-main"><div class="eyebrow">ISA PERSONAL FITNESS PROFILE</div><h1 class="disp ph-name">${esc(displayName())}</h1>
          <div class="row wrap mt-s"><span class="badge b-acc">${ico('star')}${LEVEL_NAME[lv]}</span><span class="badge">${LEVEL_DESC[lv]}</span>${p.level ? '' : `<span class="badge">уровень определён автоматически</span>`}</div>
          <div class="ph-xp mt"><div class="row between"><span class="small"><b>Уровень ${D.level}</b> · ${esc(D.title)}</span><span class="tiny muted">${fmtNum(D.xp)} / ${fmtNum(D.lvlTo)} XP</span></div>${pbar(lvPct, 'thin mt-s')}</div>
          <div class="row wrap mt"><button class="btn btn-acc" data-act="profEdit">${ico('edit')}Редактировать профиль</button><button class="btn" data-act="reOnboard">${ico('refresh')}Персонализация заново</button><span class="tiny muted">В PULLUP PRO с ${fmtDay(p.created || todayKey())}</span></div>
        </div></section>
      <div class="kpis kpis6 mt">
        ${kpi('Вес тела', wt.v ? `${fmtNum(wt.v)}<small>кг</small>` : '—', wt.date ? (Sm.weight30 != null ? `${sign(Sm.weight30)} кг за 30 дней` : `замер ${fmtDayShort(wt.date)}`) : 'из профиля', 'weight')}
        ${kpi('Рост', p.height ? `${fmtNum(p.height)}<small>см</small>` : '—', p.height ? 'указан в профиле' : 'необязательно', 'ruler')}
        ${kpi('Тренировок', fmtNum(Sm.workouts), `${fmtMin(Sm.totalMinutes * 60)} всего`, 'cal')}
        ${kpi('Эта неделя', `${Sm.weekCount}<small>/ ${Sm.weekTarget}</small>`, Sm.weekCount >= Sm.weekTarget ? 'цель выполнена' : 'тренировок по цели', 'target')}
        ${kpi('Постоянство', `${Sm.consistency}<small>нед.</small>`, 'подряд с выполненной целью', 'flame')}
        ${kpi('Достижения', `${got.length}<small>/ ${allAch.length}</small>`, got[0] ? `последнее ${fmtDayShort(S.ach[got[0].id])}` : 'первое впереди', 'trophy')}
      </div>
      <div class="grid g2 mt-l">
        <div class="card"><div class="card-head"><h3>${ico('target')}Цели</h3><button class="btn btn-sm btn-ghost" data-act="profEdit" data-sec="goals">${ico('edit')}Изменить</button></div>
          ${(p.goals || []).length ? `<div class="chips">${(p.goals || []).map(g => `<span class="chip on">${esc((GOALM[g] || { name: g }).name)}</span>`).join('')}</div>` : `<div class="small muted">Цели не выбраны — рекомендации строятся по общим правилам.</div>`}
          <div class="divider"></div>
          <div class="prof-facts">
            <div><span class="tiny muted">Формат</span><b class="small">${esc(FORMAT_NAME[p.format || ''] || 'не указан')}</b></div>
            <div><span class="tiny muted">Дней в неделю</span><b class="small">${p.weeklyTarget || 3}</b></div>
            <div><span class="tiny muted">Схема</span><b class="small">${esc(SPLIT_NAME[p.split || 'auto'] || 'Авто')}</b></div>
            <div><span class="tiny muted">Опыт</span><b class="small">${esc(EXP_NAME[p.experience || ''] || 'не указан')}</b></div>
          </div>
          <div class="tiny muted mt-s">${ico('build')} Оборудование: ${eq.length ? esc(eq.join(', ')) : Array.isArray(p.equipment) ? 'только пол и стена' : 'не указано (считается, что есть турник)'}</div></div>
        <div class="card"><div class="card-head"><h3>${ico('prog')}Текущий план</h3><a class="hint link-btn" href="#/plan">Мой план</a></div>
          ${S.profile.split === 'pullup' ? `<div class="small tx2">Классическая программа подтягиваний 1.0. Следующая: <b>${esc(LG.nextWorkout() ? LG.nextWorkout().w.name : '—')}</b>.</div>` : `<div class="prog-name">${esc(P.name)}</div><div class="small muted">${esc(P.goal)} · ${esc(P.freq)}</div>
          ${w ? `<div class="next-plan mt"><span class="li-ico acc">${ico('play')}</span><div class="grow"><b class="small">Следующая: ${esc(w.name)}</b><div class="tiny muted">${esc(w.focus)}</div></div><button class="btn btn-sm btn-acc" data-act="stEngine" data-p="${P.id}" data-i="${nextIndex(S as any, P.id)}">Старт</button></div>` : ''}`}
          <div class="tiny muted mt-s">Рекомендация по анкете: ${esc((PROGM_V2[recommendProgram(S as any)] || P).name)} · уровень по результатам: ${LEVEL_NAME[sug.level]}</div></div>
      </div>
      <div class="grid g2 mt">
        <div class="card"><div class="card-head"><h3>${ico('weight')}Вес тела</h3><button class="btn btn-sm" data-act="bodyAdd">${ico('plus')}Записать</button></div>
          ${ws.length >= 2 ? CH.slot({ type: 'line', labels: ws.map(x => fmtDayShort(x.date)), tips: ws.map(x => fmtDay(x.date)), series: [{ name: 'Вес', data: ws.map(x => x.v), fmt: v => `${fmtNum(v)} кг` }], aria: 'История веса' }, 210)
            : emptyBox(ws.length ? 'Нужен ещё один замер' : 'История веса пуста', 'Записывайте вес раз в неделю утром — здесь появится график изменений.', 'weight')}
          ${ws.length ? `<div class="tiny muted mt-s">Замеров: ${ws.length} · первый ${fmtDayShort(ws[0].date)} (${fmtNum(ws[0].v)} кг) · <a class="link-btn" href="#/body">все замеры тела</a></div>` : ''}</div>
        <div class="card"><div class="card-head"><h3>${ico('trophy')}Лучшие результаты</h3><a class="hint link-btn" href="#/stats">Прогресс</a></div>
          <div class="bests">${best('Подтягивания', R.pull ? String(R.pull) : '—', 'строго, за подход')}${best('Отжимания', R.push ? String(R.push) : '—', 'за подход')}${best('Планка', R.plank ? fmtSec(R.plank) : '—')}${best('Приседания', R.squat ? String(R.squat) : '—')}${best('Брусья', R.dips ? String(R.dips) : '—')}${best('Вис', R.hang ? fmtSec(R.hang) : '—')}</div>
          <div class="tiny muted mt-s">Лучшее из анкеты, тестов и записанных подходов без отягощения.</div></div>
      </div>
      <div class="grid g3 mt">
        <div class="card"><div class="card-head"><h3>${ico('bolt')}Этапы Muscle-Up</h3><a class="hint link-btn" href="#/mu">Путь</a></div>
          <div class="timeline">${MU_STAGES.map(st => { const dn = S.mu.done[st.n]; return `<div class="tl ${dn ? 'done' : ''}"><span class="dt"></span><div class="grow"><b class="small">${st.n}. ${esc(st.title)}</b></div><span class="tiny ${dn ? 'ok' : 'muted'}">${dn ? fmtDayShort(dn) : '—'}</span></div>`; }).join('')}</div></div>
        <div class="card"><div class="card-head"><h3>${ico('medal')}Достижения</h3><a class="hint link-btn" href="#/achievements">Все</a></div>
          ${got.length ? `<div class="ach-mini">${got.slice(0, 6).map(a => `<div class="am tier-${a.tier || 'bronze'}" title="${esc(a.desc)}"><span class="medal-ico">${ico(a.icon)}</span><div class="grow" style="min-width:0"><b class="small ell">${esc(a.en || a.name)}</b><div class="tiny muted">${fmtDayShort(S.ach[a.id])}</div></div></div>`).join('')}</div>`
            : emptyBox('Пока нет наград', 'Первая — за первую сохранённую тренировку или первый замер тела.', 'medal')}</div>
        <div class="card"><div class="card-head"><h3>${ico('list')}Последние тренировки</h3><a class="hint link-btn" href="#/journal">Журнал</a></div>
          ${recent.length ? `<div class="stack s">${recent.map(s => { const v = sessionVolume(s as any); return `<a class="hist-row" href="#/journal"><div class="grow" style="min-width:0"><b class="small ell">${esc(s.title)}</b><div class="tiny muted">${fmtDay(s.date)} · ${pl(v.sets, ['подход', 'подхода', 'подходов'])}${s.durationSec ? ` · ${fmtMin(s.durationSec)}` : ''}</div></div>${ico('right', 'muted')}</a>`; }).join('')}</div>`
            : emptyBox('Тренировок пока нет', 'Начните первую — она появится здесь.', 'cal', `<button class="btn btn-sm btn-acc" data-act="startMenu">${ico('play')}START TRAINING</button>`)}</div>
      </div>
      <div class="card mt"><div class="card-head"><h3>${ico('chart')}Общая статистика</h3></div>
        <div class="prof-facts f4">
          <div><span class="tiny muted">Подходов</span><b>${fmtNum(Sm.totalSets)}</b></div><div><span class="tiny muted">Повторений</span><b>${fmtNum(Sm.totalReps)}</b></div>
          <div><span class="tiny muted">Время тренировок</span><b>${fmtMin(Sm.totalMinutes * 60)}</b></div><div><span class="tiny muted">Последний рекорд</span><b class="small">${Sm.lastPR ? `${esc(exOf(Sm.lastPR.ex).name)} · ${Sm.lastPR.kind === 'time' ? fmtSec(Sm.lastPR.v) : Sm.lastPR.kind === 'kg' ? `+${fmtNum(Sm.lastPR.v)} кг` : fmtNum(Sm.lastPR.v)}` : '—'}</b></div>
        </div></div>`;
  }
};

/* ---------- avatar: resized to 256 px JPEG, kept in the profile as a small data URL ---------- */
ACT.profAvatar = async el => {
  const f = el.files && el.files[0]; el.value = ''; if (!f) return;
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return toast('Нужен файл JPEG, PNG или WebP', 'err');
  if (f.size > 25e6) return toast('Файл слишком большой (больше 25 МБ)', 'err');
  try {
    const bmp = await loadImage(f), size = 256, c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d'), s = Math.min(bmp.width, bmp.height);
    ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
    let q = .86, url = c.toDataURL('image/jpeg', q);
    while (url.length > AVATAR_MAX && q > .4) { q -= .1; url = c.toDataURL('image/jpeg', q); }
    if (url.length > AVATAR_MAX) return toast('Не удалось уменьшить фото — попробуйте другое', 'err');
    S.profile.avatar = url; save(); updateShell(); toast('Фото профиля обновлено', 'ok'); rerender();
  } catch (e) { toast('Не удалось прочитать изображение', 'err'); }
};
function loadImage(f: File): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const url = URL.createObjectURL(f), im = new Image(); im.onload = () => { URL.revokeObjectURL(url); res(im); }; im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image')); }; im.src = url; });
}
ACT.profAvatarDel = async () => {
  if (!(await confirmBox('Удалить фото профиля?', 'Вместо фото будет показана первая буква имени.', 'Удалить', true))) return;
  delete S.profile.avatar; save(); updateShell(); rerender();
};

/* ---------- editor: every onboarding answer can be changed later ---------- */
export function upsertWeight(v: number, day = todayKey()) {
  const e = S.body.find(b => b.date === day);
  if (e) e.weight = v; else S.body.push({ id: uid(), date: day, weight: v });
  S.profile.bodyweight = v;
}
ACT.profEdit = el => {
  const p = S.profile, sec = el && el.dataset.sec;
  openModal({
    title: 'Профиль ISA', cls: 'wide',
    body: `<div class="form-grid">
        <label class="field"><span>Имя</span><input class="inp" id="pf-name" maxlength="30" value="${esc(p.name || 'ISA')}"></label>
        <div class="field"><span>Вес тела, кг</span>${stepper('pf-weight', p.bodyweight || 75, 30, 250, 0.5)}</div>
        <div class="field"><span>Рост, см (необязательно)</span><input class="inp" type="number" inputmode="numeric" id="pf-height" min="100" max="250" value="${p.height || ''}" placeholder="не указан"></div>
      </div>
      <div class="sec-t mt">Текущие результаты</div><div class="form-grid f3">${RESULT_FIELDS.map(f => `<div class="field"><span>${f.l}, ${f.u}</span>${stepper('pf-r-' + f.k, resultOf(f.k), 0, f.max, f.step)}</div>`).join('')}</div>
      <div class="sec-t mt">Оборудование</div>${pickChips('equipment', EQUIPMENT.map(e => ({ id: e.id, name: e.name, hint: e.hint })), Array.isArray(p.equipment) ? p.equipment : ['bar'])}
      <div class="tiny muted mt-s">Пол и стена доступны всегда — упражнения без оборудования есть в каждой группе.</div>
      <div class="sec-t mt">Формат тренировок</div>${pickSeg('format', FORMATS.map(f => [f[0], f[1]]), p.format || 'home', 'wrap')}
      <div class="sec-t mt">Тренировок в неделю</div>${pickSeg('days', [2, 3, 4, 5, 6].map(n => [n, String(n)]), p.weeklyTarget || 3)}
      <div class="sec-t mt">Схема программы</div>${pickSeg('split', SPLITS.map(s => [s[0], s[1]]), p.split || 'auto', 'wrap')}
      <div class="sec-t mt">Опыт тренировок</div>${pickSeg('exp', EXPERIENCE, p.experience || 'none', 'wrap')}
      <div class="sec-t mt" id="pf-goals">Основные цели</div>${pickChips('goals', GOALS, p.goals || [])}
      <div class="sec-t mt">Уровень</div>${pickSeg('level', [['auto', 'Авто'], ['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']], p.level || 'auto', 'wrap')}
      <div class="tiny muted mt-s" id="pf-lv"></div>`,
    foot: `<button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-acc" data-pf-ok>${ico('check')}Сохранить</button>`,
    onMount(box, m) {
      const lvHint = () => { $('#pf-lv', box).textContent = `Авто — по результатам и опыту. Сейчас: ${LEVEL_NAME[suggestLevel(S as any).level]}.`; };
      bindPicks(box); lvHint();
      if (sec === 'goals') setTimeout(() => { const g = $('#pf-goals', box); if (g) g.scrollIntoView({ block: 'start' }); }, 80);
      $('[data-pf-ok]', box).addEventListener('click', () => {
        const before = recommendProgram(S as any), oldW = +p.bodyweight || 0, oldMax = +p.maxPullups || 0;
        const name = String($('#pf-name', box).value || '').trim().slice(0, 30) || 'ISA';
        const wv = round1(clamp(numVal('#pf-weight', box, oldW || 75), 30, 250));
        const hRaw = String($('#pf-height', box).value || '').trim(), h = hRaw ? Math.round(parseFloat(hRaw.replace(',', '.'))) : 0;
        if (hRaw && !(h >= 100 && h <= 250)) return toast('Рост — от 100 до 250 см или оставьте поле пустым', 'err');
        p.name = name;
        if (h) p.height = h; else delete p.height;
        const res: any = { ...(p.results || {}) };
        for (const f of RESULT_FIELDS) { const v = clamp(Math.round(numVal('#pf-r-' + f.k, box, 0)), 0, f.max); if (f.k === 'maxPullups') p.maxPullups = v; else if (v) res[f.k] = v; else delete res[f.k]; }
        p.results = res;
        p.equipment = multiVal(box, 'equipment');
        p.format = (pickVal(box, 'format') || 'home') as any;
        p.weeklyTarget = clamp(+(pickVal(box, 'days') || 3), 1, 7);
        const sp = pickVal(box, 'split') || 'auto'; if (sp === 'auto') delete p.split; else p.split = sp;
        p.experience = (pickVal(box, 'exp') || 'none') as any;
        p.goals = multiVal(box, 'goals');
        const lv = pickVal(box, 'level') || 'auto'; if (lv === 'auto') delete p.level; else p.level = lv as Level;
        if (wv !== oldW) upsertWeight(wv);
        if (p.maxPullups !== oldMax) LG.resetPctAdj();
        const after = recommendProgram(S as any); let msg = 'Профиль сохранён';
        if (after !== before && (!S.engine.program || S.engine.program === before) && PROGM_V2[after]) { S.engine.program = after; S.engine.startedAt = todayKey(); msg += ` · программа: ${PROGM_V2[after].name}`; }
        save(); LG.checkAch(); updateShell(); m.close(); toast(msg, 'ok', 3500); rerender();
      });
    }
  });
};
