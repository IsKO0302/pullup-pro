/* ================= Telegram reminders =================
 * Every minute: users with Telegram, bot reminders switched on (synced settings.bot.reminders) and enabled reminders.
 * A reminder fires once per local day, within `windowMin` minutes after its time, in the user's time zone
 * (profile.timezone written by the app). The workout reminder is skipped when a workout is already logged that day. */
import { GrammyError, InlineKeyboard, type Api } from 'grammy';
import type pg from 'pg';
import * as db from '@pullup/db';
import { recordsToState, type Reminder } from '@pullup/shared';
import { hmToMin, zoned } from './tz';
import { REMINDER_SCREEN, reminderMessage } from './texts';
import { appButton } from './bot';

export interface DueReminder { userId: string; telegramId: number; reminder: Reminder; day: string; zone: string }
export function dueReminders(targets: db.ReminderTarget[], now: Date, windowMin = 5, defaultTz = 'UTC'): DueReminder[] {
  const out: DueReminder[] = [];
  for (const t of targets) {
    const z = zoned(t.profile && t.profile.timezone, now, defaultTz);
    for (const r of (t.reminders || []) as Reminder[]) {
      if (!r || !r.enabled || typeof r.id !== 'string' || !Array.isArray(r.days) || !r.days.includes(z.wd)) continue;
      const tm = hmToMin(r.time);
      if (tm < 0 || z.minutes < tm || z.minutes >= tm + windowMin) continue;
      out.push({ userId: t.userId, telegramId: t.telegramId, reminder: r, day: z.day, zone: z.zone });
    }
  }
  return out;
}

export interface TickResult { due: number; sent: number; skipped: number; failed: number; blocked: number }
export interface TickOptions { now?: Date; windowMin?: number; defaultTz?: string; webAppUrl: string | null; pauseMs?: number; log?: (m: string, e?: unknown) => void }
export async function reminderTick(api: Api, pool: pg.Pool, o: TickOptions): Promise<TickResult> {
  const now = o.now || new Date(), res: TickResult = { due: 0, sent: 0, skipped: 0, failed: 0, blocked: 0 };
  const due = dueReminders(await db.reminderTargets(pool), now, o.windowMin ?? 5, o.defaultTz || 'UTC');
  res.due = due.length;
  for (const d of due) {
    if (!(await db.logReminder(pool, d.userId, d.reminder.id, d.day))) continue;          // already sent today
    if (d.reminder.kind === 'workout' && await db.hasWorkoutOn(pool, d.userId, d.day)) { res.skipped++; continue; }
    try {
      const S = d.reminder.kind === 'workout' ? recordsToState(await db.liveRecords(pool, d.userId, ['profile', 'engine', 'progress'])) : null;
      await api.sendMessage(d.telegramId, reminderMessage(d.reminder.kind, S), {
        parse_mode: 'HTML', reply_markup: appButton(new InlineKeyboard(), o.webAppUrl, 'Открыть PULLUP PRO', REMINDER_SCREEN[d.reminder.kind] || 'home')
      });
      res.sent++;
    } catch (e) {
      if (e instanceof GrammyError && (e.error_code === 403 || (e.error_code === 400 && /chat not found/i.test(e.description)))) {
        await db.markBotBlocked(pool, d.userId); res.blocked++;              // the user blocked the bot: stop sending
      } else {
        await db.unlogReminder(pool, d.userId, d.reminder.id, d.day); res.failed++;   // network / 429: retry next minute
        o.log?.('reminder send failed', e);
      }
    }
    if (o.pauseMs) await new Promise(r => setTimeout(r, o.pauseMs));
  }
  return res;
}

/** runs reminderTick at the start of every minute; returns a stop function */
export function startReminderLoop(api: Api, pool: pg.Pool, o: Omit<TickOptions, 'now'>): () => void {
  let timer: NodeJS.Timeout | undefined, running = false, stopped = false;
  const tick = async () => {
    if (running) return; running = true;
    try { const r = await reminderTick(api, pool, { ...o, pauseMs: o.pauseMs ?? 50 }); if (r.sent || r.failed || r.blocked) o.log?.(`reminders: sent ${r.sent}, skipped ${r.skipped}, failed ${r.failed}, blocked ${r.blocked}`); }
    catch (e) { o.log?.('reminder tick failed', e); }
    finally { running = false; }
  };
  const schedule = () => { if (stopped) return; timer = setTimeout(() => { void tick().finally(schedule); }, 60_000 - (Date.now() % 60_000) + 1_000); };
  schedule();
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}
