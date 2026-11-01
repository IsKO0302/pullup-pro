/* Test double of https://telegram.org/js/telegram-web-app.js (served by Playwright instead of the real SDK).
 * Like the real SDK it reads the launch parameters from the URL hash (tgWebAppData, tgWebAppPlatform,
 * tgWebAppVersion) and keeps them in sessionStorage. Every call is recorded in window.__tg so tests can
 * check what the app asked Telegram to do; __tgBack()/__tgMain()/__tgEmit() simulate user actions. */
(function () {
  var hp = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  var saved = null; try { saved = JSON.parse(sessionStorage.getItem('__telegram__initParams') || 'null'); } catch (e) { saved = null; }
  var P = hp.get('tgWebAppData') ? { tgWebAppData: hp.get('tgWebAppData'), tgWebAppPlatform: hp.get('tgWebAppPlatform') || 'unknown', tgWebAppVersion: hp.get('tgWebAppVersion') || '6.0' } : (saved || {});
  try { sessionStorage.setItem('__telegram__initParams', JSON.stringify(P)); } catch (e) { /* ignore */ }
  var initData = P.tgWebAppData || '', unsafe = {};
  new URLSearchParams(initData).forEach(function (v, k) { if (k === 'user' || k === 'receiver' || k === 'chat') { try { unsafe[k] = JSON.parse(v); } catch (e) { unsafe[k] = v; } } else unsafe[k] = k === 'auth_date' ? Number(v) : v; });
  var log = { calls: [], back: false, main: { visible: false, text: '' }, closingConfirmation: false, haptic: [] };
  var cb = { back: [], main: [], ev: {} };
  var rec = function (n) { return function () { log.calls.push(n); }; };
  var cmp = function (a, b) { a = String(a).split('.'); b = String(b).split('.'); for (var i = 0; i < Math.max(a.length, b.length); i++) { var x = +(a[i] || 0), y = +(b[i] || 0); if (x !== y) return x > y ? 1 : -1; } return 0; };
  var W = {
    initData: initData, initDataUnsafe: unsafe, platform: P.tgWebAppPlatform || 'unknown', version: P.tgWebAppVersion || '6.0',
    colorScheme: 'dark', themeParams: {}, isExpanded: false, isFullscreen: false, viewportHeight: innerHeight, viewportStableHeight: innerHeight,
    safeAreaInset: { top: 24, bottom: 16, left: 0, right: 0 }, contentSafeAreaInset: { top: 46, bottom: 0, left: 0, right: 0 },
    isVersionAtLeast: function (v) { return cmp(W.version, v) >= 0; },
    ready: rec('ready'), expand: function () { W.isExpanded = true; log.calls.push('expand'); }, close: rec('close'),
    disableVerticalSwipes: rec('disableVerticalSwipes'), enableVerticalSwipes: rec('enableVerticalSwipes'),
    enableClosingConfirmation: function () { log.closingConfirmation = true; }, disableClosingConfirmation: function () { log.closingConfirmation = false; },
    requestFullscreen: function () { W.isFullscreen = true; log.calls.push('requestFullscreen'); }, exitFullscreen: function () { W.isFullscreen = false; log.calls.push('exitFullscreen'); },
    openTelegramLink: function (u) { log.calls.push('openTelegramLink:' + u); }, openLink: function (u) { log.calls.push('openLink:' + u); },
    onEvent: function (e, f) { (cb.ev[e] = cb.ev[e] || []).push(f); }, offEvent: function (e, f) { cb.ev[e] = (cb.ev[e] || []).filter(function (x) { return x !== f; }); },
    BackButton: {
      get isVisible() { return log.back; },
      show: function () { log.back = true; return W.BackButton; }, hide: function () { log.back = false; return W.BackButton; },
      onClick: function (f) { cb.back.push(f); return W.BackButton; }, offClick: function (f) { cb.back = cb.back.filter(function (x) { return x !== f; }); return W.BackButton; }
    },
    MainButton: {
      get isVisible() { return log.main.visible; }, get text() { return log.main.text; }, isActive: true,
      setText: function (t) { log.main.text = String(t); return W.MainButton; }, setParams: function (p) { if (p && p.text) log.main.text = p.text; if (p && 'is_visible' in p) log.main.visible = !!p.is_visible; return W.MainButton; },
      show: function () { log.main.visible = true; return W.MainButton; }, hide: function () { log.main.visible = false; return W.MainButton; },
      enable: function () { return W.MainButton; }, disable: function () { return W.MainButton; },
      onClick: function (f) { cb.main.push(f); return W.MainButton; }, offClick: function (f) { cb.main = cb.main.filter(function (x) { return x !== f; }); return W.MainButton; }
    },
    HapticFeedback: {
      impactOccurred: function (s) { log.haptic.push('impact:' + s); }, notificationOccurred: function (s) { log.haptic.push('notification:' + s); }, selectionChanged: function () { log.haptic.push('selection'); }
    }
  };
  window.__tg = log;
  window.__tgBack = function () { cb.back.forEach(function (f) { f(); }); };
  window.__tgMain = function () { cb.main.forEach(function (f) { f(); }); };
  window.__tgEmit = function (e, patch) { if (patch) Object.assign(W, patch); (cb.ev[e] || []).forEach(function (f) { f(); }); };
  window.Telegram = { WebApp: W };
})();
