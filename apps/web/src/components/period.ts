import { segBtns } from './view';
import { addDays, dayKey } from '@pullup/shared/dates';

/* period filter shared by Body and Progress pages: 7d / 30d / 90d / 6m / 1y / all */
export const PERIODS: [string, string][] = [['7', '7 дней'], ['30', '30 дней'], ['90', '90 дней'], ['182', '6 месяцев'], ['365', '1 год'], ['all', 'Всё время']];
export const periodSince = (p: string): string => p === 'all' ? '' : dayKey(addDays(new Date(), -(Math.max(1, +p || 30) - 1)));
export const periodName = (p: string): string => (PERIODS.find(x => x[0] === p) || PERIODS[1])[1];
export const periodSeg = (act: string, cur: string) => segBtns(act, PERIODS.map(([v, l]) => [v, l.replace(' месяцев', ' мес.').replace('Всё время', 'Всё')]), cur, 'role="group" aria-label="Период" style="flex-wrap:wrap"');
