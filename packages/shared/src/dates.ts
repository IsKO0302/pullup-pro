import { W, pl } from './util';

/* ---------- dates ---------- */
export const pad = (n: number): string => String(n).padStart(2, '0');
export const dayKey = (d: Date = new Date()): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDay = (k: string): Date => { const [y, m, d] = String(k).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const addDays = (d: Date, n: number): Date => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
export const startOfWeek = (d: Date): Date => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
export const weekKey = (d: Date | string): string => dayKey(startOfWeek(typeof d === 'string' ? parseDay(d) : d));
export const daysBetween = (a: string, b: string): number => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 864e5);
export const todayKey = (): string => dayKey(new Date());
export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const MONTHS_G = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const MONTHS_S = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WD_F = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
export const wdIdx = (d: Date): number => (d.getDay() + 6) % 7;
export const fmtDay = (k: string): string => { const d = parseDay(k); const y = d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''; return `${d.getDate()} ${MONTHS_G[d.getMonth()]}${y}`; };
export const fmtDayShort = (k: string): string => { const d = parseDay(k); return `${d.getDate()} ${MONTHS_S[d.getMonth()]}`; };
export const fmtDayW = (k: string): string => { const d = parseDay(k); return `${WD[wdIdx(d)]}, ${fmtDay(k)}`; };
export const relDay = (k: string): string => { const n = daysBetween(todayKey(), k); if (n === 0) return 'сегодня'; if (n === 1) return 'завтра'; if (n === -1) return 'вчера'; if (n > 1 && n < 7) return `через ${pl(n, W.day)}`; if (n < -1 && n > -7) return `${pl(-n, W.day)} назад`; return fmtDay(k); };
export const fmtClock = (s: number): string => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${pad(m)}:${pad(x)}` : `${pad(m)}:${pad(x)}`; };
export const fmtMin = (s: number): string => { const m = Math.round((s || 0) / 60); if (s > 0 && m < 1) return '&lt;1 мин'; if (m < 60) return `${m} мин`; return `${Math.floor(m / 60)} ч ${pad(m % 60)} мин`; };
export const fmtSec = (s: number): string => { s = Math.round(s || 0); return s >= 60 ? `${Math.floor(s / 60)}:${pad(s % 60)}` : `${s} с`; };
