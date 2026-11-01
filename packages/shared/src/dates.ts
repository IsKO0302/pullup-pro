import { W, pl } from './util';
import { getLang, onLangChange } from './i18n/locale';

/* ---------- dates ---------- */
export const pad = (n: number): string => String(n).padStart(2, '0');
export const dayKey = (d: Date = new Date()): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDay = (k: string): Date => { const [y, m, d] = String(k).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const addDays = (d: Date, n: number): Date => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
export const startOfWeek = (d: Date): Date => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
export const weekKey = (d: Date | string): string => dayKey(startOfWeek(typeof d === 'string' ? parseDay(d) : d));
export const daysBetween = (a: string, b: string): number => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 864e5);
export const todayKey = (): string => dayKey(new Date());
/* month / weekday names: the arrays are switched IN PLACE when the language changes (importers keep their references) */
const NAMES = {
  ru: {
    MONTHS: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    MONTHS_G: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    MONTHS_S: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
    WD: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], WD_F: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
  },
  en: {
    MONTHS: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    MONTHS_G: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    MONTHS_S: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    WD: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], WD_F: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  tr: {
    MONTHS: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
    MONTHS_G: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
    MONTHS_S: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
    WD: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'], WD_F: ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
  }
} as const;
const UNITS = { ru: { min: 'мин', h: 'ч', s: 'с', today: 'сегодня', tomorrow: 'завтра', yesterday: 'вчера' }, en: { min: 'min', h: 'h', s: 's', today: 'today', tomorrow: 'tomorrow', yesterday: 'yesterday' }, tr: { min: 'dk', h: 'sa', s: 'sn', today: 'bugün', tomorrow: 'yarın', yesterday: 'dün' } } as const;
export const MONTHS: string[] = [...NAMES.ru.MONTHS];
export const MONTHS_G: string[] = [...NAMES.ru.MONTHS_G];
export const MONTHS_S: string[] = [...NAMES.ru.MONTHS_S];
export const WD: string[] = [...NAMES.ru.WD];
export const WD_F: string[] = [...NAMES.ru.WD_F];
onLangChange(l => {
  const n = NAMES[l];
  MONTHS.splice(0, 12, ...n.MONTHS); MONTHS_G.splice(0, 12, ...n.MONTHS_G); MONTHS_S.splice(0, 12, ...n.MONTHS_S);
  WD.splice(0, 7, ...n.WD); WD_F.splice(0, 7, ...n.WD_F);
});
export const wdIdx = (d: Date): number => (d.getDay() + 6) % 7;
export const fmtDay = (k: string): string => { const d = parseDay(k); const y = d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''; return `${d.getDate()} ${MONTHS_G[d.getMonth()]}${y}`; };
export const fmtDayShort = (k: string): string => { const d = parseDay(k); return `${d.getDate()} ${MONTHS_S[d.getMonth()]}`; };
export const fmtDayW = (k: string): string => { const d = parseDay(k); return `${WD[wdIdx(d)]}, ${fmtDay(k)}`; };
export const relDay = (k: string): string => {
  const n = daysBetween(todayKey(), k), u = UNITS[getLang()], l = getLang();
  if (n === 0) return u.today; if (n === 1) return u.tomorrow; if (n === -1) return u.yesterday;
  if (n > 1 && n < 7) return l === 'en' ? `in ${pl(n, W.day)}` : l === 'tr' ? `${pl(n, W.day)} sonra` : `через ${pl(n, W.day)}`;
  if (n < -1 && n > -7) return l === 'en' ? `${pl(-n, W.day)} ago` : l === 'tr' ? `${pl(-n, W.day)} önce` : `${pl(-n, W.day)} назад`;
  return fmtDay(k);
};
export const fmtClock = (s: number): string => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${pad(m)}:${pad(x)}` : `${pad(m)}:${pad(x)}`; };
export const fmtMin = (s: number): string => { const u = UNITS[getLang()], m = Math.round((s || 0) / 60); if (s > 0 && m < 1) return `&lt;1 ${u.min}`; if (m < 60) return `${m} ${u.min}`; return `${Math.floor(m / 60)} ${u.h} ${pad(m % 60)} ${u.min}`; };
export const fmtSec = (s: number): string => { s = Math.round(s || 0); return s >= 60 ? `${Math.floor(s / 60)}:${pad(s % 60)}` : `${s} ${UNITS[getLang()].s}`; };
