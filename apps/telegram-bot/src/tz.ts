/* ================= Local time of a user (IANA time zone from the synced profile) ================= */
export interface Zoned { zone: string; day: string; wd: number; minutes: number; hm: string }
const WDS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n: number) => String(n).padStart(2, '0');
export function validZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}
/** wall-clock date (YYYY-MM-DD), weekday (0 = Monday … 6 = Sunday) and minute of the day in `tz` */
export function zoned(tz: unknown, now: Date = new Date(), fallback = 'UTC'): Zoned {
  const zone = validZone(tz) ? tz : validZone(fallback) ? fallback : 'UTC';
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(now)) p[x.type] = x.value;
  const h = Number(p.hour) % 24, m = Number(p.minute);
  return { zone, day: `${p.year}-${p.month}-${p.day}`, wd: WDS.indexOf(p.weekday), minutes: h * 60 + m, hm: `${pad(h)}:${pad(m)}` };
}
export const hmToMin = (hm: string): number => { const m = /^(\d{2}):(\d{2})$/.exec(hm || ''); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : -1; };
