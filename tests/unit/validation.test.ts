import { describe, expect, it } from 'vitest';
import { RECORD_SCHEMAS, syncPushSchema } from '@pullup/shared';
import { checkRecord, sniffImage } from '../../apps/api/src/app';

describe('input validation', () => {
  it('accepts valid records and rejects malformed ones', () => {
    expect(RECORD_SCHEMAS.sessions.safeParse({ id: 's', date: '2026-03-02', items: [{ ex: 'pullup', sets: [{ reps: 5, done: true }] }] }).success).toBe(true);
    expect(RECORD_SCHEMAS.sessions.safeParse({ id: 's', date: '02.03.2026', items: [] }).success).toBe(false);
    expect(RECORD_SCHEMAS.sessions.safeParse({ id: 's', date: '2026-03-02', items: [{ ex: 'pullup', sets: [{ reps: -1 }] }] }).success).toBe(false);
    expect(RECORD_SCHEMAS.reminders.safeParse({ id: 'r', kind: 'workout', time: '25:00x', days: [0], enabled: true }).success).toBe(false);
  });
  it('limits batch size and collection names', () => {
    expect(syncPushSchema.safeParse({ records: [{ c: 'users', id: 'x', u: 1, d: {} }] }).success).toBe(false);
    expect(syncPushSchema.safeParse({ records: Array.from({ length: 501 }, (_, i) => ({ c: 'tests', id: 't' + i, u: 1, d: {} })) }).success).toBe(false);
  });
  it('server-side record checks: ids, size, NUL characters, deletions', () => {
    const ok = { c: 'sessions' as const, id: 's1', u: 1, d: { id: 's1', date: '2026-03-02', items: [] } };
    expect(checkRecord(ok)).toBeNull();
    expect(checkRecord({ ...ok, id: 'other' })).toBe('id_mismatch');
    expect(checkRecord({ c: 'profile', id: 'not-profile', u: 1, d: {} })).toBe('bad_id');
    expect(checkRecord({ c: 'sessions', id: 's1', u: 1, d: { ...ok.d, notes: 'a\u0000b' } })).toBe('nul_char');
    expect(checkRecord({ c: 'sessions', id: 's1', u: 1, d: { ...ok.d, notes: 'x'.repeat(300_000) } })).toBe('too_large');
    expect(checkRecord({ c: 'sessions', id: 's1', u: 1 })).toBe('missing_data');
    expect(checkRecord({ c: 'sessions', id: 's1', u: 1, del: true })).toBeNull();
    expect(checkRecord({ c: 'sessions', id: 's1', u: 1, d: { id: 's1', date: 'bad', items: [] } })).toMatch(/^invalid/);
  });
  it('detects the real image type by magic bytes', () => {
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg');
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(sniffImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]))).toBe('image/webp');
    expect(sniffImage(Buffer.from('<svg onload=alert(1)>'))).toBeNull();
  });
});
