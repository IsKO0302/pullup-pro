/* ================= PULLUP PRO — core utilities ================= */
export const APP_VERSION = '2.0.0';
export const DATA_VERSION = 2;
export const esc = (s: unknown): string => String(s == null ? '' : s).replace(/[&<>"']/g, c => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]));
export const uid = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const sum = (a: unknown[]): number => a.reduce<number>((x, y: any) => x + (+y || 0), 0);
export const round1 = (v: number): number => Math.round(v * 10) / 10;
export const fmtNum = (n: any): string => (Math.round((+n || 0) * 10) / 10).toLocaleString('ru-RU');
export const plural = (n: number, f: readonly string[]): string => { n = Math.abs(Math.round(n)); const a = n % 10, b = n % 100; return f[(a === 1 && b !== 11) ? 0 : (a >= 2 && a <= 4 && (b < 10 || b >= 20)) ? 1 : 2]; };
export const pl = (n: number, f: readonly string[]): string => `${fmtNum(n)} ${plural(n, f)}`;
export const W: Record<string, readonly [string, string, string]> = {
  rep: ['повтор', 'повтора', 'повторов'], pull: ['подтягивание', 'подтягивания', 'подтягиваний'],
  work: ['тренировка', 'тренировки', 'тренировок'], day: ['день', 'дня', 'дней'], week: ['неделя', 'недели', 'недель'],
  sec: ['секунда', 'секунды', 'секунд'], min: ['минута', 'минуты', 'минут'], set: ['подход', 'подхода', 'подходов'],
  ex: ['упражнение', 'упражнения', 'упражнений'], mu: ['выход', 'выхода', 'выходов'], test: ['тест', 'теста', 'тестов']
};
export const hashStr = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
