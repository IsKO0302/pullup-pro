import { FIG } from '../../components/figure';
import { confirmBox } from '../../components/modal';
import { toast } from '../../components/toast';
import { checkbox, pbar, ring } from '../../components/ui';
import { pageHead, speedSeg } from '../../components/view';
import { AUD, buzz } from '../../core/audio';
import { ACT } from '../../core/events';
import { ico } from '../../core/icons';
import { ROUTES, go, rerender } from '../../core/router';
import { S, save } from '../../core/state';
import { LG } from '../../services/logic';
import { exOf } from '@pullup/shared/catalog/exercises';
import { MU_SAFETY } from '@pullup/shared/catalog/programs';
import { fmtDay, fmtSec, todayKey } from '@pullup/shared/dates';
import { clamp, fmtNum } from '@pullup/shared/util';

/* ================= Muscle-Up path (6 stages) ================= */
ROUTES.mu = {
  title: 'Muscle-Up',
  render(n) {
    const M = LG.muState(), sel = clamp(+n || (M.cur ? M.cur.n : 6), 1, 6), s = M.st[sel - 1];
    const locked = !s.done && M.st.slice(0, sel - 1).some(x => !x.done), isCur = M.cur && M.cur.n === sel;
    const work = LG.planItems(s.work);
    return pageHead('Путь к <em>Muscle-Up</em>', 'Шесть этапов от силовой базы до чистого выхода силой. Переход дальше — только по критериям, а не по срокам: у каждого свой темп.',
      `<div class="row">${ring(M.pct, 70, 7, `<div class="rg-v" style="font-size:16px">${Math.round(M.pct * 100)}%</div>`)}<div><b>${M.done} из 6</b><div class="small muted">этапов пройдено</div></div></div>`, 'Выход силой') + `
    <div class="note n-warn mb-l">${ico('shield')}<div><b>Безопасность прежде всего.</b><ul class="ul mt-s">${MU_SAFETY.map(x => `<li>${x}</li>`).join('')}</ul></div></div>
    <div class="mu-steps">${M.st.map(x => {
      const c = x.done ? 'done' : (M.cur && M.cur.n === x.n) ? 'cur' : 'lock';
      return `<a href="#/mu/${x.n}" class="mu-st ${c} ${x.n === sel ? 'sel' : ''}" ${x.n === sel ? 'aria-current="step"' : ''}><span class="n">0${x.n}</span><span class="t">${x.title}</span>
        <span class="s">${x.done ? 'Пройден' : c === 'cur' ? `Критерии ${x.met}/${x.crit.length}` : `${ico('lock')} Закрыт`}</span>${pbar(x.done ? 1 : x.met / x.crit.length, x.done ? 'ok thin' : 'thin')}</a>`;
    }).join('')}</div>
    <div class="ex-detail">
      <div class="fig-box">${FIG.tag(s.anim, 'data-prog="1" data-land="1"')}
        <div class="row between mt">${speedSeg()}<span class="tiny muted">Нажмите на фигуру — пауза</span></div></div>
      <div class="stack l">
        <div><div class="eyebrow">Этап ${s.n} из 6</div><h2 class="disp" style="font-size:clamp(26px,3.2vw,38px)">${s.title}</h2>
          <div class="row wrap mt-s">${s.done ? `<span class="badge b-ok">${ico('check')}Пройден ${fmtDay(S.mu.done[s.n])}</span>` : isCur ? '<span class="badge b-acc">Текущий этап</span>' : '<span class="badge">Закрыт</span>'}</div></div>
        <p class="tx2" style="margin:0">${s.goal}</p>
        ${locked ? `<div class="note">${ico('lock')}<div>Этот этап откроется после выполнения критериев предыдущих этапов. Изучите технику заранее, но тренируйте его позже.</div></div>` : ''}
        <div class="card"><div class="card-head"><h3>${ico('target')}Критерии перехода</h3><span class="hint">${s.met}/${s.crit.length}</span></div>
          <div class="stack s">${s.crit.map(c => c.auto ? `<div class="crit ${c.met ? 'met' : ''}">${ico(c.met ? 'check' : 'target')}<span>${c.label}<span class="tiny muted" style="display:block">считается автоматически по журналу и тестам</span></span><span class="cv">${fmtNum(c.cur)}${LG.metricUnit(c.metric)} / ${c.target}${LG.metricUnit(c.metric)}</span></div>`
            : checkbox('muCheck', c.met, c.label, 'отметьте вручную, когда выполните', `data-id="${c.id}" ${locked ? 'disabled' : ''}`)).join('')}</div>
          <div class="btns mt">${s.done ? `<button class="btn btn-ghost btn-sm" data-act="muUndo" data-n="${s.n}">${ico('refresh')}Снять отметку</button>`
            : !locked && s.ready ? `<button class="btn btn-acc" data-act="muDone" data-n="${s.n}">${ico('check')}Этап пройден</button>`
            : !locked ? `<span class="small muted">Выполните все критерии, чтобы открыть следующий этап.</span>` : ''}</div></div>
        <div class="wk"><div class="wk-h"><div><b>Тренировка этапа</b> <span class="small muted">· ${s.dose}</span></div>
          ${locked ? '' : `<button class="btn btn-sm btn-acc" data-act="stMu" data-n="${s.n}">${ico('play')}Начать</button>`}</div>
          ${work.map(it => `<div class="wk-r"><a href="#/library/${it.ex}">${exOf(it.ex).name}</a><span class="dose">${LG.doseText(it)}</span><span class="rest">отдых ${fmtSec(it.rest)}</span></div>`).join('')}</div>
        <div class="grid g2">
          <div class="card"><div class="card-head"><h3>${ico('list')}Техника</h3></div><ol class="ol small">${s.tech.map(x => `<li>${x}</li>`).join('')}</ol></div>
          <div class="stack l">
            <div class="card"><div class="card-head"><h3>${ico('user')}Положение тела</h3></div><p class="small tx2" style="margin:0">${s.body}</p></div>
            <div class="card"><div class="card-head"><h3>${ico('core')}Мышцы</h3></div><div class="tags">${s.muscles.map(x => `<span class="tag">${x}</span>`).join('')}</div></div>
          </div>
        </div>
        <div class="card"><div class="card-head"><h3>${ico('warn')}Частые ошибки</h3></div><ul class="ul small tx2">${s.mistakes.map(x => `<li>${x}</li>`).join('')}</ul></div>
        <div class="note n-bad">${ico('warn')}<div><b>Важно.</b> ${s.warn}</div></div>
        <div class="row between">${s.n > 1 ? `<a class="btn btn-ghost" href="#/mu/${s.n - 1}">${ico('left')}Этап ${s.n - 1}</a>` : '<span></span>'}${s.n < 6 ? `<a class="btn btn-ghost" href="#/mu/${s.n + 1}">Этап ${s.n + 1} ${ico('right')}</a>` : ''}</div>
      </div>
    </div>`;
  }
};
ACT.muCheck = el => { S.mu.checks[el.dataset.id] = el.checked; save(); rerender(); };
ACT.muDone = el => {
  const n = +el.dataset.n, M = LG.muState(), s = M.st[n - 1];
  if (!s.ready || M.st.slice(0, n - 1).some(x => !x.done)) return toast('Сначала выполните все критерии', 'err');
  S.mu.done[n] = todayKey(); save(); AUD.done(); buzz([40, 60, 40]);
  toast(`Этап ${n} пройден! +250 XP`, 'xp', 4000); LG.checkAch();
  if (n < 6) go(`#/mu/${n + 1}`); else rerender();
};
ACT.muUndo = async el => {
  const n = +el.dataset.n;
  if (!(await confirmBox('Снять отметку?', `Этап ${n}${n < 6 ? ' и все следующие этапы' : ''} снова станут непройденными. Записи тренировок не удаляются.`, 'Снять отметку', true))) return;
  for (let i = n; i <= 6; i++) delete S.mu.done[i];
  save(); toast('Отметка снята', 'ok'); rerender();
};
