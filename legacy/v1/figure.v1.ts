import { $$ } from '../core/dom';
import { ico } from '../core/icons';
import { W, clamp, esc, hashStr } from '@pullup/shared/util';

/* ================= Animated athlete figure (SVG, side view) ================= */
export const FIG = (() => {
  const L = { f: 24, u: 26, t: 50, th: 36, sh: 34 }, HR = 9, D2R = Math.PI / 180;
  const V = (a, len) => [Math.sin(a * D2R) * len, Math.cos(a * D2R) * len];
  const add = (p, v) => [p[0] + v[0], p[1] + v[1]];
  const lerp = (a, b, x) => a + (b - a) * x;
  const ease = x => .5 - Math.cos(Math.PI * x) / 2;
  const angOf = (dx, dy) => Math.atan2(dx, dy) / D2R;
  const DEF = { k: 0, hy: 0, nl: 9, t: 0, th: 0, sh: 0, n: 180, u: 0, f: 0 };
  /* two-bone IK: base A -> middle -> target T */
  function ik2(Ab, T, a, b, sgn, pinT) {
    const dx = T[0] - Ab[0], dy = T[1] - Ab[1]; let d = Math.hypot(dx, dy) || 1e-3;
    const ux = dx / d, uy = dy / d, max = a + b - .05;
    if (d >= max) {
      if (pinT) { const B = [T[0] - ux * max, T[1] - uy * max]; return { M: [B[0] + ux * a, B[1] + uy * a], A: B, T }; }
      return { M: [Ab[0] + ux * a, Ab[1] + uy * a], A: Ab, T: [Ab[0] + ux * max, Ab[1] + uy * max] };
    }
    d = Math.max(d, Math.abs(a - b) + .05);
    const c = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), g = Math.acos(c) * sgn;
    const ex = ux * Math.cos(g) - uy * Math.sin(g), ey = ux * Math.sin(g) + uy * Math.cos(g);
    return { M: [Ab[0] + ex * a, Ab[1] + ey * a], A: Ab, T };
  }
  function solve(an, P) {
    const J: any = {}, k = P.k || 0, a = L.u - k * .52, b = L.f - k * .48;
    if (an.root === 'h') {
      const H = [an.H[0], an.H[1] + (P.hy || 0)];
      const r = ik2([H[0] + P.S[0], H[1] + P.S[1]], H, a, b, an.eb || 1, true);
      J.H = H; J.E = r.M; J.S = r.A; J.P = add(J.S, V(P.t, L.t));
      if (P.F) { const q = ik2(J.P, P.F, L.th, L.sh, an.kb || -1, false); J.K = q.M; J.F = q.T; }
      else { J.K = add(J.P, V(P.th, L.th)); J.F = add(J.K, V(P.sh, L.sh)); }
    } else {
      if (an.root === 'f') { J.F = an.F; J.K = add(J.F, V(P.sh, L.sh)); J.P = add(J.K, V(P.th, L.th)); J.S = add(J.P, V(P.t, L.t)); }
      else { J.P = an.P; J.S = add(J.P, V(P.t, L.t)); J.K = add(J.P, V(P.th, L.th)); J.F = add(J.K, V(P.sh, L.sh)); }
      const HT = P.H || an.H;
      if (HT) { const r = ik2(J.S, HT, a, b, an.eb || 1, false); J.E = r.M; J.H = r.T; }
      else { J.E = add(J.S, V(P.u, a)); J.H = add(J.E, V(P.f, b)); }
    }
    const nl = P.nl == null ? 9 : P.nl;
    J.N = add(J.S, V(P.n, nl)); J.Hd = add(J.S, V(P.n, nl + HR));
    return J;
  }
  function lerpPose(p, q, x) {
    const o = {};
    for (const k of new Set([...Object.keys(p), ...Object.keys(q)])) {
      const a = p[k], b = q[k];
      if (Array.isArray(a) || Array.isArray(b)) { if (Array.isArray(a) && Array.isArray(b)) o[k] = [lerp(a[0], b[0], x), lerp(a[1], b[1], x)]; continue; }
      o[k] = lerp(a == null ? DEF[k] : a, b == null ? DEF[k] : b, x);
    }
    return o;
  }
  /* ---------- poses ---------- */
  const HANG = { S: [0, 50], t: -4, th: 10, sh: 2, n: 172, nl: 6 };
  const HANG2 = { S: [0, 50], t: -2, th: 13, sh: 0, n: 174, nl: 6 };
  const ACTV = { S: [0, 45], k: 5, t: -4, th: 10, sh: 2, n: 172, nl: 10 };
  const TOP = { S: [-16, 8.6], t: 6, th: 14, sh: 6, n: 165 };
  const TOP2 = { S: [-15, 10], t: 5, th: 12, sh: 4, n: 166 };
  const CTB = { S: [-21, -3], t: 30, th: 26, sh: 8, n: 160 };
  const HIGH = { S: [-22, -16], t: 34, th: 30, sh: 12, n: 158 };
  const FLY = Object.assign({}, HIGH, { hy: -12 });
  const KNEE = { S: [-2, 45], k: 5, t: 6, th: 112, sh: 8, n: 170, nl: 10 };
  const TOES = { S: [-14, 46], k: 2, t: 40, th: 200, sh: 188, n: 175, nl: 8 };
  const LSIT = { S: [0, 45], k: 5, t: -2, th: 90, sh: 90, n: 172, nl: 10 };
  const MHANG = { S: [0, 50], t: -4, th: 12, sh: -40, n: 172, nl: 6 };
  const MACT = { S: [-3, 45], k: 5, t: 4, th: 20, sh: -26, n: 170, nl: 10 };
  const MHIGH = { S: [-22, -16], t: 34, th: 32, sh: 6, n: 158 };
  const MTRANS = { S: [4, -18], t: -8, th: 18, sh: -8, n: 140 };
  const MDIP = { S: [10, -24], t: -26, th: 8, sh: -4, n: 148 };
  const MSUP = { S: [2, -50], t: -10, th: 4, sh: 2, n: 178 };
  const MSUP2 = { S: [2, -50], t: -7, th: 6, sh: 3, n: 176 };
  const LB0 = { S: [-8, 28], t: -2, F: [126, 262], n: 172 };
  const LBJ = { S: [-20, -12], t: 28, th: 14, sh: 4, n: 160 };
  const DTOP = { S: [2, -50], t: -6, th: -8, sh: -70, n: 178 };
  const DBOT = { S: [8, -24], t: -22, th: -10, sh: -72, n: 155 };
  /* ---------- animations ---------- */
  const PULL_KF = [[0, HANG, 'Лопатки вниз'], [450, ACTV], [800, ACTV, 'Тяга вверх'], [1700, TOP, 'Подбородок над перекладиной'], [2100, TOP, 'Подконтрольный спуск'], [3500, HANG, 'Вис'], [3900, HANG]];
  const AU0 = { sh: -96.7, th: -96.7, t: -96.7, n: -100 }, AU1 = { sh: -114.6, th: -114.6, t: -114.6, n: -125 };
  const PU0 = { sh: -114, th: -114, t: -114, n: -116 }, PU1 = { sh: -97, th: -97, t: -97, n: -99 };
  const PL0 = { sh: -102, th: -102, t: -102, u: 0, f: -90, n: -104 }, PL1 = { sh: -101.5, th: -101.5, t: -103, u: 0, f: -90, n: -105 };
  const LIE = { t: -90, th: 90, sh: 90, u: -90, f: -90, n: -90 }, HOL = { t: -101, th: 101, sh: 101, u: -104, f: -104, n: -108 };
  const PRN = { t: -90, th: 90, sh: 90, u: -90, f: -90, n: -92 }, YR = { t: -93, th: 91, sh: 91, u: -108, f: -108, n: -100 };
  const FP0 = { sh: 180, th: 180, t: 180, H: [80, 125], n: 180 }, FP1 = { sh: 180, th: 180, t: 180, H: [112, 112], n: 180 };
  const A = {
    pullup: { root: 'h', H: [100, 50], hl: ['u', 't'], kf: PULL_KF },
    weighted: { root: 'h', H: [100, 50], hl: ['u', 't'], plate: true, kf: PULL_KF },
    bandpull: { root: 'h', H: [100, 50], hl: ['u', 't'], band: true, kf: PULL_KF },
    pause: { root: 'h', H: [100, 50], hl: ['u', 't'], kf: [[0, HANG, 'Активный вис'], [400, ACTV, 'Тяга вверх'], [1400, TOP, 'Пауза 2 секунды'], [3400, TOP, 'Медленный спуск'], [4800, HANG, 'Вис'], [5200, HANG]] },
    negative: { root: 'h', H: [100, 50], hl: ['u', 't'], kf: [[0, TOP, 'Старт сверху (с опоры)'], [700, TOP, 'Медленный спуск 5 секунд'], [5700, HANG, 'Встаньте на опору'], [6300, HANG], [7200, TOP]] },
    explosive: { root: 'h', H: [100, 50], hl: ['u', 't'], kf: [[0, HANG, 'Активный вис'], [350, ACTV, 'Взрывная тяга'], [850, CTB, 'Грудь к перекладине'], [1150, CTB, 'Плавный спуск'], [2600, HANG, 'Вис'], [3100, HANG]] },
    ctb: { root: 'h', H: [100, 50], hl: ['u', 't'], kf: [[0, HANG, 'Активный вис'], [400, ACTV, 'Тяга к груди'], [1400, CTB, 'Касание грудью'], [1800, CTB, 'Подконтрольный спуск'], [3200, HANG, 'Вис'], [3600, HANG]] },
    highpull: { root: 'h', H: [100, 50], hl: ['u', 't'], kf: [[0, HANG, 'Активный вис'], [350, ACTV, 'Мощная тяга'], [1250, HIGH, 'Перекладина к низу груди'], [1650, HIGH, 'Подконтрольный спуск'], [3300, HANG, 'Вис'], [3700, HANG]] },
    clap: { root: 'h', H: [100, 50], hl: ['u', 't'], kf: [[0, HANG, 'Активный вис'], [350, ACTV, 'Взрыв'], [800, HIGH, 'Отрыв рук'], [1000, FLY, 'Хлопок'], [1250, HIGH, 'Мягкий хват'], [1500, HIGH, 'Спуск'], [2900, HANG, 'Вис'], [3400, HANG]] },
    hang: { root: 'h', H: [100, 50], hl: ['f'], kf: [[0, HANG, 'Пассивный вис'], [2200, HANG2, 'Дышите ровно'], [4400, HANG]] },
    activehang: { root: 'h', H: [100, 50], hl: ['t'], kf: [[0, HANG, 'Лопатки вниз и назад'], [900, ACTV, 'Удерживайте позицию'], [3900, ACTV, 'Мягко расслабьтесь'], [4700, HANG]] },
    flexhang: { root: 'h', H: [100, 50], hl: ['f', 'u'], kf: [[0, TOP, 'Удержание наверху'], [2500, TOP2, 'Подбородок над перекладиной'], [5000, TOP]] },
    towel: { root: 'h', H: [100, 68], barAt: [100, 50], towel: true, hl: ['f'], kf: [[0, HANG, 'Вис на полотенцах'], [2200, HANG2, 'Крепкий хват'], [4400, HANG]] },
    falsegrip: { root: 'h', H: [100, 50], hl: ['f'], kf: [[0, HANG, 'Запястье над перекладиной'], [900, ACTV, 'Удержание'], [3900, ACTV, 'Расслабьтесь'], [4700, HANG]] },
    scap: { root: 'h', H: [100, 50], hl: ['t'], kf: [[0, HANG, 'Лопатки вниз — руки прямые'], [800, ACTV, 'Пауза'], [1400, ACTV, 'Медленно вниз'], [2200, HANG, 'Пассивный вис'], [2700, HANG]] },
    kneeraise: { root: 'h', H: [100, 50], hl: ['t', 'th'], kf: [[0, HANG, 'Колени к груди'], [1000, KNEE, 'Пауза'], [1400, KNEE, 'Медленно вниз'], [2600, HANG, 'Без раскачки'], [3100, HANG]] },
    toes: { root: 'h', H: [100, 50], hl: ['t', 'th'], kf: [[0, HANG, 'Поднимайте прямые ноги'], [1200, TOES, 'Носки к перекладине'], [1600, TOES, 'Медленно опустите'], [3000, HANG, 'Активный вис'], [3500, HANG]] },
    lsit: { root: 'h', H: [100, 50], hl: ['t', 'th'], kf: [[0, HANG, 'Поднимите прямые ноги'], [900, LSIT, 'Ноги параллельно полу'], [3900, LSIT, 'Опустите ноги'], [4800, HANG, 'Вис'], [5300, HANG]] },
    muscleup: { root: 'h', H: [100, 84], bar: 'post', hl: ['u', 't'], kf: [[0, MHANG, 'Вис, ложный хват'], [350, MACT, 'Активные плечи'], [700, MACT, 'Взрывная тяга'], [1350, MHIGH, 'Переход'], [1700, MTRANS, 'Грудь над перекладиной'], [2100, MDIP, 'Выжимание'], [2800, MSUP, 'Упор'], [3400, MSUP, 'Подконтрольный спуск'], [4400, MDIP], [5000, MTRANS], [5600, MHIGH], [6500, MHANG, 'Вис'], [7000, MHANG]] },
    negmu: { root: 'h', H: [100, 84], bar: 'post', hl: ['u', 't'], kf: [[0, MSUP, 'Старт в упоре'], [600, MSUP, 'Медленно вниз'], [2200, MDIP, 'Нижняя точка'], [3600, MTRANS, 'Грудь под перекладину'], [5000, MHIGH, 'Контроль на тяге'], [6600, MHANG, 'Вис'], [7200, MHANG, 'Вернитесь в упор'], [7800, MHIGH], [8100, MTRANS], [8500, MDIP], [9100, MSUP]] },
    lowbar: { root: 'h', H: [100, 150], bar: 'post', floor: 262, hl: ['u', 't'], kb: -1, kf: [[0, LB0, 'Ноги на полу, ложный хват'], [800, LB0, 'Прыжок и тяга'], [1200, LBJ, 'Переход'], [1550, MTRANS, 'Грудь над перекладиной'], [1950, MDIP, 'Выжмите в упор'], [2600, MSUP, 'Упор'], [3300, MSUP, 'Спуститесь'], [4300, LB0]] },
    sbdips: { root: 'h', H: [100, 120], bar: 'post', hl: ['u', 't'], kf: [[0, MSUP, 'Опускание: грудь вперёд'], [1300, MDIP, 'Локти 90°'], [1650, MDIP, 'Выжимание'], [2800, MSUP, 'Упор'], [3200, MSUP]] },
    support: { root: 'h', H: [100, 120], bar: 'post', hl: ['u', 'f'], kf: [[0, MSUP, 'Упор на прямых руках'], [2500, MSUP2, 'Плечи вниз, корпус собран'], [5000, MSUP]] },
    dips: { root: 'h', H: [100, 150], bar: 'dip', floor: 262, hl: ['u', 't'], kf: [[0, DTOP, 'Опускание'], [1300, DBOT, 'Плечо параллельно полу'], [1650, DBOT, 'Выжимание'], [2800, DTOP, 'Упор'], [3200, DTOP]] },
    aussie: { root: 'f', F: [178, 250], H: [80, 192], bar: 'low', floor: 254, eb: 1, hl: ['u', 't'], kf: [[0, AU0, 'Тяга грудью к перекладине'], [1100, AU1, 'Пауза, лопатки сведены'], [1500, AU1, 'Медленно вниз'], [2700, AU0, 'Тело прямое'], [3100, AU0]] },
    pushup: { root: 'f', F: [172, 250], H: [62, 250], floor: 254, eb: -1, hl: ['u', 't'], kf: [[0, PU0, 'Опускание, локти назад'], [1200, PU1, 'Грудь у пола'], [1500, PU1, 'Выжмите себя'], [2600, PU0, 'Упор лёжа'], [3000, PU0]] },
    plank: { root: 'f', F: [172, 250], floor: 254, hl: ['t', 'th'], kf: [[0, PL0, 'Тело — прямая линия'], [2500, PL1, 'Пресс и ягодицы напряжены'], [5000, PL0]] },
    hollow: { root: 'p', P: [112, 240], floor: 250, hl: ['t', 'th'], kf: [[0, LIE, 'Поднимите плечи и ноги'], [900, HOL, 'Поясница прижата к полу'], [4200, HOL, 'Опуститесь'], [5000, LIE, 'Отдых'], [5600, LIE]] },
    ytw: { root: 'p', P: [124, 240], floor: 250, hl: ['u'], kf: [[0, PRN, 'Поднимите руки буквой Y'], [900, YR, 'Пауза 2 секунды'], [1700, YR, 'Медленно опустите'], [2600, PRN, 'Лёжа на животе'], [3000, PRN]] },
    facepull: { root: 'f', F: [128, 250], floor: 254, anchor: true, eb: 1, hl: ['u', 't'], kf: [[0, FP0, 'Тяга к лицу, локти высоко'], [900, FP1, 'Сведите лопатки'], [1400, FP1, 'Медленно верните'], [2400, FP0, 'Руки вперёд'], [2800, FP0]] },
    hero: { root: 'h', H: [100, 84], bar: 'post', hl: ['u', 't'], kf: [[0, HANG, ''], [400, ACTV], [1300, TOP], [1600, TOP], [2700, HANG], [3100, MHANG], [3400, MACT], [4100, MHIGH], [4450, MTRANS], [4850, MDIP], [5500, MSUP], [6300, MSUP], [7300, MDIP], [7900, MTRANS], [8500, MHIGH], [9400, MHANG], [9900, HANG]] }
  };
  function prep(an) {
    let lab = '';
    an.kf = an.kf.map(k => {
      const p = Object.assign({}, k[1]);
      if (k[2] != null) lab = k[2];
      if (an.root === 'h' && p.F) { const J = solve(an, p); p.th = angOf(J.K[0] - J.P[0], J.K[1] - J.P[1]); p.sh = angOf(J.F[0] - J.K[0], J.F[1] - J.K[1]); }
      if (an.root !== 'h' && (p.H || an.H)) { const J = solve(an, p); p.u = angOf(J.E[0] - J.S[0], J.E[1] - J.S[1]); p.f = angOf(J.H[0] - J.E[0], J.H[1] - J.E[1]); }
      return [k[0], p, k[2], lab];
    });
    an.dur = an.kf[an.kf.length - 1][0];
    an.ready = true;
    const bb = bbox(an);
    an.vb = fit(an, bb, false);
    an.land = (bb[2] - bb[0]) > (bb[3] - bb[1]) * 1.3;
    if (an.land) an.vbL = fit(an, bb, true);
  }
  /* auto-fit viewBox: crop to the range of motion (portrait 200:280 or landscape 2:1, max zoom 1.35) */
  function bbox(an) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const add = (x, y, r = 0) => { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); };
    for (let t = 0; t <= an.dur; t += 40) { const J = solve(an, poseAt(an, t)[0]); add(J.Hd[0], J.Hd[1], HR + 2); for (const k of ['S', 'P', 'K', 'F', 'E', 'H']) if (J[k]) add(J[k][0], J[k][1], 9); }
    const bp = an.barAt || an.H, style = an.bar || (an.root === 'h' ? 'mount' : (an.H ? 'low' : null));
    if (style === 'mount') { add(bp[0] - 16, bp[1] - 37); add(bp[0] + 16, bp[1] - 37); }
    if (style === 'dip') { add(bp[0] - 50, bp[1]); add(bp[0] + 50, bp[1]); }
    if (bp && style) add(bp[0], bp[1], 8);
    if (an.anchor) { add(8, 92); add(18, 128); }
    if (an.floor) add(100, an.floor + 4);
    return [x0, y0, x1, y1];
  }
  function fit(an, bb, land) {
    const [x0, y0, x1, y1] = bb, BH = land ? 140 : 280, R = land ? 1 / 2 : 280 / 200;
    const w = x1 - x0 + 20, h = y1 - y0 + 20;
    const H = Math.min(BH * 1.15, Math.max(h, w * R, BH / 1.35)), W = H / R;
    const vx = (x0 + x1) / 2 - W / 2, vy = an.floor ? Math.min(an.floor + 16 - H, y0 - 10) : (y0 + y1) / 2 - H / 2;
    return [vx, vy, W, H].map(v => Math.round(v * 10) / 10);
  }
  function poseAt(an, t) {
    const k = an.kf; let i = 0;
    while (i < k.length - 2 && t >= k[i + 1][0]) i++;
    const a = k[i], b = k[i + 1] || a, span = b[0] - a[0];
    const x = span > 0 ? ease(clamp((t - a[0]) / span, 0, 1)) : 0;
    return [lerpPose(a[1], b[1], x), a[3]];
  }
  /* ---------- rendering ---------- */
  const SW = { sh: [9.5, 6.5], th: [13, 9.5], t: [21, 14], u: [10, 7.5], f: [7.5, 6] };
  function build(el, key, o) {
    const an = A[key] || A.pullup; if (!an.ready) prep(an);
    const hl = new Set(an.hl || []);
    const seg = n => `<path class="segf s-${n}${hl.has(n) ? ' hl' : ''}"/>`;
    const bp = an.barAt || an.H, style = an.bar || (an.root === 'h' ? 'mount' : (an.H ? 'low' : null));
    const fy = an.floor || 262;
    let back = '';
    const land = !!(o.land && an.land), vb = (land ? an.vbL : an.vb) || [0, 0, 200, 280];
    el.classList.toggle('land', land);
    if (an.floor) back += `<line class="floor" x1="${vb[0]}" y1="${fy}" x2="${vb[0] + vb[2]}" y2="${fy}"/>`;
    if (style === 'mount') back += `<path class="prop" stroke-width="3.2" d="M${bp[0]} ${bp[1] - 4}V${bp[1] - 34}M${bp[0] - 15} ${bp[1] - 34}H${bp[0] + 15}"/>`;
    if (style === 'post' || style === 'low') back += `<line class="prop" stroke-width="4" opacity=".45" x1="${bp[0]}" y1="${bp[1]}" x2="${bp[0]}" y2="${fy}"/><line class="prop" stroke-width="4" opacity=".45" x1="${bp[0] - 16}" y1="${fy}" x2="${bp[0] + 16}" y2="${fy}"/>`;
    if (style === 'dip') back += `<line class="prop" stroke-width="5" x1="${bp[0] - 48}" y1="${bp[1] + 3}" x2="${bp[0] + 48}" y2="${bp[1] + 3}"/><line class="prop" stroke-width="4" opacity=".6" x1="${bp[0] - 42}" y1="${bp[1] + 3}" x2="${bp[0] - 42}" y2="${fy}"/><line class="prop" stroke-width="4" opacity=".6" x1="${bp[0] + 42}" y1="${bp[1] + 3}" x2="${bp[0] + 42}" y2="${fy}"/>`;
    if (an.anchor) back += `<line class="prop" stroke-width="4" x1="12" y1="96" x2="12" y2="${fy}"/><circle class="prop" stroke-width="2.5" cx="15" cy="124" r="3"/>`;
    const shadow = an.floor ? `<ellipse class="shadow f-shadow" cx="100" cy="${fy + 1}" rx="40" ry="3.2"/>` : '';
    const barC = style ? `<circle class="bar-c" cx="${bp[0]}" cy="${bp[1]}" r="5.4"/>` : '';
    el.classList.add('fig');
    el.innerHTML = `<div class="fig-stage" title="Нажмите, чтобы остановить или продолжить анимацию"><svg class="fig-svg" viewBox="${vb.join(' ')}" role="img" aria-label="Схема выполнения упражнения">
      ${back}${shadow}
      ${seg('sh')}${seg('th')}<circle class="jt f-foot" r="4.4"/>${seg('t')}
      ${an.band ? '<path class="band f-band"/>' : ''}
      ${an.plate ? '<g class="f-plate"><line class="prop" stroke-width="2" x1="0" y1="0" x2="0" y2="14"/><rect class="plate" x="-12" y="14" width="24" height="12" rx="3"/></g>' : ''}
      <line class="seg s-n" stroke-width="7"/><circle class="head f-head" r="${HR}"/>
      ${seg('u')}${seg('f')}
      ${an.towel ? '<line class="band f-towel" stroke-width="3.4"/>' : ''}
      ${an.anchor ? '<line class="band f-anchor"/>' : ''}
      ${barC}<circle class="jt f-hand" r="4.3"/>
    </svg><div class="fig-paused">${ico('pause')} Пауза</div></div>${o.label !== false ? '<div class="fig-label"></div>' : ''}${o.prog ? '<div class="fig-prog"><i></i></div>' : ''}`;
    const q = s => el.querySelector(s);
    const f = {
      el, an, key, t: o.t0 != null ? o.t0 : (hashStr(key + (o.seed || '')) % Math.max(1, an.dur)), speed: o.speed || 1, paused: false, vis: true, lastLabel: null,
      n: { sh: q('.s-sh'), th: q('.s-th'), t: q('.s-t'), nk: q('.s-n'), u: q('.s-u'), f: q('.s-f'), head: q('.f-head'), hand: q('.f-hand'), foot: q('.f-foot'), band: q('.f-band'), plate: q('.f-plate'), towel: q('.f-towel'), anchor: q('.f-anchor'), shadow: q('.f-shadow'), label: q('.fig-label'), prog: q('.fig-prog i') }
    };
    q('.fig-stage').addEventListener('click', () => { f.paused = !f.paused; el.classList.toggle('paused', f.paused); });
    el._fig = f;
    draw(f);
    return f;
  }
  const r1 = v => Math.round(v * 10) / 10;
  function ln(e, p, q) { if (!e) return; e.setAttribute('x1', r1(p[0])); e.setAttribute('y1', r1(p[1])); e.setAttribute('x2', r1(q[0])); e.setAttribute('y2', r1(q[1])); }
  function cap(e, p, q, w) {
    if (!e) return;
    let dx = q[0] - p[0], dy = q[1] - p[1]; const d = Math.hypot(dx, dy) || 1e-3; dx /= d; dy /= d;
    const r1 = w[0] / 2, r2 = w[1] / 2, nx = -dy, ny = dx, f = v => Math.round(v * 10) / 10;
    e.setAttribute('d', `M${f(p[0] + nx * r1)} ${f(p[1] + ny * r1)}L${f(q[0] + nx * r2)} ${f(q[1] + ny * r2)}A${r2} ${r2} 0 0 0 ${f(q[0] - nx * r2)} ${f(q[1] - ny * r2)}L${f(p[0] - nx * r1)} ${f(p[1] - ny * r1)}A${r1} ${r1} 0 0 0 ${f(p[0] + nx * r1)} ${f(p[1] + ny * r1)}Z`);
  }
  function pt(e, p) { if (!e) return; e.setAttribute('cx', r1(p[0])); e.setAttribute('cy', r1(p[1])); }
  function draw(f) {
    const [P, label] = poseAt(f.an, f.t), J = solve(f.an, P), n = f.n;
    cap(n.sh, J.K, J.F, SW.sh); cap(n.th, J.P, J.K, SW.th); cap(n.t, J.S, J.P, SW.t); ln(n.nk, J.S, J.N); cap(n.u, J.S, J.E, SW.u); cap(n.f, J.E, J.H, SW.f);
    pt(n.head, J.Hd); pt(n.hand, J.H); pt(n.foot, J.F);
    if (n.band) { const b = f.an.H; n.band.setAttribute('d', `M${b[0] - 3} ${b[1] + 3}L${r1(J.K[0])} ${r1(J.K[1] + 5)}L${b[0] + 3} ${b[1] + 3}`); }
    if (n.plate) n.plate.setAttribute('transform', `translate(${r1(J.P[0] + 3)} ${r1(J.P[1] + 4)})`);
    if (n.towel) ln(n.towel, f.an.barAt, J.H);
    if (n.anchor) ln(n.anchor, [15, 124], J.H);
    if (n.shadow) { const cx = (J.S[0] + J.F[0]) / 2; n.shadow.setAttribute('cx', r1(cx)); n.shadow.setAttribute('rx', r1(Math.max(18, Math.abs(J.F[0] - J.S[0]) / 2 + 12))); }
    if (n.label && label !== f.lastLabel) { n.label.textContent = label || '\u00a0'; f.lastLabel = label; }
    if (n.prog) n.prog.style.width = (f.t / f.an.dur * 100).toFixed(1) + '%';
  }
  /* ---------- loop ---------- */
  const live = new Set(); let raf = 0, last = 0;
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach((e: any) => { if (e.target._fig) e.target._fig.vis = e.isIntersecting; }), { rootMargin: '80px' }) : null;
  function loop(now) {
    raf = 0; const dt = last ? Math.min(60, now - last) : 16; last = now;
    for (const f of live as Set<any>) {
      if (!f.el.isConnected) { live.delete(f); if (io) io.unobserve(f.el); continue; }
      if (!f.vis || f.paused) continue;
      f.t = (f.t + dt * f.speed) % f.an.dur; draw(f);
    }
    if (live.size) raf = requestAnimationFrame(loop); else last = 0;
  }
  function create(el, key, o = {}) {
    const f = build(el, key, o); live.add(f); if (io) io.observe(el);
    if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
    return f;
  }
  function mountAll(root = document) {
    $$('[data-fig]', root).forEach(el => {
      if (el._fig && el._fig.key === el.dataset.fig) return;
      create(el, el.dataset.fig, { label: el.dataset.label !== '0', prog: el.dataset.prog === '1', land: el.dataset.land === '1', speed: +el.dataset.speed || 1, seed: el.dataset.seed || '' });
    });
  }
  const tag = (key, attrs = '') => `<div data-fig="${esc(key)}" ${attrs}></div>`;
  function isLand(key) { const an = A[key] || A.pullup; if (!an.ready) prep(an); return !!an.land; }
  function setSpeed(el, s) { if (el && el._fig) el._fig.speed = s; }
  function setKey(el, key) { if (!el) return; el._fig = null; el.dataset.fig = key; mountAll(el.parentNode || document); }
  return { mountAll, create, tag, setSpeed, setKey, isLand, anims: A, solve, poseAt };
})();
