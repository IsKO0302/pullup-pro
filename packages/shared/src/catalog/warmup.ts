/* ================= Warm-up 2.0: by muscle group of the workout (ЧАСТЬ 10, 16) =================
 * A general part (pulse + shoulders) plus group-specific preparation. Every item points to an
 * exercise of the library (animation + technique), so the warm-up screen can show the movement.
 */
import type { Group } from '../types';

export interface WarmItem { id: string; t: string; d: string; ex?: string; anim: string }
const I = (id: string, t: string, d: string, anim: string, ex?: string): WarmItem => ({ id, t, d, anim, ex });

const GENERAL: WarmItem[] = [
  I('pulse', 'Ходьба на месте или лёгкий бег', '2 минуты — поднять пульс и разогреть тело', 'walk', 'mob_recovery'),
  I('arms', 'Вращения руками и плечами', '10 вперёд и 10 назад, амплитуда постепенно растёт', 'armcircle', 'mob_shoulders')
];
const BY_GROUP: Record<Group, WarmItem[]> = {
  pull: [
    I('scap', 'Лопаточные подтягивания', '2 × 6–8: только движение лопаток, руки прямые', 'scap', 'scap'),
    I('ahang', 'Активный вис', '2 × 15 секунд, плечи опущены', 'activehang', 'mob_prepull'),
    I('lats', 'Растяжка широчайших', '2 × 20 секунд на каждую сторону', 'latstretch', 'mob_lats')
  ],
  push: [
    I('wrists', 'Разминка запястий', '30–45 секунд: круги и перекаты на ладонях', 'wrists', 'mob_wrists'),
    I('scappu', 'Лопаточные отжимания', '2 × 8 — сведение и разведение лопаток в упоре', 'scappu', 'scap_pushup'),
    I('inclpu', 'Лёгкие отжимания от опоры', '1 × 8–10 в спокойном темпе', 'pu_incline', 'incline_pushup')
  ],
  shoulders: [
    I('ytw', 'Y-T-W для лопаток', '1 × 8 каждой буквы без веса', 'ytw', 'ytw'),
    I('pullapart', 'Разведение рук перед собой', '1 × 15 с лёгкой резиной или без неё', 'pullapart', 'band_pullapart'),
    I('wrists', 'Разминка запястий', '30 секунд', 'wrists', 'mob_wrists')
  ],
  core: [
    I('catcow', 'Кошка-корова', '8–10 медленных повторов', 'catcow', 'mob_thoracic'),
    I('deadbug', 'Мёртвый жук', '1 × 6 на каждую сторону, поясница прижата', 'deadbug', 'dead_bug'),
    I('birddog', 'Птица-собака', '1 × 6 на каждую сторону', 'birddog', 'bird_dog')
  ],
  legs: [
    I('hips', 'Мобилити тазобедренных суставов', '30 секунд на каждую ногу', 'hipflexor', 'mob_hips'),
    I('bwsquat', 'Медленные приседания', '1 × 10 на неполную глубину, затем полную', 'squat', 'squat'),
    I('bridge', 'Ягодичный мост', '1 × 10 с паузой наверху', 'bridge', 'glute_bridge')
  ],
  fullbody: [
    I('catcow', 'Кошка-корова', '8 медленных повторов', 'catcow', 'mob_thoracic'),
    I('wrists', 'Разминка запястий', '30 секунд', 'wrists', 'mob_wrists'),
    I('bwsquat', 'Медленные приседания', '1 × 10', 'squat', 'squat'),
    I('scappu', 'Лопаточные отжимания', '1 × 8', 'scappu', 'scap_pushup')
  ],
  mobility: [],
  muscleup: [
    I('wrists', 'Разминка запястий', '45 секунд — запястья сильно нагружаются при переходе', 'wrists', 'mob_wrists'),
    I('scap', 'Лопаточные подтягивания', '2 × 8', 'scap', 'scap'),
    I('ahang', 'Активный вис', '2 × 15 секунд', 'activehang', 'mob_prepull'),
    I('support', 'Упор на брусьях или перекладине', '2 × 10–15 секунд, плечи опущены', 'support', 'support'),
    I('pulls', 'Лёгкие подтягивания', '1 × 3–4 в спокойном темпе', 'pullup', 'pullup')
  ]
};
/** warm-up list for the groups of a workout: general part + up to 2 groups, max 7 items, no duplicates */
export function warmFor(groups: Group[]): WarmItem[] {
  const out: WarmItem[] = [...GENERAL], seen = new Set(out.map(x => x.id));
  const gs = (groups.length ? groups : ['fullbody' as Group]).filter((g, i, a) => a.indexOf(g) === i);
  const main = gs.includes('muscleup') ? ['muscleup' as Group] : gs.slice(0, 3);
  for (const g of main) for (const it of BY_GROUP[g] || []) if (!seen.has(it.id) && out.length < 7) { seen.add(it.id); out.push(it); }
  if (out.length < 4) for (const it of BY_GROUP.fullbody) if (!seen.has(it.id) && out.length < 5) { seen.add(it.id); out.push(it); }
  return out;
}
