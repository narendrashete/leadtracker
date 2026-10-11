// One storage interface, two backends:
//  - server: the Lead Tracker Express API at /api/rishta (shared by everyone
//    who opens the link — profiles, photos, shortlist, notes)
//  - local:  this browser's IndexedDB (used when the page runs without that
//    API, e.g. opened as a plain file)
import * as idb from './db.js';

const API = '/api/rishta';
let mode = null; // 'server' | 'local'

async function api(path, opts = {}) {
  const res = await fetch(API + path, opts);
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* not JSON */
  }
  if (!res.ok) throw new Error((body && body.error) || `Server error ${res.status}`);
  return body;
}
const json = (method, data) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

export const isShared = () => mode === 'server';

export async function loadAll() {
  if (mode !== 'local') {
    try {
      const list = await api('/profiles', { cache: 'no-store' });
      if (Array.isArray(list)) {
        mode = 'server';
        return list;
      }
    } catch (e) {
      if (mode === 'server') throw e; // was working: a real failure, not "no API"
    }
    mode = 'local';
  }
  return idb.getAll('profiles');
}

// Saves freshly parsed profiles. Server keeps status/note/edits of existing ones.
export async function saveProfiles(list) {
  if (mode === 'server') return api('/profiles', json('POST', { profiles: list }));
  for (const p of list) await idb.put('profiles', p);
}

export async function patchProfile(p, patch) {
  if (mode === 'server') return api('/profiles/' + encodeURIComponent(p.id), json('PATCH', patch));
  const rec = { ...p, ...patch };
  delete rec.age;
  delete rec.fields;
  await idb.put('profiles', rec);
  return rec;
}

export async function putImage(kind, id, blob) {
  if (mode === 'server') {
    return api(`/images/${kind}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: blob,
    });
  }
  return idb.put('images', blob, `${kind}:${id}`);
}

const urlCache = new Map();
export async function imageUrl(kind, id) {
  if (mode === 'server') return `${API}/images/${kind}/${encodeURIComponent(id)}`;
  const key = `${kind}:${id}`;
  if (urlCache.has(key)) return urlCache.get(key);
  const blob = await idb.get('images', key);
  if (!blob) return null;
  const u = URL.createObjectURL(blob);
  urlCache.set(key, u);
  return u;
}

export async function listImports() {
  if (mode === 'server') return api('/imports');
  return (await idb.getAll('imports')).sort((a, b) => b.at.localeCompare(a.at));
}
export async function addImport(rec) {
  if (mode === 'server') return api('/imports', json('POST', rec));
  return idb.put('imports', rec);
}

// Only the browser-only album can be wiped from the page.
export async function clearLocal() {
  if (mode === 'local') await idb.clearAll();
}
export { storageEstimate, persist } from './db.js';
