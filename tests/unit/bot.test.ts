import { describe, expect, it } from 'vitest';
import { weekAdvice, weekReport } from '@pullup/shared';
import { APP_MSG, HELP, PRIVACY, WELCOME, botLang, localized, progressText, remindersText, statsText, todayText, daysLabel } from '../../apps/telegram-bot/src/texts';
import { hmToMin, zoned } from '../../apps/telegram-bot/src/tz';
import { dueReminders } from '../../apps/telegram-bot/src/reminders';
import { COMMANDS_EN, COMMANDS_RU, COMMANDS_TR, screenUrl } from '../../apps/telegram-bot/src/bot';
import { sess, state } from './helpers';

describe('bot texts', () => {
  it('welcome message has the required wording', () => {
    for (const s of ['<b>PULLUP PRO</b>', 'POWER. DISCIPLINE. PROGRESS.', 'Welcome to your personal fitness ecosystem.', 'Your training. Your progress. Your transformation.', 'OPEN PULLUP PRO']) expect(WELCOME).toContain(s);
    for (const c of ['/app', '/today', '/stats', '/progress', '/reminder', '/settings', '/privacy', '/help']) expect(HELP).toContain(c);
  });
  it('every command is registered in both languages, including /app and /privacy', () => {
    for (const list of [COMMANDS_RU, COMMANDS_EN, COMMANDS_TR]) {
      const names = list.map(c => c.command);
      for (const c of ['start', 'help', 'app', 'today', 'stats', 'progress', 'reminder', 'settings', 'privacy']) expect(names).toContain(c);
      expect(new Set(names).size).toBe(names.length);                         // no duplicates
      for (const c of list) expect(c.description.length).toBeGreaterThanOrEqual(3);   // Telegram needs 3–256 characters
    }
  });
  it('static texts follow the Telegram language: ru → Russian, tr → Turkish, other → English, unknown → Russian', () => {
    expect([botLang('ru'), botLang('tr-TR'), botLang('en'), botLang('de'), botLang(undefined)]).toEqual(['ru', 'tr', 'en', 'en', 'ru']);
    expect(localized('WELCOME', 'tr')).toContain('hoş geldiniz'); expect(localized('WELCOME', 'en')).toContain('Welcome to your personal fitness ecosystem.');
    expect(localized('WELCOME', 'ru')).toBe(WELCOME);
    for (const key of ['WELCOME', 'HELP', 'APP_MSG', 'PRIVACY'] as const) for (const l of ['en', 'tr']) expect(localized(key, l)).not.toMatch(/[а-яё]/i);   // no Russian leaks into other languages
    for (const l of ['en', 'tr']) for (const c of ['/app', '/today', '/stats', '/progress', '/reminder', '/settings', '/privacy', '/help']) expect(localized('HELP', l)).toContain(c);
  });
  it('privacy text says what is stored and where, mentions consent and deletion, and claims no medical features', () => {
    const t = PRIVACY.toLowerCase();
    for (const s of ['на устройстве', 'фото', 'согласи', 'удал', 'telegram']) expect(t).toContain(s);
    expect(t).toContain('не заменяет врача');
    expect(APP_MSG).toContain('PULLUP PRO');
  });
  it('statistics on an empty account say so instead of inventing numbers', () => {
    const t = statsText(state(), '2026-03-05');
    expect(t).toContain('Тренировок пока нет'); expect(t).not.toMatch(/\d+ из \d+/);
  });
  it('statistics show only real values', () => {
    const S = state(S => { S.sessions.push(sess('a', '2026-03-02', [['pullup', [7, 6]], ['plank', [{ time: 75 }]]])); });
    const t = statsText(S, '2026-03-05');
    expect(t).toContain('Тренировок всего: <b>1</b>'); expect(t).toContain('Подтягивания: <b>7</b>'); expect(t).toContain('Планка: <b>1:15</b>');
    expect(t).not.toContain('Брусья');                        // no dips logged → not shown
  });
  it('today: mission and the next workout with doses', () => {
    const t = todayText(state(), '2026-03-02');
    expect(t).toContain('Миссия'); expect(t).toMatch(/1\. .+ — \d+ × /);
  });
  it('progress: strength changes and a rule-based advice', () => {
    const S = state(S => {
      S.sessions.push(sess('a', '2026-01-20', [['pullup', [5]]]));
      S.sessions.push(sess('b', '2026-03-03', [['pullup', [8]]]));
    });
    const t = progressText(S, '2026-03-05');
    expect(t).toContain('Подтягивания: 5 → <b>8</b> (+3)'); expect(t).toContain('💡');
  });
  it('escapes HTML coming from user data', () => {
    const S = state(S => { S.reminders.push({ id: 'r', kind: 'workout', time: '18:00', days: [0, 2, 4], enabled: true }); S.settings.bot.reminders = true; });
    const t = remindersText(S, 'Europe/<b>');
    expect(t).toContain('Europe/&lt;b&gt;'); expect(t).toContain('18:00 · Тренировка · Пн, Ср, Пт');
    expect(daysLabel([0, 1, 2, 3, 4, 5, 6])).toBe('каждый день');
  });
});

describe('weekly advice rules', () => {
  it('pain beats everything, then deload, missing workouts, target', () => {
    const pain = state(S => { S.sessions.push(sess('a', '2026-03-02', [['pullup', [5]]], { pain: true })); });
    expect(weekAdvice(pain, weekReport(pain, '2026-03-05'), '2026-03-05').rule).toBe('pain');
    const none = state();
    expect(weekAdvice(none, weekReport(none, '2026-03-05'), '2026-03-05').rule).toBe('none');
    const below = state(S => { S.sessions.push(sess('a', '2026-03-02', [['pullup', [5]]])); });
    expect(weekAdvice(below, weekReport(below, '2026-03-05'), '2026-03-05').rule).toBe('below-target');
  });
});

describe('reminder scheduling', () => {
  it('local time in the user time zone', () => {
    const z = zoned('Europe/Istanbul', new Date('2026-03-02T15:00:00Z'));   // Monday 18:00 in Istanbul (UTC+3)
    expect(z).toMatchObject({ zone: 'Europe/Istanbul', day: '2026-03-02', wd: 0, hm: '18:00' });
    expect(zoned('Not/AZone', new Date('2026-03-02T15:00:00Z')).zone).toBe('UTC');
    expect(hmToMin('07:30')).toBe(450); expect(hmToMin('24:00')).toBe(-1);
  });
  it('fires within the window on selected days only', () => {
    const t = [{ userId: 'u', telegramId: 1, settings: {}, profile: { timezone: 'Europe/Istanbul' }, reminders: [
      { id: 'w', kind: 'workout', time: '18:00', days: [0, 2, 4], enabled: true },
      { id: 'off', kind: 'water', time: '18:00', days: [0], enabled: false },
      { id: 'tue', kind: 'weight', time: '18:00', days: [1], enabled: true }
    ] }];
    expect(dueReminders(t, new Date('2026-03-02T15:02:00Z'), 5).map(d => d.reminder.id)).toEqual(['w']);
    expect(dueReminders(t, new Date('2026-03-02T14:59:00Z'), 5)).toHaveLength(0);   // 17:59 — too early
    expect(dueReminders(t, new Date('2026-03-02T15:05:00Z'), 5)).toHaveLength(0);   // window is over
  });
  it('deep-link URLs for the Mini App', () => {
    expect(screenUrl('https://fit.example.org/', 'stats')).toBe('https://fit.example.org/?screen=stats');
    expect(screenUrl('https://fit.example.org/app?x=1', 'train')).toBe('https://fit.example.org/app?x=1&screen=train');
  });
});
