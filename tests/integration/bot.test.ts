import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as db from '@pullup/db';
import { toRecords } from '@pullup/shared';
import type { Bot } from 'grammy';
import { createBot } from '../../apps/telegram-bot/src/bot';
import { reminderTick } from '../../apps/telegram-bot/src/reminders';
import { zoned } from '../../apps/telegram-bot/src/tz';
import { sess, state } from '../unit/helpers';
import { TOKEN, freshPool, haveDb } from './helpers';

const botInfo = { id: 999, is_bot: true as const, first_name: 'PULLUP PRO', username: 'pullup_test_bot', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false, allows_users_to_create_topics: false, can_manage_bots: false, supports_join_request_queries: false };
const WEBAPP = 'https://fit.example.org/';
const isa = { id: 1001, first_name: 'Isa', username: 'isa_fit', language_code: 'ru' };
type Call = { method: string; payload: any };

/** records every Bot API call instead of sending it to Telegram */
function recordApi(bot: Bot, blocked = new Set<number>()): Call[] {
  const calls: Call[] = [];
  bot.api.config.use(async (_prev, method, payload: any) => {
    calls.push({ method, payload });
    if (method === 'sendMessage' && blocked.has(payload.chat_id)) return { ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' } as any;
    const msg = { message_id: calls.length, date: 0, chat: { id: payload.chat_id ?? 0, type: 'private' }, text: payload.text };
    return { ok: true, result: method === 'sendMessage' || method === 'editMessageText' ? msg : true } as any;
  });
  return calls;
}
let uid = 1;
const command = (from: typeof isa, text: string, chat: any = { id: from.id, type: 'private', first_name: from.first_name }) => ({
  update_id: uid++, message: { message_id: uid, date: Math.floor(Date.now() / 1000), chat, from: { ...from, is_bot: false }, text,
    entities: text.startsWith('/') ? [{ type: 'bot_command' as const, offset: 0, length: text.split(' ')[0].length }] : undefined }
});
const callback = (from: typeof isa, data: string) => ({
  update_id: uid++, callback_query: { id: 'cb' + uid, from: { ...from, is_bot: false }, chat_instance: 'ci', data,
    message: { message_id: 77, date: 0, chat: { id: from.id, type: 'private' as const, first_name: from.first_name }, text: 'old' } }
});
const sent = (calls: Call[]) => calls.filter(c => c.method === 'sendMessage');

describe.skipIf(!haveDb)('Telegram bot (grammY) with PostgreSQL', () => {
  let pool: db.Pool, bot: Bot, calls: Call[];
  const blocked = new Set<number>();
  beforeAll(async () => { pool = await freshPool(); bot = createBot(TOKEN, { pool, webAppUrl: WEBAPP, defaultTz: 'UTC', log: () => undefined }, { botInfo }); calls = recordApi(bot, blocked); });
  afterAll(async () => { await pool?.end(); });
  beforeEach(() => { calls.length = 0; });

  it('/start: welcome text and the OPEN PULLUP PRO Mini App button', async () => {
    await bot.handleUpdate(command(isa, '/start'));
    const m = sent(calls)[0].payload;
    expect(m.text).toContain('PULLUP PRO'); expect(m.text).toContain('POWER. DISCIPLINE. PROGRESS.');
    expect(m.text).toContain('Welcome to your personal fitness ecosystem.'); expect(m.text).toContain('Your training. Your progress. Your transformation.');
    expect(m.parse_mode).toBe('HTML');
    expect(m.reply_markup.inline_keyboard[0][0]).toEqual({ text: 'OPEN PULLUP PRO', web_app: { url: WEBAPP } });
    const u = await db.getUserByTelegram(pool, isa.id);
    expect(u?.bot_started_at).toBeTruthy();
  });
  it('/app: opens the Mini App with one web_app button; works without an account', async () => {
    await bot.handleUpdate(command({ id: 4242, first_name: 'New', username: 'new_user', language_code: 'en' }, '/app'));
    const m = sent(calls)[0].payload;
    expect(m.text).toContain('PULLUP PRO');
    expect(m.reply_markup.inline_keyboard[0][0]).toEqual({ text: 'OPEN PULLUP PRO', web_app: { url: WEBAPP } });
  });
  it('/privacy: explains data handling and links to the app settings', async () => {
    await bot.handleUpdate(command(isa, '/privacy'));
    const m = sent(calls)[0].payload;
    expect(m.text).toContain('Конфиденциальность'); expect(m.text).toContain('на устройстве');
    expect(m.reply_markup.inline_keyboard[0][0].web_app.url).toBe(WEBAPP + '?screen=settings');
  });
  it('/app and /privacy are refused in group chats (no personal links there)', async () => {
    const group = { id: -5, type: 'group', title: 'g' };
    await bot.handleUpdate(command(isa, '/app', group));
    await bot.handleUpdate(command(isa, '/privacy', group));
    for (const c of sent(calls)) expect(c.payload.text).toContain('личные сообщения');
    expect(sent(calls)).toHaveLength(2);
  });
  it('/start link_<code>: confirms a browser sign-in', async () => {
    const L = await db.createLinkCode(pool, 'pwa', 10);
    await bot.handleUpdate(command(isa, `/start link_${L.code}`));
    expect(sent(calls)[0].payload.text).toContain('Вход подтверждён');
    const r = await db.pollLinkCode(pool, L.code, L.secret);
    expect(r).toMatchObject({ status: 'ok', profile: { id: isa.id } });
    await bot.handleUpdate(command(isa, '/start link_ZZZZZZZZ'));
    expect(sent(calls)[1].payload.text).toContain('не найден');
  });
  it('commands without synced data explain how to enable sync', async () => {
    await bot.handleUpdate(command(isa, '/stats'));
    expect(sent(calls)[0].payload.text).toContain('включите синхронизацию');
    expect(sent(calls)[0].payload.reply_markup.inline_keyboard[0][0].web_app.url).toBe(WEBAPP + '?screen=settings');
  });

  describe('with synced data', () => {
    let userId = '';
    beforeAll(async () => {
      userId = (await db.getUserByTelegram(pool, isa.id))!.id;
      const S = state(S => {
        S.profile.name = 'Isa'; S.profile.timezone = 'Europe/Istanbul';
        S.sessions.push(sess('a', '2026-02-02', [['pullup', [5, 5]]]), sess('b', '2026-03-02', [['pullup', [8, 7]], ['pushup', [20]]]));
        S.reminders.push({ id: 'rw', kind: 'workout', time: '18:00', days: [0, 1, 2, 3, 4, 5, 6], enabled: true });
        S.settings.bot.reminders = true;
      });
      await db.pushRecords(pool, userId, [...toRecords(S).values()].map(r => ({ ...r, u: 1000 })), 'test');
    });
    it('/stats shows the real totals', async () => {
      await bot.handleUpdate(command(isa, '/stats'));
      const t = sent(calls)[0].payload.text;
      expect(t).toContain('Тренировок всего: <b>2</b>'); expect(t).toContain('Подтягивания: <b>8</b>'); expect(t).toContain('Отжимания: <b>20</b>');
    });
    it('/today, /progress and /settings', async () => {
      await bot.handleUpdate(command(isa, '/today'));
      await bot.handleUpdate(command(isa, '/progress'));
      await bot.handleUpdate(command(isa, '/settings'));
      const [today, progress, settings] = sent(calls).map(c => c.payload);
      expect(today.text).toContain('Сегодня'); expect(today.reply_markup.inline_keyboard[0][0].web_app.url).toBe(WEBAPP + '?screen=train');
      expect(progress.text).toContain('Сила за 30 дней');
      expect(settings.text).toContain('Аккаунт: <b>Isa</b> (@isa_fit)'); expect(settings.text).toContain('Europe/Istanbul');
    });
    it('/reminder lists reminders; the inline button switches Telegram reminders and syncs the change', async () => {
      await bot.handleUpdate(command(isa, '/reminder'));
      expect(sent(calls)[0].payload.text).toContain('18:00 · Тренировка · каждый день');
      const before = (await db.getRecord(pool, userId, 'settings', 'settings'))!;
      await bot.handleUpdate(callback(isa, 'rem:off'));
      const after = (await db.getRecord(pool, userId, 'settings', 'settings'))!;
      expect((after.d as any).bot.reminders).toBe(false);
      expect(after.u).toBeGreaterThan(before.u); expect(after.rev!).toBeGreaterThan(before.rev!);   // every device will pull it
      expect(calls.some(c => c.method === 'answerCallbackQuery')).toBe(true);
      expect(calls.find(c => c.method === 'editMessageText')!.payload.text).toContain('выключены');
      await bot.handleUpdate(callback(isa, 'rem:on'));
      expect(((await db.getRecord(pool, userId, 'settings', 'settings'))!.d as any).bot.reminders).toBe(true);
    });
    it('never shows personal data in group chats', async () => {
      await bot.handleUpdate(command(isa, '/stats', { id: -100500, type: 'group', title: 'Gym' }));
      const t = sent(calls)[0].payload.text;
      expect(t).toContain('личные'); expect(t).not.toContain('Тренировок');
    });
    it('reminders: sent once per local day at the right local time, skipped after a workout, stop when blocked', async () => {
      const now = new Date('2026-03-04T15:01:00Z');                 // 18:01 in Istanbul
      expect(zoned('Europe/Istanbul', now).hm).toBe('18:01');
      const r1 = await reminderTick(bot.api, pool, { now, webAppUrl: WEBAPP });
      expect(r1).toMatchObject({ due: 1, sent: 1 });
      const msg = sent(calls)[0].payload;
      expect(msg.chat_id).toBe(isa.id); expect(msg.text).toContain('Время тренировки');
      expect(msg.reply_markup.inline_keyboard[0][0].web_app.url).toBe(WEBAPP + '?screen=train');
      const r2 = await reminderTick(bot.api, pool, { now: new Date('2026-03-04T15:02:00Z'), webAppUrl: WEBAPP });
      expect(r2.sent).toBe(0);                                         // no duplicates
      await db.pushRecords(pool, userId, [{ c: 'sessions', id: 'c', u: 2000, d: sess('c', '2026-03-05', [['pullup', [5]]]) }], 'test');
      const r3 = await reminderTick(bot.api, pool, { now: new Date('2026-03-05T15:00:00Z'), webAppUrl: WEBAPP });
      expect(r3).toMatchObject({ sent: 0, skipped: 1 });              // trained already that day
      blocked.add(isa.id);
      const r4 = await reminderTick(bot.api, pool, { now: new Date('2026-03-06T15:00:00Z'), webAppUrl: WEBAPP });
      expect(r4.blocked).toBe(1);
      expect((await db.getUserByTelegram(pool, isa.id))!.bot_blocked_at).toBeTruthy();
      expect((await db.reminderTargets(pool)).length).toBe(0);
      blocked.delete(isa.id);
      await bot.handleUpdate(command(isa, '/start'));                 // the user is back: reminders resume
      expect((await db.reminderTargets(pool)).length).toBe(1);
    });
  });
});
