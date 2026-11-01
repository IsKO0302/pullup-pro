import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { signInitData, validateInitData } from '../../apps/api/src/telegram-auth';

const TOKEN = '123456789:AAtest_token_for_unit_tests_only_000';   // fake, never a real bot
const now = 1_790_000_000;
const user = { id: 424242, first_name: 'Isa', username: 'isa_fit', language_code: 'ru' };
const fields = () => ({ query_id: 'AAE1', user, auth_date: now - 60, start_param: 'stats' });

describe('Telegram initData validation (HMAC-SHA-256)', () => {
  it('accepts correctly signed data and returns the user', () => {
    const r = validateInitData(signInitData(fields(), TOKEN), TOKEN, { nowSec: now });
    expect(r).toMatchObject({ ok: true, user: { id: 424242, username: 'isa_fit' }, startParam: 'stats' });
  });
  it('follows the documented algorithm (independent re-implementation)', () => {
    const p = new URLSearchParams(signInitData(fields(), TOKEN)), hash = p.get('hash');
    p.delete('hash');
    const dcs = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
    expect(createHmac('sha256', secret).update(dcs).digest('hex')).toBe(hash);
  });
  it('rejects tampered user data', () => {
    const p = new URLSearchParams(signInitData(fields(), TOKEN));
    p.set('user', JSON.stringify({ ...user, id: 1 }));
    expect(validateInitData(p.toString(), TOKEN, { nowSec: now })).toEqual({ ok: false, reason: 'bad_hash' });
  });
  it('rejects data signed with another bot token', () => {
    expect(validateInitData(signInitData(fields(), '987654321:BBother_token_000000000000000000'), TOKEN, { nowSec: now })).toEqual({ ok: false, reason: 'bad_hash' });
  });
  it('checks auth_date freshness', () => {
    expect(validateInitData(signInitData({ ...fields(), auth_date: now - 90_000 }, TOKEN), TOKEN, { nowSec: now, maxAgeSec: 86_400 })).toEqual({ ok: false, reason: 'expired' });
    expect(validateInitData(signInitData({ ...fields(), auth_date: now + 3600 }, TOKEN), TOKEN, { nowSec: now })).toEqual({ ok: false, reason: 'future' });
  });
  it('rejects missing hash, garbage and data without a user', () => {
    expect(validateInitData('', TOKEN)).toEqual({ ok: false, reason: 'missing' });
    expect(validateInitData('user=%7B%7D&auth_date=1', TOKEN)).toEqual({ ok: false, reason: 'malformed' });
    const noUser = signInitData({ auth_date: now - 5, query_id: 'x' }, TOKEN);
    expect(validateInitData(noUser, TOKEN, { nowSec: now })).toEqual({ ok: false, reason: 'no_user' });
  });
  it('supports the newer `signature` field in both hash variants', () => {
    // variant 1: hash covers signature as a regular field
    const withSig = signInitData({ ...fields(), signature: 'ed25519sig' }, TOKEN);
    expect(validateInitData(withSig, TOKEN, { nowSec: now }).ok).toBe(true);
    // variant 2: hash computed without the signature field, signature appended afterwards
    const v2 = new URLSearchParams(signInitData(fields(), TOKEN)); v2.set('signature', 'ed25519sig');
    expect(validateInitData(v2.toString(), TOKEN, { nowSec: now }).ok).toBe(true);
  });
});
