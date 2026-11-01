import { S } from '../core/state';
import { idb } from './idb';
import type { AppState } from '@pullup/shared/types';

/* ================= Safety snapshots: nothing is ever replaced without a way back =================
 * Before demo data, import, reset or restore, the current state is copied to IndexedDB (fallback: localStorage). */
export type SnapKind = 'predemo' | 'preimport' | 'prereset' | 'prerestore';
export const SNAP_NAME: Record<SnapKind, string> = { predemo: 'До загрузки демо-данных', preimport: 'До импорта резервной копии', prereset: 'До сброса данных', prerestore: 'До восстановления копии' };
export interface Snap { kind: SnapKind; at: number; data: string }
const LS = (k: SnapKind) => 'pullup.pro.snap.' + k;
export async function snapshot(kind: SnapKind, state: AppState = S): Promise<boolean> {
  const v = { at: Date.now(), data: JSON.stringify(state) };
  try { await idb.put('kv', 'snap:' + kind, v); return true; }
  catch (e) { try { localStorage.setItem(LS(kind), JSON.stringify(v)); return true; } catch (e2) { return false; } }
}
export async function getSnapshot(kind: SnapKind): Promise<Snap | null> {
  try { const v = await idb.get<{ at: number; data: string }>('kv', 'snap:' + kind); if (v && v.data) return { kind, ...v }; } catch (e) { /* fall through */ }
  try { const r = localStorage.getItem(LS(kind)); if (r) { const v = JSON.parse(r); if (v && v.data) return { kind, ...v }; } } catch (e) { /* ignore */ }
  return null;
}
export async function dropSnapshot(kind: SnapKind): Promise<void> {
  try { await idb.del('kv', 'snap:' + kind); } catch (e) { /* ignore */ }
  try { localStorage.removeItem(LS(kind)); } catch (e) { /* ignore */ }
}
export async function listSnapshots(): Promise<(Snap & { sessions: number })[]> {
  const out: (Snap & { sessions: number })[] = [];
  for (const k of Object.keys(SNAP_NAME) as SnapKind[]) {
    const s = await getSnapshot(k); if (!s) continue;
    let n = 0; try { n = (JSON.parse(s.data).sessions || []).length; } catch (e) { /* ignore */ }
    out.push({ ...s, sessions: n });
  }
  return out.sort((a, b) => b.at - a.at);
}
