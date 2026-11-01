/* ================= State defaults & migrations (v1 → v2) =================
 * Rules (ЧАСТЬ 1): never drop user records, keep ids and v1 field names, never auto-reset storage.
 * v1 = PULLUP PRO 1.0 (localStorage `pullup.pro.v1`, backup `{ app:'pullup-pro', version:'1.x', data }`).
 */
import type { AppState } from './types';
import { dayKey } from './dates';
import { uid } from './util';

export const STATE_VERSION = 2;
export function defaultState(now: number = Date.now()): AppState {
  return {
    v: STATE_VERSION,
    profile: {
      name: 'ISA', bodyweight: 75, program: 'beginner', maxPullups: 0, goalDaily: 20, weeklyTarget: 3,
      sound: true, vibrate: true, restDefault: 90, accent: 'orange', onboarded: false, disclaimerAccepted: false,
      created: dayKey(new Date(now)), autoRest: true
    },
    sessions: [], tests: [], mu: { checks: {}, done: {}, log: [] }, custom: [], plan: {}, ach: {}, daily: {}, progress: {}, ui: { tip: 0 },
    body: [], bodyFields: [], photos: [], foods: [], products: [],
    nutrition: { enabled: false, waterTarget: 8, habits: [
      { id: 'protein', name: 'Белок в каждом основном приёме пищи', on: true },
      { id: 'veg', name: 'Овощи или фрукты 2+ раза', on: true },
      { id: 'sleep', name: 'Сон 7+ часов', on: true }
    ] },
    reminders: [], engine: {},
    settings: { theme: 'dark', wakeLock: true, fullscreen: false, units: 'metric', cloud: { enabled: false, photos: false }, bot: { reminders: false } },
    meta: { createdAt: now, deviceId: uid() + uid() }
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
/** deep merge of plain objects: data wins, arrays are taken from data as-is */
export function mergeDeep<T>(base: T, data: unknown): T {
  if (!isObj(data)) return base;
  const b = base as unknown as Record<string, unknown>;
  for (const k of Object.keys(data)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    const dv = data[k], bv = b[k];
    if (isObj(bv) && isObj(dv)) b[k] = mergeDeep(bv, dv);
    else if (dv !== undefined) b[k] = dv;
  }
  return base;
}
export interface MigrationResult { state: AppState; from: number; migrated: boolean; notes: string[] }
/** accepts a raw v1/v2 state object (already unwrapped from a backup) and returns a valid v2 state */
export function migrateState(raw: unknown, now: number = Date.now()): MigrationResult {
  const notes: string[] = [];
  const src = isObj(raw) ? raw : {};
  const from = typeof src.v === 'number' ? src.v : 1;
  const st = mergeDeep(defaultState(now), src);
  for (const k of ['sessions', 'tests', 'custom', 'body', 'bodyFields', 'photos', 'foods', 'products', 'reminders'] as const) {
    if (!Array.isArray(st[k])) { (st as unknown as Record<string, unknown>)[k] = []; notes.push(`Поле ${k} восстановлено как пустой список`); }
  }
  for (const k of ['plan', 'ach', 'daily', 'progress', 'ui', 'engine'] as const) if (!isObj(st[k])) (st as unknown as Record<string, unknown>)[k] = {};
  if (!isObj(st.mu)) st.mu = { checks: {}, done: {}, log: [] };
  st.mu.checks = isObj(st.mu.checks) ? st.mu.checks : {}; st.mu.done = isObj(st.mu.done) ? st.mu.done : {}; if (!Array.isArray(st.mu.log)) st.mu.log = [];
  // sessions: keep every record, only repair structure
  st.sessions = st.sessions.filter(isObj).map(s => ({ ...s, id: String(s.id || uid()), items: Array.isArray(s.items) ? s.items.filter(isObj).map(it => ({ ...it, sets: Array.isArray(it.sets) ? it.sets.filter(isObj) : [] })) : [] })) as AppState['sessions'];
  st.tests = st.tests.filter(isObj).map(t => ({ ...t, id: t.id || uid() })) as AppState['tests'];
  if (from < 2) {
    notes.push('Данные PULLUP PRO 1.0 перенесены в формат 2.0 без потерь');
    st.meta.migratedFrom = from; st.meta.migratedAt = now;
  }
  st.v = STATE_VERSION;
  if (!st.meta.deviceId) st.meta.deviceId = uid() + uid();
  return { state: st, from, migrated: from < STATE_VERSION, notes };
}
/** unwraps `{ app:'pullup-pro', data }` backups (v1 and v2) or returns the object itself */
export function unwrapBackup(json: unknown): unknown {
  if (isObj(json) && isObj(json.data) && (json.app === 'pullup-pro' || 'version' in json)) return json.data;
  return json;
}
