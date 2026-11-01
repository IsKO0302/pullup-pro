/* ================= Personal Coach: transparent rule-based recommendations (ЧАСТЬ 15) =================
 * Not AI: every tip comes from an explicit rule over the user's own data. Safety rules win.
 */
import type { AppState, DayKey, Group } from './types';
import { MU_STAGES } from './catalog/programs';
import { addDays, daysBetween, dayKey, fmtDay, parseDay, todayKey, wdIdx } from './dates';
import { deloadStatus, muCurrentStage } from './engine';
import { bestResults, isWorkout, sessionVolume, summary } from './stats';
import { pl, W } from './util';

export interface CoachTip { id: string; tone: 'warn' | 'info' | 'ok' | 'up'; icon: string; title: string; text: string; href?: string; act?: string; actLabel?: string; rule: string }
export function coachTips(S: AppState, today: DayKey = todayKey(), max = 5): CoachTip[] {
  const T: CoachTip[] = [], sm = summary(S, today), ws = (S.sessions || []).filter(isWorkout);
  const recentPain = ws.some(s => s.pain && daysBetween(s.date, today) <= 3);
  if (recentPain) T.push({ id: 'pain', tone: 'warn', icon: 'warn', title: 'Сначала восстановление', text: 'Недавно была отмечена боль. Сделайте паузу или лёгкую мобилити без боли. Если боль повторяется — обратитесь к врачу или физиотерапевту.', rule: 'Боль за последние 3 дня' });
  const dl = deloadStatus(S, today);
  if (dl.active) T.push({ id: 'deload', tone: 'info', icon: 'bed', title: 'Разгрузочная неделя', text: `До ${fmtDay(dl.until as string)} объём снижен примерно на 40%. Цель — восстановиться и продолжить прогресс.`, rule: 'Активна разгрузка' });
  else if (dl.due && !recentPain) T.push({ id: 'deload-due', tone: 'up', icon: 'bed', title: 'Пора разгрузиться', text: dl.reason || '', act: 'deloadStart', actLabel: 'Начать разгрузочную неделю', rule: '6 недель тренировок или признаки усталости' });
  const props = S.engine?.proposals || [];
  if (props.length && !recentPain) T.push({ id: 'props', tone: 'up', icon: 'zap', title: `Готово повышение нагрузки: ${props.length}`, text: props.slice(0, 2).map(p => p.text).join(' · '), href: '#/plan', actLabel: 'Посмотреть', rule: '2 стабильные тренировки подряд' });
  if (sm.daysSinceLast != null && sm.daysSinceLast >= 7 && !recentPain) T.push({ id: 'comeback', tone: 'info', icon: 'refresh', title: 'Возвращение в режим', text: `Последняя тренировка была ${pl(sm.daysSinceLast, W.day)} назад. Начните с лёгкой тренировки — объём вернётся за 1–2 недели.`, act: 'startMenu', actLabel: 'Лёгкая тренировка', rule: '7+ дней без тренировок' });
  else if (sm.daysSinceLast == null) T.push({ id: 'first', tone: 'info', icon: 'play', title: 'Первая тренировка', text: 'Начните с программы FULL BODY или теста уровня — так рекомендации станут точнее.', act: 'startMenu', actLabel: 'Начать', rule: 'Нет тренировок' });
  const left = sm.weekTarget - sm.weekCount, daysLeft = 7 - wdIdx(parseDay(today));
  if (sm.workouts > 0 && !recentPain) {
    if (left <= 0) T.push({ id: 'week-ok', tone: 'ok', icon: 'check', title: 'Цель недели выполнена', text: `${sm.weekCount} из ${sm.weekTarget} тренировок. Остальные дни — восстановление или лёгкая мобилити.`, rule: 'Недельная цель' });
    else if (left > Math.ceil(daysLeft / 2)) T.push({ id: 'week-risk', tone: 'info', icon: 'cal', title: `До цели недели: ${pl(left, W.work)}`, text: `Осталось ${pl(daysLeft, W.day)}. Не пытайтесь «догнать» всё подряд — лучше одна качественная тренировка, чем две тяжёлые подряд.`, rule: 'Недельная цель' });
  }
  // balance over the last 28 days
  const since = dayKey(addDays(parseDay(today), -27)), g: Partial<Record<Group, number>> = {};
  for (const s of S.sessions || []) if (s.date >= since) for (const [k, n] of Object.entries(sessionVolume(s).byGroup)) g[k as Group] = (g[k as Group] || 0) + (n as number);
  const tot = Object.values(g).reduce((a, b) => a + (b || 0), 0);
  if (tot >= 30 && !recentPain) {
    const pull = g.pull || 0, push = g.push || 0, goals = S.profile.goals || [];
    if (push > pull * 1.6 && push - pull >= 8) T.push({ id: 'bal-pull', tone: 'info', icon: 'prog', title: 'Добавьте тяги', text: `За 4 недели жимовых подходов ${Math.round(push)}, тяговых ${Math.round(pull)}. Баланс тяги и жима полезен для осанки и плеч.`, href: '#/group/pull', rule: 'Жим > тяга × 1,6' });
    else if (pull > push * 1.6 && pull - push >= 8) T.push({ id: 'bal-push', tone: 'info', icon: 'push', title: 'Добавьте жимы', text: `За 4 недели тяговых подходов ${Math.round(pull)}, жимовых ${Math.round(push)}. Добавьте отжимания или брусья.`, href: '#/group/push', rule: 'Тяга > жим × 1,6' });
    if (!(g.legs || 0)) T.push({ id: 'legs', tone: 'info', icon: 'legs', title: 'Ноги без нагрузки 4 недели', text: 'Добавьте 2–3 упражнения на ноги в неделю — приседания, выпады или ягодичный мост.', href: '#/group/legs', rule: 'Нет подходов на ноги' });
    if (goals.includes('shoulders') && (g.shoulders || 0) < 16) T.push({ id: 'delts', tone: 'info', icon: 'shoulder', title: 'Больше работы на средние дельты', text: 'Для ширины плеч нужны отдельные махи в стороны: 2–3 раза в неделю по 3–4 подхода. Одни отжимания средние дельты почти не нагружают.', href: '#/group/shoulders', rule: 'Цель «плечи» и < 4 подходов в неделю' });
    if (!(g.core || 0)) T.push({ id: 'core', tone: 'info', icon: 'core', title: 'Корпус без нагрузки', text: 'Добавьте 2 упражнения на корпус 2 раза в неделю: стабилизация и подъёмы ног.', href: '#/group/core', rule: 'Нет подходов на корпус' });
  }
  const n = muCurrentStage(S), st = MU_STAGES[n - 1];
  if (st && !(S.mu?.done || {})[n]) {
    const R = bestResults(S) as unknown as Record<string, number>, mv: Record<string, number> = { max: R.pull, dips: R.dips, hang: R.hang };
    const met = st.crit.every(c => c.metric ? (mv[c.metric] ?? 0) >= (c.target || 0) : !!(S.mu?.checks || {})[c.id]);
    if (met) T.push({ id: 'mu', tone: 'ok', icon: 'bolt', title: `Этап ${n} Muscle-Up: критерии выполнены`, text: 'Все критерии силы и техники отмечены. Подтвердите этап, если выполняете его стабильно и без боли.', href: '#/mu', rule: 'Критерии этапа' });
  }
  const body = [...(S.body || [])].sort((a, b) => a.date < b.date ? -1 : 1), lastB = body[body.length - 1];
  if (!lastB && sm.workouts >= 1) T.push({ id: 'body0', tone: 'info', icon: 'ruler', title: 'Стартовые замеры', text: 'Запишите вес и обхваты сегодня — через месяц будет с чем сравнить.', href: '#/body', rule: 'Нет замеров' });
  else if (lastB && daysBetween(lastB.date, today) >= 14) T.push({ id: 'body', tone: 'info', icon: 'ruler', title: 'Обновите замеры', text: `Последние замеры — ${fmtDay(lastB.date)}. Измеряйте утром, в одинаковых условиях.`, href: '#/body', rule: '14+ дней без замеров' });
  if ((S.profile.goals || []).includes('muscle') && sm.workouts >= 3) T.push({ id: 'muscle', tone: 'info', icon: 'heart', title: 'Рост мышц — это система', text: 'Важны регулярные тренировки с прогрессией, достаточное питание с белком в течение дня и сон 7–9 часов. Ни один продукт сам по себе мышцы не строит.', rule: 'Цель «масса»' });
  return T.slice(0, max);
}
