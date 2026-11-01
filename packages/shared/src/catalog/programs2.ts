/* ================= v2 program engine catalog: movement slots, ladders, programs (ЧАСТЬ 4) =================
 * A v2 program is described with movement *slots* (vertical pull, horizontal push, side delts…).
 * The engine picks a concrete exercise for every slot from a progression ladder using the user's
 * level, training experience, results of the main exercises and available equipment, then
 * computes the dose. Pull-up programs of PULLUP PRO 1.0 (beginner / intermediate / advanced) stay as they are.
 */
import type { Equipment, Group, Level } from '../types';

export type SlotId =
  | 'vpull' | 'hpull' | 'chin' | 'hpush' | 'pushv' | 'vpush' | 'dip' | 'triceps' | 'latdelt' | 'frontdelt' | 'reardelt' | 'scap'
  | 'squat' | 'split' | 'hinge' | 'calf' | 'wallsit'
  | 'core_stab' | 'core_rectus' | 'core_obl' | 'core_pelvis' | 'core_dyn' | 'grip' | 'mu_main' | 'mu_assist';

export interface LadderStep {
  ex: string;
  /** all of these must be available (wall / floor are always available) */
  need?: Equipment[];
  /** minimal results of the main exercises: pull-ups, push-ups, plank (s), squats, dips */
  min?: Partial<Record<'pull' | 'push' | 'plank' | 'squat' | 'dips', number>>;
  /** minimal training level */
  lvl?: Level;
}
export interface Slot { id: SlotId; name: string; group: Group; ladder: LadderStep[] }

const B: Equipment[] = ['bar'];
export const SLOTS: Record<SlotId, Slot> = {
  vpull: { id: 'vpull', name: 'Вертикальная тяга', group: 'pull', ladder: [
    { ex: 'band_row', need: ['bands'] }, { ex: 'row_backpack', need: ['backpack'] }, { ex: 'aussie', need: ['lowbar'] },
    { ex: 'negative', need: B }, { ex: 'bandpull', need: ['bar', 'bands'], min: { pull: 1 } }, { ex: 'pullup', need: B, min: { pull: 3 } },
    { ex: 'pause', need: B, min: { pull: 10 }, lvl: 'intermediate' }, { ex: 'archer', need: B, min: { pull: 12 }, lvl: 'advanced' }] },
  chin: { id: 'chin', name: 'Тяга на бицепс', group: 'pull', ladder: [
    { ex: 'band_row', need: ['bands'] }, { ex: 'row_backpack', need: ['backpack'] }, { ex: 'flexhang', need: B }, { ex: 'chinup', need: B, min: { pull: 3 } },
    { ex: 'close', need: B, min: { pull: 8 }, lvl: 'intermediate' }] },
  hpull: { id: 'hpull', name: 'Горизонтальная тяга', group: 'pull', ladder: [
    { ex: 'band_row', need: ['bands'] }, { ex: 'row_backpack', need: ['backpack'] }, { ex: 'aussie', need: ['lowbar'] }] },
  hpush: { id: 'hpush', name: 'Горизонтальный жим', group: 'push', ladder: [
    { ex: 'wall_pushup' }, { ex: 'incline_pushup', need: ['bench'] }, { ex: 'knee_pushup', min: { push: 1 } }, { ex: 'pushup', min: { push: 5 } },
    { ex: 'decline_pushup', need: ['bench'], min: { push: 20 }, lvl: 'intermediate' }, { ex: 'pp_pushup', min: { push: 35 }, lvl: 'advanced' }] },
  pushv: { id: 'pushv', name: 'Вариация отжиманий', group: 'push', ladder: [
    { ex: 'wall_pushup' }, { ex: 'knee_pushup', min: { push: 1 } }, { ex: 'wide_pushup', min: { push: 8 } }, { ex: 'close_pushup', min: { push: 12 } },
    { ex: 'diamond_pushup', min: { push: 20 }, lvl: 'intermediate' }] },
  vpush: { id: 'vpush', name: 'Вертикальный жим', group: 'shoulders', ladder: [
    { ex: 'incline_pushup', need: ['bench'] }, { ex: 'pike_pushup', min: { push: 8 } }, { ex: 'elev_pike', need: ['bench'], min: { push: 20 }, lvl: 'intermediate' },
    { ex: 'hspu_wall', min: { push: 30 }, lvl: 'advanced' }] },
  dip: { id: 'dip', name: 'Брусья и трицепс', group: 'push', ladder: [
    { ex: 'close_pushup', min: { push: 1 } }, { ex: 'bench_dips', need: ['bench'], min: { push: 5 } }, { ex: 'dips', need: ['dipbars'], min: { push: 12 } },
    { ex: 'sbdips', need: B, min: { dips: 10, pull: 8 }, lvl: 'intermediate' }] },
  triceps: { id: 'triceps', name: 'Трицепс', group: 'push', ladder: [
    { ex: 'wall_pushup' }, { ex: 'close_pushup', min: { push: 5 } }, { ex: 'diamond_pushup', min: { push: 15 } }] },
  latdelt: { id: 'latdelt', name: 'Средние дельты', group: 'shoulders', ladder: [
    { ex: 'band_lateral', need: ['bands'] }, { ex: 'lateral_raise', need: ['bottles'] }, { ex: 'lateral_raise', need: ['weights'] }] },
  frontdelt: { id: 'frontdelt', name: 'Передние дельты', group: 'shoulders', ladder: [
    { ex: 'pike_pushup', min: { push: 5 } }, { ex: 'front_raise', need: ['bottles'] }, { ex: 'front_raise', need: ['weights'] }] },
  reardelt: { id: 'reardelt', name: 'Задние дельты и лопатки', group: 'shoulders', ladder: [
    { ex: 'ytw' }, { ex: 'reverse_fly', need: ['bottles'] }, { ex: 'band_pullapart', need: ['bands'] }, { ex: 'facepull', need: ['bands'] }] },
  scap: { id: 'scap', name: 'Лопатки', group: 'shoulders', ladder: [
    { ex: 'scap_pushup' }, { ex: 'scap', need: B }, { ex: 'activehang', need: B, min: { pull: 1 } }] },
  squat: { id: 'squat', name: 'Приседание', group: 'legs', ladder: [
    { ex: 'squat' }, { ex: 'bulgarian', need: ['bench'], min: { squat: 40 }, lvl: 'intermediate' }] },
  split: { id: 'split', name: 'Выпады', group: 'legs', ladder: [
    { ex: 'rev_lunge' }, { ex: 'fwd_lunge', min: { squat: 20 } }, { ex: 'bulgarian', need: ['bench'], min: { squat: 25 } }] },
  hinge: { id: 'hinge', name: 'Ягодицы и задняя поверхность', group: 'legs', ladder: [
    { ex: 'glute_bridge' }, { ex: 'sl_bridge', min: { squat: 15 } }, { ex: 'sl_rdl', min: { squat: 25 }, lvl: 'intermediate' }] },
  calf: { id: 'calf', name: 'Икры', group: 'legs', ladder: [{ ex: 'calf_raise' }, { ex: 'sl_calf', min: { squat: 25 }, lvl: 'intermediate' }] },
  wallsit: { id: 'wallsit', name: 'Статика ног', group: 'legs', ladder: [{ ex: 'wall_sit' }] },
  core_stab: { id: 'core_stab', name: 'Стабилизация корпуса', group: 'core', ladder: [
    { ex: 'dead_bug' }, { ex: 'plank', min: { plank: 20 } }, { ex: 'hollow', min: { plank: 45 } }, { ex: 'dragon_flag', need: ['bench'], min: { plank: 120, pull: 12 }, lvl: 'advanced' }] },
  core_rectus: { id: 'core_rectus', name: 'Прямая мышца живота', group: 'core', ladder: [
    { ex: 'crunch' }, { ex: 'reverse_crunch', min: { plank: 30 } }, { ex: 'kneeraise', need: B, min: { pull: 1, plank: 30 } }, { ex: 'hang_legraise', need: B, min: { pull: 5, plank: 60 }, lvl: 'intermediate' },
    { ex: 'toes', need: B, min: { pull: 10, plank: 90 }, lvl: 'advanced' }] },
  core_obl: { id: 'core_obl', name: 'Косые мышцы', group: 'core', ladder: [{ ex: 'side_plank' }] },
  core_pelvis: { id: 'core_pelvis', name: 'Подъёмы ног и контроль таза', group: 'core', ladder: [
    { ex: 'lying_leg_raise' }, { ex: 'leg_raise', need: ['dipbars'], min: { plank: 45 } }, { ex: 'hang_legraise', need: B, min: { pull: 5, plank: 60 }, lvl: 'intermediate' },
    { ex: 'lsit_floor', need: ['dipbars'], min: { plank: 90, dips: 10 }, lvl: 'advanced' }] },
  core_dyn: { id: 'core_dyn', name: 'Динамика корпуса', group: 'core', ladder: [{ ex: 'bird_dog' }, { ex: 'mclimber', min: { plank: 30 } }] },
  grip: { id: 'grip', name: 'Хват', group: 'pull', ladder: [{ ex: 'hang', need: B }, { ex: 'towel', need: B, min: { pull: 8 } }] },
  mu_main: { id: 'mu_main', name: 'Muscle-Up: основное', group: 'muscleup', ladder: [] },
  mu_assist: { id: 'mu_assist', name: 'Muscle-Up: вспомогательное', group: 'muscleup', ladder: [] }
};

export interface SlotDose { slot: SlotId; note?: string }
export interface WorkoutV2 { id: string; name: string; focus: string; slots: SlotDose[] }
export interface ProgramV2 {
  id: string; name: string; en: string; kind: 'fullbody' | 'split' | 'focus' | 'mu'; group: Group;
  days: number; freq: string; dur: string; goal: string; desc: string; workouts: WorkoutV2[]; rules: string[]; forLevels?: Level[];
}

export const PROGRESSION_RULES = [
  'Нагрузка не растёт после каждого занятия: повышение предлагается только после 2 подряд тренировок, где все подходы выполнены, остался запас 1+ повтор (RIR) и техника была уверенной.',
  'Порядок прогрессии: +1–2 повтора (или +5–10 секунд) → +1 подход → более сложная вариация упражнения.',
  'Повышение — это предложение. Вы принимаете его сами; если отказаться, программа снова оценит 2 следующие тренировки.',
  'Боль, срыв техники или RPE 9–10 останавливают прогрессию. Отмеченная боль сразу снижает нагрузку в этом упражнении.',
  'Две неудачные тренировки подряд в упражнении — предложение облегчить дозировку.',
  'Лёгкое занятие (−1 подход и −20% повторов) предлагается, если вчерашняя тренировка была очень тяжёлой, была боль или плохое самочувствие.',
  'Разгрузочная неделя (около −40% объёма) предлагается примерно каждые 6 недель регулярных тренировок или раньше — при признаках накопленной усталости.'
];

const W = (id: string, name: string, focus: string, slots: SlotId[]): WorkoutV2 => ({ id, name, focus, slots: slots.map(slot => ({ slot })) });
export const PROGRAMS_V2: ProgramV2[] = [
  { id: 'fb_abc', name: 'FULL BODY A / B / C', en: 'Full Body A/B/C', kind: 'fullbody', group: 'fullbody', days: 3, freq: '3 тренировки в неделю, через день', dur: '45–60 минут',
    goal: 'Сила и пропорциональное развитие всего тела дома или на площадке', desc: 'Основная программа для домашних тренировок. Три разных дня по кругу: A — базовая сила, B — плечи и верх тела, C — всё тело. Упражнения подбираются под ваш уровень и инвентарь.',
    workouts: [
      W('A', 'Тренировка A', 'Базовая сила', ['vpull', 'hpush', 'squat', 'core_rectus', 'reardelt']),
      W('B', 'Тренировка B', 'Плечи и верх тела', ['vpush', 'hpull', 'latdelt', 'split', 'core_obl']),
      W('C', 'Тренировка C', 'Всё тело', ['vpull', 'pushv', 'split', 'core_pelvis', 'reardelt'])
    ], rules: PROGRESSION_RULES },
  { id: 'ppl', name: 'PUSH / PULL / LEGS', en: 'Push Pull Legs', kind: 'split', group: 'fullbody', days: 3, freq: '3–6 тренировок в неделю', dur: '45–60 минут',
    goal: 'Больше объёма на каждую группу мышц', desc: 'Жимовой день, тяговый день и ноги с корпусом. При 3 тренировках в неделю каждая группа — раз в неделю, при 6 — дважды.',
    workouts: [
      W('push', 'PUSH', 'Грудь, плечи, трицепс', ['hpush', 'vpush', 'dip', 'latdelt', 'triceps']),
      W('pull', 'PULL', 'Спина, бицепс, задние дельты', ['vpull', 'hpull', 'chin', 'reardelt', 'core_pelvis']),
      W('legs', 'LEGS', 'Ноги, ягодицы, корпус', ['squat', 'split', 'hinge', 'calf', 'core_stab', 'core_obl'])
    ], rules: PROGRESSION_RULES },
  { id: 'ul', name: 'UPPER / LOWER', en: 'Upper / Lower', kind: 'split', group: 'fullbody', days: 4, freq: '4 тренировки в неделю', dur: '40–55 минут',
    goal: 'Баланс верха и низа при 4 тренировках', desc: 'Два дня верха и два дня низа с корпусом. Каждая группа мышц получает нагрузку дважды в неделю.',
    workouts: [
      W('UA', 'Верх A', 'Тяга и жим', ['vpull', 'hpush', 'hpull', 'vpush', 'latdelt']),
      W('LA', 'Низ A', 'Ноги и пресс', ['squat', 'hinge', 'split', 'calf', 'core_stab', 'core_rectus']),
      W('UB', 'Верх B', 'Плечи и руки', ['vpull', 'dip', 'hpull', 'latdelt', 'reardelt']),
      W('LB', 'Низ B', 'Ноги и корпус', ['split', 'hinge', 'wallsit', 'calf', 'core_obl', 'core_pelvis'])
    ], rules: PROGRESSION_RULES },
  { id: 'back_biceps', name: 'BACK & BICEPS', en: 'Back & Biceps', kind: 'focus', group: 'pull', days: 2, freq: '2 тренировки в неделю + основная программа', dur: '35–45 минут',
    goal: 'Ширина и толщина спины, сильные руки и хват', desc: 'Фокус на тягах: вертикальная и горизонтальная тяга, бицепс, задние дельты и хват.',
    workouts: [
      W('BB1', 'Спина 1', 'Ширина спины', ['vpull', 'hpull', 'chin', 'scap', 'grip']),
      W('BB2', 'Спина 2', 'Толщина и задние дельты', ['vpull', 'hpull', 'reardelt', 'chin', 'core_pelvis'])
    ], rules: PROGRESSION_RULES },
  { id: 'chest_shoulders', name: 'CHEST & SHOULDERS', en: 'Chest & Shoulders', kind: 'focus', group: 'shoulders', days: 2, freq: '2 тренировки в неделю', dur: '35–45 минут',
    goal: 'Широкие плечи и развитая грудь', desc: 'Жимы под разными углами плюс отдельная работа на средние и задние дельты — одних отжиманий для ширины плеч недостаточно.',
    workouts: [
      W('CS1', 'Грудь и плечи 1', 'Жим и средние дельты', ['hpush', 'vpush', 'latdelt', 'reardelt', 'triceps']),
      W('CS2', 'Грудь и плечи 2', 'Объём дельт', ['pushv', 'dip', 'latdelt', 'frontdelt', 'reardelt'])
    ], rules: PROGRESSION_RULES },
  { id: 'core_focus', name: 'CORE FOCUS', en: 'Core Focus', kind: 'focus', group: 'core', days: 3, freq: '2–3 коротких занятия в неделю', dur: '15–25 минут',
    goal: 'Сильный корпус по всем 4 направлениям', desc: 'Стабилизация, прямая мышца живота, косые мышцы, подъёмы ног и контроль таза. Пресс укрепляется, но жир с живота локально не сжигается — для этого важны питание и общая активность.',
    workouts: [
      W('C1', 'Корпус 1', 'Стабилизация', ['core_stab', 'core_obl', 'core_dyn', 'hinge']),
      W('C2', 'Корпус 2', 'Пресс и контроль таза', ['core_rectus', 'core_pelvis', 'core_stab', 'core_obl']),
      W('C3', 'Корпус 3', 'Комплекс', ['core_pelvis', 'core_dyn', 'core_rectus', 'core_stab'])
    ], rules: PROGRESSION_RULES },
  { id: 'mu_prep', name: 'MUSCLE-UP PREPARATION', en: 'Muscle-Up Preparation', kind: 'mu', group: 'muscleup', days: 2, freq: '2 тренировки в неделю (не больше)', dur: '45–60 минут',
    goal: 'Подготовка к выходу силой по вашему текущему этапу', desc: 'Основная часть берётся из текущего этапа пути Muscle-Up, вспомогательная — брусья, корпус и плечи. Переход к следующему этапу — только по критериям силы и техники, а не по количеству тренировок.',
    workouts: [
      { id: 'MU1', name: 'MU · Сила и техника', focus: 'Работа текущего этапа', slots: [{ slot: 'mu_main' }, { slot: 'dip' }, { slot: 'core_stab' }, { slot: 'scap' }] },
      { id: 'MU2', name: 'MU · Объём и устойчивость', focus: 'Этап + вспомогательные', slots: [{ slot: 'mu_main' }, { slot: 'mu_assist' }, { slot: 'core_pelvis' }, { slot: 'reardelt' }] }
    ], rules: [...PROGRESSION_RULES.slice(0, 4), 'Не больше 2 тренировок выхода силой в неделю. Боль в локтях, запястьях или плечах — пауза и консультация специалиста.'] }
];
export const PROGM_V2: Record<string, ProgramV2> = Object.fromEntries(PROGRAMS_V2.map(p => [p.id, p]));

/** equipment options shown in onboarding/profile (wall and floor are always available) */
export const EQUIPMENT: { id: Equipment; name: string; hint: string }[] = [
  { id: 'bar', name: 'Турник', hint: 'перекладина для подтягиваний' },
  { id: 'dipbars', name: 'Брусья', hint: 'или два устойчивых стула' },
  { id: 'lowbar', name: 'Низкая перекладина', hint: 'для австралийских подтягиваний' },
  { id: 'bands', name: 'Резиновые ленты', hint: 'эспандеры, петли' },
  { id: 'bottles', name: 'Бутылки воды', hint: '0,5–2 л для махов' },
  { id: 'weights', name: 'Гантели или гири', hint: 'любой вес' },
  { id: 'backpack', name: 'Рюкзак', hint: 'отягощение из книг или бутылок' },
  { id: 'bench', name: 'Скамья или стул', hint: 'устойчивая опора' }
];
export const GOALS: { id: string; name: string; group?: Group }[] = [
  { id: 'muscle', name: 'Набрать мышечную массу' },
  { id: 'strength', name: 'Увеличить силу' },
  { id: 'shoulders', name: 'Развить широкие плечи', group: 'shoulders' },
  { id: 'back', name: 'Укрепить спину', group: 'pull' },
  { id: 'core', name: 'Развить пресс', group: 'core' },
  { id: 'endurance', name: 'Улучшить выносливость' },
  { id: 'pullups', name: 'Научиться подтягиваться', group: 'pull' },
  { id: 'muscleup', name: 'Освоить Muscle-Up', group: 'muscleup' },
  { id: 'health', name: 'Улучшить общее физическое состояние' }
];
export const GOALM = Object.fromEntries(GOALS.map(g => [g.id, g]));
