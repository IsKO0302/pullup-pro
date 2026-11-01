/* ================= Daily Mission (ЧАСТЬ 15): training day or recovery day ================= */
import type { AppState, DayKey } from './types';
import { addDays, daysBetween, dayKey, parseDay, todayKey, weekKey } from './dates';
import { activeProgram, nextIndex } from './engine';
import { isWorkout, weightSeries } from './stats';

export interface MissionItem { id: string; t: string; auto?: boolean; done: boolean; href?: string }
export interface Mission { kind: 'train' | 'done' | 'rest' | 'recovery'; title: string; sub: string; items: MissionItem[]; done: number }
export function dailyMission(S: AppState, today: DayKey = todayKey()): Mission {
  const ws = (S.sessions || []).filter(isWorkout), d = (S.daily || {})[today] || {}, chk = d.mission || {};
  const trainedToday = ws.some(s => s.date === today), y = dayKey(addDays(parseDay(today), -1));
  const pain = ws.some(s => s.pain && daysBetween(s.date, today) >= 0 && daysBetween(s.date, today) <= 2);
  const week = ws.filter(s => weekKey(s.date) === weekKey(today)).length, target = +S.profile.weeklyTarget || 3;
  const P = activeProgram(S), w = P.workouts[nextIndex(S, P.id)];
  const nut = !!(S.nutrition && S.nutrition.enabled), water = d.water || 0, wt = S.nutrition?.waterTarget || 8;
  const lastW = weightSeries(S).pop(), needWeight = !lastW || daysBetween(lastW.date, today) >= 7;
  const it = (id: string, t: string, extra: Partial<MissionItem> = {}): MissionItem => ({ id, t, done: !!chk[id], ...extra });
  let m: Omit<Mission, 'done'>;
  if (pain && !trainedToday) m = { kind: 'recovery', title: 'Миссия: восстановление', sub: 'Недавно была отмечена боль — сегодня без силовой нагрузки.', items: [it('walk', 'Спокойная прогулка 20 минут'), it('mob', 'Мобилити без боли — 10 минут', { href: '#/group/mobility' }), it('sleep', 'Сон 7+ часов')] };
  else if (trainedToday) m = { kind: 'done', title: 'Миссия выполнена', sub: 'Тренировка сегодня уже есть. Закрепите результат восстановлением.', items: [{ id: 'train', t: 'Тренировка дня', auto: true, done: true }, it('stretch', 'Растяжка или мобилити 5 минут', { href: '#/group/mobility' }), it('sleep', 'Сон 7+ часов')] };
  else {
    const rested = !ws.some(s => s.date === y) || P.kind !== 'fullbody';
    if (week < target && rested && !(d.recovery)) m = { kind: 'train', title: `Миссия: ${w ? w.name : 'тренировка'}`, sub: `${P.name}${w ? ' · ' + w.focus : ''}. Неделя: ${week} из ${target}.`, items: [{ id: 'train', t: `Выполнить тренировку${w ? ' «' + w.name + '»' : ''}`, auto: true, done: false }, it('warm', 'Разминка 5 минут перед стартом'), it('sleep', 'Сон 7+ часов')] };
    else m = { kind: 'rest', title: 'Миссия: день восстановления', sub: week >= target ? 'Недельная цель выполнена — мышцы растут во время отдыха.' : 'Вчера была тренировка — сегодня восстановление.', items: [it('walk', 'Прогулка 20–30 минут'), it('mob', 'Мобилити плеч и бёдер — 10 минут', { href: '#/group/mobility' }), it('sleep', 'Сон 7+ часов')] };
  }
  if (nut) m.items.push({ id: 'water', t: `Вода: ${water} из ${wt} стаканов`, auto: true, done: water >= wt, href: '#/nutrition' });
  if (needWeight) m.items.push(it('weight', 'Записать вес', { href: '#/body' }));
  return { ...m, done: m.items.filter(x => x.done).length };
}
