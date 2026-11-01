/* ================= IndexedDB: progress photos (binary) + state mirror =================
 * Photos never go to localStorage (quota ~5 MB) and never leave the device unless the user
 * explicitly enables cloud photo sync. The `kv` store keeps a mirror of the app state so the
 * data survives a cleared/evicted localStorage. */
const DB_NAME = 'pullup-pro';
const DB_VER = 1;
export type StoreName = 'photos' | 'kv';
let dbp: Promise<IDBDatabase> | null = null;

export const idbSupported = (): boolean => typeof indexedDB !== 'undefined';

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    if (!idbSupported()) return rej(new Error('IndexedDB недоступен'));
    const rq = indexedDB.open(DB_NAME, DB_VER);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos');
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    rq.onsuccess = () => { const db = rq.result; db.onversionchange = () => { db.close(); dbp = null; }; res(db); };
    rq.onerror = () => { dbp = null; rej(rq.error || new Error('IndexedDB: open failed')); };
    rq.onblocked = () => { dbp = null; rej(new Error('IndexedDB заблокирована другой вкладкой')); };
  });
  return dbp;
}
function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  return open().then(db => new Promise<T>((res, rej) => {
    const t = db.transaction(store, mode), s = t.objectStore(store);
    let out: any;
    const rq = fn(s);
    if (rq) rq.onsuccess = () => { out = rq.result; };
    t.oncomplete = () => res(out as T);
    t.onerror = () => rej(t.error || new Error('IndexedDB: transaction failed'));
    t.onabort = () => rej(t.error || new Error('IndexedDB: transaction aborted'));
  }));
}
export const idb = {
  get: <T = any>(store: StoreName, key: string) => tx<T | undefined>(store, 'readonly', s => s.get(key)),
  put: (store: StoreName, key: string, val: unknown) => tx<void>(store, 'readwrite', s => s.put(val, key)),
  del: (store: StoreName, key: string) => tx<void>(store, 'readwrite', s => s.delete(key)),
  keys: (store: StoreName) => tx<string[]>(store, 'readonly', s => s.getAllKeys() as IDBRequest).then(k => (k || []).map(String)),
  clear: (store: StoreName) => tx<void>(store, 'readwrite', s => s.clear())
};

/** Ask the browser not to evict our storage (photos!). Safe to call repeatedly. */
export async function persistStorage(): Promise<boolean> {
  try { if (navigator.storage && navigator.storage.persist) { if (await navigator.storage.persisted()) return true; return await navigator.storage.persist(); } } catch (e) { /* not supported */ }
  return false;
}
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); return { usage: e.usage || 0, quota: e.quota || 0 }; } } catch (e) { /* not supported */ }
  return null;
}
