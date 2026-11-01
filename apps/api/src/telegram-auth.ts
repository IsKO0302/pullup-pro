/* ================= Telegram Mini App initData validation (server side only) =================
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *   secret_key       = HMAC_SHA256(key = "WebAppData", message = <bot token>)
 *   data_check_string = every received field except `hash`, sorted by key, "key=value" joined with "\n"
 *   valid            ⇔ hex(HMAC_SHA256(key = secret_key, message = data_check_string)) == hash
 * initDataUnsafe from the client is never trusted: the user id comes only from validated initData. */
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface InitDataUser { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string; is_premium?: boolean; photo_url?: string }
export type InitDataFail = 'missing' | 'malformed' | 'bad_hash' | 'expired' | 'future' | 'no_user';
export type InitDataResult =
  | { ok: true; user: InitDataUser; authDate: number; startParam?: string; queryId?: string; chatType?: string }
  | { ok: false; reason: InitDataFail };

const secretKey = (botToken: string) => createHmac('sha256', 'WebAppData').update(botToken).digest();
const checkString = (p: URLSearchParams, skip: string[]) =>
  [...p.entries()].filter(([k]) => !skip.includes(k)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('\n');
const hmacHex = (key: Buffer, s: string) => createHmac('sha256', key).update(s).digest('hex');
function sameHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(a) || !/^[0-9a-f]{64}$/.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

export function validateInitData(initData: string, botToken: string, opts: { maxAgeSec?: number; nowSec?: number } = {}): InitDataResult {
  if (!initData || typeof initData !== 'string') return { ok: false, reason: 'missing' };
  if (initData.length > 8192) return { ok: false, reason: 'malformed' };
  let p: URLSearchParams;
  try { p = new URLSearchParams(initData); } catch { return { ok: false, reason: 'malformed' }; }
  const hash = (p.get('hash') || '').toLowerCase();
  if (!hash) return { ok: false, reason: 'malformed' };
  const key = secretKey(botToken);
  // Newer clients also send `signature` (Ed25519, for third-party validation). The HMAC covers every field except
  // `hash`; the second variant (without `signature`) keeps compatibility with implementations that exclude it.
  const valid = sameHex(hmacHex(key, checkString(p, ['hash'])), hash) || (p.has('signature') && sameHex(hmacHex(key, checkString(p, ['hash', 'signature'])), hash));
  if (!valid) return { ok: false, reason: 'bad_hash' };
  const authDate = Number(p.get('auth_date'));
  if (!Number.isFinite(authDate) || authDate <= 0) return { ok: false, reason: 'malformed' };
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000), maxAge = opts.maxAgeSec ?? 86_400;
  if (authDate > now + 300) return { ok: false, reason: 'future' };
  if (now - authDate > maxAge) return { ok: false, reason: 'expired' };
  let user: InitDataUser;
  try { user = JSON.parse(p.get('user') || 'null'); } catch { return { ok: false, reason: 'malformed' }; }
  if (!user || typeof user !== 'object' || !Number.isSafeInteger(user.id) || user.id <= 0) return { ok: false, reason: 'no_user' };
  return { ok: true, user, authDate, startParam: p.get('start_param') || undefined, queryId: p.get('query_id') || undefined, chatType: p.get('chat_type') || undefined };
}

/** builds a correctly signed initData string — used by tests and the local Telegram simulator, never by the client */
export function signInitData(fields: Record<string, string | number | object>, botToken: string): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) p.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  p.set('hash', hmacHex(secretKey(botToken), checkString(p, ['hash'])));
  return p.toString();
}
