import { confirmBox } from '../../components/modal';
import { toast } from '../../components/toast';
import { $ } from '../../core/dom';
import { ACT } from '../../core/events';
import { ico } from '../../core/icons';
import { runStore } from '../../core/state';
import { TR } from './train';
import { fmtClock } from '@pullup/shared/dates';
import { W, esc, pl } from '@pullup/shared/util';

/* ================= Boot: onboarding, resume banner, router start ================= */
export function showResume() {
  const rr = $('#resume-root'); if (!rr) return;
  const r = runStore.get();
  if (!r || TR.active() || !Array.isArray(r.items)) { rr.innerHTML = ''; return; }
  const done = r.items.reduce((a, it) => a + (it.sets || []).filter(s => s.done === true).length, 0);
  const ms = (r.activeMs || 0) + (r.paused ? 0 : Math.max(0, (r.savedAt || r.tickAt) - r.tickAt));
  rr.innerHTML = `<div class="resume" role="status">${ico('timer', 'acc')}<div class="grow"><b>Незавершённая тренировка</b><div class="small muted">${esc(r.title)} · ${pl(done, W.set)} · ${fmtClock(ms / 1000)}</div></div>
    <button class="btn btn-sm btn-acc" data-act="resumeRun">${ico('play')}Продолжить</button><button class="btn btn-sm btn-ghost" data-act="dropRun">Удалить</button></div>`;
}
ACT.resumeRun = () => TR.resume();
ACT.dropRun = async () => { if (await confirmBox('Удалить незавершённую тренировку?', 'Выполненные в ней подходы не сохранятся в журнал.', 'Удалить', true)) { runStore.clear(); showResume(); toast('Удалено', 'ok'); } };
