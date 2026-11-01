import { openModal } from '../../components/modal';
import { toast } from '../../components/toast';
import { weekMuCount } from '../../components/view';
import { AUD } from '../../core/audio';
import { ACT } from '../../core/events';
import { ico } from '../../core/icons';
import { CUR, go, rerender } from '../../core/router';
import { S, save } from '../../core/state';
import { TR } from './train';
import { LG } from '../../services/logic';
import { exOf } from '@pullup/shared/catalog/exercises';
import { PROGM } from '@pullup/shared/catalog/programs';
import { PROGM_V2 } from '@pullup/shared/catalog/programs2';
import { GROUPM, GROUPS } from '@pullup/shared/catalog/muscles';
import { activeProgram, buildWorkout, deloadStatus, lightAdvice, nextIndex } from '@pullup/shared/engine';
import { daysBetween, fmtDay, todayKey } from '@pullup/shared/dates';
import { W, esc, pl, plural } from '@pullup/shared/util';

ACT.startMenu = () => {
  const r = LG.readiness(), P = activeProgram(S as any), idx = nextIndex(S as any, P.id), bw = buildWorkout(S as any, P.id, idx), M = LG.muState();
  const dl = deloadStatus(S as any), legacy = S.profile.split === 'pullup' ? LG.nextWorkout() : null;
  const opt = (attrs, icon, t, sub, cls = '') => `<button class="opt ${cls}" ${attrs}><span class="li-ico ${cls ? 'acc' : ''}">${ico(icon)}</span><span class="grow"><b>${t}</b><span class="small muted" style="display:block">${sub}</span></span>${ico('right', 'muted')}</button>`;
  const rec = legacy
    ? opt(`data-close data-act="stProg" data-p="${legacy.prog.id}" data-i="${legacy.idx}"`, 'bolt', `${legacy.prog.name} · ${legacy.w.name}`, `${legacy.w.focus} · ${pl(legacy.w.items.length, W.ex)}`, 'acc')
    : bw ? opt(`data-close data-act="stEngine" data-p="${P.id}" data-i="${idx}"`, 'bolt', `${P.name} · ${bw.w.name}`, `${bw.w.focus} · ${pl(bw.items.length, W.ex)}${dl.active ? ' · разгрузка' : ''}`, 'acc') : '';
  openModal({
    title: 'START TRAINING', cls: 'wide',
    body: `<div class="ready ${r.lvl}"><span class="dotc"></span><div><b>${r.title}</b><div class="small muted">${r.reasons.join(' ')}</div></div></div>
      <div class="sec-t mt-l">Рекомендуем</div>
      ${rec}
      ${legacy && bw ? opt(`data-close data-act="stEngine" data-p="${P.id}" data-i="${idx}"`, 'fullbody', `${P.name} · ${bw.w.name}`, bw.w.focus) : ''}
      <div class="sec-t mt-l">Тренировка по группе мышц</div>
      <div class="grp-pick">${GROUPS.map(g => `<button class="grp-b" data-close data-act="stGroup" data-g="${g.id}">${ico(g.icon)}<b>${g.en}</b><span>${g.name}</span></button>`).join('')}</div>
      <div class="sec-t mt-l">Другие варианты</div>
      <div class="stack s">
        ${M.cur ? opt(`data-close data-act="stMu" data-n="${M.cur.n}"`, 'zap', `Muscle-Up · Этап ${M.cur.n}`, M.cur.title) : ''}
        ${S.custom.map(c => opt(`data-close data-act="stCustom" data-id="${c.id}"`, 'build', esc(c.name), `Своя · ${pl(c.items.length, W.ex)}`)).join('')}
        ${opt('data-close data-act="stFree"', 'plus', 'Свободная тренировка', 'Добавляйте упражнения по ходу')}
        ${opt('data-close data-act="goLib"', 'book', 'Одно упражнение', 'Выберите в библиотеке')}
        ${opt('data-close data-act="testWizard"', 'test', 'Тест уровня', 'Максимум подтягиваний и вис')}
        ${opt('data-close data-act="logWorkout"', 'edit', 'Записать тренировку вручную', 'Если тренировались без приложения')}
      </div>`
  });
};
ACT.goLib = () => go('#/library');
ACT.logWorkout = () => go('#/journal/new');
ACT.moreMenu = () => {
  const items = [['plan', 'target', 'Мой план'], ['programs', 'prog', 'Программы'], ['mu', 'bolt', 'Muscle-Up'], ['library', 'book', 'Библиотека'], ['journal', 'list', 'Журнал'],
    ['body', 'ruler', 'Тело'], ['nutrition', 'apple', 'Питание'], ['calendar', 'cal', 'Календарь'], ['builder', 'build', 'Конструктор'], ['report', 'report', 'Отчёт недели'],
    ['profile', 'user', 'Профиль'], ['achievements', 'trophy', 'Достижения'], ['settings', 'gear', 'Настройки']];
  openModal({ title: 'Разделы', body: `<div class="more-grid">${items.map(([r, i, t]) => `<a href="#/${r}" data-close class="more-t ${CUR.name === r ? 'on' : ''}">${ico(i)}<span>${t}</span></a>`).join('')}</div>` });
};
/** reasons from the engine (deload week, light-session advice) shown in the pre-check */
function engineExtra() {
  const extra = [], dl = deloadStatus(S as any), la = lightAdvice(S as any);
  if (dl.active) extra.push(`Идёт разгрузочная неделя до ${fmtDay(dl.until)}: объём уже снижен.`);
  for (const x of la.reasons) if (!extra.includes(x)) extra.push(x);
  return extra;
}
ACT.stEngine = el => {
  const P = PROGM_V2[el.dataset.p]; if (!P) return toast('Программа не найдена', 'err');
  const i = +el.dataset.i || 0, w = P.workouts[i % P.workouts.length];
  precheck(light => LG.runEngine(P.id, i, light), `${P.name} · ${w.name}`, engineExtra());
};
ACT.stGroup = el => {
  const g = GROUPM[el.dataset.g]; if (!g) return;
  if (g.id === 'muscleup') { const M = LG.muState(); if (M.cur) return ACT.stMu({ dataset: { n: M.cur.n } }); }
  precheck(light => LG.runGroup(g.id, light), `${g.en} · ${g.name}`, g.id === 'mobility' ? [] : engineExtra(), g.id === 'mobility');
};
ACT.stProg = el => { const P = PROGM[el.dataset.p], i = +el.dataset.i || 0; precheck(light => LG.runProgram(P.id, i, light), `${P.name} · ${P.workouts[i].name}`); };
ACT.stMu = el => {
  const n = +el.dataset.n, extra = [], wc = weekMuCount();
  if (wc >= 2) extra.push(`На этой неделе уже ${wc} ${plural(wc, W.work)} Muscle-Up. Рекомендуется не более 2 в неделю.`);
  const last = LG.sortSess(S.sessions).reverse().find(s => s.source === 'mu');
  if (last && daysBetween(last.date, todayKey()) < 2) extra.push('С прошлой тренировки Muscle-Up прошло меньше 48 часов.');
  precheck(light => LG.runMu(n, light), `Muscle-Up · Этап ${n}`, extra);
};
ACT.stCustom = el => { const c = S.custom.find(x => x.id === el.dataset.id); if (!c) return toast('Тренировка не найдена', 'err'); if (!c.items.length) return toast('В тренировке нет упражнений', 'err'); precheck(light => LG.runCustom(c, light), c.name); };
ACT.stFree = () => precheck(() => LG.runFree(), 'Свободная тренировка', [], true);
ACT.stSingle = el => precheck(() => LG.runSingle(el.dataset.id), exOf(el.dataset.id).name, [], true);
ACT.stPlan = el => {
  const p = ((S.plan[el.dataset.k] || []).find(x => x.id === el.dataset.id)); if (!p) return;
  precheck(light => { const r: any = LG.runFromPlan(p, light); if (r) r.plan = { k: el.dataset.k, id: p.id }; return r; }, p.title);
};
/* Pre-training self-check: pain blocks training, low readiness suggests a light version */
export function precheck(build, label, extra = [], noLight = false) {
  const r = LG.readiness(), st = { feel: 0, sleep: '', pain: '' };
  const FEEL = ['Плохо', 'Так себе', 'Норм', 'Хорошо', 'Отлично'];
  const sg = (k, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-pk="${k}" data-v="${v}" class="${st[k] === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  let m;
  const draw = () => {
    const ready = st.pain && st.feel, light = st.pain === 'mild' || (st.feel && st.feel <= 2) || st.sleep === 'lt6' || r.lvl !== 'go' || extra.length;
    let res = '';
    if (st.pain === 'pain') res = `<div class="note n-bad">${ico('warn')}<div><b>Тренировка через боль запрещена.</b> Отдохните сегодня. Если боль острая, не проходит или повторяется — обратитесь к врачу или физиотерапевту.</div></div>`;
    else if (ready && light) res = `<div class="note n-warn">${ico('info')}<div><b>Рекомендуем лёгкую версию</b>${noLight ? '' : ': на 1 подход меньше и −20% повторов'}. Прогрессия в лёгкой тренировке не повышается.</div></div>`;
    else if (ready) res = `<div class="note n-ok">${ico('check')}<div><b>Всё в порядке.</b> Начните с разминки — она встроена в тренировку.</div></div>`;
    m.setBody(`<p class="small muted" style="margin-top:-4px">${esc(label)}</p>
      ${r.lvl !== 'go' || extra.length ? `<div class="ready ${extra.length && r.lvl === 'go' ? 'easy' : r.lvl} mb"><span class="dotc"></span><div><b>${r.lvl === 'go' ? 'Обратите внимание' : r.title}</b><div class="small muted">${[...(r.lvl !== 'go' ? r.reasons : []), ...extra].join(' ')}</div></div></div>` : ''}
      <div class="stack l">
        <div><div class="lbl mb">Как вы себя чувствуете?</div><div class="rate">${FEEL.map((f, i) => `<button type="button" data-pk="feel" data-v="${i + 1}" class="${st.feel === i + 1 ? 'on' : ''}">${i + 1}<small>${f}</small></button>`).join('')}</div></div>
        <div><div class="lbl mb">Сон прошлой ночью</div>${sg('sleep', [['lt6', 'меньше 6 ч'], ['6', '6–7 ч'], ['7', '7+ ч']])}</div>
        <div><div class="lbl mb">Есть боль в суставах или мышцах?</div>${sg('pain', [['no', 'Нет'], ['mild', 'Лёгкий дискомфорт'], ['pain', 'Есть боль']])}</div>
        ${res}
      </div>`);
    if (st.pain === 'pain') m.setFoot(`<button class="btn btn-ghost" data-close>Закрыть</button><button class="btn btn-acc" data-pa="rec">${ico('bed')}День восстановления</button>`);
    else if (!ready) m.setFoot(`<span class="small muted grow">Ответьте на вопросы о самочувствии и боли</span><button class="btn btn-ghost" data-close>Отмена</button>`);
    else if (light && !noLight) m.setFoot(`<button class="btn" data-pa="normal">Обычная версия</button><button class="btn btn-acc" data-pa="light">${ico('play')}Лёгкая версия</button>`);
    else m.setFoot(`<button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-acc" data-pa="normal">${ico('play')}Начать</button>`);
  };
  m = openModal({
    title: 'Проверка самочувствия',
    onMount(box) {
      box.addEventListener('click', e => {
        const b = e.target.closest('[data-pk]');
        if (b) { const k = b.dataset.pk, v = k === 'feel' ? +b.dataset.v : b.dataset.v; st[k] = v; AUD.tap(); draw(); return; }
        const a = e.target.closest('[data-pa]'); if (!a) return;
        if (a.dataset.pa === 'rec') { const k = todayKey(); S.daily[k] = { ...(S.daily[k] || {}), recovery: true }; save(); LG.checkAch(); m.close(); toast('Включён день восстановления. Берегите себя!', 'ok'); rerender(); return; }
        const run = build(a.dataset.pa === 'light'); m.close();
        if (!run) return toast('Не удалось подготовить тренировку', 'err');
        run.check = { feel: st.feel, sleep: st.sleep, pain: st.pain };
        TR.start(run);
      });
    }
  });
  draw();
}
