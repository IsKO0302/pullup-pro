/* ================= Record-based sync model (client ⇄ API) =================
 * AppState ⇄ records { c: collection, id, u: updatedAt(ms), del?, d } with last-writer-wins per record.
 * The server assigns a monotonically increasing `rev` used for incremental pulls.
 */
import type { AppState, Collection, SyncRecord } from './types';
import { defaultState } from './migrate';

type Rec = { c: Collection; id: string; d: unknown };
const SINGLE: Collection[] = ['profile', 'settings', 'mu', 'nutrition', 'engine'];
const LIST: Collection[] = ['sessions', 'tests', 'custom', 'body', 'bodyFields', 'photos', 'foods', 'products', 'reminders'];
const MAP: Collection[] = ['plan', 'ach', 'daily', 'progress'];
export const keyOf = (c: string, id: string) => c + '\u0001' + id;

/** device-local settings that are never synced */
function settingsForSync(s: AppState['settings']): unknown {
  const { cloud, ...rest } = s || ({} as AppState['settings']);
  return { ...rest, cloud: { photos: !!(cloud && cloud.photos) } };
}
export function toRecords(S: AppState): Map<string, Rec> {
  const m = new Map<string, Rec>();
  const put = (c: Collection, id: string, d: unknown) => m.set(keyOf(c, id), { c, id, d });
  put('profile', 'profile', S.profile); put('settings', 'settings', settingsForSync(S.settings)); put('mu', 'mu', S.mu);
  put('nutrition', 'nutrition', S.nutrition); put('engine', 'engine', S.engine);
  for (const c of LIST) for (const x of (S[c] as unknown as { id?: string }[]) || []) if (x && x.id) put(c, String(x.id), x);
  for (const c of MAP) for (const [k, v] of Object.entries((S[c] as unknown as Record<string, unknown>) || {})) put(c, k, v);
  return m;
}
/** cyrb53 — fast 53-bit string hash for change detection */
export function hash53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
export interface IndexEntry { h: string; u: number; dirty?: boolean; del?: boolean }
export type SyncIndex = Record<string, IndexEntry>;
/** compares state with the last known index; marks changed/new/deleted records dirty with u = now */
export function diffState(S: AppState, index: SyncIndex, now: number = Date.now()): { index: SyncIndex; changed: number } {
  const recs = toRecords(S), out: SyncIndex = {}; let changed = 0;
  for (const [k, r] of recs) {
    const h = hash53(JSON.stringify(r.d)), prev = index[k];
    if (!prev || prev.del || prev.h !== h) { out[k] = { h, u: Math.max(now, prev ? prev.u + 1 : 0), dirty: true }; changed++; }
    else out[k] = prev;
  }
  for (const [k, prev] of Object.entries(index)) if (!recs.has(k)) {
    if (prev.del) out[k] = prev; else { out[k] = { h: '', u: Math.max(now, prev.u + 1), dirty: true, del: true }; changed++; }
  }
  return { index: out, changed };
}
export function dirtyRecords(S: AppState, index: SyncIndex, limit = 500): SyncRecord[] {
  const recs = toRecords(S), out: SyncRecord[] = [];
  for (const [k, e] of Object.entries(index)) {
    if (!e.dirty) continue;
    const [c, id] = k.split('\u0001') as [Collection, string];
    if (e.del) out.push({ c, id, u: e.u, del: true }); else { const r = recs.get(k); if (r) out.push({ c, id, u: e.u, d: r.d }); }
    if (out.length >= limit) break;
  }
  return out;
}
/** applies remote records to the state (insert / replace / delete) */
export function applyRecords(S: AppState, records: SyncRecord[]): number {
  let n = 0;
  for (const r of records) {
    n++;
    if (SINGLE.includes(r.c)) {
      if (r.del || r.d == null) continue;
      if (r.c === 'settings') { const keep = S.settings.cloud; S.settings = { ...S.settings, ...(r.d as object), cloud: { ...keep, photos: !!((r.d as AppState['settings']).cloud || {}).photos } }; }
      else (S as unknown as Record<string, unknown>)[r.c] = r.d;
    } else if (LIST.includes(r.c)) {
      const arr = (S as unknown as Record<string, { id: string }[]>)[r.c] || [], i = arr.findIndex(x => String(x.id) === r.id);
      if (r.del) { if (i >= 0) arr.splice(i, 1); } else if (i >= 0) arr[i] = r.d as { id: string }; else arr.push(r.d as { id: string });
      (S as unknown as Record<string, unknown>)[r.c] = arr;
    } else if (MAP.includes(r.c)) {
      const o = (S as unknown as Record<string, Record<string, unknown>>)[r.c] || {};
      if (r.del) delete o[r.id]; else o[r.id] = r.d;
      (S as unknown as Record<string, unknown>)[r.c] = o;
    }
  }
  return n;
}
/** rebuilds a full state from server records (API export, Telegram bot statistics) */
export function recordsToState(records: SyncRecord[]): AppState {
  const S = defaultState(0); applyRecords(S, records.filter(r => !r.del)); return S;
}
/** marks records as synced after the server accepted them (keeps newer local edits dirty) */
export function markSynced(index: SyncIndex, accepted: { c: Collection; id: string; u?: number }[], sentU: Record<string, number>): SyncIndex {
  for (const a of accepted) { const k = keyOf(a.c, a.id), e = index[k]; if (e && e.u === sentU[k]) e.dirty = false; }
  return index;
}
/** after applying server records, the index must reflect them as clean */
export function indexRemote(S: AppState, index: SyncIndex, records: SyncRecord[]): SyncIndex {
  const recs = toRecords(S);
  for (const r of records) {
    const k = keyOf(r.c, r.id);
    if (r.del || !recs.has(k)) index[k] = { h: '', u: r.u, del: true };
    else index[k] = { h: hash53(JSON.stringify(recs.get(k)!.d)), u: r.u };
  }
  return index;
}
