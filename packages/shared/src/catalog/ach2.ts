/* ================= Achievements 2.0 (ЧАСТЬ 15) ================= */
import type { Achievement, AppState, Group } from '../types';
import { bestResults, consistencyWeeks, doneSets, isWorkout, sessionVolume, type Results } from '../stats';
import { exOf } from './exercises';
import { weekKey } from '../dates';

export interface AchCtx { R: Results; workouts: number; maxPushSession: number; groupSets: Partial<Record<Group, number>>; mu: number; consistency: number; groupsWeekMax: number; measurements: number; muStagesDone: number }
export function achCtx(S: AppState): AchCtx {
  const groupSets: Partial<Record<Group, number>> = {}, weekGroups: Record<string, Set<Group>> = {};
  let workouts = 0, maxPushSession = 0, mu = 0;
  for (const s of S.sessions || []) {
    if (isWorkout(s)) workouts++;
    const v = sessionVolume(s); maxPushSession = Math.max(maxPushSession, v.push);
    for (const [g, n] of Object.entries(v.byGroup)) groupSets[g as Group] = (groupSets[g as Group] || 0) + (n as number);
    const wg = weekGroups[weekKey(s.date)] || (weekGroups[weekKey(s.date)] = new Set());
    for (const it of s.items || []) {
      const e = exOf(it.ex), ds = doneSets(it); if (!ds.length) continue;
      wg.add(e.group); (e.also || []).forEach(g => wg.add(g));
      if (e.count === 'mu') for (const st of ds) mu = Math.max(mu, +(st.reps || 0));
    }
  }
  const main: Group[] = ['pull', 'push', 'shoulders', 'core', 'legs'];
  const groupsWeekMax = Math.max(0, ...Object.values(weekGroups).map(set => main.filter(g => set.has(g)).length));
  return { R: bestResults(S), workouts, maxPushSession, groupSets, mu, consistency: consistencyWeeks(S), groupsWeekMax, measurements: (S.body || []).length, muStagesDone: Object.values(S.mu?.done || {}).filter(Boolean).length };
}
const m = (a: number, b: number): [number, number] => [Math.min(a || 0, b), b];
export const ACH2: Achievement[] = [
  { id: 'v2_first_pullup', en: 'FIRST PULL-UP', name: 'Первое подтягивание', desc: 'Одно строгое подтягивание без помощи', icon: 'prog', tier: 'bronze', group: 'pull', p: (X: AchCtx) => m(X.R.pull, 1) },
  { id: 'v2_first_pushup', en: 'FIRST PUSH-UP', name: 'Первое отжимание', desc: 'Одно полноценное отжимание от пола', icon: 'push', tier: 'bronze', group: 'push', p: (X: AchCtx) => m(X.R.push, 1) },
  { id: 'v2_10_pullups', en: '10 PULL-UPS', name: '10 подтягиваний', desc: '10 строгих подтягиваний подряд', icon: 'trophy', tier: 'gold', group: 'pull', p: (X: AchCtx) => m(X.R.pull, 10) },
  { id: 'v2_50_pushups', en: '50 PUSH-UPS', name: '50 отжиманий', desc: '50 отжиманий за одну тренировку', icon: 'push', tier: 'silver', group: 'push', p: (X: AchCtx) => m(X.maxPushSession, 50) },
  { id: 'v2_plank_1min', en: '1 MINUTE PLANK', name: 'Минута в планке', desc: 'Планка на предплечьях 60 секунд', icon: 'timer', tier: 'silver', group: 'core', p: (X: AchCtx) => m(X.R.plank, 60) },
  { id: 'v2_strong_shoulders', en: 'STRONG SHOULDERS', name: 'Сильные плечи', desc: '100 рабочих подходов на плечи', icon: 'shoulder', tier: 'gold', group: 'shoulders', p: (X: AchCtx) => m(Math.floor(X.groupSets.shoulders || 0), 100) },
  { id: 'v2_core_master', en: 'CORE MASTER', name: 'Мастер корпуса', desc: '150 рабочих подходов на пресс и корпус', icon: 'core', tier: 'gold', group: 'core', p: (X: AchCtx) => m(Math.floor(X.groupSets.core || 0), 150) },
  { id: 'v2_first_mu', en: 'FIRST MUSCLE-UP', name: 'Первый выход силой', desc: 'Один чистый выход силой на две руки', icon: 'bolt', tier: 'platinum', group: 'muscleup', p: (X: AchCtx) => m(X.mu, 1) },
  { id: 'v2_10_workouts', en: '10 WORKOUTS', name: '10 тренировок', desc: '10 сохранённых тренировок', icon: 'cal', tier: 'bronze', p: (X: AchCtx) => m(X.workouts, 10) },
  { id: 'v2_50_workouts', en: '50 WORKOUTS', name: '50 тренировок', desc: '50 сохранённых тренировок', icon: 'cal', tier: 'silver', p: (X: AchCtx) => m(X.workouts, 50) },
  { id: 'v2_100_workouts', en: '100 WORKOUTS', name: '100 тренировок', desc: '100 сохранённых тренировок', icon: 'medal', tier: 'gold', p: (X: AchCtx) => m(X.workouts, 100) },
  { id: 'v2_consistency', en: 'CONSISTENCY MASTER', name: 'Мастер постоянства', desc: '8 недель подряд с выполненной недельной целью', icon: 'flame', tier: 'platinum', p: (X: AchCtx) => m(X.consistency, 8) },
  { id: 'v2_full_week', en: 'FULL BODY WEEK', name: 'Неделя всего тела', desc: 'За одну неделю: спина, грудь, плечи, корпус и ноги', icon: 'fullbody', tier: 'silver', p: (X: AchCtx) => m(X.groupsWeekMax, 5) },
  { id: 'v2_leg_day', en: 'LEG DAY', name: 'День ног', desc: '50 рабочих подходов на ноги', icon: 'legs', tier: 'bronze', group: 'legs', p: (X: AchCtx) => m(Math.floor(X.groupSets.legs || 0), 50) },
  { id: 'v2_body_tracker', en: 'BODY TRACKER', name: 'Дневник тела', desc: 'Первая запись замеров тела', icon: 'ruler', tier: 'bronze', p: (X: AchCtx) => m(X.measurements, 1) },
  { id: 'v2_mu_halfway', en: 'MUSCLE-UP HALFWAY', name: 'Половина пути', desc: 'Пройдены 3 этапа пути к выходу силой', icon: 'bolt', tier: 'silver', group: 'muscleup', p: (X: AchCtx) => m(X.muStagesDone, 3) }
];
