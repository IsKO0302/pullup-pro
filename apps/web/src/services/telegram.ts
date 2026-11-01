import { setHaptic } from '../core/audio';
import { go } from '../core/router';
import { setSchemeOverride, applyTheme } from '../core/theme';
import { S } from '../core/state';

/* ================= Telegram Mini App integration (ЧАСТЬ 13) =================
 * telegram-web-app.js is loaded ONLY when the app is opened from Telegram (launch parameters in the URL);
 * in the browser/PWA nothing is loaded from telegram.org. initData is validated on the server (HMAC). */
const TG_SCREENS = ['home', 'train', 'plan', 'stats', 'body', 'nutrition', 'settings', 'report', 'profile', 'mu', 'achievements', 'journal'];
export const TG: { app: any; active: boolean; initData: string; platform: string } = { app: null, active: false, initData: '', platform: '' };
export function launchedFromTelegram(): boolean {
  const h = location.hash + location.search;
  try { if (/tgWebAppData=|tgWebAppPlatform=/.test(h) || sessionStorage.getItem('__telegram__initParams')) return true; } catch (e) { /* storage blocked */ }
  return /tgWebAppData=|tgWebAppPlatform=/.test(h);
}
function loadScript(src: string, ms: number): Promise<void> {
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.async = true;
    const t = setTimeout(() => rej(new Error('timeout')), ms);
    s.onload = () => { clearTimeout(t); res(); }; s.onerror = () => { clearTimeout(t); rej(new Error('load failed')); };
    document.head.appendChild(s);
  });
}
function setInsets() {
  const W = TG.app; if (!W) return;
  const a = W.safeAreaInset || {}, c = W.contentSafeAreaInset || {}, st = document.documentElement.style;
  st.setProperty('--tg-top', ((+a.top || 0) + (+c.top || 0)) + 'px'); st.setProperty('--tg-bottom', ((+a.bottom || 0) + (+c.bottom || 0)) + 'px');
}
function syncBack() {
  const W = TG.app; if (!W || !W.BackButton) return;
  const r = (location.hash || '').replace(/^#\/?/, '').split('/')[0] || 'home';
  if (r === 'home') W.BackButton.hide(); else W.BackButton.show();
}
export async function initTelegram(): Promise<boolean> {
  if (!launchedFromTelegram()) return false;
  try { await loadScript('https://telegram.org/js/telegram-web-app.js', 5000); } catch (e) { console.warn('Telegram SDK not loaded', e); return false; }
  const W = (window as any).Telegram && (window as any).Telegram.WebApp; if (!W) return false;
  TG.app = W; TG.active = true; TG.initData = W.initData || ''; TG.platform = W.platform || '';
  document.body.classList.add('in-tg');
  try { W.ready(); W.expand && W.expand(); } catch (e) { /* old client */ }
  const ver = (v: string) => { try { return W.isVersionAtLeast && W.isVersionAtLeast(v); } catch (e) { return false; } };
  if (ver('7.7') && W.disableVerticalSwipes) W.disableVerticalSwipes();
  const scheme = () => { setSchemeOverride(W.colorScheme === 'light' ? 'light' : 'dark'); applyTheme(); };
  scheme(); W.onEvent && W.onEvent('themeChanged', scheme);
  setInsets(); if (W.onEvent) { W.onEvent('safeAreaChanged', setInsets); W.onEvent('contentSafeAreaChanged', setInsets); }
  if (W.BackButton && ver('6.1')) { W.BackButton.onClick(() => { if (history.length > 1) history.back(); else go('#/home'); }); window.addEventListener('hashchange', syncBack); syncBack(); }
  if (W.HapticFeedback && ver('6.1')) setHaptic(p => { try { const v = Array.isArray(p) ? 'heavy' : (+p >= 80 ? 'medium' : 'light'); W.HapticFeedback.impactOccurred(v); return true; } catch (e) { return false; } });
  let training = false;
  window.addEventListener('pullup:train', (e: any) => {
    training = !!(e.detail && e.detail.active);
    try { if (training) W.enableClosingConfirmation && W.enableClosingConfirmation(); else W.disableClosingConfirmation && W.disableClosingConfirmation(); } catch (er) { /* ignore */ }
    // full screen during a workout on phones (Bot API 8.0+), when enabled in the settings
    try {
      if (training && S.settings && S.settings.fullscreen && ver('8.0') && /android|ios/.test(TG.platform) && W.requestFullscreen && !W.isFullscreen) W.requestFullscreen();
      else if (!training && W.isFullscreen && W.exitFullscreen) W.exitFullscreen();
    } catch (er) { /* unsupported client */ }
    syncMain();
  });
  // MainButton mirrors the primary action of the screen («Начать тренировку»); hidden while a dialog or the workout is open
  const primary = () => document.querySelector<HTMLElement>('#view [data-tg-main], #view [data-act="stEngine"]');
  const syncMain = () => {
    const MB = W.MainButton; if (!MB) return;
    const el = training || document.querySelector('#modal-root .modal-wrap') ? null : primary();
    try { if (el) { MB.setText(el.dataset.tgMain || 'НАЧАТЬ ТРЕНИРОВКУ'); MB.show(); } else MB.hide(); } catch (er) { /* ignore */ }
  };
  if (W.MainButton) {
    W.MainButton.onClick(() => { const el = primary(); if (el && !training) { try { W.MainButton.hide(); } catch (er) { /* ignore */ } el.click(); } });
    window.addEventListener('pullup:render', syncMain);
    const mr = document.getElementById('modal-root'); if (mr && 'MutationObserver' in window) new MutationObserver(syncMain).observe(mr, { childList: true });
  }
  // the SDK has stored the launch params; give the hash back to the router
  // deep link: t.me/<bot>/<app>?startapp=<screen> (start_param) or WEBAPP_URL?screen=<screen> from the bot buttons
  const want = String((W.initDataUnsafe && W.initDataUnsafe.start_param) || new URLSearchParams(location.search).get('screen') || '');
  const target = TG_SCREENS.includes(want) ? want : 'home';
  if (/tgWebApp/.test(location.hash) || want) history.replaceState(null, '', location.pathname + location.search + '#/' + target);
  return true;
}
export const tgUser = (): { id: number; first_name?: string; username?: string } | null => { try { return TG.app && TG.app.initDataUnsafe && TG.app.initDataUnsafe.user || null; } catch (e) { return null; } };
export function tgOpenLink(url: string) { if (TG.app && TG.app.openTelegramLink && /^https:\/\/t\.me\//.test(url)) TG.app.openTelegramLink(url); else window.open(url, '_blank', 'noopener'); }
