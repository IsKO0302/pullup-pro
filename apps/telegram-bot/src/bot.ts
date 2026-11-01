/* ================= PULLUP PRO Telegram bot (grammY) =================
 * Commands: /start /app /help /today /stats /progress /reminder /settings /privacy; Mini App button; account linking for the web/PWA.
 * Personal data is shown only in private chats and only for the Telegram account that owns it. */
import { Bot, InlineKeyboard, type Context } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';
import type pg from 'pg';
import * as db from '@pullup/db';
import { recordsToState, type AppState, type Collection } from '@pullup/shared';
import { zoned } from './tz';
import { LINK_MSG, NO_ACCOUNT, NO_WEBAPP, PRIVATE_ONLY, SERVICE_DOWN, localized, progressText, remindersText, settingsText, statsText, todayText } from './texts';

export interface BotDeps { pool: pg.Pool; webAppUrl: string | null; defaultTz?: string; now?: () => Date; log?: (msg: string, err?: unknown) => void }

export const COMMANDS_RU = [
  { command: 'start', description: 'Запуск PULLUP PRO' }, { command: 'app', description: 'Открыть приложение' }, { command: 'today', description: 'Миссия и тренировка на сегодня' },
  { command: 'stats', description: 'Статистика тренировок' }, { command: 'progress', description: 'Неделя и изменения силы' },
  { command: 'reminder', description: 'Напоминания' }, { command: 'settings', description: 'Аккаунт и настройки' },
  { command: 'privacy', description: 'Конфиденциальность' }, { command: 'help', description: 'Справка' }
];
export const COMMANDS_EN = [
  { command: 'start', description: 'Start PULLUP PRO' }, { command: 'app', description: 'Open the app' }, { command: 'today', description: "Today's mission and workout" },
  { command: 'stats', description: 'Workout statistics' }, { command: 'progress', description: 'Weekly progress and strength changes' },
  { command: 'reminder', description: 'Reminders' }, { command: 'settings', description: 'Account and settings' },
  { command: 'privacy', description: 'Privacy information' }, { command: 'help', description: 'Help' }
];

export const COMMANDS_TR = [
  { command: 'start', description: 'PULLUP PRO’yu başlat' }, { command: 'app', description: 'Uygulamayı aç' }, { command: 'today', description: 'Bugünün görevi ve antrenmanı' },
  { command: 'stats', description: 'Antrenman istatistikleri' }, { command: 'progress', description: 'Hafta ve kuvvet değişimleri' }, { command: 'reminder', description: 'Hatırlatmalar' },
  { command: 'settings', description: 'Hesap ve ayarlar' }, { command: 'privacy', description: 'Gizlilik bilgisi' }, { command: 'help', description: 'Yardım' }
];

/** Mini App URL with a deep-link screen (?screen=train → the app opens #/train) */
export function screenUrl(base: string, screen?: string): string {
  if (!screen) return base;
  const u = new URL(base); u.searchParams.set('screen', screen); return u.toString();
}
/** a web_app button needs HTTPS (Telegram requirement); without it no button is shown */
export function appButton(kb: InlineKeyboard, webAppUrl: string | null, text: string, screen?: string): InlineKeyboard {
  if (webAppUrl && webAppUrl.startsWith('https://')) kb.webApp(text, screenUrl(webAppUrl, screen));
  return kb;
}

export function createBot(token: string, deps: BotDeps, opts: { botInfo?: UserFromGetMe } = {}): Bot {
  const bot = new Bot(token, opts.botInfo ? { botInfo: opts.botInfo } : {});
  const now = deps.now || (() => new Date()), log = deps.log || ((m: string, e?: unknown) => console.error(`[bot] ${m}`, e ?? ''));
  const hasApp = !!(deps.webAppUrl && deps.webAppUrl.startsWith('https://'));
  const profileOf = (ctx: Context): db.TgProfile => ({ id: ctx.from!.id, username: ctx.from!.username, first_name: ctx.from!.first_name, last_name: ctx.from!.last_name, language_code: ctx.from!.language_code });
  const html = { parse_mode: 'HTML' as const, link_preview_options: { is_disabled: true } };

  const welcomeKb = () => {
    const kb = appButton(new InlineKeyboard(), deps.webAppUrl, 'OPEN PULLUP PRO');
    if (hasApp) kb.row();
    return kb.text('📅 Сегодня', 'cmd:today').text('📊 Статистика', 'cmd:stats');
  };
  /** the user's synced state, or null when the account / data does not exist yet */
  async function stateOf(ctx: Context, cols?: Collection[]): Promise<{ user: db.DbUser; S: AppState; zone: string; today: string } | null> {
    const user = await db.getUserByTelegram(deps.pool, ctx.from!.id);
    if (!user) return null;
    const recs = await db.liveRecords(deps.pool, user.id, cols);
    if (!recs.length) return null;
    const S = recordsToState(recs), z = zoned(S.profile.timezone, now(), deps.defaultTz || 'UTC');
    return { user, S, zone: z.zone, today: z.day };
  }
  const noData = (ctx: Context) => ctx.reply(NO_ACCOUNT, { ...html, reply_markup: appButton(new InlineKeyboard(), deps.webAppUrl, 'Открыть настройки', 'settings') });
  /** private chats only: never show personal statistics in groups */
  const guard = (fn: (ctx: Context) => Promise<unknown>) => async (ctx: Context) => {
    if (!ctx.from) return;
    if (ctx.chat && ctx.chat.type !== 'private') { await ctx.reply(PRIVATE_ONLY); return; }
    try { await fn(ctx); } catch (e) { log('handler failed', e); try { await ctx.reply(SERVICE_DOWN); } catch { /* chat unavailable */ } }
  };

  const start = guard(async ctx => {
    const payload = String(ctx.match || '').trim();
    await db.markBotStarted(deps.pool, profileOf(ctx));
    if (/^link_[A-Za-z0-9]{4,16}$/.test(payload)) {
      const r = await db.claimLinkCode(deps.pool, payload.slice(5), profileOf(ctx));
      await ctx.reply(LINK_MSG[r], { ...html, reply_markup: r === 'ok' ? undefined : appButton(new InlineKeyboard(), deps.webAppUrl, 'Открыть PULLUP PRO', 'settings') });
      return;
    }
    await ctx.reply(localized('WELCOME', ctx.from?.language_code) + (hasApp ? '' : '\n\n' + NO_WEBAPP), { ...html, reply_markup: welcomeKb() });
  });
  const help = guard(async ctx => { await ctx.reply(localized('HELP', ctx.from?.language_code), { ...html, reply_markup: appButton(new InlineKeyboard(), deps.webAppUrl, 'OPEN PULLUP PRO') }); });
  const today = guard(async ctx => {
    const x = await stateOf(ctx); if (!x) return void (await noData(ctx));
    await ctx.reply(todayText(x.S, x.today), { ...html, reply_markup: appButton(new InlineKeyboard(), deps.webAppUrl, '▶ Открыть тренировку', 'train') });
  });
  const stats = guard(async ctx => {
    const x = await stateOf(ctx); if (!x) return void (await noData(ctx));
    await ctx.reply(statsText(x.S, x.today), { ...html, reply_markup: appButton(new InlineKeyboard(), deps.webAppUrl, 'Подробная статистика', 'stats').row().text('📈 Прогресс', 'cmd:progress') });
  });
  const progress = guard(async ctx => {
    const x = await stateOf(ctx); if (!x) return void (await noData(ctx));
    await ctx.reply(progressText(x.S, x.today), { ...html, reply_markup: appButton(new InlineKeyboard(), deps.webAppUrl, 'Недельный отчёт', 'report') });
  });
  const remKb = (on: boolean) => appButton(new InlineKeyboard().text(on ? '🔕 Выключить в Telegram' : '🔔 Включить в Telegram', on ? 'rem:off' : 'rem:on').row(), deps.webAppUrl, '⚙️ Настроить время', 'settings');
  const reminder = guard(async ctx => {
    const x = await stateOf(ctx, ['profile', 'settings', 'reminders']); if (!x) return void (await noData(ctx));
    await ctx.reply(remindersText(x.S, x.zone), { ...html, reply_markup: remKb(!!x.S.settings.bot?.reminders) });
  });
  const settings = guard(async ctx => {
    const x = await stateOf(ctx); if (!x) return void (await noData(ctx));
    const lc = await db.lastChange(deps.pool, x.user.id), pu = db.publicUser(x.user);
    await ctx.reply(settingsText(x.S, { name: pu.name, username: x.user.username, photosConsent: x.user.photos_consent, lastChangeAt: lc.at, records: lc.records }, x.zone),
      { ...html, reply_markup: appButton(new InlineKeyboard(), deps.webAppUrl, '⚙️ Открыть настройки', 'settings') });
  });
  const app = guard(async ctx => { await ctx.reply(localized('APP_MSG', ctx.from?.language_code) + (hasApp ? '' : '\n\n' + NO_WEBAPP), { ...html, reply_markup: appButton(new InlineKeyboard(), deps.webAppUrl, 'OPEN PULLUP PRO') }); });
  const privacy = guard(async ctx => { await ctx.reply(localized('PRIVACY', ctx.from?.language_code), { ...html, reply_markup: appButton(new InlineKeyboard(), deps.webAppUrl, '⚙️ Настройки и данные', 'settings') }); });
  const HANDLERS: Record<string, (ctx: Context) => Promise<void>> = { app, today, stats, progress, reminder, settings, privacy, help };

  bot.command('start', start);
  bot.command('app', app);
  bot.command('privacy', privacy);
  bot.command('help', help);
  bot.command('today', today);
  bot.command('stats', stats);
  bot.command('progress', progress);
  bot.command(['reminder', 'reminders'], reminder);
  bot.command('settings', settings);

  bot.callbackQuery(/^cmd:(app|today|stats|progress|reminder|settings|privacy|help)$/, async ctx => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    await HANDLERS[ctx.match[1]](ctx);
  });
  bot.callbackQuery(/^rem:(on|off)$/, guard(async ctx => {
    const on = ctx.match![1] === 'on';
    const user = await db.getUserByTelegram(deps.pool, ctx.from!.id);
    const rec = user ? await db.getRecord(deps.pool, user.id, 'settings', 'settings') : null;
    if (!user || !rec) { await ctx.answerCallbackQuery({ text: 'Сначала включите синхронизацию в приложении', show_alert: true }); return; }
    const d = (rec.d && typeof rec.d === 'object' ? rec.d : {}) as Record<string, unknown>;
    await db.putServerRecord(deps.pool, user.id, 'settings', 'settings', { ...d, bot: { ...((d.bot as object) || {}), reminders: on } });
    await ctx.answerCallbackQuery({ text: on ? 'Напоминания включены' : 'Напоминания выключены' });
    const x = await stateOf(ctx, ['profile', 'settings', 'reminders']);
    if (x) await ctx.editMessageText(remindersText(x.S, x.zone), { ...html, reply_markup: remKb(on) }).catch(() => undefined);
  }));
  // the user blocked / unblocked the bot: reminders stop / may resume
  bot.on('my_chat_member', async ctx => {
    try {
      const st = ctx.myChatMember.new_chat_member.status;
      if (ctx.chat.type !== 'private') return;
      if (st === 'kicked') { const u = await db.getUserByTelegram(deps.pool, ctx.from.id); if (u) await db.markBotBlocked(deps.pool, u.id); }
      else if (st === 'member') await db.markBotStarted(deps.pool, profileOf(ctx));
    } catch (e) { log('my_chat_member failed', e); }
  });
  bot.chatType('private').on('message', async ctx => {
    await ctx.reply('Используйте команды: /app, /today, /stats, /progress, /reminder, /settings, /privacy или /help.', { reply_markup: appButton(new InlineKeyboard(), deps.webAppUrl, 'OPEN PULLUP PRO') });
  });
  bot.catch(err => log(`update ${err.ctx?.update?.update_id} failed`, err.error));
  return bot;
}

/** commands, menu button (opens the Mini App) and descriptions — called once at start-up */
export async function setupBotProfile(bot: Bot, webAppUrl: string | null, log: (m: string) => void = console.log): Promise<void> {
  const tryIt = async (name: string, f: () => Promise<unknown>) => { try { await f(); } catch (e) { log(`[bot] ${name} failed: ${(e as Error).message}`); } };
  await tryIt('setMyCommands(ru)', () => bot.api.setMyCommands(COMMANDS_RU, { language_code: 'ru' }));
  await tryIt('setMyCommands(tr)', () => bot.api.setMyCommands(COMMANDS_TR, { language_code: 'tr' }));
  await tryIt('setMyDescription(tr)', () => bot.api.setMyDescription('PULLUP PRO — kişisel fitness koçu: planlı antrenmanlar, Muscle-Up, istatistikler, vücut ilerlemesi ve hatırlatmalar.', { language_code: 'tr' }));
  await tryIt('setMyCommands', () => bot.api.setMyCommands(COMMANDS_EN));
  await tryIt('setMyShortDescription', () => bot.api.setMyShortDescription('PULLUP PRO — your personal fitness journey starts here.'));
  await tryIt('setMyDescription(ru)', () => bot.api.setMyDescription('PULLUP PRO — персональный фитнес-тренер: тренировки по плану, Muscle-Up, статистика, прогресс тела и напоминания.', { language_code: 'ru' }));
  if (webAppUrl && webAppUrl.startsWith('https://')) await tryIt('setChatMenuButton', () => bot.api.setChatMenuButton({ menu_button: { type: 'web_app', text: 'PULLUP PRO', web_app: { url: webAppUrl } } }));
  else log('[bot] WEBAPP_URL is not an https:// URL — the Mini App button is disabled');
}
