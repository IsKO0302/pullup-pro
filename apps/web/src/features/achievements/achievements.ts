import { pbar } from '../../components/ui';
import { pageHead } from '../../components/view';
import { ico } from '../../core/icons';
import { ROUTES } from '../../core/router';
import { S } from '../../core/state';
import { LG } from '../../services/logic';
import { ACH2, achCtx } from '@pullup/shared/catalog/ach2';
import { ACH } from '@pullup/shared/catalog/programs';
import { fmtDay } from '@pullup/shared/dates';
import { esc, fmtNum } from '@pullup/shared/util';
import type { Achievement } from '@pullup/shared/types';

/* ================= Achievements 2.0 (ЧАСТЬ 15.2) — awarded only from real logged data ================= */
const TIERS: [string, string][] = [['bronze', 'Бронза'], ['silver', 'Серебро'], ['gold', 'Золото'], ['platinum', 'Платина']];
const TIER_NAME = Object.fromEntries(TIERS) as Record<string, string>;
const fmtP = (a: Achievement, v: number) => /plank|1min/.test(a.id) ? `${fmtNum(v)} с` : fmtNum(v);

ROUTES.achievements = {
  title: 'Достижения',
  render() {
    const C = achCtx(S as any), D = LG.derive();
    const rows = ACH2.map(a => { const [c, t] = a.p(C); return { a, c, t, on: !!S.ach[a.id], r: t ? Math.min(1, c / t) : 0 }; });
    const got = rows.filter(x => x.on).length, legacyGot = ACH.filter(a => S.ach[a.id]).length;
    const soon = rows.filter(x => !x.on && x.r > 0).sort((a, b) => b.r - a.r).slice(0, 3);
    const tierCount = (t: string) => rows.filter(x => x.on && (x.a.tier || 'bronze') === t).length;
    const medal = (x, big = false) => `<div class="medal-card tier-${x.a.tier || 'bronze'} ${x.on ? 'on' : ''} ${big ? 'big' : ''}">
        <div class="medal" aria-hidden="true"><span class="medal-ico">${ico(x.on ? x.a.icon : 'lock')}</span></div>
        <div class="mc-b"><div class="mc-en">${esc(x.a.en || x.a.name)}</div><div class="mc-n">${esc(x.a.name)}</div><div class="mc-d">${esc(x.a.desc)}</div>
        ${x.on ? `<div class="tiny ok mt-s">${ico('check')} получено ${fmtDay(S.ach[x.a.id])} · ${TIER_NAME[x.a.tier || 'bronze']}</div>` : `${pbar(x.r, 'thin mt-s')}<div class="tiny muted mt-s">${fmtP(x.a, Math.min(x.c, x.t))} / ${fmtP(x.a, x.t)} · ${TIER_NAME[x.a.tier || 'bronze']}</div>`}</div></div>`;
    return pageHead('Достижения <em>2.0</em>', 'Награды выдаются только по вашим записям: тренировкам, тестам, замерам и этапам Muscle-Up.', `<a class="btn" href="#/report">${ico('report')}Отчёт недели</a>`, 'ACHIEVEMENTS') + `
      <div class="card ach-sum"><div class="row wrap between" style="gap:16px"><div><div class="ach-big num">${got}<small> / ${ACH2.length}</small></div><div class="small muted">наград ACHIEVEMENTS 2.0 · классических: ${legacyGot} / ${ACH.length}</div></div>
        <div class="tier-row">${TIERS.map(([t, n]) => `<div class="tier-pill tier-${t}"><span class="medal sm" aria-hidden="true"></span><b>${tierCount(t)}</b><span class="tiny muted">${n}</span></div>`).join('')}</div></div>
        ${pbar(got / ACH2.length, 'mt')}</div>
      ${soon.length ? `<div class="sec-t mt-l">Ближе всего</div><div class="medal-grid">${soon.map(x => medal(x, true)).join('')}</div>` : ''}
      <div class="sec-t mt-l">ACHIEVEMENTS 2.0</div>
      <div class="medal-grid">${rows.map(x => medal(x)).join('')}</div>
      <div class="sec-t mt-l">Классические достижения PULLUP PRO 1.0</div>
      <div class="ach-grid">${ACH.map(a => { const [c, t] = a.p(D), on = !!S.ach[a.id]; return `<div class="ach ${on ? 'on' : ''}" title="${esc(a.desc)}"><div class="ai">${ico(on ? a.icon : 'lock')}</div><div class="grow"><div class="an">${esc(a.name)}</div><div class="ad">${esc(a.desc)}</div>
        ${on ? `<div class="tiny ok mt-s">${ico('check')} ${fmtDay(S.ach[a.id])}</div>` : `${pbar(Math.min(1, c / t), 'thin')}<div class="tiny muted mt-s">${fmtNum(Math.min(c, t))} / ${fmtNum(t)}</div>`}</div></div>`; }).join('')}</div>
      <p class="tiny muted mt">За каждое достижение начисляется 100 XP. Достижения не отзываются, даже если результат позже снизится.</p>`;
  }
};
