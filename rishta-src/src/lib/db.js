// Tiny IndexedDB wrapper. Everything stays in this browser.
const DB_NAME = 'rishta-album';
const VERSION = 1;
let dbp;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('images')) db.createObjectStore('images');
      if (!db.objectStoreNames.contains('imports')) db.createObjectStore('imports', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        let out;
        Promise.resolve(fn(s)).then((v) => (out = v));
        t.oncomplete = () => resolve(out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}
const req2p = (r) => new Promise((res, rej) => ((r.onsuccess = () => res(r.result)), (r.onerror = () => rej(r.error))));

export const getAll = (store) => tx(store, 'readonly', (s) => req2p(s.getAll()));
export const get = (store, key) => tx(store, 'readonly', (s) => req2p(s.get(key)));
export const put = (store, value, key) => tx(store, 'readwrite', (s) => req2p(key === undefined ? s.put(value) : s.put(value, key)));
export const del = (store, key) => tx(store, 'readwrite', (s) => req2p(s.delete(key)));
export const clear = (store) => tx(store, 'readwrite', (s) => req2p(s.clear()));

export async function clearAll() {
  await clear('profiles');
  await clear('images');
  await clear('imports');
}

export async function storageEstimate() {
  try {
    const e = await navigator.storage?.estimate?.();
    return e?.usage || 0;
  } catch {
    return 0;
  }
}
export async function persist() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* ignore */
  }
}
