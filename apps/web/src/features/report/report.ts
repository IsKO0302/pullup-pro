import { openModal } from '../../components/modal';
import { toast } from '../../components/toast';
import { pbar } from '../../components/ui';
import { emptyBox, pageHead } from '../../components/view';
import { $ } from '../../core/dom';
import { ACT } from '../../core/events';
import { ico } from '../../core/icons';
import { ROUTES } from '../../core/router';
import { S } from '../../core/state';
import { displayName } from '../../layouts/shell';
import { exOf } from '@pullup/shared/catalog/exercises';
import { GROUPM } from '@pullup/shared/catalog/muscles';
import { MONTHS_G, addDays, dayKey, fmtDay, fmtDayShort, fmtSec, parseDay, todayKey, weekKey } from '@pullup/shared/dates';
import { LEVEL_NAME, userLevel } from '@pullup/shared/engine';
import { GROUP_ORDER, weekAdvice } from '@pullup/shared/report';
import { weekReport, type WeekReport } from '@pullup/shared/stats';
import { esc, fmtNum, round1 } from '@pullup/shared/util';
import type { PR } from '@pullup/shared/stats';

/* ================= Weekly Report (ЧАСТЬ 15.4) + shareable PNG card ================= */
const rangeName = (r: WeekReport) => { const a = parseDay(r.from), b = parseDay(r.to); return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MONTHS_G[b.getMonth()]} ${b.getFullYear()}` : `${a.getDate()} ${MONTHS_G[a.getMonth()]} – ${b.getDate()} ${MONTHS_G[b.getMonth()]} ${b.getFullYear()}`; };
const delta = (a: number, b: number) => { const d = a - b; return d === 0 ? '±0' : (d > 0 ? '+' : '−') + fmtNum(Math.abs(d)); };
const prText = (p: PR) => p.kind === 'time' ? `${fmtSec(p.v)} (было ${fmtSec(p.prev)})` : p.kind === 'kg' ? `+${fmtNum(p.v)} кг (было +${fmtNum(p.prev)})` : `${fmtNum(p.v)} (было ${fmtNum(p.prev)})`;
const isDay = (k: string) => /^\d{4}-\d{2}-\d{2}$/.test(k || '');

ROUTES.report = {
  title: 'Отчёт недели',
  render(day = '') {
    const ref = isDay(day) ? day : todayKey(), r = weekReport(S as any, ref), adv = weekAdvice(S as any, r);
    const prevWk = dayKey(addDays(parseDay(r.from), -7)), nextWk = dayKey(addDays(parseDay(r.from), 7)), cur = weekKey(todayKey());
    const groups = GROUP_ORDER.map(g => [g, Math.round((r.groups[g] || 0) * 10) / 10] as [string, number]).filter(x => x[1] > 0), gmax = Math.max(1, ...groups.map(x => x[1]));
    const goalOk = r.workouts >= r.target, empty = !r.workouts && !r.sets && !r.measurements;
    return pageHead('Отчёт <em>недели</em>', rangeName(r), `<button class="btn btn-acc" data-act="repPng" data-day="${r.from}">${ico('image')}Сохранить как изображение</button>`, 'WEEKLY REPORT') + `
      <div class="day-nav card flat"><a class="btn btn-sm btn-ghost btn-icon" href="#/report/${prevWk}" aria-label="Предыдущая неделя">${ico('left')}</a>
        <div class="grow center"><b>${fmtDayShort(r.from)} — ${fmtDayShort(r.to)}</b><div class="tiny muted">${r.from === cur ? 'текущая неделя — отчёт обновляется' : 'завершённая неделя'}</div></div>
        ${r.from !== cur ? `<a class="btn btn-sm" href="#/report">Эта неделя</a>` : ''}
        <a class="btn btn-sm btn-ghost btn-icon ${nextWk > cur ? 'disabled' : ''}" href="#/report/${nextWk > cur ? r.from : nextWk}" aria-label="Следующая неделя" ${nextWk > cur ? 'aria-disabled="true" tabindex="-1"' : ''}>${ico('right')}</a></div>
      ${empty ? emptyBox('За эту неделю записей нет', 'Отчёт заполнится, когда появятся тренировки или замеры.', 'report', `<button class="btn btn-sm btn-acc" data-act="startMenu">${ico('play')}START TRAINING</button>`) : ''}
      <div class="rep-card mt">
        <div class="rep-top"><div><div class="eyebrow">PULLUP PRO · WEEKLY REPORT</div><h2 class="disp">${esc(displayName())}</h2><div class="small muted">${LEVEL_NAME[userLevel(S as any)]} · ${rangeName(r)}</div></div>
          <div class="rep-goal ${goalOk ? 'ok' : ''}"><b class="num">${r.workouts}<small>/${r.target}</small></b><span>${goalOk ? 'цель выполнена' : 'тренировок'}</span></div></div>
        <div class="rep-kpis">
          <div><span>Тренировки</span><b class="num">${r.workouts}</b><i>${delta(r.workouts, r.prev.workouts)} к прошлой</i></div>
          <div><span>Подходы</span><b class="num">${fmtNum(r.sets)}</b><i>${delta(r.sets, r.prev.sets)}</i></div>
          <div><span>Повторения</span><b class="num">${fmtNum(r.reps)}</b><i>${delta(r.reps, r.prev.reps)}</i></div>
          <div><span>Минуты</span><b class="num">${fmtNum(r.minutes)}</b><i>${delta(r.minutes, r.prev.minutes)}</i></div>
        </div>
        <div class="grid g2 mt">
          <div class="card flat"><h4>${ico('trophy', 'acc')}Новые рекорды</h4>
            ${r.prs.length ? `<div class="stack s mt-s">${r.prs.slice(-6).reverse().map(p => `<div class="row between small"><span class="ell">${esc(exOf(p.ex).name)}${p.test ? ' · тест' : ''}</span><b class="nowrap">${prText(p)}</b></div>`).join('')}</div>` : '<div class="small muted mt-s">Рекордов на этой неделе нет — это нормально: прогресс идёт волнами.</div>'}
            <div class="tiny muted mt-s">Подтягивания: ${fmtNum(r.pull)} · отжимания: ${fmtNum(r.push)} · удержания: ${fmtSec(r.hold)}${r.bestDay ? ` · лучший день ${fmtDayShort(r.bestDay.date)} (${fmtNum(r.bestDay.sets)} подх.)` : ''}</div></div>
          <div class="card flat"><h4>${ico('fullbody', 'acc')}Группы мышц, подходы</h4>
            ${groups.length ? `<div class="stack s mt-s">${groups.map(([g, n]) => `<div class="rep-g"><span class="small">${esc(GROUPM[g] ? GROUPM[g].name : g)}</span>${pbar(n / gmax, 'thin')}<b class="small num">${fmtNum(n)}</b></div>`).join('')}</div>` : '<div class="small muted mt-s">Нет выполненных подходов.</div>'}</div>
          <div class="card flat"><h4>${ico('target', 'acc')}Цели</h4><div class="stack s mt-s small">
            <div class="row between"><span>Тренировок в неделю</span><b class="${goalOk ? 'ok' : ''}">${r.workouts} / ${r.target}${goalOk ? ' ✓' : ''}</b></div>
            <div class="row between"><span>Средняя тяжесть (RPE)</span><b>${r.avgRpe != null ? String(r.avgRpe).replace('.', ',') : '—'}</b></div>
            <div class="row between"><span>Дни с болью</span><b class="${r.painDays ? 'bad' : ''}">${r.painDays}</b></div></div></div>
          <div class="card flat"><h4>${ico('weight', 'acc')}Тело</h4><div class="stack s mt-s small">
            <div class="row between"><span>Вес</span><b>${r.weightEnd != null ? (r.weightStart != null && r.weightStart !== r.weightEnd ? `${fmtNum(r.weightStart)} → ${fmtNum(r.weightEnd)} кг (${r.weightEnd > r.weightStart ? '+' : '−'}${fmtNum(round1(Math.abs(r.weightEnd - r.weightStart)))})` : `${fmtNum(r.weightEnd)} кг`) : 'нет замера'}</b></div>
            <div class="row between"><span>Записей замеров</span><b>${r.measurements}</b></div><div class="row between"><span>Фото прогресса</span><b>${r.photos}</b></div></div></div>
        </div>
        <div class="note n-${adv.tone === 'warn' ? 'warn' : adv.tone === 'up' || adv.tone === 'ok' ? 'ok' : 'acc'} mt">${ico(adv.tone === 'warn' ? 'warn' : 'coach')}<div><b>Рекомендация на следующую неделю: ${esc(adv.title)}</b><div class="small mt-s">${esc(adv.text)}</div><div class="tiny muted mt-s">Правило: ${esc(adv.rule)} · это набор простых правил, а не медицинская оценка.</div></div></div>
      </div>`;
  }
};

/* ---------- PNG card (1080×1350, drawn on canvas — no external libraries) ---------- */
function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines = 4): number {
  const words = text.split(/\s+/); let line = '', n = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      n++; if (n === maxLines) { let l = line; while (ctx.measureText(l + '…').width > maxW && l.length) l = l.slice(0, -1); ctx.fillText(l + '…', x, y); return y + lh; }
      ctx.fillText(line, x, y); y += lh; line = words[i];
    } else line = test;
  }
  if (line) { ctx.fillText(line, x, y); y += lh; }
  return y;
}
export function drawReport(r: WeekReport): HTMLCanvasElement {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'), cs = getComputedStyle(document.body);
  const acc = (cs.getPropertyValue('--acc') || '#ff6a1a').trim() || '#ff6a1a', acc2 = (cs.getPropertyValue('--acc2') || '#ff2e2e').trim() || '#ff2e2e';
  const F = (w: string, s: number, fam = 'Arial, "Helvetica Neue", sans-serif') => `${w} ${s}px ${fam}`, DISP = '"Arial Black", "Segoe UI Black", Arial, sans-serif';
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b0b0e'); bg.addColorStop(1, '#151519'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W - 120, 120, 10, W - 120, 120, 560); glow.addColorStop(0, acc + '66'); glow.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  const P = 72; let y = 110;
  ctx.fillStyle = acc; ctx.font = F('bold', 26); ctx.fillText('PULLUP PRO  ·  WEEKLY REPORT', P, y);
  y += 92; ctx.fillStyle = '#ffffff'; ctx.font = `italic 900 84px ${DISP}`; ctx.fillText(displayName().toUpperCase().slice(0, 16), P, y);
  y += 50; ctx.fillStyle = '#a9a9b4'; ctx.font = F('normal', 30); ctx.fillText(`${LEVEL_NAME[userLevel(S as any)]}  ·  ${rangeName(r)}`, P, y);
  // goal ring
  const cx = W - P - 95, cy = 250, rad = 88, pct = Math.min(1, r.workouts / Math.max(1, r.target));
  ctx.lineWidth = 18; ctx.strokeStyle = '#2a2a31'; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
  const rg = ctx.createLinearGradient(cx - rad, cy - rad, cx + rad, cy + rad); rg.addColorStop(0, acc); rg.addColorStop(1, acc2);
  ctx.strokeStyle = rg; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(.001, pct)); ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `italic 900 60px ${DISP}`; ctx.fillText(`${r.workouts}/${r.target}`, cx, cy + 20);
  ctx.font = F('bold', 20); ctx.fillStyle = r.workouts >= r.target ? '#35d07f' : '#a9a9b4'; ctx.fillText(r.workouts >= r.target ? 'ЦЕЛЬ ВЫПОЛНЕНА' : 'ТРЕНИРОВОК', cx, cy + rad + 48); ctx.textAlign = 'left';
  // KPI tiles
  y = 420; const tiles: [string, string, string][] = [['ТРЕНИРОВКИ', String(r.workouts), delta(r.workouts, r.prev.workouts)], ['ПОДХОДЫ', fmtNum(r.sets), delta(r.sets, r.prev.sets)], ['ПОВТОРЕНИЯ', fmtNum(r.reps), delta(r.reps, r.prev.reps)], ['МИНУТЫ', fmtNum(r.minutes), delta(r.minutes, r.prev.minutes)]];
  const tw = (W - P * 2 - 3 * 20) / 4;
  tiles.forEach(([l, v, d], i) => {
    const x = P + i * (tw + 20); ctx.fillStyle = '#1b1b21'; roundRect(ctx, x, y, tw, 170, 22); ctx.fill();
    ctx.fillStyle = '#8a8a96'; ctx.font = F('bold', 20); ctx.fillText(l, x + 22, y + 42);
    ctx.fillStyle = '#fff'; ctx.font = `italic 900 54px ${DISP}`; ctx.fillText(v.replace(/\u00a0/g, ' '), x + 22, y + 108);
    ctx.fillStyle = d.startsWith('+') ? '#35d07f' : '#8a8a96'; ctx.font = F('bold', 20); ctx.fillText(`${d} к прошлой`, x + 22, y + 146);
  });
  // records + groups
  y = 650; ctx.fillStyle = acc; ctx.font = F('bold', 24); ctx.fillText('НОВЫЕ РЕКОРДЫ', P, y); ctx.fillText('ГРУППЫ МЫШЦ · ПОДХОДЫ', W / 2 + 20, y);
  ctx.font = F('normal', 28); let ly = y + 50;
  const prs = r.prs.slice(-5).reverse();
  if (!prs.length) { ctx.fillStyle = '#8a8a96'; ly = wrap(ctx, 'На этой неделе без новых рекордов — прогресс идёт волнами.', P, ly, W / 2 - P - 30, 38, 3); }
  for (const p of prs) { ctx.fillStyle = '#fff'; ctx.font = F('bold', 27); const n = exOf(p.ex).name; ctx.fillText(n.length > 22 ? n.slice(0, 21) + '…' : n, P, ly); ctx.fillStyle = acc; ctx.font = F('normal', 25); ctx.fillText(prText(p), P, ly + 34); ly += 82; }
  const groups = GROUP_ORDER.map(g => [g, r.groups[g] || 0] as [string, number]).filter(x => x[1] > 0).slice(0, 6), gmax = Math.max(1, ...groups.map(x => x[1]));
  let gy = y + 48; const gx = W / 2 + 20, gw = W - P - gx;
  if (!groups.length) { ctx.fillStyle = '#8a8a96'; ctx.font = F('normal', 28); ctx.fillText('Нет выполненных подходов', gx, gy); }
  for (const [g, n] of groups) {
    ctx.fillStyle = '#d6d6de'; ctx.font = F('normal', 25); ctx.fillText(GROUPM[g] ? GROUPM[g].name : g, gx, gy);
    ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = F('bold', 25); ctx.fillText(fmtNum(Math.round(n * 10) / 10), gx + gw, gy); ctx.textAlign = 'left';
    ctx.fillStyle = '#26262d'; roundRect(ctx, gx, gy + 14, gw, 12, 6); ctx.fill();
    const bg2 = ctx.createLinearGradient(gx, 0, gx + gw, 0); bg2.addColorStop(0, acc); bg2.addColorStop(1, acc2); ctx.fillStyle = bg2; roundRect(ctx, gx, gy + 14, Math.max(12, gw * n / gmax), 12, 6); ctx.fill();
    gy += 66;
  }
  // body + advice
  y = 1070; ctx.fillStyle = '#1b1b21'; roundRect(ctx, P, y - 58, W - P * 2, 230, 26); ctx.fill();
  ctx.fillStyle = acc; ctx.font = F('bold', 22); ctx.fillText('РЕКОМЕНДАЦИЯ НА СЛЕДУЮЩУЮ НЕДЕЛЮ', P + 30, y - 16);
  const adv = weekAdvice(S as any, r);
  ctx.fillStyle = '#fff'; ctx.font = F('bold', 30); let ay = wrap(ctx, adv.title, P + 30, y + 26, W - P * 2 - 60, 38, 2);
  ctx.fillStyle = '#b8b8c2'; ctx.font = F('normal', 24); wrap(ctx, adv.text, P + 30, ay + 4, W - P * 2 - 60, 32, 3);
  ctx.fillStyle = '#8a8a96'; ctx.font = F('normal', 24);
  const body = r.weightEnd != null ? `Вес: ${r.weightStart != null && r.weightStart !== r.weightEnd ? `${fmtNum(r.weightStart)} → ` : ''}${fmtNum(r.weightEnd)} кг` : 'Вес: нет замера';
  ctx.fillText(`${body}   ·   Подтягивания: ${fmtNum(r.pull)}   ·   Отжимания: ${fmtNum(r.push)}`.replace(/\u00a0/g, ' '), P, H - 64);
  ctx.textAlign = 'right'; ctx.fillText('ISA PERSONAL', W - P, H - 64); ctx.textAlign = 'left';
  return c;
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
ACT.repPng = el => {
  const r = weekReport(S as any, el.dataset.day || todayKey()), c = drawReport(r), url = c.toDataURL('image/png'), name = `pullup-pro-week-${r.from}.png`;
  const canShare = !!(navigator.share && (navigator as any).canShare);
  openModal({
    title: 'Карточка недели', cls: 'wide',
    body: `<img class="rep-img" src="${url}" alt="Отчёт недели ${esc(fmtDay(r.from))}"><p class="tiny muted mt-s">На телефоне можно также нажать и удерживать изображение, чтобы сохранить его.</p>`,
    foot: `${canShare ? `<button class="btn" data-rp-share>${ico('share')}Поделиться</button>` : ''}<button class="btn btn-acc" data-rp-dl>${ico('download')}Скачать PNG</button>`,
    onMount(box) {
      $('[data-rp-dl]', box).addEventListener('click', () => { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast('Изображение сохранено', 'ok'); });
      const sh = $('[data-rp-share]', box);
      if (sh) sh.addEventListener('click', () => c.toBlob(async b => {
        try { const f = new File([b], name, { type: 'image/png' }); if ((navigator as any).canShare({ files: [f] })) await navigator.share({ files: [f], title: 'PULLUP PRO · отчёт недели' }); else toast('Это устройство не умеет делиться файлами — скачайте PNG', 'info'); }
        catch (e) { if (e && e.name !== 'AbortError') toast('Не удалось поделиться', 'err'); }
      }, 'image/png'));
    }
  });
};
