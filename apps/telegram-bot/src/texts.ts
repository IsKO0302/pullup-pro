/* ================= Bot messages (Telegram HTML). Pure functions over the synced AppState — never invent numbers ================= */
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
  '<b>PULLUP PRO</b>', '', 'Your personal fitness journey starts here.', '',
  'Тренировки по плану, Muscle-Up, библиотека упражнений, статистика и прогресс тела — прямо в Telegram.',
  'Нажмите <b>OPEN PULLUP PRO</b>, чтобы открыть приложение.'
]);
export const HELP = lines([
  '<b>Команды PULLUP PRO</b>', '',
  '/today — миссия и тренировка на сегодня', '/stats — статистика тренировок', '/progress — неделя и изменения силы',
  '/reminder — напоминания в Telegram', '/settings — аккаунт и настройки', '/help — эта справка', '',
  'Бот показывает данные из приложения после включения синхронизации: PULLUP PRO → <b>Настройки</b> → «Синхронизация и аккаунт».'
]);
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
  const at = info.lastChangeAt ? new Intl.DateTimeFormat('ru-RU', { timeZone: zone, day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(info.lastChangeAt)) : '—';
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
