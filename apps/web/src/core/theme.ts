import { $ } from './dom';
import { S } from './state';

/* ================= Design system 2.0: Dark / Light / System + accent ================= */
export const ACCENTS: { id: string; name: string; c1: string; c2: string }[] = [
  { id: 'orange', name: 'Orange Fire', c1: '#ff6a1a', c2: '#ff2e2e' },
  { id: 'red', name: 'Red Power', c1: '#ff3030', c2: '#ff7a1a' }
];
const hexRgb = (h: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null;
  const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
/** second gradient stop: rotate towards red/orange to keep the PULLUP PRO "fire" look */
function shade(rgb: [number, number, number]): string { const [r, g, b] = rgb; return toHex(r * .92 + 20, g * .55, b * .6); }
/** Telegram Mini App passes its own color scheme; used when the theme is "system" */
let schemeOverride: 'light' | 'dark' | null = null;
export const setSchemeOverride = (s: 'light' | 'dark' | null) => { schemeOverride = s; };
export const isLight = (): boolean => {
  const t = S.settings?.theme || 'dark';
  if (t === 'system') return schemeOverride ? schemeOverride === 'light' : !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  return t === 'light';
};
export function applyTheme() {
  const b = document.body, light = isLight(), acc = S.profile.accent || 'orange';
  b.classList.toggle('light', light);
  b.classList.toggle('acc-red', acc === 'red');
  const custom = acc === 'custom' ? hexRgb(S.settings?.customAccent || '') : null;
  if (custom) { b.style.setProperty('--acc', toHex(...custom)); b.style.setProperty('--acc2', shade(custom)); b.style.setProperty('--accRGB', custom.join(',')); }
  else { b.style.removeProperty('--acc'); b.style.removeProperty('--acc2'); b.style.removeProperty('--accRGB'); }
  const m = $('meta[name=theme-color]'); if (m) m.content = light ? '#f4f4f6' : '#09090b';
}
let mq: MediaQueryList | null = null;
export function watchSystemTheme() {
  if (mq || !window.matchMedia) return;
  mq = window.matchMedia('(prefers-color-scheme: light)');
  const fn = () => { if ((S.settings?.theme || 'dark') === 'system') applyTheme(); };
  if (mq.addEventListener) mq.addEventListener('change', fn); else (mq as any).addListener(fn);
}
