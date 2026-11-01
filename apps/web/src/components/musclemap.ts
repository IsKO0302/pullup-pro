import { MUSCLEM } from '@pullup/shared/catalog/muscles';
import type { MuscleId } from '@pullup/shared/types';
import { esc } from '@pullup/shared/util';

/* ================= Anatomical muscle map (front + back, local SVG, no images) =================
 * Shapes are drawn for one half of the body and mirrored. Primary muscles use the accent colour,
 * secondary ones a translucent accent. */
type Shape = [MuscleId, string];
const FRONT: Shape[] = [
  ['traps', 'M44 30Q38 33 31 36.5L36 39Q41 35.5 46 34Z'],
  ['sidedelts', 'M29 37Q21 38.5 20 47.5Q21.5 49.5 23.5 48.5Q24 41.5 31 38.5Z'],
  ['frontdelts', 'M31 38.5Q25 41 23.6 48.6Q26.5 50.6 29.5 49Q30.5 43 35 40.2Z'],
  ['chest', 'M47.5 40Q40.5 37.5 34.5 40.6Q30.5 45.5 31.5 52Q38.5 57.5 47.5 55.5Z'],
  ['serratus', 'M32.2 55.6L36.2 54.8L35.6 58.8L32.4 59.8ZM32.6 61L36.4 60.2L35.8 64L32.8 65Z'],
  ['biceps', 'M23.4 51Q20.2 58 21.2 66Q24.2 68 27.2 66Q28.4 58 28.6 52Z'],
  ['brachialis', 'M20.6 62Q19.2 67 20.2 70.5L22.4 69.6Q22 65.5 22.3 61.5Z'],
  ['forearms', 'M20.2 71.5Q16.4 80.5 15.2 92Q17.2 94.2 20.2 93.2Q24.2 82.5 25.4 72.5Z'],
  ['obliques', 'M35.6 62Q34.4 75 37.2 88L42 92V60.5Z'],
  ['abs', 'M42.8 58H49.6V92Q46.2 96 42.8 92Z'],
  ['transverse', 'M38.4 86.5Q44 98 49.6 99.2V94.5Q45.2 94.5 42.2 90.5Z'],
  ['hipflexors', 'M40.2 96.5Q42.2 104 46.2 110.2L48.2 106Q46.2 100 44.2 96.5Z'],
  ['adductors', 'M43.4 108Q41.4 125 44.2 140Q47.2 138 48.6 128V110Z'],
  ['quads', 'M36.2 100Q31 118 33.2 140Q36.2 150 41.2 150Q44.4 136 42.4 112Q40.4 104 36.2 100Z'],
  ['calves', 'M34.2 160Q31.2 172 33.2 186H36.2Q37.2 172 37.4 160Z']
];
const BACK: Shape[] = [
  ['traps', 'M50 26L44 30Q36.5 34 30.5 37Q38.5 40 44.2 44L47.2 60L50 66.5Z'],
  ['sidedelts', 'M29 37Q21 38.5 20 47.5Q21.5 49.5 23.5 48.5Q24 41.5 31 38.5Z'],
  ['reardelts', 'M31 38.8Q25 41 23.4 48Q26.2 50 29.2 48.6Q31 43.4 35.2 41.4Z'],
  ['rotators', 'M36.2 44Q34.2 50 37.2 56Q42.2 56.2 44.2 50.2Q42.2 45 36.2 44Z'],
  ['rhomboids', 'M44.4 44.6L47.2 46.4V60.2L43.4 56.4Z'],
  ['lats', 'M33.2 52Q32.2 66 38.2 82Q43.2 86.4 46.2 84.4V66.4Q40.2 60.4 36.4 52.4Z'],
  ['lowerback', 'M45.4 70H49.6V100H45.4Q44.2 86 45.4 70Z'],
  ['triceps', 'M22.4 49Q19.2 57 20.2 66Q23.2 68.2 26.2 66Q28.2 57 28.4 50Z'],
  ['forearms', 'M20.2 71.5Q16.4 80.5 15.2 92Q17.2 94.2 20.2 93.2Q24.2 82.5 25.4 72.5Z'],
  ['glutes', 'M36.2 98Q33.2 108 36.2 118Q43.2 122.4 49.6 118V100Q42.2 96 36.2 98Z'],
  ['hamstrings', 'M34.2 122Q32.2 136 35.2 152Q39.2 154.2 42.2 152Q45.2 138 46.2 124Q40.2 122 34.2 122Z'],
  ['adductors', 'M45.6 124Q44.4 138 47.2 150L48.6 148V124Z'],
  ['calves', 'M33.2 158Q30.2 168 33.2 182Q36.2 184.2 39.2 182Q40.2 168 38.4 158Z']
];
const BODY = 'M46.5 26.5L44.5 30.5Q31 33.5 24.5 37.5Q19 41 19 50L17.2 70Q14.2 82 13 94L12 100.5Q14.2 103.5 17.2 101.5L19.2 95Q23.2 84 25.2 72L28.2 60L31.2 64Q33.2 80 35.2 96Q31 120 32.2 142Q33.2 152 33.2 160Q30.2 176 32.2 196L31 204.5Q34.2 207.5 39.2 205.5L38.2 196Q40.2 176 39.2 160Q41.2 150 43.2 140Q46.2 124 48.2 112L50 110V26.5Z';
const MIRROR = 'matrix(-1 0 0 1 100 0)';
function view(shapes: Shape[], prim: Set<string>, sec: Set<string>, label: string) {
  const cls = (m: string) => prim.has(m) ? 'mm-p' : sec.has(m) ? 'mm-s' : 'mm-n';
  const half = shapes.map(([m, d]) => `<path class="${cls(m)}" d="${d}"><title>${esc(MUSCLEM[m]?.name || m)}</title></path>`).join('');
  return `<svg class="mm-svg" viewBox="0 0 100 212" role="img" aria-label="${label}">
    <circle class="mm-body" cx="50" cy="15" r="10.5"/><path class="mm-body" d="${BODY}"/><path class="mm-body" d="${BODY}" transform="${MIRROR}"/>
    ${half}<g transform="${MIRROR}">${half}</g>
    ${label.includes('спереди') ? '<path class="mm-line" d="M42.8 66.5H57.2M42.8 75H57.2M42.8 83.5H57.2M50 58V93"/>' : ''}
  </svg>`;
}
export function muscleMap(primary: string[] = [], secondary: string[] = [], opts: { legend?: boolean; cls?: string } = {}) {
  const p = new Set(primary), s = new Set(secondary.filter(x => !p.has(x)));
  const names = (xs: Set<string>) => [...xs].map(m => esc(MUSCLEM[m as MuscleId]?.name || m)).join(', ');
  return `<div class="mm ${opts.cls || ''}">
    <div class="mm-views"><figure>${view(FRONT, p, s, 'Мышцы спереди')}<figcaption>Спереди</figcaption></figure><figure>${view(BACK, p, s, 'Мышцы сзади')}<figcaption>Сзади</figcaption></figure></div>
    ${opts.legend !== false ? `<div class="mm-legend">${p.size ? `<div><i class="mm-dot p"></i><span><b>Основные:</b> ${names(p)}</span></div>` : ''}${s.size ? `<div><i class="mm-dot s"></i><span><b>Вспомогательные:</b> ${names(s)}</span></div>` : ''}</div>` : ''}
  </div>`;
}
