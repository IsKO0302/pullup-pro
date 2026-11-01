import { toast } from '../components/toast';
import { idb } from '../services/idb';
import { defaultState as freshState, mergeDeep, migrateState, type MigrationResult } from '@pullup/shared/migrate';
import type { AppState } from '@pullup/shared/types';

/* ================= Local-first storage =================
 * v2 data lives in localStorage under STORE_KEY and is mirrored to IndexedDB.
 * v1 data (LEGACY_KEY) is only READ for the one-time migration and is never modified or deleted,
 * so a user can always go back to PULLUP PRO 1.0 with the original data. */
export const STORE_KEY = 'pullup.pro.v2';
export const LEGACY_KEY = 'pullup.pro.v1';
export const RUN_KEY = 'pullup.pro.run';
export let STORAGE_OK = true;
export const defaultState = (): AppState => freshState();
/** legacy helper kept for modules that merge partial objects */
export function merge<T>(base: T, data: unknown): T { return mergeDeep(base, data); }

/** information about a migration that happened during this page load (shown once after boot) */
export let MIGRATION: (MigrationResult & { source: 'v1' | 'v2' }) | null = null;

function readLS(key: string): string | null { try { return localStorage.getItem(key); } catch (e) { STORAGE_OK = false; return null; } }

export function loadState(): AppState {
  const raw = readLS(STORE_KEY);
  if (raw) {
    try {
      const r = migrateState(JSON.parse(raw));
      if (r.migrated) MIGRATION = { ...r, source: 'v2' };
      return r.state;
    } catch (e) { console.error('state parse failed', e); }
  }
  const legacy = readLS(LEGACY_KEY);
  if (legacy) {
    try {
      const r = migrateState(JSON.parse(legacy));
      MIGRATION = { ...r, source: 'v1' };
      try { localStorage.setItem(STORE_KEY, JSON.stringify(r.state)); } catch (e) { STORAGE_OK = false; }
      return r.state;
    } catch (e) { console.error('legacy parse failed', e); }
  }
  return defaultState();
}
export let S: AppState & Record<string, any> = loadState();
export let DATA_VER = 1;
export const saveHooks: Array<() => void> = [];
/** Replace the whole state object (import, reset, restore, cross-tab reload). Live bindings update everywhere. */
export function setState(next: AppState) { S = next as any; DATA_VER++; }

let mirrorT: any = 0;
function mirror() {
  clearTimeout(mirrorT);
  mirrorT = setTimeout(() => { idb.put('kv', 'state', { at: Date.now(), data: JSON.stringify(S) }).catch(() => { /* IDB unavailable: localStorage stays primary */ }); }, 600);
}
export function save() {
  DATA_VER++;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); STORAGE_OK = true; }
  catch (e) { if (STORAGE_OK) toast('Не удалось сохранить данные: хранилище браузера недоступно или переполнено. Сделайте экспорт в настройках.', 'err', 6000); STORAGE_OK = false; }
  mirror();
  for (const h of saveHooks) { try { h(); } catch (e) { console.error(e); } }
}
/** If localStorage was cleared but the IndexedDB mirror survived, offer the mirror back. */
export async function mirrorCandidate(): Promise<AppState | null> {
  try {
    const m = await idb.get<{ at: number; data: string }>('kv', 'state'); if (!m || !m.data) return null;
    const r = migrateState(JSON.parse(m.data)).state;
    const has = (x: AppState) => x.sessions.length + x.body.length + x.tests.length + x.foods.length;
    return has(r) > has(S) ? r : null;
  } catch (e) { return null; }
}
export const runStore = {
  get() { try { const r = localStorage.getItem(RUN_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } },
  set(run) { try { localStorage.setItem(RUN_KEY, JSON.stringify(run)); } catch (e) { /* quota */ } },
  clear() { try { localStorage.removeItem(RUN_KEY); } catch (e) { /* ignore */ } }
};
export function storageSize() { try { return (localStorage.getItem(STORE_KEY) || '').length * 2; } catch (e) { return 0; } }
export const hasLegacyData = (): boolean => !!readLS(LEGACY_KEY);
