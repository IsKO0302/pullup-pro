/* ================= Validation (zod): backups and sync payloads =================
 * Used by the web app (JSON import) and the API (every synced record). Bounded sizes protect storage.
 */
import { z } from 'zod';
import type { Collection } from './types';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const id = z.string().min(1).max(64);
const txt = (n: number) => z.string().max(n);
const num = z.number().finite();
const setLog = z.looseObject({ reps: num.min(0).max(10000).optional(), time: num.min(0).max(36000).optional(), weight: num.min(-500).max(1000).optional(), done: z.boolean().optional(), rir: num.optional() });
export const sessionSchema = z.looseObject({
  id, date: day, startedAt: num.optional(), title: txt(200).optional(), source: txt(40).optional(), durationSec: num.min(0).max(86400 * 2).optional(),
  items: z.array(z.looseObject({ ex: txt(64), sets: z.array(setLog).max(200), note: txt(500).optional() })).max(100),
  feel: num.min(0).max(10).optional(), pain: z.boolean().optional(), notes: txt(2000).optional(), rpe: num.min(0).max(10).optional(), rir: num.min(0).max(10).optional(), tech: num.min(0).max(3).optional()
});
export const testSchema = z.looseObject({ id: id.optional(), date: day, pullups: num.min(0).max(1000) });
export const bodySchema = z.looseObject({ id, date: day, weight: num.min(0).max(500).optional(), note: txt(500).optional(), custom: z.record(z.string().max(64), num).optional() });
export const photoMetaSchema = z.looseObject({ id, date: day, pose: z.enum(['front', 'side', 'back']), w: num, h: num, size: num.max(15e6), mime: z.enum(['image/jpeg', 'image/webp', 'image/png']) });
export const foodSchema = z.looseObject({ id, date: day, meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']), name: txt(120), grams: num.min(0).max(10000).optional(), kcal: num.min(0).max(20000).optional() });
export const productSchema = z.looseObject({ id, name: txt(120) });
export const reminderSchema = z.looseObject({ id, kind: z.enum(['workout', 'weight', 'water', 'mobility']), time: z.string().regex(/^\d{2}:\d{2}$/), days: z.array(z.number().int().min(0).max(6)).max(7), enabled: z.boolean() });
export const customSchema = z.looseObject({ id, name: txt(120), items: z.array(z.looseObject({ ex: txt(64) })).max(60) });
const anyObj = z.record(z.string(), z.unknown());

/** schema for the `d` payload of a synced record, by collection */
export const RECORD_SCHEMAS: Record<Collection, z.ZodType> = {
  profile: anyObj, settings: anyObj, sessions: sessionSchema, tests: testSchema, mu: anyObj, custom: customSchema, plan: z.array(anyObj).max(50), ach: day.or(z.string().max(32)),
  daily: anyObj, progress: anyObj, body: bodySchema, bodyFields: z.looseObject({ id, name: txt(60), unit: txt(12) }), photos: photoMetaSchema, foods: foodSchema,
  products: productSchema, nutrition: anyObj, reminders: reminderSchema, engine: anyObj
};
export const COLLECTIONS = Object.keys(RECORD_SCHEMAS) as Collection[];
export const syncRecordSchema = z.object({ c: z.enum(COLLECTIONS as [Collection, ...Collection[]]), id: z.string().min(1).max(80), u: z.number().int().nonnegative(), del: z.boolean().optional(), d: z.unknown().optional() });
export const syncPushSchema = z.object({ records: z.array(syncRecordSchema).max(500), deviceId: z.string().max(80).optional() });
/** maximal serialized size of one record payload */
export const MAX_RECORD_BYTES = 256 * 1024;

export interface BackupCheck { ok: boolean; error?: string; sessions: number; invalidSessions: number }
export function checkBackup(d: unknown): BackupCheck {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { ok: false, error: 'Файл не похож на резервную копию PULLUP PRO', sessions: 0, invalidSessions: 0 };
  const o = d as Record<string, unknown>;
  if (!o.profile || typeof o.profile !== 'object' || !Array.isArray(o.sessions)) return { ok: false, error: 'В файле нет профиля или журнала тренировок', sessions: 0, invalidSessions: 0 };
  const bad = (o.sessions as unknown[]).filter(s => !sessionSchema.safeParse(s).success).length;
  return { ok: true, sessions: (o.sessions as unknown[]).length, invalidSessions: bad };
}
