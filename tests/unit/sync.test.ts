import { describe, expect, it } from 'vitest';
import { applyRecords, diffState, dirtyRecords, indexRemote, keyOf, markSynced, recordsToState, toRecords, type SyncIndex, type SyncRecord } from '@pullup/shared';
import { sess, state } from './helpers';

/** in-memory stand-in for the server LWW store (structuredClone = the network serializes, no shared references) (the real one is tested against PostgreSQL in tests/integration) */
function memoryServer() {
  const recs = new Map<string, SyncRecord>(); let rev = 0;
  return {
    push(batch: SyncRecord[]) {
      const accepted: { c: any; id: string; rev: number }[] = [], conflicts: SyncRecord[] = [];
      for (const r of batch) { const k = keyOf(r.c, r.id), e = recs.get(k); if (e && e.u > r.u) { conflicts.push(structuredClone(e)); continue; } rev++; recs.set(k, structuredClone({ ...r, rev })); accepted.push({ c: r.c, id: r.id, rev }); }
      return { accepted, conflicts, rev };
    },
    pull(since: number) { return structuredClone([...recs.values()].filter(r => (r.rev || 0) > since).sort((a, b) => a.rev! - b.rev!)); },
    get rev() { return rev; }
  };
}
function syncDevice(S: ReturnType<typeof state>, idx: SyncIndex, srv: ReturnType<typeof memoryServer>, since: number, now: number) {
  let index = diffState(S, idx, now).index;
  const recs = dirtyRecords(S, index), sentU: Record<string, number> = {};
  for (const r of recs) sentU[keyOf(r.c, r.id)] = r.u;
  const res = srv.push(recs);
  index = markSynced(index, res.accepted, sentU);
  if (res.conflicts.length) { applyRecords(S, res.conflicts); index = indexRemote(S, index, res.conflicts); }
  const fresh = srv.pull(since).filter(r => { const e = index[keyOf(r.c, r.id)]; return !e || e.u < r.u; });
  applyRecords(S, fresh); index = indexRemote(S, index, fresh);
  return { index, rev: srv.rev };
}

describe('record-based sync', () => {
  it('splits the state into records and rebuilds it', () => {
    const S = state(S => { S.sessions.push(sess('a', '2026-03-02', [['pullup', [5]]])); S.plan['2026-03-05'] = [{ kind: 'program' } as any]; });
    const recs = [...toRecords(S).values()].map(r => ({ ...r, u: 1 }));
    expect(recs.find(r => r.c === 'sessions' && r.id === 'a')).toBeTruthy();
    expect(recs.find(r => r.c === 'plan' && r.id === '2026-03-05')).toBeTruthy();
    const back = recordsToState(recs as SyncRecord[]);
    expect(back.sessions.map(s => s.id)).toEqual(['a']); expect(back.plan['2026-03-05']).toBeTruthy();
  });
  it('never syncs device-local cloud settings except the photo consent flag', () => {
    const S = state(S => { S.settings.cloud = { enabled: true, photos: true, lastSync: 123 }; });
    const d = toRecords(S).get(keyOf('settings', 'settings'))!.d as any;
    expect(d.cloud).toEqual({ photos: true });
  });
  it('only changed records become dirty', () => {
    const S = state(S => { S.sessions.push(sess('a', '2026-03-02', [['pullup', [5]]])); });
    let idx = diffState(S, {}, 1000).index;
    for (const e of Object.values(idx)) e.dirty = false;
    S.sessions.push(sess('b', '2026-03-03', [['pullup', [6]]]));
    const d = diffState(S, idx, 2000);
    expect(d.changed).toBe(1);
    expect(dirtyRecords(S, d.index).map(r => r.id)).toEqual(['b']);
  });
  it('two devices converge (create, edit, delete) and newer edits win', () => {
    const srv = memoryServer();
    const A = state(S => { S.sessions.push(sess('a', '2026-03-02', [['pullup', [5]]])); });
    const B = state();
    let ia = syncDevice(A, {}, srv, 0, 1000);
    let ib = syncDevice(B, {}, srv, 0, 1100);
    expect(B.sessions.map(s => s.id)).toEqual(['a']);
    // B edits the session, A deletes another record later
    B.sessions[0].notes = 'edited on B';
    ib = syncDevice(B, ib.index, srv, ib.rev, 2000);
    ia = syncDevice(A, ia.index, srv, ia.rev, 2100);
    expect(A.sessions[0].notes).toBe('edited on B');
    A.sessions.splice(0, 1);
    ia = syncDevice(A, ia.index, srv, ia.rev, 3000);
    ib = syncDevice(B, ib.index, srv, ib.rev, 3100);
    expect(B.sessions).toHaveLength(0);
  });
  it('an older offline edit loses against a newer server version (conflict returned)', () => {
    const srv = memoryServer();
    const A = state(S => { S.sessions.push(sess('a', '2026-03-02', [['pullup', [5]]])); });
    const ia = syncDevice(A, {}, srv, 0, 1000);
    const B = state(); const ib = syncDevice(B, {}, srv, 0, 1001);
    B.sessions[0].notes = 'newer'; syncDevice(B, ib.index, srv, ib.rev, 5000);
    A.sessions[0].notes = 'older';
    const res = syncDevice(A, ia.index, srv, ia.rev, 4000);  // A's clock says the edit is older
    expect(A.sessions[0].notes).toBe('newer');
    expect(Object.values(res.index).every(e => !e.dirty)).toBe(true);
  });
});
