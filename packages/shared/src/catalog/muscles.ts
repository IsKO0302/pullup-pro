/* ================= Muscles & training groups (v2) ================= */
import type { Group, GroupInfo, MuscleId } from '../types';

export interface MuscleInfo { id: MuscleId; name: string; side: 'front' | 'back' | 'both' }
export const MUSCLES: MuscleInfo[] = [
  { id: 'chest', name: 'Грудные', side: 'front' },
  { id: 'frontdelts', name: 'Передние дельты', side: 'front' },
  { id: 'sidedelts', name: 'Средние дельты', side: 'both' },
  { id: 'reardelts', name: 'Задние дельты', side: 'back' },
  { id: 'rotators', name: 'Вращательная манжета', side: 'back' },
  { id: 'biceps', name: 'Бицепс', side: 'front' },
  { id: 'brachialis', name: 'Плечевая мышца', side: 'front' },
  { id: 'triceps', name: 'Трицепс', side: 'back' },
  { id: 'forearms', name: 'Предплечья', side: 'both' },
  { id: 'lats', name: 'Широчайшие', side: 'back' },
  { id: 'traps', name: 'Трапеция', side: 'back' },
  { id: 'rhomboids', name: 'Ромбовидные', side: 'back' },
  { id: 'lowerback', name: 'Разгибатели спины', side: 'back' },
  { id: 'serratus', name: 'Передняя зубчатая', side: 'front' },
  { id: 'abs', name: 'Прямая мышца живота', side: 'front' },
  { id: 'obliques', name: 'Косые мышцы живота', side: 'front' },
  { id: 'transverse', name: 'Поперечная мышца живота', side: 'front' },
  { id: 'hipflexors', name: 'Сгибатели бедра', side: 'front' },
  { id: 'glutes', name: 'Ягодичные', side: 'back' },
  { id: 'quads', name: 'Квадрицепсы', side: 'front' },
  { id: 'hamstrings', name: 'Задняя поверхность бедра', side: 'back' },
  { id: 'adductors', name: 'Приводящие мышцы бедра', side: 'front' },
  { id: 'calves', name: 'Икроножные', side: 'back' }
];
export const MUSCLEM = Object.fromEntries(MUSCLES.map(m => [m.id, m])) as Record<MuscleId, MuscleInfo>;

export const GROUPS: GroupInfo[] = [
  { id: 'pull', name: 'Спина и бицепс', en: 'PULL', icon: 'prog', desc: 'Тяговые движения: подтягивания всех видов, австралийские подтягивания и домашние тяги. Ширина и толщина спины, сильный хват.', focus: ['Вертикальная тяга', 'Горизонтальная тяга', 'Хват и лопатки'] },
  { id: 'push', name: 'Грудь и трицепс', en: 'PUSH', icon: 'push', desc: 'Прогрессия от отжиманий от стены до pseudo planche и отжиманий на брусьях. Грудь, трицепс и передние дельты.', focus: ['Горизонтальный жим', 'Трицепс', 'Брусья'] },
  { id: 'shoulders', name: 'Широкие плечи', en: 'SHOULDERS', icon: 'shoulder', desc: 'Передние, средние и задние дельты плюс стабилизаторы лопатки. Средние дельты дают визуальную ширину плеч — им нужны отдельные махи, одних отжиманий недостаточно.', focus: ['Средние дельты', 'Задние дельты и осанка', 'Вертикальный жим'] },
  { id: 'core', name: 'Пресс и корпус', en: 'CORE', icon: 'core', desc: 'Стабилизация, прямая и косые мышцы живота, подъёмы ног и контроль таза. Сильный корпус — основа всех упражнений. Локально жир с живота упражнения на пресс не сжигают.', focus: ['Стабилизация корпуса', 'Прямая мышца живота', 'Косые мышцы', 'Подъёмы ног и контроль таза'] },
  { id: 'legs', name: 'Ноги и ягодицы', en: 'LEGS', icon: 'legs', desc: 'Приседания, выпады, мосты и икры — без обязательного оборудования. Сильные ноги — это баланс тела и выше общий уровень силы.', focus: ['Квадрицепсы', 'Ягодицы и задняя поверхность', 'Икры и баланс'] },
  { id: 'fullbody', name: 'Всё тело', en: 'FULL BODY', icon: 'fullbody', desc: 'Комплексные тренировки A / B / C: тяга, жим, ноги, корпус и плечи в одном занятии. Лучший формат для 2–4 тренировок в неделю.', focus: ['Тренировка A — базовая сила', 'Тренировка B — плечи и верх', 'Тренировка C — всё тело'] },
  { id: 'mobility', name: 'Мобильность и восстановление', en: 'MOBILITY', icon: 'mobility', desc: 'Разминка, подвижность плеч, грудного отдела, запястий и бёдер, растяжка широчайших и восстановительные дни. Восстановление — часть тренировочного процесса.', focus: ['Разминка', 'Подвижность суставов', 'Восстановление'] },
  { id: 'muscleup', name: 'Выход силой', en: 'MUSCLE-UP', icon: 'bolt', desc: 'Шесть этапов к выходу силой на две руки: силовая база, взрывная тяга, высота, переход, упор и полный Muscle-Up — с критериями готовности.', focus: ['Взрывная тяга', 'Переход', 'Упор и брусья'] }
];
export const GROUPM = Object.fromEntries(GROUPS.map(g => [g.id, g])) as Record<Group, GroupInfo>;

/** Core sub-directions (ЧАСТЬ 3.5) */
export const CORE_DIRS = [
  { id: 'stability', name: 'Стабилизация корпуса' },
  { id: 'rectus', name: 'Прямая мышца живота' },
  { id: 'obliques', name: 'Косые мышцы живота' },
  { id: 'pelvis', name: 'Подъёмы ног и контроль таза' }
];
