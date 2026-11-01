import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import * as db from '@pullup/db';
import { buildApp } from '../../apps/api/src/app';
import { signInitData } from '../../apps/api/src/telegram-auth';
import { TOKEN, freshPool, haveDb, testConfig } from './helpers';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
const alice = { id: 1001, first_name: 'Isa', username: 'isa_fit', language_code: 'ru' };
const bob = { id: 2002, first_name: 'Bob' };
const initData = (u: object, age = 5) => signInitData({ query_id: 'AAQ', user: u, auth_date: Math.floor(Date.now() / 1000) - age }, TOKEN);
const H = (t: string) => ({ authorization: 'Bearer ' + t });
const session = (id: string, date = '2026-03-02', extra = {}) => ({ id, date, items: [{ ex: 'pullup', sets: [{ reps: 5, done: true }] }], ...extra });

describe.skipIf(!haveDb)('API (Fastify + PostgreSQL)', () => {
  let pool: db.Pool, app: FastifyInstance, A: { token: string; user: any }, B: { token: string; user: any };
  const login = async (u: object) => {
    const r = await app.inject({ method: 'POST', url: '/api/auth/telegram', payload: { initData: initData(u), deviceId: 'dev-1' } });
    expect(r.statusCode, r.body).toBe(200); return r.json();
  };
  beforeAll(async () => { pool = await freshPool(); app = await buildApp(testConfig(), pool, { logger: false }); A = await login(alice); B = await login(bob); });
  afterAll(async () => { await app?.close(); await pool?.end(); });

  it('health and public config (no secrets)', async () => {
    expect((await app.inject('/api/health')).json()).toMatchObject({ ok: true, db: 'up' });
    const c = await app.inject('/api/config');
    expect(c.json()).toMatchObject({ botUsername: 'pullup_test_bot', webAppUrl: 'https://fit.example.org/', photos: true, telegramAuth: true });
    expect(c.body).not.toContain(TOKEN.split(':')[1]);
  });

  describe('Telegram sign-in', () => {
    it('valid initData creates a user and a session', () => {
      expect(A.user).toMatchObject({ telegramId: 1001, username: 'isa_fit', name: 'Isa' });
      expect(A.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    });
    it('rejects forged, expired and malformed initData', async () => {
      const forged = new URLSearchParams(initData(alice)); forged.set('user', JSON.stringify({ ...alice, id: 1 }));
      const r1 = await app.inject({ method: 'POST', url: '/api/auth/telegram', payload: { initData: forged.toString() } });
      expect(r1.statusCode).toBe(401); expect(r1.json().code).toBe('initdata_bad_hash');
      const r2 = await app.inject({ method: 'POST', url: '/api/auth/telegram', payload: { initData: initData(alice, 200_000) } });
      expect(r2.json().code).toBe('initdata_expired');
      const r3 = await app.inject({ method: 'POST', url: '/api/auth/telegram', payload: { nope: 1 } });
      expect(r3.statusCode).toBe(400);
    });
    it('protected routes need a valid session', async () => {
      expect((await app.inject('/api/sync/pull')).statusCode).toBe(401);
      expect((await app.inject({ url: '/api/sync/pull', headers: H('x'.repeat(43)) })).statusCode).toBe(401);
      expect((await app.inject({ url: '/api/account', headers: H(A.token) })).json().user.telegramId).toBe(1001);
    });
  });

  describe('sync', () => {
    let rev = 0;
    it('push → pull round trip', async () => {
      const r = await app.inject({ method: 'POST', url: '/api/sync/push', headers: H(A.token), payload: { deviceId: 'd1', records: [
        { c: 'sessions', id: 's1', u: 1000, d: session('s1') }, { c: 'profile', id: 'profile', u: 1000, d: { name: 'Isa', weeklyTarget: 3 } },
        { c: 'reminders', id: 'r1', u: 1000, d: { id: 'r1', kind: 'workout', time: '18:00', days: [0, 2, 4], enabled: true } }
      ] } });
      expect(r.statusCode, r.body).toBe(200);
      const j = r.json(); expect(j.accepted).toHaveLength(3); expect(j.conflicts).toEqual([]); expect(j.rejected).toEqual([]);
      rev = j.rev;
      const p = (await app.inject({ url: '/api/sync/pull?since=0', headers: H(A.token) })).json();
      expect(p.records.map((x: any) => x.c + ':' + x.id).sort()).toEqual(['profile:profile', 'reminders:r1', 'sessions:s1']);
      expect(p.rev).toBe(rev); expect(p.more).toBe(false);
      expect((await app.inject({ url: `/api/sync/pull?since=${rev}`, headers: H(A.token) })).json().records).toEqual([]);
    });
    it('re-sending the same version is idempotent (retries after a lost response)', async () => {
      const j = (await app.inject({ method: 'POST', url: '/api/sync/push', headers: H(A.token), payload: { records: [{ c: 'sessions', id: 's1', u: 1000, d: session('s1') }] } })).json();
      expect(j.accepted).toHaveLength(1); expect(j.rev).toBe(rev);
    });
    it('last writer wins: older versions get the server copy back as a conflict', async () => {
      const newer = (await app.inject({ method: 'POST', url: '/api/sync/push', headers: H(A.token), payload: { records: [{ c: 'sessions', id: 's1', u: 3000, d: session('s1', '2026-03-02', { notes: 'phone' }) }] } })).json();
      expect(newer.rev).toBe(rev + 1);
      const older = (await app.inject({ method: 'POST', url: '/api/sync/push', headers: H(A.token), payload: { records: [{ c: 'sessions', id: 's1', u: 2000, d: session('s1', '2026-03-02', { notes: 'laptop' }) }] } })).json();
      expect(older.accepted).toEqual([]); expect(older.conflicts[0]).toMatchObject({ c: 'sessions', id: 's1', u: 3000, d: { notes: 'phone' } });
    });
    it('deletions are synced as tombstones', async () => {
      await app.inject({ method: 'POST', url: '/api/sync/push', headers: H(A.token), payload: { records: [{ c: 'reminders', id: 'r1', u: 4000, del: true }] } });
      const p = (await app.inject({ url: `/api/sync/pull?since=${rev}`, headers: H(A.token) })).json();
      expect(p.records.find((x: any) => x.id === 'r1')).toMatchObject({ del: true });
    });
    it('invalid records are rejected individually, valid ones are stored', async () => {
      const j = (await app.inject({ method: 'POST', url: '/api/sync/push', headers: H(A.token), payload: { records: [
        { c: 'sessions', id: 'bad', u: 5000, d: { id: 'bad', date: 'yesterday', items: [] } },
        { c: 'sessions', id: 'evil', u: 5000, d: session('other-id') },
        { c: 'tests', id: 't1', u: 5000, d: { id: 't1', date: '2026-03-01', pullups: 9 } }
      ] } })).json();
      expect(j.accepted.map((a: any) => a.id)).toEqual(['t1']);
      expect(j.rejected.map((a: any) => [a.id, a.reason.split(':')[0]])).toEqual([['bad', 'invalid'], ['evil', 'id_mismatch']]);
    });
    it('rejects unknown collections and bad query parameters', async () => {
      expect((await app.inject({ method: 'POST', url: '/api/sync/push', headers: H(A.token), payload: { records: [{ c: 'users', id: 'x', u: 1, d: {} }] } })).statusCode).toBe(400);
      expect((await app.inject({ url: '/api/sync/pull?since=-1', headers: H(A.token) })).statusCode).toBe(400);
      expect((await app.inject({ url: '/api/sync/pull?limit=5000', headers: H(A.token) })).statusCode).toBe(400);
    });
    it('users never see each other\'s data', async () => {
      const p = (await app.inject({ url: '/api/sync/pull?since=0', headers: H(B.token) })).json();
      expect(p.records).toEqual([]);
      await app.inject({ method: 'POST', url: '/api/sync/push', headers: H(B.token), payload: { records: [{ c: 'sessions', id: 's1', u: 99_999, d: session('s1', '2026-03-09', { notes: 'bob' }) }] } });
      const a = (await app.inject({ url: '/api/sync/pull?since=0', headers: H(A.token) })).json();
      expect(a.records.find((x: any) => x.c === 'sessions' && x.id === 's1').d.notes).toBe('phone');
    });
  });

  describe('progress photos (separate consent)', () => {
    it('upload requires consent', async () => {
      const r = await app.inject({ method: 'PUT', url: '/api/photos/p1', headers: { ...H(A.token), 'content-type': 'image/jpeg' }, payload: JPEG });
      expect(r.statusCode).toBe(403); expect(r.json().code).toBe('consent_required');
    });
    it('upload, download with ETag, type sniffing, size limit', async () => {
      expect((await app.inject({ method: 'POST', url: '/api/account/consent', headers: H(A.token), payload: { photos: true } })).json().user.photosConsent).toBe(true);
      const up = await app.inject({ method: 'PUT', url: '/api/photos/p1', headers: { ...H(A.token), 'content-type': 'image/png' }, payload: JPEG });
      expect(up.statusCode, up.body).toBe(200); expect(up.json().mime).toBe('image/jpeg');   // declared png, real jpeg
      const g = await app.inject({ url: '/api/photos/p1', headers: H(A.token) });
      expect(g.statusCode).toBe(200); expect(g.headers['content-type']).toBe('image/jpeg'); expect(Buffer.compare(g.rawPayload, JPEG)).toBe(0);
      expect((await app.inject({ url: '/api/photos/p1', headers: { ...H(A.token), 'if-none-match': String(g.headers.etag) } })).statusCode).toBe(304);
      expect((await app.inject({ method: 'PUT', url: '/api/photos/p2', headers: { ...H(A.token), 'content-type': 'application/octet-stream' }, payload: Buffer.from('<svg/>') })).statusCode).toBe(415);
      expect((await app.inject({ method: 'PUT', url: '/api/photos/big', headers: { ...H(A.token), 'content-type': 'image/jpeg' }, payload: Buffer.concat([JPEG, Buffer.alloc(3 * 1024 * 1024)]) })).statusCode).toBe(413);
      expect((await app.inject({ method: 'PUT', url: '/api/photos/..%2Fetc', headers: { ...H(A.token), 'content-type': 'image/jpeg' }, payload: JPEG })).statusCode).toBe(400);
    });
    it('another user cannot read the photo', async () => {
      expect((await app.inject({ url: '/api/photos/p1', headers: H(B.token) })).statusCode).toBe(404);
    });
    it('deleting the photo record deletes the stored image; revoking consent deletes all photos', async () => {
      await app.inject({ method: 'PUT', url: '/api/photos/p3', headers: { ...H(A.token), 'content-type': 'image/jpeg' }, payload: JPEG });
      await app.inject({ method: 'POST', url: '/api/sync/push', headers: H(A.token), payload: { records: [{ c: 'photos', id: 'p1', u: 6000, del: true }] } });
      expect((await app.inject({ url: '/api/photos/p1', headers: H(A.token) })).statusCode).toBe(404);
      expect((await app.inject({ url: '/api/photos/p3', headers: H(A.token) })).statusCode).toBe(200);
      await app.inject({ method: 'POST', url: '/api/account/consent', headers: H(A.token), payload: { photos: false } });
      expect((await db.photoStats(pool, A.user.id)).count).toBe(0);
    });
  });

  describe('browser / PWA sign-in through the bot (one-time link code)', () => {
    it('start → pending → claimed by the bot → ok once', async () => {
      const s = (await app.inject({ method: 'POST', url: '/api/auth/link/start', payload: { deviceId: 'pwa-1' } })).json();
      expect(s.code).toMatch(/^[A-Z2-9]{8}$/); expect(s.botUrl).toBe(`https://t.me/pullup_test_bot?start=link_${s.code}`);
      const poll = () => app.inject({ method: 'POST', url: '/api/auth/link/poll', payload: { code: s.code, secret: s.secret } });
      expect((await poll()).json()).toEqual({ status: 'pending' });
      expect((await app.inject({ method: 'POST', url: '/api/auth/link/poll', payload: { code: s.code, secret: 'wrong-secret-123' } })).statusCode).toBe(404);
      expect(await db.claimLinkCode(pool, s.code, { id: 1001, first_name: 'Isa', username: 'isa_fit' })).toBe('ok');   // what the bot does on /start link_<code>
      const ok = (await poll()).json();
      expect(ok).toMatchObject({ status: 'ok', user: { telegramId: 1001 } });
      expect((await app.inject({ url: '/api/account', headers: H(ok.token) })).json().user.id).toBe(A.user.id);   // same account as in the Mini App
      expect((await poll()).json()).toEqual({ status: 'expired' });                                           // one-time
    });
  });

  describe('account', () => {
    it('export contains the user records', async () => {
      const e = (await app.inject({ url: '/api/export', headers: H(A.token) })).json();
      expect(e.format).toBe('pullup-pro-cloud-export'); expect(e.records.some((r: any) => r.c === 'sessions')).toBe(true);
    });
    it('logout invalidates the token', async () => {
      const t = (await login(alice)).token;
      await app.inject({ method: 'POST', url: '/api/auth/logout', headers: H(t), payload: {} });
      expect((await app.inject({ url: '/api/account', headers: H(t) })).statusCode).toBe(401);
    });
    it('account deletion removes all personal data', async () => {
      const r = await app.inject({ method: 'DELETE', url: '/api/account', headers: H(B.token) });
      expect(r.json()).toEqual({ ok: true });
      expect((await app.inject({ url: '/api/account', headers: H(B.token) })).statusCode).toBe(401);
      const left = await pool.query('SELECT count(*)::int AS n FROM records WHERE user_id = $1', [B.user.id]);
      expect(left.rows[0].n).toBe(0);
    });
  });

  it('rate limits sign-in attempts', async () => {
    const strict = await buildApp(testConfig({ authRateLimitPerMin: 3 }), pool, { logger: false });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await strict.inject({ method: 'POST', url: '/api/auth/telegram', payload: { initData: 'x=1' } })).statusCode);
    expect(codes.slice(0, 3)).toEqual([401, 401, 401]); expect(codes.slice(3)).toEqual([429, 429]);
    await strict.close();
  });

  const dist = fileURLToPath(new URL('../../apps/web/dist', import.meta.url));
  it.skipIf(!existsSync(dist + '/index.html'))('serves the web app with security and cache headers', async () => {
    const web = await buildApp(testConfig({ webDist: dist }), pool, { logger: false });
    const r = await web.inject({ url: '/', headers: { accept: 'text/html' } });
    expect(r.statusCode).toBe(200); expect(r.headers['content-security-policy']).toContain("frame-ancestors 'self' https://web.telegram.org");
    expect(r.headers['cache-control']).toBe('no-cache');
    expect((await web.inject('/sw.js')).headers['cache-control']).toBe('no-cache');
    expect((await web.inject({ url: '/deep/link', headers: { accept: 'text/html' } })).statusCode).toBe(200);
    expect((await web.inject('/api/nope')).json().code).toBe('not_found');
    await web.close();
  });
});
