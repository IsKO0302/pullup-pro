import { openModal } from '../components/modal';
import { toast } from '../components/toast';
import { ACT } from '../core/events';
import { ico } from '../core/icons';
import { S, save } from '../core/state';

/* ================= PWA: install prompt, iOS guide, service worker updates (ЧАСТЬ 12) =================
 * The service worker caches only the static app shell. User data lives in localStorage/IndexedDB and is
 * never touched by the worker or by updates. */
let deferred: any = null, waitingReg: ServiceWorkerRegistration | null = null;
const listeners: Array<() => void> = [];
const changed = () => listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } });
export const onPwaChange = (f: () => void) => listeners.push(f);
export const isStandalone = (): boolean => !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (navigator as any).standalone === true;
export const isIOS = (): boolean => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const inTelegramWebView = (): boolean => document.body.classList.contains('in-tg');
export type InstallState = 'installed' | 'prompt' | 'ios' | 'manual';
export function installState(): InstallState {
  if (isStandalone()) return 'installed';
  if (deferred) return 'prompt';
  if (isIOS()) return 'ios';
  return 'manual';
}
window.addEventListener('beforeinstallprompt', (e: any) => { e.preventDefault(); deferred = e; changed(); });
window.addEventListener('appinstalled', () => { deferred = null; S.ui.installDismissed = 1; save(); toast('PULLUP PRO установлен на устройство', 'ok'); changed(); });

/** dashboard banner: shown only when installation is actually possible and not dismissed */
export function installBanner(): string {
  const st = installState();
  if (inTelegramWebView() || st === 'installed' || st === 'manual' || S.ui.installDismissed) return '';
  return `<div class="install-banner" role="region" aria-label="Установка приложения"><span class="li-ico acc">${ico('install')}</span>
    <div class="grow"><b>Установите PULLUP PRO</b><div class="small muted">Иконка на экране, полноэкранный режим и работа без интернета.</div></div>
    <button class="btn btn-acc btn-sm" data-act="pwaInstall">${ico('install')}INSTALL PULLUP PRO</button>
    <button class="btn btn-ghost btn-icon btn-sm" data-act="pwaDismiss" aria-label="Скрыть">${ico('x')}</button></div>`;
}
ACT.pwaDismiss = el => { S.ui.installDismissed = 1; save(); const b = el.closest('.install-banner'); if (b) b.remove(); };
ACT.pwaInstall = async () => {
  if (deferred) {
    const d = deferred; deferred = null;
    try { d.prompt(); const r = await d.userChoice; if (r && r.outcome === 'accepted') toast('Устанавливаем PULLUP PRO…', 'ok'); } catch (e) { console.error(e); }
    changed(); return;
  }
  if (isStandalone()) return toast('PULLUP PRO уже установлен', 'ok');
  if (isIOS()) return iosGuide();
  openModal({
    title: 'Установка PULLUP PRO',
    body: `<ol class="ol"><li>Откройте меню браузера (⋮ или ≡).</li><li>Выберите «Установить приложение» или «Добавить на главный экран».</li><li>Подтвердите установку.</li></ol>
      <p class="small muted">Если пункта нет, браузер не поддерживает установку или приложение открыто не по HTTPS. Подходят Chrome, Edge, Samsung Internet, Яндекс Браузер; на iPhone — Safari.</p>`
  });
};
export function iosGuide() {
  openModal({
    title: 'Установка на iPhone и iPad',
    body: `<ol class="ol"><li>Откройте PULLUP PRO в <b>Safari</b> (в других браузерах на iOS установка может быть недоступна).</li>
      <li>Нажмите кнопку <b>«Поделиться»</b> ${ico('share')} внизу или вверху экрана.</li>
      <li>Прокрутите список и выберите <b>«На экран „Домой“»</b>.</li><li>Нажмите <b>«Добавить»</b>.</li></ol>
      <div class="note n-warn small mt">${ico('info')}<div>На iOS установленное приложение хранит данные отдельно от Safari. Чтобы перенести тренировки, сделайте экспорт в настройках и импорт в установленном приложении — или включите синхронизацию.</div></div>`
  });
}

/* ---------- service worker & updates ---------- */
export const updateReady = () => !!waitingReg;
function announceUpdate(reg: ServiceWorkerRegistration) {
  waitingReg = reg; changed();
  const root = document.getElementById('toasts'); if (!root || document.getElementById('upd-bar')) return;
  const el = document.createElement('div'); el.id = 'upd-bar'; el.className = 'toast t-info in upd-bar';
  el.innerHTML = `${ico('refresh')}<span>Доступна новая версия PULLUP PRO. Данные сохранятся.</span><button class="btn btn-sm btn-acc" data-act="pwaUpdate">Обновить</button>`;
  root.appendChild(el);
}
ACT.pwaUpdate = () => {
  const w = waitingReg && waitingReg.waiting; if (!w) return location.reload();
  w.postMessage({ type: 'SKIP_WAITING' });
  setTimeout(() => location.reload(), 4000);   // fallback if the browser does not report controllerchange
};
export function registerSW() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD || location.protocol === 'file:') return;
  // reload only when an updated worker takes over an already controlled page; the very first install
  // (clients.claim() of the first worker) only takes control of the open page and needs no reload
  let reloading = false, hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; }
    if (reloading) return; reloading = true; location.reload();
  });
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then(reg => {
    if (reg.waiting && navigator.serviceWorker.controller) announceUpdate(reg);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing; if (!nw) return;
      nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) announceUpdate(reg); });
    });
    const check = () => reg.update().catch(() => { /* offline */ });
    setInterval(check, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  }).catch(e => console.warn('SW registration failed', e));
}
export function checkForUpdate(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return Promise.resolve(false);
  return navigator.serviceWorker.getRegistration().then(reg => reg ? reg.update().then(() => !!reg.waiting || !!reg.installing) : false).catch(() => false);
}
