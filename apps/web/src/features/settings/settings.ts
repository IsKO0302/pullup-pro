import { confirmBox, openModal } from '../../components/modal';
import { toast } from '../../components/toast';
import { stepper } from '../../components/ui';
import { pageHead, segBtns, setSeg } from '../../components/view';
import { AUD, buzz } from '../../core/audio';
import { $, download, numVal } from '../../core/dom';
import { ACT } from '../../core/events';
import { chooseLang } from '../../core/i18n';
import { ico } from '../../core/icons';
import { LANGS, LANG_NAME, getLang, numLocale, type Lang } from '@pullup/shared/i18n/locale';
import { ROUTES, go, render, rerender } from '../../core/router';
import { S, STORAGE_OK, defaultState, runStore, save, setState, storageSize } from '../../core/state';
import { applyTheme } from '../../core/theme';
import { BL_TPL, blItem } from '../builder/builder';
import { showOnboarding } from '../onboarding/onboarding';
import { avatar, displayName, updateShell } from '../../layouts/shell';
import { deleteCloudAccount, linkPoll, linkStart, serverConfig, setPhotoConsent, signOut, telegramSignIn } from '../../services/account';
import { ApiError, api, apiAvailable, auth } from '../../services/api';
import { idb, persistStorage, storageEstimate } from '../../services/idb';
import { LG } from '../../services/logic';
import { checkForUpdate, installState, iosGuide, isSingleFile } from '../../services/pwa';
import { SNAP_NAME, dropSnapshot, getSnapshot, listSnapshots, snapshot, type SnapKind } from '../../services/snapshots';
import { SYNC, onSync, setCloud, syncErrorToast, syncNow, syncPhotos } from '../../services/sync';
import { TG, tgOpenLink } from '../../services/telegram';
import { exOf } from '@pullup/shared/catalog/exercises';
import { PROGM, PROGRAMS, SAFETY_RULES } from '@pullup/shared/catalog/programs';
import { SOURCES } from '@pullup/shared/catalog/sources';
import { WD, addDays, dayKey, daysBetween, startOfWeek, todayKey, wdIdx } from '@pullup/shared/dates';
import { LEVEL_NAME, buildWorkout, userLevel } from '@pullup/shared/engine';
import { STATE_VERSION, migrateState, unwrapBackup } from '@pullup/shared/migrate';
import { checkBackup } from '@pullup/shared/schema';
import { APP_VERSION, W, clamp, esc, fmtNum, pl, round1, uid } from '@pullup/shared/util';
import type { AppState, Reminder } from '@pullup/shared/types';
import { strToU8, zipSync } from 'fflate';

/* ================= Settings 2.0: training, design, sync & account, reminders, install, data ================= */
const REM_KIND: [Reminder['kind'], string][] = [['workout', 'Тренировка'], ['weight', 'Взвешивание'], ['water', 'Вода'], ['mobility', 'Мобилити']];
const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } };
const fmtTime = (ms: number) => ms ? new Date(ms).toLocaleString(numLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const sw = (o: string, f: string, t: string, sub = '', on = false, dis = false) => `<label class="switch"><input type="checkbox" data-chg="setSw" data-o="${o}" data-f="${f}" ${on ? 'checked' : ''} ${dis ? 'disabled' : ''}><i></i><span><b class="small">${t}</b>${sub ? `<span class="tiny muted" style="display:block">${sub}</span>` : ''}</span></label>`;
export const isDemo = (): boolean => !!(S.meta && (S.meta as any).demo);

ROUTES.settings = {
  title: 'Настройки',
  render() {
    const p = S.profile, st = S.settings, vibOk = 'vibrate' in navigator, wlOk = 'wakeLock' in navigator, acc = p.accent || 'orange';
    return pageHead('Настройки', 'Тренировка, оформление, синхронизация, напоминания и данные. Без входа всё работает локально на этом устройстве.', '', 'SETTINGS') + `
    ${isDemo() ? `<div class="note n-warn note-act mb">${ico('sparkle')}<div class="grow"><b>Сейчас загружены ДЕМО-данные.</b> Это пример, а не ваши тренировки; синхронизация на паузе.</div><button class="btn btn-sm" data-act="demoExit">${ico('refresh')}Вернуть мои данные</button></div>` : ''}
    <div class="grid g2">
      <div class="card stack l"><div class="card-head" style="margin:0"><h3>${ico('user')}Профиль</h3><a class="hint link-btn" href="#/profile">Открыть</a></div>
        <a class="row side-prof" href="#/profile" style="gap:12px">${avatar('lg')}<div class="grow" style="min-width:0"><b class="ell">${esc(displayName())}</b><div class="small muted">${LEVEL_NAME[userLevel(S as any)]} · ${fmtNum(+p.bodyweight || 0)} кг · ${p.weeklyTarget || 3} трен./нед.</div></div>${ico('right', 'muted')}</a>
        <div class="row wrap"><button class="btn btn-sm" data-act="profEdit">${ico('edit')}Изменить профиль</button><button class="btn btn-sm btn-ghost" data-act="reOnboard">${ico('refresh')}Персонализация заново</button></div>
      </div>
      <div class="card stack l"><div class="card-head" style="margin:0"><h3>${ico('sparkle')}Оформление</h3></div>
        <div class="field"><span>Language / Язык / Dil</span>${segBtns('setLang', LANGS.map(l => [l, LANG_NAME[l]] as [string, string]), getLang(), 'style="flex-wrap:wrap"')}</div>
        <div class="field"><span>Тема</span>${segBtns('setTheme', [['dark', `${ico('moon')}Тёмная`], ['light', `${ico('sun')}Светлая`], ['system', `${ico('desktop')}Системная`]], st.theme || 'dark', 'style="flex-wrap:wrap"')}</div>
        <div class="field"><span>Акцентный цвет</span>${segBtns('setAcc', [['orange', '<i class="sw" style="background:#ff6a1a"></i>Orange Fire'], ['red', '<i class="sw" style="background:#ff3030"></i>Red Power'], ['custom', `<i class="sw" style="background:${esc(st.customAccent || '#2f8cff')}"></i>Свой`]], acc, 'style="flex-wrap:wrap"')}</div>
        ${acc === 'custom' ? `<label class="field"><span>Свой цвет</span><span class="row"><input type="color" class="color-inp" value="${esc(st.customAccent || '#2f8cff')}" data-inp="setAccColor" aria-label="Свой акцентный цвет"><span class="tiny muted">Цвет кнопок, графиков и прогресса</span></span></label>` : ''}
        <div class="acc-prev" aria-hidden="true"><div class="ap-bar"><i></i></div><div class="tiny muted">Так выглядят прогресс, кнопки и графики. Применяется сразу.</div></div>
      </div>
      <div class="card stack l"><div class="card-head" style="margin:0"><h3>${ico('timer')}Тренировка</h3></div>
        <div class="field"><span>Отдых по умолчанию (своя и свободная тренировка)</span>${segBtns('setRest', [[60, '60 с'], [90, '90 с'], [120, '2 мин'], [180, '3 мин']], p.restDefault)}</div>
        ${sw('profile', 'autoRest', 'Автозапуск отдыха', 'Таймер отдыха стартует сразу после подхода', p.autoRest)}
        <div class="row between wrap">${sw('profile', 'sound', 'Звуковые сигналы', 'Обратный отсчёт 3-2-1 и старт подхода', p.sound)}<button class="btn btn-sm" data-act="testSound">${ico('volume')}Проверить</button></div>
        <div class="row between wrap">${sw('profile', 'vibrate', 'Вибрация', vibOk || TG.active ? 'В конце отдыха и при рекордах' : 'Не поддерживается этим устройством или браузером', p.vibrate, !vibOk && !TG.active)}${vibOk || TG.active ? `<button class="btn btn-sm" data-act="testVib">${ico('vib')}Проверить</button>` : ''}</div>
        ${sw('settings', 'wakeLock', 'Экран не гаснет во время тренировки', wlOk ? 'Screen Wake Lock, только пока открыта тренировка' : 'Браузер не поддерживает Wake Lock — экран может гаснуть', st.wakeLock, !wlOk)}
        ${sw('settings', 'fullscreen', 'Тренировка на весь экран', 'Можно переключить кнопкой или клавишей F во время тренировки', st.fullscreen)}
      </div>
      <div class="card stack l"><div class="card-head" style="margin:0"><h3>${ico('target')}Подтягивания (программы 1.0)</h3></div>
        <div class="field"><span>Подтягиваний в день</span>${stepper('set-goal', p.goalDaily, 0, 500, 5, 'data-chg="setP" data-f="goalDaily"')}<span class="tiny muted">0 — без дневной цели. Не учитывается в дни восстановления.</span></div>
        <label class="field"><span>Программа подтягиваний</span><select class="inp" data-chg="setP" data-f="program">${PROGRAMS.map(P => `<option value="${P.id}" ${P.id === p.program ? 'selected' : ''}>${esc(P.name)} — ${esc(P.range || '')}</option>`).join('')}</select></label>
        <div class="tiny muted">Основной план 2.0 (всё тело, сплиты) настраивается в разделе <a class="link-btn" href="#/plan">Мой план</a>.</div>
      </div>
      <div class="card stack l span2" id="sync-card"><div class="card-head" style="margin:0"><h3>${ico('cloud')}Синхронизация и аккаунт</h3><span class="hint" id="sync-st"></span></div>
        <div id="sync-box"><div class="small muted">Проверяем сервер синхронизации…</div></div></div>
      <div class="card stack l span2"><div class="card-head" style="margin:0"><h3>${ico('telegram')}Напоминания в Telegram</h3>${sw('bot', 'reminders', 'Включены', '', !!(st.bot && st.bot.reminders))}</div>
        ${remindersView()}</div>
      <div class="card stack l"><div class="card-head" style="margin:0"><h3>${ico('install')}Приложение</h3><button class="btn btn-sm btn-ghost" data-act="pwaCheck">${ico('refresh')}Обновления</button></div>${installView()}</div>
      <div class="card stack l"><div class="card-head" style="margin:0"><h3>${ico('layers')}Хранилище</h3><button class="btn btn-sm btn-ghost" data-act="persistReq">${ico('lock')}Защитить данные</button></div>
        <div id="store-box" class="small muted">Считаем…</div>
        ${STORAGE_OK ? '' : `<div class="note n-bad">${ico('warn')}<div>Хранилище браузера недоступно (например, приватный режим). Данные не сохранятся после закрытия — сделайте экспорт.</div></div>`}</div>
      <div class="card stack l span2"><div class="card-head" style="margin:0"><h3>${ico('file')}Данные</h3><span class="hint">${pl(S.sessions.length, W.work)} · ${pl(S.tests.length, W.test)} · замеров: ${S.body.length}</span></div>
        <div class="grid g4">
          <div class="card flat stack s"><b>Резервная копия</b><span class="small muted">Все данные в JSON (без фото)</span><button class="btn btn-sm mt-s" data-act="expJson">${ico('download')}Экспорт JSON</button></div>
          <div class="card flat stack s"><b>Полный архив</b><span class="small muted">JSON + фото прогресса в ZIP</span><button class="btn btn-sm mt-s" data-act="expZip">${ico('download')}Экспорт ZIP</button></div>
          <div class="card flat stack s"><b>Восстановить</b><span class="small muted">JSON из PULLUP PRO 1.0 или 2.0</span><label class="btn btn-sm mt-s">${ico('upload')}Импорт<input type="file" accept="application/json,.json" data-chg="impJson" class="sr"></label></div>
          <div class="card flat stack s"><b>Демо-данные</b><span class="small muted">Помеченный пример за 10 недель</span>${isDemo() ? `<button class="btn btn-sm mt-s" data-act="demoExit">${ico('refresh')}Убрать демо</button>` : `<button class="btn btn-sm mt-s" data-act="demoData">${ico('sparkle')}Загрузить</button>`}</div>
        </div>
        <div id="snap-box"></div>
        <div class="row wrap between"><span class="tiny muted">Перед импортом, демо и сбросом приложение сохраняет копию текущих данных — её можно вернуть.</span><button class="btn btn-sm btn-danger" data-act="resetAll">${ico('trash')}Сбросить данные</button></div>
      </div>
      <div class="card span2"><div class="card-head"><h3>${ico('shield')}Безопасность и источники</h3><button class="btn btn-sm btn-ghost" data-act="showSources">${ico('book')}Источники методик</button></div>
        <div class="grid g2"><ol class="ol small">${SAFETY_RULES.map(x => `<li>${x}</li>`).join('')}</ol>
          <div class="stack"><div class="note n-warn">${ico('info')}<div class="small">PULLUP PRO — тренировочный дневник и набор методик, а не медицинская рекомендация и не замена тренера или врача. Рекомендации строятся по прозрачным правилам, это не искусственный интеллект. Сроки результата индивидуальны — приложение их не обещает.</div></div>
          <div class="small muted">PULLUP PRO ${APP_VERSION} · формат данных v${STATE_VERSION} · работает офлайн · без платных API</div></div></div>
      </div>
    </div>`;
  },
  mount(view) { fillStorage(view); fillSnapshots(view); fillSync(view); }
};

/* ---------- simple preferences ---------- */
ACT.setP = el => {
  const f = el.dataset.f; let v = el.value;
  if (f === 'goalDaily') v = clamp(Math.round(numVal(el)), 0, 500);
  if (f === 'program' && !PROGM[v]) return;
  S.profile[f] = v; save(); toast('Сохранено', 'ok', 1200); updateShell();
};
ACT.setSw = el => {
  const o = el.dataset.o === 'settings' ? S.settings : el.dataset.o === 'bot' ? (S.settings.bot = S.settings.bot || { reminders: false }) : S.profile;
  o[el.dataset.f] = el.checked;
  if (el.dataset.o === 'bot') S.profile.timezone = tz();
  save(); toast(el.checked ? 'Включено' : 'Выключено', 'ok', 1200);
  if (el.dataset.o === 'bot') rerender();
};
ACT.setRest = el => { S.profile.restDefault = +el.dataset.v; setSeg(el); save(); toast('Сохранено', 'ok', 1200); };
ACT.setTheme = el => { S.settings.theme = el.dataset.v; save(); applyTheme(); rerender(); };
ACT.setLang = el => chooseLang(el.dataset.v as Lang);
ACT.setAcc = el => { S.profile.accent = el.dataset.v; if (el.dataset.v === 'custom' && !S.settings.customAccent) S.settings.customAccent = '#2f8cff'; save(); applyTheme(); rerender(); };
let accT: any = 0;
ACT.setAccColor = el => { if (!/^#[0-9a-f]{6}$/i.test(el.value)) return; S.settings.customAccent = el.value; applyTheme(); clearTimeout(accT); accT = setTimeout(() => save(), 400); };
ACT.testSound = () => { if (!S.profile.sound) return toast('Звук выключен в настройках', 'err'); AUD.tick(); setTimeout(() => AUD.tick(), 450); setTimeout(() => AUD.go(), 900); };
ACT.testVib = () => { if (!S.profile.vibrate) return toast('Вибрация выключена в настройках', 'err'); buzz([120, 80, 120]); toast('Если устройство поддерживает вибрацию, вы её почувствовали', 'info'); };
ACT.pwaCheck = async () => { const r = await checkForUpdate(); toast(r ? 'Найдено обновление — нажмите «Обновить» в уведомлении' : 'Установлена последняя версия', r ? 'ok' : 'info'); };
ACT.persistReq = async () => { const ok = await persistStorage(); toast(ok ? 'Браузер не будет удалять данные автоматически' : 'Браузер не подтвердил защиту хранилища — регулярно делайте экспорт', ok ? 'ok' : 'info', 4500); rerender(); };
ACT.showSources = () => openModal({
  title: 'Источники методик', cls: 'wide',
  body: `<p class="small tx2">Дозировки, прогрессия, техника и советы по питанию основаны на этих публикациях. Полный список с пояснениями — в docs/TRAINING_CONTENT_SOURCES.md.</p>
    <ol class="ol small src-list">${SOURCES.map(s => `<li><b>${esc(s.topic)}</b><div class="tiny muted">${esc(s.cite)}</div></li>`).join('')}</ol>`
});

/* ---------- install ---------- */
function installView() {
  const s = installState();
  if (s === 'installed') return `<div class="note n-ok">${ico('check')}<div class="small">PULLUP PRO установлено как приложение и работает офлайн.</div></div>`;
  if (TG.active) return `<div class="small tx2">Вы в Telegram Mini App. Чтобы установить PULLUP PRO на главный экран, откройте приложение в браузере.</div>`;
  if (isSingleFile()) return `<div class="small tx2">Открыта версия в одном файле: она работает без интернета прямо с диска. Установка на главный экран доступна, когда приложение открыто по адресу https://… (сайт или сервер PULLUP PRO).</div>`;
  return `<div class="small tx2">Установите PULLUP PRO на главный экран: отдельное окно, быстрый запуск и работа без интернета.</div>
    ${s === 'prompt' ? `<button class="btn btn-acc" data-act="pwaInstall">${ico('install')}INSTALL PULLUP PRO</button>` : s === 'ios' ? `<button class="btn btn-acc" data-act="iosGuide">${ico('install')}Как установить на iPhone</button>` :
      `<div class="tiny muted">Chrome / Edge: значок установки в адресной строке или меню → «Установить приложение». Android: меню браузера → «Добавить на главный экран».</div>`}`;
}
ACT.iosGuide = () => iosGuide();

/* ---------- storage & snapshots ---------- */
async function fillStorage(view) {
  const el = $('#store-box', view); if (!el) return;
  const est = await storageEstimate(); let persisted = false;
  try { persisted = !!(navigator.storage && navigator.storage.persisted && await navigator.storage.persisted()); } catch (e) { /* ignore */ }
  const mb = (b: number) => fmtNum(round1(b / 1048576)) + ' МБ';
  el.innerHTML = `<div class="stack s"><div class="row between"><span>Данные приложения</span><b>${fmtNum(round1(storageSize() / 1024))} КБ</b></div>
    <div class="row between"><span>Фото прогресса</span><b>${S.photos.length}</b></div>
    ${est ? `<div class="row between"><span>Занято всего (с фото и кэшем)</span><b>${mb(est.usage)}${est.quota ? ` из ${mb(est.quota)}` : ''}</b></div>` : ''}
    <div class="row between"><span>Защита от автоочистки</span><b class="${persisted ? 'ok' : 'muted'}">${persisted ? 'включена' : 'нет'}</b></div></div>`;
}
async function fillSnapshots(view) {
  const el = $('#snap-box', view); if (!el) return;
  const xs = await listSnapshots(); if (!xs.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="sec-t">Сохранённые копии</div><div class="stack s">${xs.map(s => `<div class="snap-row"><span class="li-ico">${ico('refresh')}</span><div class="grow" style="min-width:0"><b class="small">${SNAP_NAME[s.kind]}</b><div class="tiny muted">${fmtTime(s.at)} · ${pl(s.sessions, W.work)}</div></div>
    <button class="btn btn-sm" data-act="snapRestore" data-k="${s.kind}">Вернуть</button><button class="btn btn-sm btn-ghost btn-icon" data-act="snapDrop" data-k="${s.kind}" aria-label="Удалить копию">${ico('trash')}</button></div>`).join('')}</div>`;
}
/** replaces the state (keeps device-local settings: deviceId and cloud sync switch) */
function replaceState(next: AppState) {
  next.meta.deviceId = S.meta.deviceId; next.settings.cloud = { ...S.settings.cloud };
  setState(next); save(); runStore.clear(); applyTheme(); LG.checkAch(true); updateShell();
}
ACT.snapRestore = async el => {
  const k = el.dataset.k as SnapKind, s = await getSnapshot(k); if (!s) return toast('Копия не найдена', 'err');
  if (!(await confirmBox('Вернуть сохранённую копию?', `${SNAP_NAME[k]} (${fmtTime(s.at)}). Текущие данные тоже сохранятся копией — шаг можно отменить.`, 'Вернуть'))) return;
  try {
    const r = migrateState(JSON.parse(s.data)); await snapshot('prerestore');
    replaceState(r.state); if (k !== 'prerestore') await dropSnapshot(k);
    toast('Данные восстановлены', 'ok'); render();
  } catch (e) { toast('Копия повреждена и не может быть восстановлена', 'err'); }
};
ACT.snapDrop = async el => {
  if (!(await confirmBox('Удалить копию?', 'Сохранённая копия будет удалена. Текущие данные не изменятся.', 'Удалить', true))) return;
  await dropSnapshot(el.dataset.k); rerender();
};

/* ---------- export / import ---------- */
const backupJson = () => JSON.stringify({ app: 'pullup-pro', version: APP_VERSION, schema: STATE_VERSION, exported: new Date().toISOString(), data: S }, null, 1);
ACT.expJson = () => { download(`pullup-pro-backup-${todayKey()}.json`, backupJson()); toast('Резервная копия скачана', 'ok'); };
ACT.expZip = async () => {
  const files: Record<string, Uint8Array> = { 'pullup-pro-backup.json': strToU8(backupJson()) };
  let n = 0;
  for (const p of S.photos) { try { const r: any = await idb.get('photos', p.id); if (r && r.blob) { files[`photos/${p.date}_${p.pose}_${p.id}.jpg`] = new Uint8Array(await r.blob.arrayBuffer()); n++; } } catch (e) { /* skip unreadable */ } }
  files['README.txt'] = strToU8(`PULLUP PRO ${APP_VERSION} — полный архив от ${new Date().toLocaleString('ru-RU')}\n\npullup-pro-backup.json — все данные (импорт: Настройки → Данные → Импорт).\nphotos/ — фото прогресса (${n}), имя файла: дата_ракурс_id.jpg.\n`);
  const zip = zipSync(files, { level: 0 });
  download(`pullup-pro-archive-${todayKey()}.zip`, new Blob([zip as any], { type: 'application/zip' }) as any, 'application/zip');
  toast(`Архив скачан: данные + ${pl(n, ['фото', 'фото', 'фото'])}`, 'ok');
};
ACT.impJson = el => {
  const f = el.files && el.files[0]; if (!f) return;
  const r: any = new FileReader();
  r.onload = async () => {
    el.value = '';
    let raw: any;
    try { raw = unwrapBackup(JSON.parse(r.result)); } catch (e) { return toast('Файл не читается как JSON', 'err', 4500); }
    const chk = checkBackup(raw); if (!chk.ok) return toast(chk.error || 'Это не резервная копия PULLUP PRO', 'err', 4500);
    const ver = typeof raw.v === 'number' ? raw.v : 1;
    const ok = await confirmBox('Импортировать данные?', `Файл PULLUP PRO ${ver >= 2 ? '2.0' : '1.0'}: ${pl(chk.sessions, W.work)}${chk.invalidSessions ? ` (с ошибками формата: ${chk.invalidSessions} — будут сохранены и исправлены, где возможно)` : ''}, ${pl((raw.tests || []).length, W.test)}, замеров: ${(raw.body || []).length}.<br><br>Текущие данные будут заменены. Перед заменой сохранится копия — её можно вернуть в «Данные».${S.settings.cloud.enabled ? ' Включена синхронизация: изменения попадут в облако.' : ''}`, 'Импортировать', true);
    if (!ok) return;
    const saved = await snapshot('preimport');
    if (!saved && !(await confirmBox('Не удалось сохранить копию', 'Хранилище браузера не позволило сохранить копию текущих данных. Сделайте экспорт вручную или продолжите без копии.', 'Продолжить', true))) return;
    const m = migrateState(raw); replaceState(m.state);
    toast(m.migrated ? 'Данные 1.0 импортированы и перенесены в формат 2.0' : 'Данные импортированы', 'ok', 4000); render();
  };
  r.onerror = () => toast('Ошибка чтения файла', 'err');
  r.readAsText(f);
};
ACT.resetAll = async () => {
  if (!(await confirmBox('Сбросить все данные?', 'Будут удалены тренировки, тесты, планы, замеры, питание и настройки на этом устройстве. Копия сохранится в «Данные» — её можно вернуть. Данные PULLUP PRO 1.0 в браузере не затрагиваются.', 'Сбросить', true))) return;
  await snapshot('prereset');
  const fresh = defaultState(); replaceState(fresh); toast('Данные сброшены. Копия сохранена.', 'ok'); go('#/home'); setTimeout(() => showOnboarding(false), 300);
};
ACT.demoData = async () => {
  if (!(await confirmBox('Загрузить демо-данные?', 'Демо — помеченный пример тренировок за 10 недель, чтобы посмотреть графики и отчёты. Ваши данные сохранятся копией и вернутся кнопкой «Вернуть мои данные». Синхронизация на время демо приостанавливается.', 'Загрузить'))) return;
  if (!(await snapshot('predemo'))) return toast('Не удалось сохранить копию ваших данных — демо не загружено', 'err', 4500);
  loadDemo(); toast('Загружены ДЕМО-данные', 'ok', 3500); go('#/home');
};
ACT.demoExit = async () => {
  const s = await getSnapshot('predemo');
  if (s) { try { replaceState(migrateState(JSON.parse(s.data)).state); await dropSnapshot('predemo'); toast('Демо удалено, ваши данные возвращены', 'ok'); render(); return; } catch (e) { /* fall through */ } }
  if (!(await confirmBox('Копия не найдена', 'Копия данных до демо не найдена. Очистить демо и начать с пустого журнала? Профиль сохранится.', 'Очистить', true))) return;
  const fresh = defaultState(); fresh.profile = { ...S.profile }; replaceState(fresh); toast('Демо-данные удалены', 'ok'); render();
};
/* ---------- demo data: ~10 weeks, clearly labelled (S.meta.demo) and never synced ---------- */
export function loadDemo() {
  let seed = 20240917; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const keep = S.profile, st: any = defaultState();
  st.profile = { ...keep, name: keep.name || 'ISA', bodyweight: 78, program: 'intermediate', maxPullups: 0, goalDaily: 30, weeklyTarget: 3, onboarded: true, disclaimerAccepted: true, goals: ['strength', 'muscle', 'muscleup'], equipment: ['bar', 'dipbars', 'bands'], format: 'mixed', experience: 'lt1' };
  delete st.profile.split; delete st.profile.level;
  st.settings = { ...S.settings, cloud: { ...S.settings.cloud } }; st.meta.deviceId = S.meta.deviceId; st.meta.demo = true;
  const P = PROGM.intermediate, t = todayKey(), start = addDays(startOfWeek(new Date()), -10 * 7);
  const maxAt = (w: number) => Math.round(5 + w * .62);
  const mkSets = (it, max, w, fatigue) => {
    const e = exOf(it.ex);
    if (Array.isArray(it.reps)) return it.reps.map(r => ({ reps: r, weight: 0, done: true }));
    if (e.type === 'time') return Array.from({ length: it.sets || 3 }, () => ({ time: Math.max(5, (it.time || 20) + ri(-3, 6) + w), done: true }));
    const m = /^p(\d+)$/.exec(String(it.reps || '')), base = m ? Math.max(1, Math.round(max * +m[1] / 100)) : (+it.reps || 6) + (w > 7 ? 1 : 0);
    return Array.from({ length: it.sets || 3 }, (_, i) => ({ reps: Math.max(1, base - (i >= (it.sets || 3) - 1 && fatigue ? 1 : 0)), weight: it.w || 0, done: true }));
  };
  let idx = 0, eidx = 0;
  for (let w = 0; w <= 10; w++) {
    const days = rnd() < .2 ? [0, 3] : [0, 2, 4];
    for (const dd of days) {
      const d = addDays(start, w * 7 + dd + (rnd() < .15 ? 1 : 0)), k = dayKey(d);
      if (daysBetween(k, t) < 2) continue;
      const hour = w === 2 && dd === 0 ? 7 : ri(17, 19), at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, ri(0, 50)).getTime();
      if (w < 6) {
        const wo = P.workouts[idx % 3], pain = w === 4 && dd === 2;
        const items = wo.items.map(it => ({ ex: it.ex, sets: mkSets(it, maxAt(w), w, rnd() < .5) }));
        if (pain) items.forEach((it, i) => { if (i >= 2) it.sets = it.sets.map(s => ({ ...s, done: false })); });
        st.sessions.push({ id: uid() + w + dd, date: k, startedAt: at, title: `${P.name} · ${wo.name}`, source: 'program', ref: { prog: P.id, idx: idx % 3, w: wo.id }, durationSec: ri(36, 52) * 60, items, feel: pain ? 2 : ri(3, 5), pain, light: false,
          notes: pain ? 'Неприятные ощущения в локте — остановился, следующую тренировку сделал легче.' : '', completed: !pain, warmup: rnd() > .1, rpe: pain ? 8 : ri(6, 8) });
        if (pain) st.daily[dayKey(addDays(d, 1))] = { recovery: true, tasks: { r1: true, r2: true } };
        idx++;
      } else {
        const bw = buildWorkout(st, 'fb_abc', eidx); if (!bw) continue;
        const items = bw.items.map(it => ({ ex: it.ex, target: { ex: it.ex, sets: it.sets, reps: it.reps, time: it.time, rest: it.rest }, sets: mkSets({ ...it, reps: typeof it.reps === 'number' ? it.reps + (w >= 9 ? 1 : 0) : it.reps }, maxAt(w), w, rnd() < .4) }));
        st.sessions.push({ id: uid() + 'e' + w + dd, date: k, startedAt: at, title: `${bw.prog.name} · ${bw.w.name}`, source: 'engine', ref: { prog: 'fb_abc', idx: bw.idx, w: bw.w.id }, durationSec: ri(44, 58) * 60, items, feel: ri(3, 5), pain: false, completed: true, warmup: true, rpe: ri(6, 8), rir: 2, tech: 3 });
        if (!st.engine.startedAt) st.engine.startedAt = k;
        eidx++;
      }
    }
    const qd = addDays(start, w * 7 + 5), qk = dayKey(qd);
    if (daysBetween(qk, t) >= 1 && rnd() < .6) st.sessions.push({ id: uid() + 'q' + w, date: qk, startedAt: qd.getTime() + 12 * 3600e3, title: 'Быстрые подтягивания', source: 'quick', ref: null, durationSec: 0, items: [{ ex: 'pullup', sets: Array.from({ length: ri(3, 5) }, () => ({ reps: ri(3, 6), weight: 0, done: true })) }], feel: 0, pain: false, completed: true, warmup: false });
    // body: weekly weight, waist every 2 weeks
    const bd = dayKey(addDays(start, w * 7 + 1)); if (bd < t) st.body.push({ id: uid() + 'b' + w, date: bd, weight: round1(80.6 - w * .22 + (rnd() - .5) * .5), ...(w % 2 === 0 ? { waist: round1(87 - w * .3), chest: round1(101 + w * .15), biceps: round1(34.5 + w * .06) } : {}) });
  }
  [[0, 5, 40, 6], [3, 7, 46, 8], [6, 9, 52, 10], [9, 11, 58, 12]].forEach(([w, pu, hg, dp]) => { const k = dayKey(addDays(start, w * 7 + 6)); if (k < t) st.tests.push({ id: uid() + 't' + w, date: k, pullups: pu, hang: hg, dips: dp, pushups: 20 + w * 2, plank: 50 + w * 6 }); });
  st.profile.maxPullups = 11; st.profile.results = { pushups: 38, plank: 105, squats: 40 };
  st.mu.checks.s1d = true; st.mu.done[1] = dayKey(addDays(start, 9 * 7 + 6));
  st.custom = BL_TPL.slice(0, 2).map(tp => ({ id: uid() + tp.name.length, name: tp.name, items: tp.items.map((x: any) => (blItem as any)(...x)), created: dayKey(addDays(start, 14)) }));
  st.progress.intermediate = { next: idx % 3, adj: { 'A:2': 1, 'B:2': 1, 'C:0': 1 } };
  st.progress.fb_abc = { next: eidx % 3, adj: {} }; st.engine.program = 'fb_abc';
  for (let i = 0; i <= 13; i++) { const d = addDays(new Date(), i), k = dayKey(d); if (![0, 2, 4].includes(wdIdx(d))) continue; (st.plan[k] = st.plan[k] || []).push({ id: uid() + i, kind: 'engine', prog: 'fb_abc', idx: (eidx + (i / 2 | 0)) % 3, title: `FULL BODY · ${['A', 'B', 'C'][(eidx + (i / 2 | 0)) % 3]}` }); }
  st.ui.planCount = Object.values(st.plan).reduce((a: number, x: any) => a + x.length, 0); st.ui.tip = 3;
  setState(st); save(); runStore.clear(); LG.checkAch(true); applyTheme(); updateShell();
}

/* ---------- reminders (sent by the Telegram bot from synced records) ---------- */
function remindersView() {
  const rs = S.reminders || [], a = auth.get(), on = !!(S.settings.bot && S.settings.bot.reminders);
  const warn = !on ? '' : !a ? 'Войдите через Telegram в блоке «Синхронизация и аккаунт» — иначе боту некуда отправлять напоминания.' : !S.settings.cloud.enabled ? 'Включите синхронизацию — бот видит напоминания только через сервер.' : '';
  return `<div class="small tx2">Бот PULLUP PRO присылает напоминания в Telegram в указанное время (часовой пояс: ${esc(S.profile.timezone || tz())}).</div>
    ${warn ? `<div class="note n-warn">${ico('info')}<div class="small">${warn}</div></div>` : ''}
    ${rs.length ? `<div class="stack s">${rs.map(r => `<div class="rem-row ${r.enabled ? '' : 'off'}">
      <select class="inp" data-chg="remSet" data-id="${esc(r.id)}" data-f="kind" aria-label="Тип напоминания">${REM_KIND.map(([k, l]) => `<option value="${k}" ${k === r.kind ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <input class="inp" type="time" value="${esc(r.time)}" data-chg="remSet" data-id="${esc(r.id)}" data-f="time" aria-label="Время">
      <div class="rem-days">${WD.map((d, i) => `<button type="button" class="${r.days.includes(i) ? 'on' : ''}" data-act="remDay" data-id="${esc(r.id)}" data-d="${i}" aria-pressed="${r.days.includes(i)}">${d}</button>`).join('')}</div>
      <label class="switch"><input type="checkbox" data-chg="remSet" data-id="${esc(r.id)}" data-f="enabled" ${r.enabled ? 'checked' : ''}><i></i><span class="sr">Включено</span></label>
      <button class="btn btn-ghost btn-icon btn-sm" data-act="remDel" data-id="${esc(r.id)}" aria-label="Удалить напоминание">${ico('trash')}</button></div>`).join('')}</div>` : '<div class="small muted">Напоминаний пока нет.</div>'}
    <div class="row wrap"><button class="btn btn-sm" data-act="remAdd">${ico('plus')}Добавить напоминание</button></div>`;
}
const remOf = (id: string) => (S.reminders || []).find(r => r.id === id);
ACT.remAdd = () => {
  if ((S.reminders || []).length >= 10) return toast('Можно до 10 напоминаний', 'err');
  S.reminders.push({ id: uid(), kind: 'workout', time: '18:00', days: [0, 2, 4], enabled: true }); S.profile.timezone = tz();
  if (!S.settings.bot.reminders) S.settings.bot.reminders = true;
  save(); rerender();
};
ACT.remSet = el => {
  const r = remOf(el.dataset.id); if (!r) return; const f = el.dataset.f;
  if (f === 'enabled') r.enabled = el.checked;
  else if (f === 'time') { if (!/^\d{2}:\d{2}$/.test(el.value)) return toast('Укажите время в формате ЧЧ:ММ', 'err'); r.time = el.value; }
  else if (f === 'kind') r.kind = el.value;
  S.profile.timezone = tz(); save(); toast('Сохранено', 'ok', 1000); if (f === 'enabled') rerender();
};
ACT.remDay = el => {
  const r = remOf(el.dataset.id); if (!r) return; const d = +el.dataset.d;
  r.days = r.days.includes(d) ? r.days.filter(x => x !== d) : [...r.days, d].sort();
  if (!r.days.length) { r.days = [d]; return toast('Нужен хотя бы один день', 'err'); }
  save(); rerender();
};
ACT.remDel = el => { S.reminders = S.reminders.filter(r => r.id !== el.dataset.id); save(); rerender(); };

/* ---------- sync & account ---------- */
const STATUS_NAME: Record<string, string> = { off: 'выключена', idle: 'включена', syncing: 'синхронизация…', offline: 'нет сети', error: 'ошибка', auth: 'нужен повторный вход' };
let linkTimer: any = 0;
async function fillSync(view) {
  const el = $('#sync-box', view), stEl = $('#sync-st', view); if (!el) return;
  const a = auth.get();
  if (stEl) stEl.textContent = a ? `статус: ${STATUS_NAME[SYNC.status] || SYNC.status}` : 'локальный режим';
  if (isSingleFile()) {
    el.innerHTML = `<div class="note n-acc">${ico('info')}<div class="small">Версия в одном файле: все данные хранятся только в этом браузере на этом устройстве. Синхронизация между устройствами, вход через Telegram и напоминания бота работают, когда приложение открыто с сервера PULLUP PRO. Перенести данные можно кнопками «Экспорт JSON» и «Импорт» в блоке «Данные».</div></div>`;
    return;
  }
  const ok = await apiAvailable();
  if (!el.isConnected) return;
  if (!ok) {
    el.innerHTML = `<div class="note n-acc">${ico('info')}<div class="small">Сервер синхронизации сейчас недоступен${navigator.onLine ? '' : ' (нет интернета)'}. Приложение полностью работает без него: данные хранятся на этом устройстве.${a ? ` Аккаунт: <b>${esc(a.user.name || a.user.username || 'Telegram')}</b> — синхронизация продолжится, когда сервер станет доступен.` : ''}</div></div>
      ${a ? `<div class="row wrap"><button class="btn btn-sm btn-ghost" data-act="signOut">${ico('logout')}Выйти</button></div>` : ''}`;
    return;
  }
  const cfg = await serverConfig();
  if (!el.isConnected) return;
  if (!a) {
    el.innerHTML = `<div class="small tx2">Войдите через Telegram, чтобы синхронизировать данные между телефоном, компьютером и Telegram Mini App и получать напоминания от бота. Без входа всё продолжает работать локально.</div>
      <div class="row wrap">${TG.active ? `<button class="btn btn-acc" data-act="tgLogin">${ico('telegram')}Войти через Telegram</button>` : cfg && cfg.botUsername ? `<button class="btn btn-acc" data-act="linkStart">${ico('telegram')}Войти через Telegram-бота</button>` : `<span class="small muted">Вход через Telegram не настроен на сервере (нет имени бота).</span>`}</div>
      <div id="link-box"></div>
      <div class="tiny muted">Сохраняются только данные PULLUP PRO. Фото прогресса в облако не отправляются без отдельного согласия.</div>`;
    return;
  }
  const c = S.settings.cloud;
  el.innerHTML = `<div class="row wrap between"><div class="row" style="gap:10px"><span class="li-ico acc">${ico('telegram')}</span><div><b class="small">${esc(a.user.name || 'Аккаунт Telegram')}</b>${a.user.username ? `<div class="tiny muted">@${esc(a.user.username)}</div>` : ''}</div></div>
      <div class="row wrap"><button class="btn btn-sm btn-ghost" data-act="signOut">${ico('logout')}Выйти</button></div></div>
    <div class="grid g2">
      <div class="stack s">${`<label class="switch"><input type="checkbox" data-chg="cloudSw" ${c.enabled ? 'checked' : ''} ${isDemo() ? 'disabled' : ''}><i></i><span><b class="small">Синхронизация данных</b><span class="tiny muted" style="display:block">${isDemo() ? 'на паузе, пока загружено демо' : 'тренировки, план, тело, питание, настройки'}</span></span></label>`}
        <label class="switch"><input type="checkbox" data-chg="photoSw" ${c.photos ? 'checked' : ''} ${c.enabled && cfg && cfg.photos !== false ? '' : 'disabled'}><i></i><span><b class="small">Фото прогресса в облаке</b><span class="tiny muted" style="display:block">${cfg && cfg.photos === false ? 'отключено на сервере' : 'только с вашего отдельного согласия'}</span></span></label></div>
      <div class="stack s small"><div class="row between"><span>Статус</span><b>${STATUS_NAME[SYNC.status] || SYNC.status}</b></div><div class="row between"><span>Последняя синхронизация</span><b>${fmtTime(c.lastSync || SYNC.at)}</b></div>
        ${SYNC.error && SYNC.status !== 'idle' ? `<div class="tiny bad">${esc(SYNC.error)}</div>` : ''}</div>
    </div>
    <div class="row wrap"><button class="btn btn-sm" data-act="syncGo" ${c.enabled ? '' : 'disabled'}>${ico('sync')}Синхронизировать сейчас</button><button class="btn btn-sm btn-ghost" data-act="cloudExport">${ico('download')}Мои данные с сервера</button><button class="btn btn-sm btn-ghost" data-act="cloudDelete">${ico('trash')}Удалить облачный аккаунт</button></div>`;
}
onSync(() => { const v = $('#sync-card'); if (v && v.isConnected) { const s = $('#sync-st'); if (s) s.textContent = `статус: ${STATUS_NAME[SYNC.status] || SYNC.status}`; } });
ACT.tgLogin = async () => {
  try { await telegramSignIn(); toast('Вход выполнен', 'ok'); askEnableSync(); rerender(); }
  catch (e) { toast(e instanceof ApiError ? `Вход не удался: ${e.message}` : e.message, 'err', 4500); }
};
ACT.linkStart = async () => {
  const box = $('#link-box'); if (!box) return;
  try {
    const L = await linkStart(); clearInterval(linkTimer);
    box.innerHTML = `<div class="link-code card flat"><div class="tiny muted">Код входа (действует 10 минут)</div><div class="lc-code num">${esc(L.code)}</div>
      <div class="small tx2">Откройте бота и нажмите «Start» — вход подтвердится автоматически. Или отправьте боту: <span class="kbd">/start link_${esc(L.code)}</span></div>
      <div class="row wrap mt-s">${L.botUrl ? `<button class="btn btn-acc btn-sm" data-act="openBot" data-url="${esc(L.botUrl)}">${ico('telegram')}Открыть бота</button>` : ''}<span class="tiny muted" id="link-st">Ждём подтверждения…</span></div></div>`;
    const t0 = Date.now();
    linkTimer = setInterval(async () => {
      if (!box.isConnected || Date.now() - t0 > 10 * 60e3) { clearInterval(linkTimer); const s = $('#link-st'); if (s) s.textContent = 'Код истёк — запросите новый'; return; }
      try {
        const st = await linkPoll(L.code, L.secret);
        if (st === 'ok') { clearInterval(linkTimer); toast('Telegram подключён', 'ok'); askEnableSync(); rerender(); }
        else if (st === 'expired') { clearInterval(linkTimer); const s = $('#link-st'); if (s) s.textContent = 'Код истёк — запросите новый'; }
      } catch (e) { /* network hiccup: keep polling */ }
    }, 2500);
  } catch (e) { toast(`Не удалось получить код: ${e.message}`, 'err', 4500); }
};
ACT.openBot = el => tgOpenLink(el.dataset.url);
export async function askEnableSync() {
  if (S.settings.cloud.enabled || isDemo()) return;
  if (await confirmBox('Включить синхронизацию?', 'Тренировки, план, замеры, питание и настройки будут сохраняться на сервере PULLUP PRO и появятся на других устройствах с этим аккаунтом Telegram. Фото прогресса не отправляются без отдельного согласия. Выключить можно в любой момент.', 'Включить')) {
    setCloud(true); try { await syncNow(); toast('Синхронизация включена', 'ok'); } catch (e) { syncErrorToast(e); } rerender();
  }
}
ACT.cloudSw = async el => {
  if (el.checked) { setCloud(true); try { await syncNow(); toast('Синхронизировано', 'ok'); } catch (e) { syncErrorToast(e); } }
  else { setCloud(false); toast('Синхронизация выключена. Данные остаются на устройстве и на сервере.', 'ok', 4000); }
  rerender();
};
ACT.photoSw = async el => {
  if (el.checked) {
    el.checked = false;
    if (!(await confirmBox('Отправлять фото прогресса в облако?', 'Фото будут храниться на сервере PULLUP PRO в вашем аккаунте, чтобы появиться на других устройствах. Фото не публикуются и не передаются третьим лицам; метаданные (геопозиция, модель камеры) удаляются ещё на устройстве. Согласие можно отозвать — фото будут удалены с сервера.', 'Даю согласие'))) return;
    try { await setPhotoConsent(true); const r = await syncPhotos(); toast(`Фото синхронизированы: отправлено ${r.up}, получено ${r.down}`, 'ok'); } catch (e) { syncErrorToast(e); }
  } else {
    try { await setPhotoConsent(false); for (const p of S.photos) delete p.cloud; save(); toast('Согласие отозвано, фото удалены с сервера', 'ok'); } catch (e) { syncErrorToast(e); }
  }
  rerender();
};
ACT.syncGo = async () => { try { const n = await syncNow(); toast(n ? `Синхронизировано · получено записей: ${n}` : 'Синхронизировано', 'ok'); } catch (e) { syncErrorToast(e); } rerender(); };
ACT.cloudExport = async () => { try { const j = await api('/export'); download(`pullup-pro-cloud-${todayKey()}.json`, JSON.stringify(j, null, 1)); toast('Данные с сервера скачаны', 'ok'); } catch (e) { syncErrorToast(e); } };
ACT.signOut = async () => {
  if (!(await confirmBox('Выйти из аккаунта?', 'Синхронизация остановится. Все данные останутся на этом устройстве и на сервере.', 'Выйти'))) return;
  await signOut(); toast('Вы вышли из аккаунта', 'ok'); rerender();
};
ACT.cloudDelete = async () => {
  if (!(await confirmBox('Удалить облачный аккаунт?', 'С сервера будут удалены все синхронизированные данные и фото, напоминания бота прекратятся. Данные на этом устройстве останутся. Отменить нельзя.', 'Удалить с сервера', true))) return;
  try { await deleteCloudAccount(); toast('Облачный аккаунт удалён. Данные на устройстве сохранены.', 'ok', 4500); rerender(); } catch (e) { syncErrorToast(e); }
};
