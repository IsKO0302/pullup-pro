import { toast } from '../components/toast';
import { S, save, saveHooks } from '../core/state';
import { api, auth, ApiError } from './api';
import { idb } from './idb';
import { applyRecords, diffState, dirtyRecords, indexRemote, keyOf, markSynced, type SyncIndex } from '@pullup/shared/sync';
import type { SyncPullResult, SyncPushResult, SyncRecord } from '@pullup/shared/types';

/* ================= Cloud sync (optional, explicit opt-in) =================
 * Local-first: the app works offline; when sync is enabled the client pushes changed records
 * (last-writer-wins per record, by client timestamp) and pulls records changed on other devices.
 * Photos are uploaded only with a separate explicit consent (settings.cloud.photos). */
const META_KEY = 'pullup.pro.sync';
type Status = 'off' | 'idle' | 'syncing' | 'offline' | 'error' | 'auth';
export const SYNC: { status: Status; error: string; at: number; rev: number } = { status: 'off', error: '', at: 0, rev: 0 };
let index: SyncIndex = {}, loaded = false, busy = false, again = false, applying = false, timer: any = 0;
const subs: Array<() => void> = [];
export const onSync = (f: () => void) => subs.push(f);
const emit = () => subs.forEach(f => { try { f(); } catch (e) { console.error(e); } });
function setStatus(s: Status, err = '') { SYNC.status = s; SYNC.error = err; emit(); }
function readMeta() { try { const m = JSON.parse(localStorage.getItem(META_KEY) || '{}'); SYNC.rev = +m.rev || 0; SYNC.at = +m.at || 0; } catch (e) { /* ignore */ } }
function writeMeta() { try { localStorage.setItem(META_KEY, JSON.stringify({ rev: SYNC.rev, at: SYNC.at, user: (auth.get() || { user: { id: '' } }).user.id })); } catch (e) { /* ignore */ } }
async function loadIndex() { if (loaded) return; try { index = (await idb.get<SyncIndex>('kv', 'syncIndex')) || {}; } catch (e) { index = {}; } loaded = true; }
const saveIndex = () => idb.put('kv', 'syncIndex', index).catch(() => { /* ignore */ });
/** never syncs labelled demo data (S.meta.demo) */
export const syncEnabled = (): boolean => !!(S.settings && S.settings.cloud && S.settings.cloud.enabled && auth.get() && !(S.meta && S.meta.demo));

export function scheduleSync(ms = 2500) { if (!syncEnabled() || applying) return; clearTimeout(timer); timer = setTimeout(() => { syncNow().catch(() => { /* status already set */ }); }, ms); }
/** full sync cycle: push local changes, then pull remote ones. Returns number of remote records applied. */
export async function syncNow(): Promise<number> {
  if (!syncEnabled()) { setStatus('off'); return 0; }
  if (!navigator.onLine) { setStatus('offline'); return 0; }
  if (busy) { again = true; return 0; }
  busy = true; setStatus('syncing'); readMeta();
  let applied = 0;
  try {
    await loadIndex();
    // a different account on this device → start from scratch (all local records are pushed to the new account)
    try { const m = JSON.parse(localStorage.getItem(META_KEY) || '{}'); const uidNow = auth.get()!.user.id; if (m.user && m.user !== uidNow) { index = {}; SYNC.rev = 0; } } catch (e) { /* ignore */ }
    index = diffState(S as any, index).index;
    for (let guard = 0; guard < 40; guard++) {
      const recs = dirtyRecords(S as any, index, 200); if (!recs.length) break;
      const sentU: Record<string, number> = {}; for (const r of recs) sentU[keyOf(r.c, r.id)] = r.u;
      const res = await api<SyncPushResult>('/sync/push', { body: { records: recs, deviceId: S.meta.deviceId } });
      index = markSynced(index, [...res.accepted, ...(res.rejected || [])], sentU);
      if (res.rejected && res.rejected.length) console.warn('[sync] server rejected records', res.rejected);
      if (res.conflicts && res.conflicts.length) { applyRemote(res.conflicts); applied += res.conflicts.length; for (const c of res.conflicts) { const e = index[keyOf(c.c, c.id)]; if (e) e.dirty = false; } }
      if (!res.accepted.length && !(res.conflicts || []).length && !(res.rejected || []).length) break;
    }
    for (let guard = 0; guard < 100; guard++) {
      const res = await api<SyncPullResult>(`/sync/pull?since=${SYNC.rev}&limit=500`);
      const fresh = res.records.filter(r => { const e = index[keyOf(r.c, r.id)]; return !e || (!e.dirty && e.u < r.u) || (e.dirty && e.u < r.u); });
      if (fresh.length) { applyRemote(fresh); applied += fresh.length; }
      SYNC.rev = res.rev; if (!res.more) break;
    }
    SYNC.at = Date.now(); S.settings.cloud.lastSync = SYNC.at; writeMeta(); saveIndex();
    if (applied) { applying = true; try { save(); } finally { applying = false; } window.dispatchEvent(new CustomEvent('pullup:remote')); }
    setStatus('idle');
    if (S.settings.cloud.photos) syncPhotos().catch(e => console.warn('photo sync', e));
    return applied;
  } catch (e: any) {
    const st: Status = e instanceof ApiError && e.status === 401 ? 'auth' : e instanceof ApiError && e.status === 0 ? 'offline' : 'error';
    setStatus(st, e.message || String(e)); saveIndex();
    throw e;
  } finally { busy = false; if (again) { again = false; scheduleSync(800); } }
}
function applyRemote(records: SyncRecord[]) { applyRecords(S as any, records); index = indexRemote(S as any, index, records); }

/* ---------- photos (only with explicit consent) ---------- */
export async function syncPhotos(): Promise<{ up: number; down: number }> {
  let up = 0, down = 0;
  if (!syncEnabled() || !S.settings.cloud.photos) return { up, down };
  for (const p of S.photos) {
    const rec: any = await idb.get('photos', p.id).catch(() => null);
    if (rec && rec.blob && !p.cloud) { await api(`/photos/${encodeURIComponent(p.id)}`, { method: 'PUT', raw: rec.blob, timeout: 60000 }); p.cloud = true; up++; }
    else if (!rec && p.cloud) {
      try { const blob: Blob = await api(`/photos/${encodeURIComponent(p.id)}`, { timeout: 60000 }); await idb.put('photos', p.id, { blob, thumb: blob }); down++; } catch (e) { if (!(e instanceof ApiError && e.status === 404)) throw e; }
    }
  }
  if (up) { applying = true; try { save(); } finally { applying = false; } scheduleSync(500); }
  return { up, down };
}
/** turn cloud sync on/off (data stays on the device in both cases) */
export function setCloud(on: boolean) { S.settings.cloud.enabled = on; if (!on) { S.settings.cloud.photos = false; } save(); setStatus(on ? 'idle' : 'off'); if (on) scheduleSync(100); }
export function resetSyncState() { index = {}; loaded = true; SYNC.rev = 0; SYNC.at = 0; try { localStorage.removeItem(META_KEY); } catch (e) { /* ignore */ } idb.del('kv', 'syncIndex').catch(() => { /* ignore */ }); }
export function initSync() {
  readMeta();
  SYNC.status = syncEnabled() ? 'idle' : 'off';
  saveHooks.push(() => scheduleSync());
  window.addEventListener('online', () => scheduleSync(500));
  if (syncEnabled()) scheduleSync(1500);
}
export function syncErrorToast(e: any) { toast(e && e.message ? `Синхронизация: ${e.message}` : 'Синхронизация не удалась', 'err', 4500); }
