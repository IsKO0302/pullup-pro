/* ================= PULLUP PRO — core utilities ================= */
import { getLang, numLocale, onLangChange } from './i18n/locale';
export const APP_VERSION = '2.0.0';
export const DATA_VERSION = 2;
export const esc = (s: unknown): string => String(s == null ? '' : s).replace(/[&<>"']/g, c => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]));
export const uid = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const sum = (a: unknown[]): number => a.reduce<number>((x, y: any) => x + (+y || 0), 0);
export const round1 = (v: number): number => Math.round(v * 10) / 10;
export const fmtNum = (n: any): string => (Math.round((+n || 0) * 10) / 10).toLocaleString(numLocale());
/** plural form index: Russian has 3 forms; English one/other (index 0 / 2); Turkish never inflects after a number (index 0) */
export const plural = (n: number, f: readonly string[]): string => {
  n = Math.abs(Math.round(n));
  const lang = getLang();
  if (lang === 'en') return f[n === 1 ? 0 : 2] ?? f[f.length - 1];
  if (lang === 'tr') return f[0];
  const a = n % 10, b = n % 100; return f[(a === 1 && b !== 11) ? 0 : (a >= 2 && a <= 4 && (b < 10 || b >= 20)) ? 1 : 2];
};
export const pl = (n: number, f: readonly string[]): string => `${fmtNum(n)} ${plural(n, f)}`;
const WORDS_RU: Record<string, readonly [string, string, string]> = {
  rep: ['повтор', 'повтора', 'повторов'], pull: ['подтягивание', 'подтягивания', 'подтягиваний'],
  work: ['тренировка', 'тренировки', 'тренировок'], day: ['день', 'дня', 'дней'], week: ['неделя', 'недели', 'недель'],
  sec: ['секунда', 'секунды', 'секунд'], min: ['минута', 'минуты', 'минут'], set: ['подход', 'подхода', 'подходов'],
  ex: ['упражнение', 'упражнения', 'упражнений'], mu: ['выход', 'выхода', 'выходов'], test: ['тест', 'теста', 'тестов']
};
const one = (s: string, many = s + 's'): readonly [string, string, string] => [s, many, many];
const WORDS_EN: Record<string, readonly [string, string, string]> = {
  rep: one('rep'), pull: one('pull-up'), work: one('workout'), day: one('day'), week: one('week'), sec: one('second'),
  min: one('minute'), set: one('set'), ex: one('exercise'), mu: one('muscle-up'), test: one('test')
};
const WORDS_TR: Record<string, readonly [string, string, string]> = {
  rep: one('tekrar', 'tekrar'), pull: one('barfiks', 'barfiks'), work: one('antrenman', 'antrenman'), day: one('gün', 'gün'), week: one('hafta', 'hafta'),
  sec: one('saniye', 'saniye'), min: one('dakika', 'dakika'), set: one('set', 'set'), ex: one('egzersiz', 'egzersiz'), mu: one('muscle-up', 'muscle-up'), test: one('test', 'test')
};
/** unit words with plural forms; switched in place when the language changes, so every importer sees the current language */
export const W: Record<string, readonly [string, string, string]> = { ...WORDS_RU };
onLangChange(l => { Object.assign(W, l === 'en' ? WORDS_EN : l === 'tr' ? WORDS_TR : WORDS_RU); });
export const hashStr = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
