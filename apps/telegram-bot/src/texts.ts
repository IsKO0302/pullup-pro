/* ================= Bot messages (Telegram HTML). Pure functions over the synced AppState — never invent numbers ================= */
import { EN } from '@pullup/shared/i18n/en';
import { TR } from '@pullup/shared/i18n/tr';
import { getLang, numLocale, setLang } from '@pullup/shared/i18n/locale';
import { makeTranslator } from '@pullup/shared/i18n/translate';
import {
  KEY_RESULTS, LEVEL_NAME, W, activeProgram, addDays, buildWorkout, dailyMission, dayKey, doseLabel, exOf, fmtDay, fmtDayShort, fmtDayW,
  fmtNum, fmtSec, nextIndex, parseDay, plural, strengthChanges, summary, userLevel, weekAdvice, weekReport, WD,
  type AppState, type DayKey, type PR, type Reminder
} from '@pullup/shared';

export const h = (s: unknown): string => String(s ?? '').replace(/[&<>]/g, c => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
const lines = (a: (string | null | false | undefined)[]) => a.filter(x => x !== null && x !== false && x !== undefined).join('\n');
const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmtNum(Math.abs(n));
const minutes = (m: number) => m >= 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m} мин`;
const val = (kind: 'reps' | 'time' | 'kg', v: number) => kind === 'time' ? fmtSec(v) : kind === 'kg' ? `${fmtNum(v)} кг` : fmtNum(v);
const prLabel = (p: PR) => `${h(exOf(p.ex).name)} — ${val(p.kind, p.v)}`;

export const WELCOME = lines([
  '<b>PULLUP PRO</b>', '<b>POWER. DISCIPLINE. PROGRESS.</b>', '',
  'Welcome to your personal fitness ecosystem.', 'Your training. Your progress. Your transformation.', '',
  'Тренировки по плану, Muscle-Up, библиотека упражнений, статистика и прогресс тела — прямо в Telegram.',
  'Нажмите <b>OPEN PULLUP PRO</b>, чтобы открыть приложение.'
]);
export const HELP = lines([
  '<b>Команды PULLUP PRO</b>', '',
  '/app — открыть приложение', '/today — миссия и тренировка на сегодня', '/stats — статистика тренировок', '/progress — неделя и изменения силы',
  '/reminder — напоминания в Telegram', '/settings — аккаунт и настройки', '/privacy — конфиденциальность', '/help — эта справка', '',
  'Бот показывает данные из приложения после включения синхронизации: PULLUP PRO → <b>Настройки</b> → «Синхронизация и аккаунт».'
]);
export const APP_MSG = lines(['<b>PULLUP PRO</b>', 'Ваши тренировки, прогресс и изменения тела — в одном приложении.', 'Нажмите кнопку ниже, чтобы открыть его.']);
export const PRIVACY = lines([
  '<b>Конфиденциальность PULLUP PRO</b>', '',
  '• По умолчанию тренировки, замеры, питание и профиль хранятся только <b>на устройстве</b>.',
  '• Синхронизация — по вашему желанию: после входа через Telegram данные копируются на сервер и доступны только вам. Бот показывает статистику только в личном чате.',
  '• <b>Фото прогресса</b> остаются на устройстве. В облако они попадают только после отдельного согласия; согласие можно отозвать — фото будут удалены с сервера.',
  '• Telegram передаёт приложению ваш id, имя и username — они нужны для входа; подлинность этих данных проверяется на сервере по подписи Telegram.',
  '• Напоминания и отчёты приходят только если вы их включили, и их можно отключить в любой момент.',
  '• Данные можно выгрузить (экспорт JSON) и удалить вместе с аккаунтом: <b>Настройки</b> → «Синхронизация и аккаунт».',
  '• Приложение не определяет процент жира по фото, не ставит диагнозов и не заменяет врача.'
]);
/* ---------- static texts in the user's language (Telegram language_code: ru → Russian, tr → Turkish, any other → English; unknown → Russian) ---------- */
export type BotLang = 'ru' | 'en' | 'tr';
export function botLang(code?: string | null): BotLang {
  const c = String(code || '').toLowerCase().slice(0, 2);
  return !c || c === 'ru' ? 'ru' : c === 'tr' ? 'tr' : 'en';
}
const LOCAL = {
  WELCOME: {
    ru: WELCOME,
    en: lines(['<b>PULLUP PRO</b>', '<b>POWER. DISCIPLINE. PROGRESS.</b>', '', 'Welcome to your personal fitness ecosystem.', 'Your training. Your progress. Your transformation.', '',
      'Workout plans, Muscle-Up, an exercise library, statistics and body progress — right in Telegram.', 'Tap <b>OPEN PULLUP PRO</b> to open the app.']),
    tr: lines(['<b>PULLUP PRO</b>', '<b>POWER. DISCIPLINE. PROGRESS.</b>', '', 'Kişisel fitness ekosisteminize hoş geldiniz.', 'Antrenmanınız. İlerlemeniz. Dönüşümünüz.', '',
      'Planlı antrenmanlar, Muscle-Up, egzersiz kütüphanesi, istatistikler ve vücut ilerlemesi — doğrudan Telegram’da.', 'Uygulamayı açmak için <b>OPEN PULLUP PRO</b> düğmesine dokunun.'])
  },
  HELP: {
    ru: HELP,
    en: lines(['<b>PULLUP PRO commands</b>', '', '/app — open the app', '/today — today’s mission and workout', '/stats — workout statistics', '/progress — week and strength changes',
      '/reminder — reminders in Telegram', '/settings — account and settings', '/privacy — privacy', '/help — this help', '',
      'The bot shows data from the app once sync is on: PULLUP PRO → <b>Settings</b> → “Sync and account”.']),
    tr: lines(['<b>PULLUP PRO komutları</b>', '', '/app — uygulamayı aç', '/today — bugünün görevi ve antrenmanı', '/stats — antrenman istatistikleri', '/progress — hafta ve kuvvet değişimleri',
      '/reminder — Telegram hatırlatmaları', '/settings — hesap ve ayarlar', '/privacy — gizlilik', '/help — bu yardım', '',
      'Bot, senkronizasyon açıldıktan sonra uygulamadaki verileri gösterir: PULLUP PRO → <b>Ayarlar</b> → “Senkronizasyon ve hesap”.'])
  },
  APP_MSG: {
    ru: APP_MSG,
    en: lines(['<b>PULLUP PRO</b>', 'Your training, progress and body changes — in one app.', 'Tap the button below to open it.']),
    tr: lines(['<b>PULLUP PRO</b>', 'Antrenmanınız, ilerlemeniz ve vücut değişimleriniz — tek uygulamada.', 'Açmak için aşağıdaki düğmeye dokunun.'])
  },
  PRIVACY: {
    ru: PRIVACY,
    en: lines(['<b>PULLUP PRO privacy</b>', '',
      '• By default workouts, measurements, nutrition and the profile are stored only <b>on the device</b>.',
      '• Sync is optional: after signing in with Telegram your data is copied to the server and available only to you. The bot shows statistics only in a private chat.',
      '• <b>Progress photos</b> stay on the device. They reach the cloud only after a separate consent; the consent can be withdrawn — the photos are then deleted from the server.',
      '• Telegram gives the app your id, name and username — they are needed to sign in; the server verifies the authenticity of this data by Telegram’s signature.',
      '• Reminders and reports arrive only if you turned them on, and can be turned off at any time.',
      '• Your data can be exported (JSON) and deleted together with the account: <b>Settings</b> → “Sync and account”.',
      '• The app does not estimate body fat from photos, does not diagnose and does not replace a doctor.']),
    tr: lines(['<b>PULLUP PRO gizlilik</b>', '',
      '• Varsayılan olarak antrenmanlar, ölçümler, beslenme ve profil yalnızca <b>cihazda</b> saklanır.',
      '• Senkronizasyon isteğe bağlıdır: Telegram ile giriş yaptıktan sonra verileriniz sunucuya kopyalanır ve yalnızca size açıktır. Bot istatistikleri yalnızca özel sohbette gösterir.',
      '• <b>İlerleme fotoğrafları</b> cihazda kalır. Buluta yalnızca ayrı bir onaydan sonra gider; onay geri çekilebilir — fotoğraflar sunucudan silinir.',
      '• Telegram uygulamaya kimliğinizi, adınızı ve kullanıcı adınızı iletir — giriş için gereklidir; bu verilerin gerçekliği sunucuda Telegram imzasıyla doğrulanır.',
      '• Hatırlatmalar ve raporlar yalnızca siz açarsanız gelir ve istediğiniz zaman kapatılabilir.',
      '• Verileriniz dışa aktarılabilir (JSON) ve hesapla birlikte silinebilir: <b>Ayarlar</b> → “Senkronizasyon ve hesap”.',
      '• Uygulama fotoğraflardan vücut yağı tahmin etmez, teşhis koymaz ve doktorun yerini tutmaz.'])
  }
} as const;
/* ---------- dynamic texts: dates, numbers and plural forms follow the user's language (the shared helpers read a global
 * language, so it is switched only while one — synchronous — text is built), the rest goes through the dictionary piece by piece
 * (HTML tags are kept as they are) ---------- */
const TRANSLATORS = { en: makeTranslator(EN), tr: makeTranslator(TR) };
const translateHtml = (html: string, lang: 'en' | 'tr'): string => html.split(/(<[^>]*>)/).map(p => (p.startsWith('<') ? p : TRANSLATORS[lang](p))).join('');
/** translates a ready Russian text / button label for a Telegram user (Russian stays as it is) */
export function loc(text: string, code?: string | null): string {
  const l = botLang(code);
  return l === 'ru' ? text : translateHtml(text, l);
}
/** builds a text in the user's language: formatters switch to it, the result is translated */
export function inLang(code: string | null | undefined, build: () => string): string {
  const l = botLang(code);
  if (l === 'ru') return build();
  const prev = getLang();
  setLang(l);
  try { return translateHtml(build(), l); } finally { setLang(prev); }
}
/** a static bot text in the language of the Telegram user */
export const localized = (key: keyof typeof LOCAL, code?: string | null): string => LOCAL[key][botLang(code)];
export const NO_ACCOUNT = lines([
  'Данных из приложения пока нет.', '',
  'Чтобы бот показывал план и статистику, откройте PULLUP PRO → <b>Настройки</b> → «Синхронизация и аккаунт», войдите через Telegram и включите синхронизацию.'
]);
export const NO_WEBAPP = 'Адрес приложения (WEBAPP_URL с HTTPS) не настроен у владельца бота — кнопка открытия появится после настройки.';
export const PRIVATE_ONLY = 'Статистика и план личные — напишите боту в личные сообщения.';
export const SERVICE_DOWN = 'Сервис временно недоступен. Попробуйте позже.';
export const LINK_MSG: Record<'ok' | 'not_found' | 'expired' | 'used', string> = {
  ok: '✅ <b>Вход подтверждён.</b>\nВернитесь в PULLUP PRO — вход выполнится автоматически в течение нескольких секунд.',
  expired: 'Код входа истёк. Запросите новый в приложении: <b>Настройки</b> → «Синхронизация и аккаунт».',
  used: 'Этот код входа уже использован. Запросите новый в приложении.',
  not_found: 'Код входа не найден. Проверьте код или запросите новый в приложении.'
};

export function todayText(S: AppState, today: DayKey): string {
  const m = dailyMission(S, today), P = activeProgram(S), bw = m.kind === 'train' ? buildWorkout(S, P.id, nextIndex(S, P.id), { today }) : null;
  return lines([
    `<b>Сегодня · ${h(fmtDayW(today))}</b>`, '', `<b>${h(m.title)}</b>`, h(m.sub), '',
    ...m.items.map(i => `${i.done ? '✅' : '▫️'} ${h(i.t)}`),
    ...(bw ? ['', `<b>${h(bw.w.name)}</b> · ${h(bw.w.focus)}${bw.deload ? ' · разгрузка' : ''}`, ...bw.items.map((it, n) => `${n + 1}. ${h(exOf(it.ex).name)} — ${h(doseLabel(it))}`)] : []),
    ...(bw && bw.deload ? ['Разгрузочная неделя: объём снижен, техника — в приоритете.'] : [])
  ]);
}

export function statsText(S: AppState, today: DayKey): string {
  const s = summary(S, today);
  if (!s.workouts && !(S.tests || []).length) return lines(['<b>Статистика</b>', '', 'Тренировок пока нет. Они появятся здесь после первой тренировки и синхронизации.']);
  const res = KEY_RESULTS.filter(k => s.results[k.k] > 0).map(k => `${h(k.label)}: <b>${val(k.kind, s.results[k.k])}</b>`);
  const ago = s.daysSinceLast === 0 ? 'сегодня' : s.daysSinceLast === 1 ? 'вчера' : s.daysSinceLast != null ? `${s.daysSinceLast} ${plural(s.daysSinceLast, W.day)} назад` : '';
  return lines([
    '<b>Статистика PULLUP PRO</b>', '',
    `Тренировок всего: <b>${fmtNum(s.workouts)}</b>`, `Эта неделя: <b>${s.weekCount} из ${s.weekTarget}</b>`,
    s.consistency ? `Недель подряд с выполненной целью: <b>${s.consistency}</b>` : null,
    s.lastWorkout ? `Последняя тренировка: ${h(fmtDay(s.lastWorkout.date))} (${ago})` : null,
    `Подходов: ${fmtNum(s.totalSets)} · повторений: ${fmtNum(s.totalReps)} · время: ${minutes(s.totalMinutes)}`,
    ...(res.length ? ['', '<b>Лучшие результаты</b>', ...res] : []),
    s.lastPR ? `\nПоследний рекорд: ${prLabel(s.lastPR)} · ${h(fmtDay(s.lastPR.date))}` : null,
    s.weight.v > 0 ? `\nВес: <b>${fmtNum(s.weight.v)} кг</b>${s.weight.fromProfile ? ' (из профиля)' : ''}${s.weight30 != null ? ` · за 30 дней ${signed(s.weight30)} кг` : ''}` : null
  ]);
}

export function progressText(S: AppState, today: DayKey): string {
  const r = weekReport(S, today), adv = weekAdvice(S, r, today), ch = strengthChanges(S, dayKey(addDays(parseDay(today), -30)));
  const d = (a: number, b: number) => (b || a) && a !== b ? ` (${signed(a - b)})` : '';
  return lines([
    `<b>Прогресс · ${h(fmtDayShort(r.from))} – ${h(fmtDayShort(r.to))}</b>`, '',
    `Тренировок: <b>${r.workouts} из ${r.target}</b>${r.prev.workouts ? ` · прошлая неделя: ${r.prev.workouts}` : ''}`,
    `Подходов: ${fmtNum(r.sets)}${d(r.sets, r.prev.sets)} · повторений: ${fmtNum(r.reps)}${d(r.reps, r.prev.reps)} · время: ${minutes(r.minutes)}`,
    r.prs.length ? `Новых рекордов: <b>${r.prs.length}</b> — ${r.prs.slice(-3).map(prLabel).join(', ')}` : null,
    r.weightStart != null && r.weightEnd != null && r.weightStart !== r.weightEnd ? `Вес: ${fmtNum(r.weightStart)} → ${fmtNum(r.weightEnd)} кг` : null,
    '', '<b>Сила за 30 дней</b>',
    ...(ch.length ? ch.map(c => c.before ? `${h(c.label)}: ${val(c.kind, c.before)} → <b>${val(c.kind, c.now)}</b>${c.delta ? ` (${c.delta > 0 ? '+' : '−'}${val(c.kind, Math.abs(c.delta))})` : ''}` : `${h(c.label)}: <b>${val(c.kind, c.now)}</b> (первый результат)`)
      : ['Пока нет результатов в ключевых упражнениях за этот период.']),
    '', `💡 <b>${h(adv.title)}</b>`, h(adv.text)
  ]);
}

export const REMINDER_KIND: Record<Reminder['kind'], string> = { workout: 'Тренировка', weight: 'Вес', water: 'Вода', mobility: 'Мобилити' };
export const daysLabel = (days: number[]) => days.length === 7 ? 'каждый день' : days.length ? [...days].sort((a, b) => a - b).map(i => WD[i]).join(', ') : 'дни не выбраны';
export function remindersText(S: AppState, zone: string): string {
  const rs = (S.reminders || []).slice().sort((a, b) => (a.time < b.time ? -1 : 1)), on = !!(S.settings && S.settings.bot && S.settings.bot.reminders);
  return lines([
    '<b>Напоминания</b>', '', `В Telegram: <b>${on ? 'включены' : 'выключены'}</b>`, `Часовой пояс: ${h(zone)}`, '',
    ...(rs.length ? rs.map(r => `${r.enabled ? '🔔' : '🔕'} ${h(r.time)} · ${h(REMINDER_KIND[r.kind] || r.kind)} · ${h(daysLabel(r.days || []))}`)
      : ['Напоминаний пока нет — добавьте их в приложении: <b>Настройки</b> → «Напоминания».'])
  ]);
}

export interface SettingsInfo { name: string; username: string | null; photosConsent: boolean; lastChangeAt: string | null; records: number }
export function settingsText(S: AppState, info: SettingsInfo, zone: string): string {
  const P = activeProgram(S), rem = (S.reminders || []).filter(r => r.enabled).length, on = !!(S.settings && S.settings.bot && S.settings.bot.reminders);
  const at = info.lastChangeAt ? new Intl.DateTimeFormat(numLocale(), { timeZone: zone, day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(info.lastChangeAt)) : '—';
  return lines([
    '<b>Настройки</b>', '',
    `Аккаунт: <b>${h(info.name)}</b>${info.username ? ` (@${h(info.username)})` : ''}`,
    `Синхронизация: ${fmtNum(info.records)} ${plural(info.records, ['запись', 'записи', 'записей'])} · последнее изменение ${h(at)}`,
    `Программа: ${h(P.name)} · цель ${+S.profile.weeklyTarget || 3} ${plural(+S.profile.weeklyTarget || 3, W.work)} в неделю`,
    `Уровень: ${h(LEVEL_NAME[userLevel(S)] || userLevel(S))}`, `Часовой пояс: ${h(zone)}`,
    `Напоминания в Telegram: ${on ? 'включены' : 'выключены'} (активных: ${rem})`,
    `Фото прогресса в облаке: ${info.photosConsent ? 'согласие дано' : 'не хранятся'}`, '',
    'Изменить настройки можно в приложении.'
  ]);
}

export function reminderMessage(kind: Reminder['kind'], S: AppState | null): string {
  if (kind === 'workout') {
    const P = S ? activeProgram(S) : null, w = P && S ? P.workouts[nextIndex(S, P.id)] : null;
    return lines(['💪 <b>Время тренировки</b>', w && P ? `По плану: <b>${h(w.name)}</b> · ${h(P.name)}.` : 'Тренировка по вашему плану ждёт.', 'Начните с разминки 5 минут.']);
  }
  if (kind === 'weight') return lines(['⚖️ <b>Пора записать вес</b>', 'Лучше утром, до завтрака — так замеры сравнимы между собой.']);
  if (kind === 'water') return lines(['💧 <b>Выпейте стакан воды</b>', 'Отметьте его в разделе «Питание».']);
  return lines(['🧘 <b>Мобилити 10 минут</b>', 'Плечи, грудной отдел и бёдра — плавно и без боли.']);
}
export const REMINDER_SCREEN: Record<Reminder['kind'], string> = { workout: 'train', weight: 'body', water: 'nutrition', mobility: 'train' };
