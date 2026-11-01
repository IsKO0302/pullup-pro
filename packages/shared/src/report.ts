/* ================= Weekly report advice & strength changes (ЧАСТЬ 15.4, ЧАСТЬ 9) =================
 * Plain, documented rules — not a medical or "AI" assessment. Shared by the web app and the Telegram bot. */
import type { AppState, DayKey, Group } from './types';
import { deloadStatus } from './engine';
import { doneSets, isWorkout, type Results, type WeekReport } from './stats';
import { exOf } from './catalog/exercises';

export interface Advice { tone: 'warn' | 'info' | 'ok' | 'up'; title: string; text: string; rule: string }
export function weekAdvice(S: AppState, r: WeekReport, today?: DayKey): Advice {
  const dl = deloadStatus(S, today);
  if (r.painDays > 0) return { tone: 'warn', rule: 'pain', title: 'Начните неделю с облегчённой тренировки', text: `На неделе была отмечена боль (${r.painDays} ${r.painDays === 1 ? 'день' : 'дня'}). Не тренируйтесь через боль: выберите облегчённые варианты упражнений, а если боль повторяется — обратитесь к врачу.` };
  if (dl.due) return { tone: 'info', rule: 'deload', title: 'Пора запланировать разгрузку', text: `${dl.reason || 'Накопилось много тренировочных недель.'} Разгрузочную неделю можно включить в разделе «Мой план».` };
  if (r.workouts === 0) return { tone: 'info', rule: 'none', title: 'Вернитесь в ритм мягко', text: 'На этой неделе тренировок не было. Начните с 2 коротких тренировок на всё тело с обычной разминкой — без попытки «догнать» пропущенное.' };
  if (r.workouts < r.target) return { tone: 'info', rule: 'below-target', title: `Цель: ${r.target} тренировки в неделю`, text: `Выполнено ${r.workouts} из ${r.target}. Запланируйте дни заранее в календаре — так проще выполнить план.` };
  if (r.avgRpe != null && r.avgRpe >= 8.5) return { tone: 'warn', rule: 'hard', title: 'Нагрузка ощущалась тяжёлой', text: `Средняя оценка тяжести (RPE) — ${String(r.avgRpe).replace('.', ',')}. Оставьте объём прежним или немного снизьте его: не каждый подход нужно доводить до отказа.` };
  if (r.prs.length > 0) return { tone: 'up', rule: 'prs', title: 'Отличная неделя — продолжайте по плану', text: `Новых рекордов: ${r.prs.length}. Нагрузку повышайте постепенно: программа предложит прогрессию после стабильных тренировок с запасом повторений.` };
  return { tone: 'ok', rule: 'on-target', title: 'Цель недели выполнена', text: 'Сохраните ритм: те же тренировочные дни и сон 7+ часов. Когда все подходы будут даваться с запасом, программа предложит прогрессию.' };
}

/** key exercises shown in "strength changes": best single set before the period vs inside the period */
export const KEY_RESULTS: { k: keyof Results; ex: string; kind: 'reps' | 'time'; label: string }[] = [
  { k: 'pull', ex: 'pullup', kind: 'reps', label: 'Подтягивания' }, { k: 'push', ex: 'pushup', kind: 'reps', label: 'Отжимания' },
  { k: 'plank', ex: 'plank', kind: 'time', label: 'Планка' }, { k: 'squat', ex: 'squat', kind: 'reps', label: 'Приседания' },
  { k: 'dips', ex: 'dips', kind: 'reps', label: 'Брусья' }, { k: 'hang', ex: 'hang', kind: 'time', label: 'Вис' }
];
export interface StrengthChange { ex: string; label: string; kind: 'reps' | 'time'; before: number; now: number; delta: number }
const TEST_FIELD: Record<string, string> = { pullup: 'pullups', pushup: 'pushups', plank: 'plank', squat: 'squats', dips: 'dips', hang: 'hang' };
export function strengthChanges(S: AppState, since: DayKey, extra: string[] = []): StrengthChange[] {
  const list = [...KEY_RESULTS.map(x => ({ ex: x.ex, kind: x.kind, label: x.label })), ...extra.filter(e => !KEY_RESULTS.some(k => k.ex === e)).map(e => ({ ex: e, kind: exOf(e).type, label: exOf(e).name }))];
  const out: StrengthChange[] = [];
  for (const it of list) {
    let before = 0, now = 0;
    const add = (date: DayKey, v: number) => { if (!(v > 0)) return; if (since && date < since) before = Math.max(before, v); else now = Math.max(now, v); };
    for (const s of S.sessions || []) {
      if (!isWorkout(s)) continue;
      for (const x of s.items || []) if (x.ex === it.ex) for (const st of doneSets(x)) {
        if (it.kind === 'time') add(s.date, +(st.time || 0)); else if (!(+(st.weight || 0) > 0)) add(s.date, +(st.reps || 0));
      }
    }
    const tf = TEST_FIELD[it.ex]; if (tf) for (const t of S.tests || []) add(t.date, +((t as unknown as Record<string, number>)[tf] || 0));
    if (now > 0) out.push({ ex: it.ex, label: it.label, kind: it.kind as 'reps' | 'time', before, now, delta: before ? now - before : 0 });
  }
  return out;
}
export const GROUP_ORDER: Group[] = ['pull', 'push', 'shoulders', 'core', 'legs', 'fullbody', 'mobility', 'muscleup'];
