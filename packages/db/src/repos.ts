/* ================= Repositories: users, sessions, link codes, synced records, photos, reminders ================= */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type pg from 'pg';
import { tx } from './pool';
import type { Collection, SyncRecord } from '@pullup/shared';

type Db = pg.Pool | pg.PoolClient;

export interface DbUser {
  id: string; telegram_id: number | null; username: string | null; first_name: string | null; last_name: string | null;
  language_code: string | null; photos_consent: boolean; photos_consent_at: Date | null; rev: number;
  bot_started_at: Date | null; bot_blocked_at: Date | null; created_at: Date; updated_at: Date; last_seen_at: Date | null;
}
export interface TgProfile { id: number; username?: string; first_name?: string; last_name?: string; language_code?: string }
export interface PublicUser { id: string; name: string; telegramId: number | null; username: string | null; photosConsent: boolean; createdAt: string }

export const sha256 = (s: string | Buffer): Buffer => createHash('sha256').update(s).digest();
export const newToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');
const sameHash = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

export const publicUser = (u: DbUser): PublicUser => ({
  id: u.id,
  name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'ISA',
  telegramId: u.telegram_id, username: u.username, photosConsent: u.photos_consent,
  createdAt: new Date(u.created_at).toISOString()
});

/* ---------- users ---------- */
export async function upsertTelegramUser(db: Db, p: TgProfile): Promise<DbUser> {
  const r = await db.query(
    `INSERT INTO users (telegram_id, username, first_name, last_name, language_code, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (telegram_id) DO UPDATE SET username = EXCLUDED.username, first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name, language_code = COALESCE(EXCLUDED.language_code, users.language_code),
       last_seen_at = now(), updated_at = now()
     RETURNING *`,
    [p.id, p.username ?? null, p.first_name ?? null, p.last_name ?? null, p.language_code ?? null]);
  return r.rows[0];
}
export async function getUser(db: Db, id: string): Promise<DbUser | null> {
  const r = await db.query('SELECT * FROM users WHERE id = $1', [id]); return r.rows[0] || null;
}
export async function getUserByTelegram(db: Db, telegramId: number): Promise<DbUser | null> {
  const r = await db.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]); return r.rows[0] || null;
}
/** /start in the bot: remember that the bot may write to this user */
export async function markBotStarted(db: Db, p: TgProfile): Promise<DbUser> {
  const u = await upsertTelegramUser(db, p);
  const r = await db.query('UPDATE users SET bot_started_at = COALESCE(bot_started_at, now()), bot_blocked_at = NULL WHERE id = $1 RETURNING *', [u.id]);
  return r.rows[0];
}
export async function markBotBlocked(db: Db, userId: string): Promise<void> {
  await db.query('UPDATE users SET bot_blocked_at = now() WHERE id = $1', [userId]);
}
/** photo storage consent; revoking it deletes every stored photo of the user */
export async function setPhotoConsent(pool: pg.Pool, userId: string, on: boolean): Promise<DbUser> {
  return tx(pool, async c => {
    const r = await c.query('UPDATE users SET photos_consent = $2, photos_consent_at = CASE WHEN $2 THEN now() ELSE NULL END, updated_at = now() WHERE id = $1 RETURNING *', [userId, on]);
    if (!on) await c.query('DELETE FROM photos WHERE user_id = $1', [userId]);
    return r.rows[0];
  });
}
/** full account deletion (records, photos, sessions, reminder log cascade) */
export async function deleteUser(db: Db, userId: string): Promise<boolean> {
  const r = await db.query('DELETE FROM users WHERE id = $1', [userId]); return (r.rowCount || 0) > 0;
}

/* ---------- sessions ---------- */
export async function createSession(db: Db, userId: string, via: 'telegram' | 'link', deviceId: string | null, ttlDays: number): Promise<{ token: string; exp: number }> {
  const token = newToken(), exp = Date.now() + ttlDays * 86_400_000;
  await db.query('INSERT INTO auth_sessions (token_hash, user_id, via, device_id, expires_at) VALUES ($1, $2, $3, $4, $5)',
    [sha256(token), userId, via, deviceId ? deviceId.slice(0, 80) : null, new Date(exp)]);
  return { token, exp };
}
export async function sessionUser(db: Db, token: string): Promise<DbUser | null> {
  if (!token || token.length > 200) return null;
  const h = sha256(token);
  const r = await db.query('SELECT u.* FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()', [h]);
  if (!r.rows[0]) return null;
  await db.query(`UPDATE auth_sessions SET last_used_at = now() WHERE token_hash = $1 AND (last_used_at IS NULL OR last_used_at < now() - interval '5 minutes')`, [h]);
  return r.rows[0];
}
export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.query('DELETE FROM auth_sessions WHERE token_hash = $1', [sha256(token)]);
}
export async function purgeExpired(db: Db): Promise<{ sessions: number; codes: number }> {
  const a = await db.query('DELETE FROM auth_sessions WHERE expires_at < now()');
  const b = await db.query(`DELETE FROM link_codes WHERE expires_at < now() - interval '1 day'`);
  return { sessions: a.rowCount || 0, codes: b.rowCount || 0 };
}

/* ---------- link codes (browser / PWA ⇄ Telegram account through the bot) ---------- */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 symbols, no 0/O/1/I
export function newLinkCode(len = 8): string {
  const b = randomBytes(len); let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[b[i] & 31];
  return s;
}
export const normalizeLinkCode = (code: string): string => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);

export async function createLinkCode(db: Db, deviceId: string | null, ttlMinutes = 10): Promise<{ code: string; secret: string; expiresAt: number }> {
  const secret = newToken(24), expiresAt = Date.now() + ttlMinutes * 60_000;
  for (let i = 0; i < 6; i++) {
    const code = newLinkCode();
    const r = await db.query('INSERT INTO link_codes (code, secret_hash, device_id, expires_at) VALUES ($1, $2, $3, $4) ON CONFLICT (code) DO NOTHING RETURNING code',
      [code, sha256(secret), deviceId ? deviceId.slice(0, 80) : null, new Date(expiresAt)]);
    if (r.rows[0]) return { code, secret, expiresAt };
  }
  throw new Error('could not allocate a link code');
}
export type ClaimResult = 'ok' | 'not_found' | 'expired' | 'used';
/** called by the bot on /start link_<code> */
export async function claimLinkCode(db: Db, rawCode: string, p: TgProfile): Promise<ClaimResult> {
  const code = normalizeLinkCode(rawCode);
  const r = await db.query(`UPDATE link_codes SET status = 'claimed', telegram_id = $2, tg_profile = $3, claimed_at = now()
    WHERE code = $1 AND status = 'pending' AND expires_at > now() RETURNING code`, [code, p.id, JSON.stringify(p)]);
  if (r.rows[0]) return 'ok';
  const x = (await db.query('SELECT status, telegram_id, expires_at FROM link_codes WHERE code = $1', [code])).rows[0];
  if (!x) return 'not_found';
  if (x.status === 'claimed' && Number(x.telegram_id) === p.id) return 'ok';
  if (x.status === 'pending') return 'expired';
  return 'used';
}
export type PollResult = { status: 'pending' | 'expired' | 'invalid' } | { status: 'ok'; profile: TgProfile; deviceId: string | null };
/** called by the browser that created the code (proves possession of the secret); one-time */
export async function pollLinkCode(pool: pg.Pool, rawCode: string, secret: string): Promise<PollResult> {
  const code = normalizeLinkCode(rawCode);
  return tx(pool, async c => {
    const x = (await c.query('SELECT * FROM link_codes WHERE code = $1 FOR UPDATE', [code])).rows[0];
    if (!x || !secret || !sameHash(sha256(secret), x.secret_hash)) return { status: 'invalid' as const };
    if (x.status === 'pending') return { status: new Date(x.expires_at).getTime() > Date.now() ? 'pending' as const : 'expired' as const };
    if (x.status === 'used') return { status: 'expired' as const };
    await c.query(`UPDATE link_codes SET status = 'used' WHERE code = $1`, [code]);
    return { status: 'ok' as const, profile: x.tg_profile as TgProfile, deviceId: x.device_id };
  });
}

/* ---------- synced records (last-writer-wins by `u`, server revision `rev`) ---------- */
export interface PushResult { accepted: { c: Collection; id: string; rev: number }[]; conflicts: SyncRecord[]; rev: number }
const toRecord = (r: any): SyncRecord => ({ c: r.c, id: r.id, u: Number(r.u), rev: Number(r.rev), ...(r.del ? { del: true } : { d: r.d }) });

export async function pushRecords(pool: pg.Pool, userId: string, input: SyncRecord[], deviceId?: string | null): Promise<PushResult> {
  // de-duplicate inside the batch: the newest version of a key wins
  const byKey = new Map<string, SyncRecord>();
  for (const r of input) { const k = r.c + '\u0001' + r.id, o = byKey.get(k); if (!o || r.u >= o.u) byKey.set(k, r); }
  const recs = [...byKey.values()];
  return tx(pool, async c => {
    const u0 = (await c.query('SELECT rev FROM users WHERE id = $1 FOR UPDATE', [userId])).rows[0];
    if (!u0) throw Object.assign(new Error('user not found'), { statusCode: 401 });
    let rev = Number(u0.rev);
    const ex = new Map<string, any>();
    if (recs.length) {
      const q = await c.query('SELECT c, id, u, rev, del, d FROM records WHERE user_id = $1 AND (c, id) IN (SELECT * FROM unnest($2::text[], $3::text[]))',
        [userId, recs.map(r => r.c), recs.map(r => r.id)]);
      for (const row of q.rows) ex.set(row.c + '\u0001' + row.id, row);
    }
    const accepted: PushResult['accepted'] = [], conflicts: SyncRecord[] = [], w: (SyncRecord & { rev: number })[] = [];
    for (const r of recs) {
      const e = ex.get(r.c + '\u0001' + r.id);
      if (e && Number(e.u) > r.u) { conflicts.push(toRecord(e)); continue; }                       // server has a newer version
      if (e && Number(e.u) === r.u && !!e.del === !!r.del) { accepted.push({ c: r.c, id: r.id, rev: Number(e.rev) }); continue; } // idempotent re-push
      rev += 1; w.push({ ...r, rev }); accepted.push({ c: r.c, id: r.id, rev });
    }
    if (w.length) {
      await c.query(
        `INSERT INTO records (user_id, c, id, u, rev, del, d, device_id, updated_at)
         SELECT $1, x.c, x.id, x.u, x.rev, x.del, x.d, $8, now()
         FROM unnest($2::text[], $3::text[], $4::bigint[], $5::bigint[], $6::boolean[], $7::jsonb[]) AS x(c, id, u, rev, del, d)
         ON CONFLICT (user_id, c, id) DO UPDATE SET u = EXCLUDED.u, rev = EXCLUDED.rev, del = EXCLUDED.del, d = EXCLUDED.d,
           device_id = EXCLUDED.device_id, updated_at = now()`,
        [userId, w.map(r => r.c), w.map(r => r.id), w.map(r => r.u), w.map(r => r.rev), w.map(r => !!r.del),
          w.map(r => (r.del ? null : JSON.stringify(r.d === undefined ? null : r.d))), deviceId ? deviceId.slice(0, 80) : null]);
      await c.query('UPDATE users SET rev = $2, updated_at = now(), last_seen_at = now() WHERE id = $1', [userId, rev]);
    }
    return { accepted, conflicts, rev };
  });
}

export async function pullRecords(db: Db, userId: string, since: number, limit: number): Promise<{ records: SyncRecord[]; rev: number; more: boolean }> {
  const q = await db.query('SELECT c, id, u, rev, del, d FROM records WHERE user_id = $1 AND rev > $2 ORDER BY rev LIMIT $3', [userId, since, limit + 1]);
  const more = q.rows.length > limit, rows = q.rows.slice(0, limit);
  if (rows.length) return { records: rows.map(toRecord), rev: Number(rows[rows.length - 1].rev), more };
  const u = (await db.query('SELECT rev FROM users WHERE id = $1', [userId])).rows[0];
  return { records: [], rev: Math.max(since, u ? Number(u.rev) : 0), more: false };
}

/** all live (non-deleted) records of a user, e.g. to rebuild the app state for the bot or for export */
export async function liveRecords(db: Db, userId: string, collections?: Collection[]): Promise<SyncRecord[]> {
  const q = collections && collections.length
    ? await db.query('SELECT c, id, u, rev, del, d FROM records WHERE user_id = $1 AND NOT del AND c = ANY($2::text[]) ORDER BY c, id', [userId, collections])
    : await db.query('SELECT c, id, u, rev, del, d FROM records WHERE user_id = $1 AND NOT del ORDER BY c, id', [userId]);
  return q.rows.map(toRecord);
}

/** server-side change of one record (bot commands); bumps the revision so every device pulls it */
export async function putServerRecord(pool: pg.Pool, userId: string, c: Collection, id: string, d: unknown): Promise<number> {
  return tx(pool, async cl => {
    const u0 = (await cl.query('SELECT rev FROM users WHERE id = $1 FOR UPDATE', [userId])).rows[0];
    if (!u0) throw new Error('user not found');
    const e = (await cl.query('SELECT u FROM records WHERE user_id = $1 AND c = $2 AND id = $3', [userId, c, id])).rows[0];
    const rev = Number(u0.rev) + 1, u = Math.max(Date.now(), e ? Number(e.u) + 1 : 0);
    await cl.query(`INSERT INTO records (user_id, c, id, u, rev, del, d, device_id) VALUES ($1, $2, $3, $4, $5, false, $6, 'server')
      ON CONFLICT (user_id, c, id) DO UPDATE SET u = EXCLUDED.u, rev = EXCLUDED.rev, del = false, d = EXCLUDED.d, device_id = 'server', updated_at = now()`,
      [userId, c, id, u, rev, JSON.stringify(d)]);
    await cl.query('UPDATE users SET rev = $2, updated_at = now() WHERE id = $1', [userId, rev]);
    return rev;
  });
}

/* ---------- photos (only with consent; checked by the API) ---------- */
export async function putPhoto(db: Db, userId: string, id: string, mime: string, data: Buffer): Promise<void> {
  await db.query(`INSERT INTO photos (user_id, id, mime, size, sha256, data) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (user_id, id) DO UPDATE SET mime = EXCLUDED.mime, size = EXCLUDED.size, sha256 = EXCLUDED.sha256, data = EXCLUDED.data, created_at = now()`,
    [userId, id, mime, data.length, sha256(data), data]);
}
export async function getPhoto(db: Db, userId: string, id: string): Promise<{ mime: string; data: Buffer; size: number; sha256: Buffer } | null> {
  const r = await db.query('SELECT mime, data, size, sha256 FROM photos WHERE user_id = $1 AND id = $2', [userId, id]); return r.rows[0] || null;
}
export async function deletePhoto(db: Db, userId: string, id: string): Promise<boolean> {
  const r = await db.query('DELETE FROM photos WHERE user_id = $1 AND id = $2', [userId, id]); return (r.rowCount || 0) > 0;
}
export async function photoStats(db: Db, userId: string): Promise<{ count: number; bytes: number }> {
  const r = await db.query('SELECT count(*)::int AS count, COALESCE(sum(size), 0)::bigint AS bytes FROM photos WHERE user_id = $1', [userId]);
  return { count: r.rows[0].count, bytes: Number(r.rows[0].bytes) };
}
export async function listPhotos(db: Db, userId: string): Promise<{ id: string; mime: string; size: number; createdAt: string }[]> {
  const r = await db.query('SELECT id, mime, size, created_at FROM photos WHERE user_id = $1 ORDER BY created_at', [userId]);
  return r.rows.map(x => ({ id: x.id, mime: x.mime, size: x.size, createdAt: new Date(x.created_at).toISOString() }));
}

/* ---------- Telegram reminders ---------- */
export interface ReminderTarget { userId: string; telegramId: number; settings: any; profile: any; reminders: any[] }
/** users with a Telegram account, bot reminders switched on in the synced settings and at least one reminder */
export async function reminderTargets(db: Db): Promise<ReminderTarget[]> {
  const q = await db.query(
    `SELECT u.id, u.telegram_id, s.d AS settings, p.d AS profile,
            COALESCE(json_agg(r.d) FILTER (WHERE r.id IS NOT NULL), '[]') AS reminders
     FROM users u
     JOIN records s ON s.user_id = u.id AND s.c = 'settings' AND s.id = 'settings' AND NOT s.del
     LEFT JOIN records p ON p.user_id = u.id AND p.c = 'profile' AND p.id = 'profile' AND NOT p.del
     JOIN records r ON r.user_id = u.id AND r.c = 'reminders' AND NOT r.del
     WHERE u.telegram_id IS NOT NULL AND u.bot_blocked_at IS NULL AND (s.d -> 'bot' ->> 'reminders') = 'true'
     GROUP BY u.id, u.telegram_id, s.d, p.d`);
  return q.rows.map(x => ({ userId: x.id, telegramId: Number(x.telegram_id), settings: x.settings, profile: x.profile || {}, reminders: x.reminders || [] }));
}
/** true when this reminder was not yet sent for that local day (and records it) */
export async function logReminder(db: Db, userId: string, reminderId: string, localDay: string): Promise<boolean> {
  const r = await db.query('INSERT INTO reminder_log (user_id, reminder_id, local_day) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING 1', [userId, reminderId, localDay]);
  return !!r.rows[0];
}
export async function unlogReminder(db: Db, userId: string, reminderId: string, localDay: string): Promise<void> {
  await db.query('DELETE FROM reminder_log WHERE user_id = $1 AND reminder_id = $2 AND local_day = $3', [userId, reminderId, localDay]);
}

/** true when a workout (not a quick "+N" entry) is logged for that day — the workout reminder is skipped then */
export async function hasWorkoutOn(db: Db, userId: string, day: string): Promise<boolean> {
  const r = await db.query(`SELECT 1 FROM records WHERE user_id = $1 AND c = 'sessions' AND NOT del AND d ->> 'date' = $2
    AND COALESCE(d ->> 'source', '') <> 'quick' LIMIT 1`, [userId, day]);
  return !!r.rows[0];
}
/** one live record (bot: read-modify-write of the synced settings) */
export async function getRecord(db: Db, userId: string, c: Collection, id: string): Promise<SyncRecord | null> {
  const r = await db.query('SELECT c, id, u, rev, del, d FROM records WHERE user_id = $1 AND c = $2 AND id = $3 AND NOT del', [userId, c, id]);
  return r.rows[0] ? toRecord(r.rows[0]) : null;
}
/** last time any record of the user changed (bot /settings) */
export async function lastChange(db: Db, userId: string): Promise<{ at: string | null; records: number }> {
  const r = await db.query('SELECT max(updated_at) AS at, count(*) FILTER (WHERE NOT del)::int AS n FROM records WHERE user_id = $1', [userId]);
  return { at: r.rows[0].at ? new Date(r.rows[0].at).toISOString() : null, records: r.rows[0].n };
}

/* ---------- export ---------- */
export async function exportUser(db: Db, userId: string) {
  const u = await getUser(db, userId); if (!u) return null;
  return { format: 'pullup-pro-cloud-export', version: 1, exportedAt: new Date().toISOString(), user: publicUser(u), records: await liveRecords(db, userId), photos: await listPhotos(db, userId) };
}
