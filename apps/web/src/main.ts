import './styles/app.css';
import './styles/v2.css';
// feature modules register their routes (ROUTES.*) and actions (ACT.*) on import
import './components/ui';
import './components/view';
import './features/dashboard/home';
import './features/train/hub';
import './features/plan/plan';
import './features/programs/programs';
import './features/muscle-up/muscle-up';
import './features/exercises/library';
import './features/journal/journal';
import './features/statistics/stats';
import './features/body/body';
import './features/nutrition/nutrition';
import './features/calendar/calendar';
import './features/builder/builder';
import './features/profile/profile';
import './features/achievements/achievements';
import './features/report/report';
import './features/settings/settings';
import './features/workout/start';
import './features/workout/train';
import './features/workout/resume';
import './features/onboarding/onboarding';
import { confirmBox } from './components/modal';
import { toast } from './components/toast';
import { $ } from './core/dom';
import { ico } from './core/icons';
import { CUR, render, rerender } from './core/router';
import { MIGRATION, S, STORE_KEY, loadState, mirrorCandidate, save, setState } from './core/state';
import { applyTheme, watchSystemTheme } from './core/theme';
import { askEnableSync, loadDemo } from './features/settings/settings';
import { ACT } from './core/events';
import { showOnboarding } from './features/onboarding/onboarding';
import { showResume } from './features/workout/resume';
import { TR } from './features/workout/train';
import { updateNetBadge, updateShell } from './layouts/shell';
import { telegramSignIn } from './services/account';
import { apiAvailable, auth } from './services/api';
import { LG } from './services/logic';
import { onPwaChange, registerSW } from './services/pwa';
import { snapshot } from './services/snapshots';
import { initSync, onSync } from './services/sync';
import { TG, initTelegram } from './services/telegram';

/* development-only QA hook (stripped from production builds by Vite's import.meta.env.DEV) */
if (import.meta.env.DEV) (window as any).__pullup = { S: () => S, ACT, render, demo: () => { S.profile.onboarded = true; S.profile.disclaimerAccepted = true; loadDemo(); render(); }, onboard: () => { S.profile.onboarded = true; S.profile.disclaimerAccepted = true; save(); render(); } };

(async function boot() {
  $('#brand-mark').innerHTML = ico('bar');
  applyTheme(); watchSystemTheme();
  // Telegram Mini App: the SDK must read its launch parameters before the router touches the hash
  try { await initTelegram(); } catch (e) { console.warn('Telegram init failed', e); }
  LG.checkAch(true);
  window.addEventListener('hashchange', () => render());
  if (!location.hash || location.hash === '#' || location.hash === '#/') history.replaceState(null, '', location.pathname + location.search + '#/home');
  render(); showResume();
  if (!S.profile.onboarded) setTimeout(() => showOnboarding(false), 300);
  else if (MIGRATION && MIGRATION.source === 'v1') setTimeout(() => toast('Данные PULLUP PRO 1.0 перенесены в версию 2.0 без потерь. Исходная копия 1.0 в браузере не изменялась.', 'ok', 7000), 600);

  // cross-tab edits
  window.addEventListener('storage', e => { if (e.key === STORE_KEY && !TR.active()) { setState(loadState()); render(); } });
  // network state
  updateNetBadge();
  window.addEventListener('online', () => { updateNetBadge(); toast('Снова онлайн', 'ok', 1800); });
  window.addEventListener('offline', () => { updateNetBadge(); toast('Нет интернета — PULLUP PRO продолжает работать офлайн', 'info', 3500); });
  // sync, PWA and remote changes
  initSync(); registerSW();
  onPwaChange(() => { if (['home', 'settings'].includes(CUR.name) && !TR.active()) rerender(); });
  onSync(() => updateShell());
  window.addEventListener('pullup:remote', () => { if (!TR.active()) { LG.checkAch(true); rerender(); toast('Получены изменения с другого устройства', 'info', 2200); } });

  // localStorage was cleared but the IndexedDB mirror survived → offer it back (never automatic)
  mirrorCandidate().then(async m => {
    if (!m) return;
    const ok = await confirmBox('Найдена сохранённая копия данных', `В резервном хранилище браузера есть более полная копия: ${m.sessions.length} тренировок, ${m.body.length} замеров. Восстановить её? Текущие данные тоже сохранятся копией.`, 'Восстановить');
    if (!ok) return;
    await snapshot('prerestore'); m.meta.deviceId = S.meta.deviceId; setState(m); save(); LG.checkAch(true); render(); toast('Данные восстановлены из резервной копии', 'ok');
  }).catch(() => { /* IndexedDB unavailable */ });

  // Telegram Mini App: sign in automatically with validated initData (only if the sync server is reachable)
  if (TG.active && !auth.get()) {
    apiAvailable().then(async ok => {
      if (!ok) return;
      try { await telegramSignIn(); updateShell(); if (!S.ui.syncAsked && S.profile.onboarded) { S.ui.syncAsked = 1; save(); askEnableSync(); } }
      catch (e) { console.warn('Telegram sign-in failed', e); }
    });
  }
})();
