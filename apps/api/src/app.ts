/* ================= PULLUP PRO API (Fastify 5) =================
 * Optional cloud sync for the local-first app: Telegram sign-in, record sync (LWW), progress photos (with consent),
 * export and account deletion. Also serves the built web app / PWA / Telegram Mini App when WEB_DIST exists. */
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { z } from 'zod';
import type pg from 'pg';
import * as db from '@pullup/db';
import { MAX_RECORD_BYTES, RECORD_SCHEMAS, syncPushSchema } from '@pullup/shared/schema';
import type { Collection, SyncRecord } from '@pullup/shared/types';
import type { ApiConfig } from './config';
import { validateInitData, type InitDataFail } from './telegram-auth';

declare module 'fastify' {
  interface FastifyRequest { user?: db.DbUser; token?: string }
}

export class HttpError extends Error {
  statusCode: number; code: string;
  constructor(statusCode: number, code: string, message: string) { super(message); this.statusCode = statusCode; this.code = code; }
}
function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new HttpError(400, 'validation', `Некорректные данные${i && i.path.length ? ` (${i.path.join('.')})` : ''}`);
  }
  return r.data;
}

const INITDATA_MSG: Record<InitDataFail, string> = {
  missing: 'Нет данных Telegram — откройте приложение из бота', malformed: 'Повреждённые данные Telegram',
  bad_hash: 'Подпись Telegram не прошла проверку', expired: 'Данные Telegram устарели — перезапустите Mini App',
  future: 'Неверное время в данных Telegram', no_user: 'В данных Telegram нет пользователя'
};
const SINGLE = new Set<Collection>(['profile', 'settings', 'mu', 'nutrition', 'engine']);
const LIST = new Set<Collection>(['sessions', 'tests', 'custom', 'body', 'bodyFields', 'photos', 'foods', 'products', 'reminders']);

/** server-side validation of one synced record; returns a short machine-readable reason or null */
export function checkRecord(r: SyncRecord): string | null {
  if (r.del) return null;
  if (r.d === undefined || r.d === null) return 'missing_data';
  if (SINGLE.has(r.c) && r.id !== r.c) return 'bad_id';
  let json: string;
  try { json = JSON.stringify(r.d); } catch { return 'not_serializable'; }
  if (Buffer.byteLength(json) > MAX_RECORD_BYTES) return 'too_large';
  if (json.includes('\\u0000')) return 'nul_char';             // PostgreSQL jsonb cannot store U+0000
  const res = RECORD_SCHEMAS[r.c].safeParse(r.d);
  if (!res.success) { const i = res.error.issues[0]; return 'invalid' + (i && i.path.length ? ':' + i.path.join('.').slice(0, 60) : ''); }
  if (LIST.has(r.c) && String((r.d as { id?: unknown }).id) !== r.id) return 'id_mismatch';
  return null;
}
/** real image type from the magic bytes (the declared content-type is not trusted) */
export function sniffImage(b: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

const authTelegramBody = z.object({ initData: z.string().min(1).max(8192), deviceId: z.string().max(80).optional() });
const deviceBody = z.object({ deviceId: z.string().max(80).optional() }).optional();
const linkPollBody = z.object({ code: z.string().min(4).max(32), secret: z.string().min(10).max(200) });
const consentBody = z.object({ photos: z.boolean() });
const pullQuery = z.object({ since: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(1000).default(500) });
const photoParams = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/) });
const NO_CACHE = new Set(['index.html', 'sw.js', 'version.json', 'manifest.webmanifest']);

export const CSP = [
  "default-src 'self'", "script-src 'self' https://telegram.org", "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:", "media-src 'self' data: blob:", "font-src 'self' data:", "connect-src 'self'",
  "worker-src 'self'", "manifest-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'",
  "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org"
].join('; ');

export interface BuildOptions { logger?: boolean | object; photoQuotaBytes?: number }

export async function buildApp(cfg: ApiConfig, pool: pg.Pool, opts: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger === undefined ? { level: cfg.logLevel, redact: ['req.headers.authorization'] } : opts.logger,
    trustProxy: cfg.trustProxy, bodyLimit: 1024 * 1024, onProtoPoisoning: 'error', onConstructorPoisoning: 'error'
  });
  const quota = opts.photoQuotaBytes ?? 1024 * 1024 * 1024;

  app.setErrorHandler((err: any, req, reply) => {
    let status = Number(err.statusCode || err.status) || 500, code = err.code || 'error', message = err.message || 'Ошибка';
    if (status === 413 || code === 'FST_ERR_CTP_BODY_TOO_LARGE') { status = 413; code = 'too_large'; message = 'Слишком большой запрос'; }
    else if (code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') { status = 415; code = 'unsupported_media'; message = 'Неподдерживаемый тип данных'; }
    else if (code === 'FST_ERR_CTP_EMPTY_JSON_BODY' || (status === 400 && !(err instanceof HttpError) && !err.message?.startsWith('Слишком'))) { code = code === 'FST_ERR_CTP_EMPTY_JSON_BODY' ? 'empty_body' : 'bad_request'; message = 'Некорректный запрос'; }
    else if (status === 429) { code = 'rate_limited'; message = err.message || 'Слишком много запросов'; }
    if (status >= 500) { req.log.error({ err }, 'request failed'); code = 'server_error'; message = 'Внутренняя ошибка сервера'; }
    reply.status(status).send({ error: code, code, message });
  });

  await app.register(rateLimit, {
    global: true, max: cfg.rateLimitPerMin, timeWindow: '1 minute',
    errorResponseBuilder: (_req, ctx) => ({ statusCode: 429, code: 'rate_limited', error: 'rate_limited', message: `Слишком много запросов — повторите через ${Math.ceil(ctx.ttl / 1000)} с` })
  });
  const authLimit = { rateLimit: { max: cfg.authRateLimitPerMin, timeWindow: '1 minute' } };
  if (cfg.corsOrigins.length) await app.register(cors, { origin: cfg.corsOrigins, methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['authorization', 'content-type'], maxAge: 86_400 });

  app.addContentTypeParser(['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'], { parseAs: 'buffer', bodyLimit: cfg.maxPhotoBytes }, (_req, body, done) => done(null, body));

  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'strict-origin-when-cross-origin');
    if (req.protocol === 'https') reply.header('strict-transport-security', 'max-age=15552000');
    if (req.url.startsWith('/api/')) { if (!reply.hasHeader('cache-control')) reply.header('cache-control', 'no-store'); }
    else {
      reply.header('content-security-policy', CSP);
      reply.header('permissions-policy', 'geolocation=(), microphone=(), camera=(), payment=()');
    }
    return payload;
  });

  const requireUser = async (req: FastifyRequest) => {
    const m = /^Bearer\s+([A-Za-z0-9_-]{20,200})$/.exec(String(req.headers.authorization || ''));
    if (!m) throw new HttpError(401, 'auth_required', 'Требуется вход в аккаунт');
    const u = await db.sessionUser(pool, m[1]);
    if (!u) throw new HttpError(401, 'session_expired', 'Сессия истекла — войдите снова');
    req.user = u; req.token = m[1];
  };
  const me = (req: FastifyRequest) => req.user as db.DbUser;

  /* ---------- service ---------- */
  app.get('/api/health', async (_req, reply) => {
    const ok = await db.ping(pool);
    if (!ok) return reply.code(503).send({ ok: false, db: 'down', version: cfg.version });
    return { ok: true, db: 'up', version: cfg.version };
  });
  app.get('/api/config', async () => ({
    botUsername: cfg.botUsername, webAppUrl: cfg.webAppUrl, photos: cfg.allowPhotos, telegramAuth: !!cfg.botToken, version: cfg.version
  }));

  /* ---------- auth ---------- */
  app.post('/api/auth/telegram', { config: authLimit }, async req => {
    if (!cfg.botToken) throw new HttpError(503, 'telegram_not_configured', 'Вход через Telegram не настроен на сервере');
    const b = parse(authTelegramBody, req.body);
    const v = validateInitData(b.initData, cfg.botToken, { maxAgeSec: cfg.initDataMaxAgeSec });
    if (!v.ok) { req.log.warn({ reason: v.reason }, 'initData rejected'); throw new HttpError(401, 'initdata_' + v.reason, INITDATA_MSG[v.reason]); }
    const u = await db.upsertTelegramUser(pool, { id: v.user.id, username: v.user.username, first_name: v.user.first_name, last_name: v.user.last_name, language_code: v.user.language_code });
    const s = await db.createSession(pool, u.id, 'telegram', b.deviceId ?? null, cfg.sessionTtlDays);
    return { token: s.token, exp: s.exp, user: db.publicUser(u) };
  });
  app.post('/api/auth/link/start', { config: authLimit }, async req => {
    if (!cfg.botUsername) throw new HttpError(503, 'bot_not_configured', 'Telegram-бот не настроен на сервере');
    const b = parse(deviceBody, req.body);
    const L = await db.createLinkCode(pool, b?.deviceId ?? null, 10);
    return { code: L.code, secret: L.secret, expiresAt: L.expiresAt, botUrl: `https://t.me/${cfg.botUsername}?start=link_${L.code}` };
  });
  app.post('/api/auth/link/poll', { config: { rateLimit: { max: Math.max(60, cfg.authRateLimitPerMin * 2), timeWindow: '1 minute' } } }, async req => {
    const b = parse(linkPollBody, req.body);
    const r = await db.pollLinkCode(pool, b.code, b.secret);
    if (r.status === 'invalid') throw new HttpError(404, 'invalid_code', 'Код входа не найден — запросите новый');
    if (r.status !== 'ok') return { status: r.status };
    const u = await db.upsertTelegramUser(pool, r.profile);
    const s = await db.createSession(pool, u.id, 'link', r.deviceId, cfg.sessionTtlDays);
    return { status: 'ok', token: s.token, exp: s.exp, user: db.publicUser(u) };
  });
  app.post('/api/auth/logout', async req => {
    const m = /^Bearer\s+([A-Za-z0-9_-]{20,200})$/.exec(String(req.headers.authorization || ''));
    if (m) await db.deleteSession(pool, m[1]);
    return { ok: true };
  });

  /* ---------- account ---------- */
  app.get('/api/account', { preHandler: requireUser }, async req => ({ user: db.publicUser(me(req)), photos: await db.photoStats(pool, me(req).id) }));
  app.delete('/api/account', { preHandler: requireUser }, async req => ({ ok: await db.deleteUser(pool, me(req).id) }));
  app.post('/api/account/consent', { preHandler: requireUser }, async req => {
    const b = parse(consentBody, req.body);
    if (b.photos && !cfg.allowPhotos) throw new HttpError(403, 'photos_disabled', 'Хранение фото отключено на сервере');
    return { user: db.publicUser(await db.setPhotoConsent(pool, me(req).id, b.photos)) };
  });
  app.get('/api/export', { preHandler: requireUser }, async (req, reply) => {
    reply.header('content-disposition', 'attachment; filename="pullup-pro-cloud-export.json"');
    return db.exportUser(pool, me(req).id);
  });

  /* ---------- sync ---------- */
  app.post('/api/sync/push', { preHandler: requireUser, bodyLimit: 16 * 1024 * 1024 }, async req => {
    const b = parse(syncPushSchema, req.body);
    const valid: SyncRecord[] = [], rejected: { c: Collection; id: string; reason: string }[] = [];
    for (const r of b.records as SyncRecord[]) { const why = checkRecord(r); if (why) rejected.push({ c: r.c, id: r.id, reason: why }); else valid.push(r); }
    if (rejected.length) req.log.warn({ rejected: rejected.slice(0, 10), n: rejected.length }, 'sync records rejected');
    const res = await db.pushRecords(pool, me(req).id, valid, b.deviceId ?? null);
    // a deleted photo record also removes the stored image
    const acc = new Set(res.accepted.map(a => a.c + '\u0001' + a.id));
    for (const r of valid) if (r.c === 'photos' && r.del && acc.has('photos\u0001' + r.id)) await db.deletePhoto(pool, me(req).id, r.id);
    return { ...res, rejected };
  });
  app.get('/api/sync/pull', { preHandler: requireUser }, async req => {
    const q = parse(pullQuery, req.query);
    return db.pullRecords(pool, me(req).id, q.since, q.limit);
  });

  /* ---------- progress photos (separate explicit consent) ---------- */
  app.get('/api/photos', { preHandler: requireUser }, async req => ({ photos: await db.listPhotos(pool, me(req).id), ...(await db.photoStats(pool, me(req).id)) }));
  app.put('/api/photos/:id', { preHandler: requireUser, bodyLimit: cfg.maxPhotoBytes }, async req => {
    const { id } = parse(photoParams, req.params), u = me(req);
    if (!cfg.allowPhotos) throw new HttpError(403, 'photos_disabled', 'Хранение фото отключено на сервере');
    if (!u.photos_consent) throw new HttpError(403, 'consent_required', 'Нет согласия на хранение фото в облаке');
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) throw new HttpError(400, 'empty_body', 'Пустой файл');
    const mime = sniffImage(body);
    if (!mime) throw new HttpError(415, 'unsupported_media', 'Поддерживаются только JPEG, PNG и WebP');
    const st = await db.photoStats(pool, u.id), prev = await db.getPhoto(pool, u.id, id);
    if (st.bytes - (prev ? prev.size : 0) + body.length > quota) throw new HttpError(413, 'quota_exceeded', 'Превышен лимит хранилища фото');
    await db.putPhoto(pool, u.id, id, mime, body);
    return { ok: true, id, mime, size: body.length };
  });
  app.get('/api/photos/:id', { preHandler: requireUser }, async (req, reply) => {
    const { id } = parse(photoParams, req.params);
    const p = await db.getPhoto(pool, me(req).id, id);
    if (!p) throw new HttpError(404, 'not_found', 'Фото не найдено');
    const etag = '"' + Buffer.from(p.sha256).toString('hex').slice(0, 32) + '"';
    reply.header('etag', etag).header('cache-control', 'private, no-cache');
    if (req.headers['if-none-match'] === etag) return reply.code(304).send();
    return reply.type(p.mime).send(p.data);
  });
  app.delete('/api/photos/:id', { preHandler: requireUser }, async req => {
    const { id } = parse(photoParams, req.params);
    return { ok: true, deleted: await db.deletePhoto(pool, me(req).id, id) };
  });

  /* ---------- web app / PWA / Telegram Mini App (static) ---------- */
  const dist = cfg.webDist && existsSync(join(cfg.webDist, 'index.html')) ? cfg.webDist : null;
  if (dist) {
    await app.register(fastifyStatic, {
      root: dist, prefix: '/', index: ['index.html'], wildcard: true, cacheControl: false, serveDotFiles: false,
      setHeaders: (res, path) => {
        const f = path.split(/[\\/]/).pop() || '';
        if (NO_CACHE.has(f)) res.header('cache-control', 'no-cache');
        else if (/[\\/]assets[\\/]/.test(path)) res.header('cache-control', 'public, max-age=31536000, immutable');
        else res.header('cache-control', 'public, max-age=86400');
        if (f.endsWith('.webmanifest')) res.header('content-type', 'application/manifest+json');
        if (f === 'sw.js') res.header('service-worker-allowed', '/');
      }
    });
  }
  app.setNotFoundHandler((req, reply) => {
    const url = req.url.split('?')[0];
    if (dist && req.method === 'GET' && !url.startsWith('/api/') && !/\.[a-z0-9]{1,8}$/i.test(url) && String(req.headers.accept || '').includes('text/html'))
      return reply.header('cache-control', 'no-cache').type('text/html; charset=utf-8').sendFile('index.html');
    reply.code(404).send({ error: 'not_found', code: 'not_found', message: 'Не найдено' });
  });
  return app;
}
