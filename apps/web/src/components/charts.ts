import { $$ } from '../core/dom';
import { esc, fmtNum, sum } from '@pullup/shared/util';

/* ================= Canvas charts (line / bar) with hover tooltips ================= */
export const CH = (() => {
  const reg = new Map(); let seq = 0;
  const cssv = n => getComputedStyle(document.body).getPropertyValue(n).trim();
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  function niceStep(v) { if (v <= 0) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; }
  function rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, Math.abs(h)); ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h); ctx.closePath(); }
  class Chart {
    [k: string]: any;
    constructor(el, cfg) {
      this.el = el; this.cfg = cfg; this.hover = -1; this.p = 0;
      const vals = cfg.series.flatMap(s => s.data).filter(v => v != null && isFinite(v));
      const empty = cfg.type === 'line' ? vals.length < 1 : !vals.some(v => v > 0);
      if (empty && !cfg.showEmpty) { el.innerHTML = `<div class="chart-empty">${cfg.emptyText || 'Пока нет данных за этот период'}</div>`; return; }
      el.innerHTML = '<canvas></canvas><div class="chart-tip"></div>';
      this.cv = el.querySelector('canvas'); this.tip = el.querySelector('.chart-tip'); this.ctx = this.cv.getContext('2d');
      this.cv.setAttribute('role', 'img'); this.cv.setAttribute('aria-label', cfg.aria || 'График');
      if ('ResizeObserver' in window) { this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(el); }
      const mv = e => this.move(e);
      this.cv.addEventListener('pointermove', mv); this.cv.addEventListener('pointerdown', mv);
      this.cv.addEventListener('pointerleave', () => { this.hover = -1; this.tip.classList.remove('on'); this.draw(); });
      this.resize(); this.animate();
    }
    resize() {
      if (!this.el.isConnected) { if (this.ro) this.ro.disconnect(); return; }
      const r = this.el.getBoundingClientRect(), dpr = Math.min(2.5, window.devicePixelRatio || 1);
      if (!r.width || !r.height) return;
      this.w = r.width; this.h = r.height; this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.draw();
    }
    animate() { const t0 = performance.now(), d = 800; const step = now => { this.p = Math.min(1, (now - t0) / d); this.draw(); if (this.p < 1 && this.el.isConnected) requestAnimationFrame(step); }; requestAnimationFrame(step); }
    layout() {
      const c = this.cfg, ctx = this.ctx, n = c.labels.length;
      let max = 0;
      if (c.stacked) for (let i = 0; i < n; i++) max = Math.max(max, sum(c.series.map(s => s.data[i] || 0)));
      else c.series.forEach(s => s.data.forEach(v => { if (v != null) max = Math.max(max, v); }));
      if (c.goal) max = Math.max(max, c.goal.value);
      let min = c.yMin != null ? c.yMin : 0;
      if (c.type === 'line' && c.yMin == null) { const vs = c.series.flatMap(s => s.data).filter(v => v != null); min = Math.max(0, Math.floor(Math.min(...vs) * .8)); }
      const ints = c.series.every(s => s.data.every(v => v == null || Number.isInteger(v))) && (!c.goal || Number.isInteger(c.goal.value));
      let step = niceStep(Math.max(1e-6, (max - min) / 4) || 1);
      if (ints) { step = step < 1 ? 1 : Number.isInteger(step) ? step : Math.round(step); min = Math.floor(min / step) * step; }
      const top = Math.max(min + step, min + Math.ceil((max - min) / step - 1e-9) * step);
      const fmt = c.fmt || (v => fmtNum(v));
      ctx.font = '600 11px system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif';
      const ticks = []; for (let v = min; v <= top + 1e-9; v += step) ticks.push(v);
      const lw = Math.max(...ticks.map(v => ctx.measureText(fmt(v)).width));
      const L: any = { l: lw + 14, r: 10, t: 12, b: 26 };
      L.pw = this.w - L.l - L.r; L.ph = this.h - L.t - L.b; L.min = min; L.top = top; L.ticks = ticks; L.fmt = fmt; L.n = n;
      L.y = v => L.t + L.ph - ((v - min) / (top - min)) * L.ph;
      if (c.type === 'bar') { L.band = L.pw / n; L.x = i => L.l + L.band * (i + .5); }
      else L.x = i => L.l + (n <= 1 ? L.pw / 2 : i * L.pw / (n - 1));
      return L;
    }
    color(i) { const s = this.cfg.series[i]; return s.color || [cssv('--acc') || '#ff6a1a', '#f1f1f4', '#35d07f', '#ffb21e'][i % 4]; }
    draw() {
      if (!this.ctx || !this.w) return;
      const c = this.cfg, ctx = this.ctx, L = this.layout(), p = easeOut(this.p);
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.font = '600 11px system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif'; ctx.textBaseline = 'middle';
      L.ticks.forEach(v => { const y = Math.round(L.y(v)) + .5; ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L.l, y); ctx.lineTo(this.w - L.r, y); ctx.stroke(); ctx.fillStyle = '#7f7f8b'; ctx.textAlign = 'right'; ctx.fillText(L.fmt(v), L.l - 8, y); });
      // x labels
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const maxW = Math.max(...c.labels.map(s => ctx.measureText(String(s)).width)) + 10;
      const every = Math.max(1, Math.ceil(maxW / (L.pw / Math.max(1, L.n))));
      c.labels.forEach((lab, i) => { if ((L.n - 1 - i) % every) return; ctx.fillStyle = i === c.highlight ? '#f4f4f6' : '#7f7f8b'; const tw = ctx.measureText(String(lab)).width; ctx.fillText(String(lab), Math.min(this.w - tw / 2 - 2, Math.max(tw / 2 + 2, L.x(i))), this.h - 8); });
      // goal
      if (c.goal) { const y = Math.round(L.y(c.goal.value)) + .5; ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(255,178,30,.75)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(L.l, y); ctx.lineTo(this.w - L.r, y); ctx.stroke(); ctx.restore(); }
      if (c.type === 'bar') this.drawBars(L, p); else this.drawLines(L, p);
      if (c.goal) { const y = Math.round(L.y(c.goal.value)) + .5, t = c.goal.label || ('цель ' + c.goal.value); ctx.font = '700 10.5px system-ui,Arial,sans-serif'; const tw = ctx.measureText(t).width, x2 = this.w - L.r - 2, ty = y - 5 < 10 ? y + 13 : y - 5; ctx.fillStyle = 'rgba(17,17,21,.88)'; rr(ctx, x2 - tw - 6, ty - 10, tw + 8, 14, 4); ctx.fill(); ctx.fillStyle = '#ffb21e'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x2, ty); }
      if (this.hover >= 0) {
        const x = L.x(this.hover); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(x) + .5, L.t); ctx.lineTo(Math.round(x) + .5, L.t + L.ph); ctx.stroke();
      }
    }
    drawBars(L, p) {
      const c = this.cfg, ctx = this.ctx, ns = c.series.length, bw = Math.max(2, Math.min(42, L.band * .64));
      const acc = this.color(0), acc2 = cssv('--acc2') || '#ff2e2e';
      for (let i = 0; i < L.n; i++) {
        let base = L.min;
        const dim = this.hover >= 0 && this.hover !== i;
        for (let s = 0; s < ns; s++) {
          const v = c.series[s].data[i] || 0; if (v <= 0) continue;
          let x, w = c.stacked ? bw : bw / ns, y0, y1;
          x = L.x(i) - bw / 2 + (c.stacked ? 0 : s * w);
          if (c.stacked) { y0 = L.y(base); y1 = L.y(base + v * p); base += v; } else { y0 = L.y(L.min); y1 = L.y(L.min + (v - L.min) * p); }
          let fill;
          if (s === 0 && !c.series[0].color) { const g = ctx.createLinearGradient(0, y1, 0, y0); g.addColorStop(0, acc); g.addColorStop(1, acc2); fill = g; } else fill = this.color(s);
          ctx.globalAlpha = dim ? .45 : 1; ctx.fillStyle = fill;
          rr(ctx, x + (c.stacked ? 0 : .5), y1, w - (c.stacked ? 0 : 1), y0 - y1, c.stacked && s < ns - 1 ? 0 : 4); ctx.fill();
          ctx.globalAlpha = 1;
        }
        if (i === c.highlight) { ctx.fillStyle = '#f4f4f6'; ctx.beginPath(); ctx.arc(L.x(i), L.t + L.ph + 4, 2, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    drawLines(L, p) {
      const c = this.cfg, ctx = this.ctx;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, L.l + (L.pw + 20) * p, this.h); ctx.clip();
      c.series.forEach((s, si) => {
        const col = this.color(si), pts = [];
        s.data.forEach((v, i) => { if (v != null) pts.push([L.x(i), L.y(v), i]); });
        if (!pts.length) return;
        if (si === 0 && pts.length > 1 && !s.noFill) { const g = ctx.createLinearGradient(0, L.t, 0, L.t + L.ph); g.addColorStop(0, col + '55'); g.addColorStop(1, col + '00'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(pts[0][0], L.t + L.ph); pts.forEach(q => ctx.lineTo(q[0], q[1])); ctx.lineTo(pts[pts.length - 1][0], L.t + L.ph); ctx.closePath(); ctx.fill(); }
        ctx.strokeStyle = col; ctx.lineWidth = s.width || 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; if (s.dash) ctx.setLineDash(s.dash);
        ctx.beginPath(); pts.forEach((q, k) => k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke(); ctx.setLineDash([]);
        if (pts.length <= 60 && !s.noDots) pts.forEach(q => { const h = q[2] === this.hover; ctx.fillStyle = '#0e0e11'; ctx.beginPath(); ctx.arc(q[0], q[1], h ? 6 : 3.6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = h ? 3 : 2; ctx.stroke(); });
      });
      ctx.restore();
    }
    move(e) {
      if (!this.w) return;
      const r = this.cv.getBoundingClientRect(), mx = e.clientX - r.left, L = this.layout();
      let best = -1, bd = 1e9;
      for (let i = 0; i < L.n; i++) { const d = Math.abs(L.x(i) - mx); if (d < bd) { bd = d; best = i; } }
      if (this.cfg.type === 'line' && this.cfg.series.every(s => s.data[best] == null)) best = -1;
      if (best !== this.hover) { this.hover = best; this.draw(); }
      if (best < 0) { this.tip.classList.remove('on'); return; }
      const c = this.cfg, t = c.tips ? c.tips[best] : c.labels[best];
      const rows = c.series.map((s, si) => s.data[best] == null ? '' : `<div><span class="dot" style="background:${this.color(si)}"></span>${esc(s.name)}: <b style="display:inline;color:var(--tx);font-size:12.5px">${(s.fmt || c.tipFmt || fmtNum)(s.data[best])}</b></div>`).join('');
      this.tip.innerHTML = `<b>${esc(t)}</b>${rows}${c.extra ? c.extra(best) : ''}`;
      this.tip.classList.add('on');
      const tw = this.tip.offsetWidth, x = L.x(best);
      let left = x + 14; if (left + tw > this.w) left = x - tw - 14; if (left < 0) left = 4;
      this.tip.style.left = left + 'px'; this.tip.style.top = '6px';
    }
  }
  function slot(cfg, h = 220, cls = '') {
    const id = 'ch' + (++seq); reg.set(id, cfg);
    const pal = ['var(--acc)', '#f1f1f4', '#35d07f', '#ffb21e'];
    const leg = cfg.legend ? `<div class="ch-leg">${cfg.series.map((s, i) => `<span><i class="${s.dash ? 'dash' : ''}" style="--c:${s.color || pal[i % 4]}"></i>${esc(s.name)}</span>`).join('')}${cfg.goal ? `<span><i class="dash" style="--c:#ffb21e"></i>${esc(cfg.goal.label || 'цель')}</span>` : ''}</div>` : '';
    return `<div class="chart ${cls}" data-chart="${id}" style="height:${h}px"></div>${leg}`;
  }
  function mountAll(root = document) { $$('[data-chart]', root).forEach(el => { if (el._chart) return; const cfg = reg.get(el.dataset.chart); if (cfg) { el._chart = new Chart(el, cfg); reg.delete(el.dataset.chart); } }); }
  function reset() { reg.clear(); }
  return { slot, mountAll, reset };
})();
