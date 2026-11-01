import { defaultState, type AppState, type Session } from '@pullup/shared';

type SetIn = number | { reps?: number; time?: number; weight?: number; done?: boolean };
/** a logged workout: items = [exerciseId, [reps | {time} ...]] */
export function sess(id: string, date: string, items: [string, SetIn[]][], extra: Partial<Session> = {}): Session {
  return {
    id, date, startedAt: Date.parse(date + 'T10:00:00Z'), title: 'Тест', source: 'engine', durationSec: 1800,
    items: items.map(([ex, sets]) => ({ ex, sets: sets.map(s => typeof s === 'number' ? { reps: s, done: true } : { done: true, ...s }) })),
    ...extra
  } as Session;
}
export function state(patch: (S: AppState) => void = () => undefined): AppState {
  const S = defaultState(Date.parse('2026-01-01T00:00:00Z'));
  S.profile.onboarded = true; S.profile.disclaimerAccepted = true; S.profile.equipment = ['bar', 'dipbars'];
  patch(S);
  return S;
}
