// Rishta Album — shared storage. Public by the owner's choice: anyone with the
// /rishta link can read, import, shortlist and add notes (no code, no login).
// Profiles live in the rishta_profiles / rishta_imports tables; the cropped
// photo and full page image of each profile are JPEG files in rishta-data/images
// (git-ignored, like shetenavratri/uploads), never in leads.db, because run()
// rewrites the whole DB file on every write.
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { query, run, runMany } = require('../db');

const router = express.Router();

const IMG_DIR = path.resolve(__dirname, '..', '..', 'rishta-data', 'images');
fs.mkdirSync(IMG_DIR, { recursive: true });

const KINDS = new Set(['photo', 'page']);
const STATUSES = new Set(['new', 'seen', 'shortlist', 'hidden']);
const EDIT_KEYS = new Set(['dob', 'height', 'weight', 'education', 'job', 'income', 'native', 'currentLocation', 'familyResidence']);
const MAX_ID = 300;
const MAX_RECORD = 30 * 1024;   // one parsed profile is ~2 KB; this is generous
const MAX_BATCH = 60;
const MAX_PROFILES = 20000;
const MAX_NOTE = 4000;

// Search engines have no business indexing these pages or photos.
router.use((req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});

const validId = (id) => typeof id === 'string' && id.length > 0 && id.length <= MAX_ID;
const imgFile = (kind, id) =>
  path.join(IMG_DIR, crypto.createHash('sha1').update(id).digest('hex') + '-' + kind + '.jpg');

function rowToProfile(r) {
  let data = {};
  let edits = {};
  try { data = JSON.parse(r.data); } catch { /* corrupt row: show what we can */ }
  try { edits = JSON.parse(r.edits || '{}'); } catch { /* ignore */ }
  return { ...data, id: r.id, status: r.status, note: r.note || '', edits, firstSeen: r.first_seen };
}

// Fields the browser owns per import; status/note/edits are the family's and
// are only changed through PATCH, so a re-import never wipes a shortlist.
function cleanData(p) {
  const d = { ...p };
  for (const k of ['id', 'status', 'note', 'edits', 'firstSeen', 'fields', 'age']) delete d[k];
  return d;
}

router.get('/profiles', (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(query('SELECT * FROM rishta_profiles').map(rowToProfile));
  } catch (err) { next(err); }
});

router.post('/profiles', (req, res, next) => {
  try {
    const list = Array.isArray(req.body && req.body.profiles) ? req.body.profiles : null;
    if (!list || !list.length) return res.status(400).json({ error: 'No profiles sent.' });
    if (list.length > MAX_BATCH) return res.status(400).json({ error: `Send at most ${MAX_BATCH} profiles at a time.` });

    const total = query('SELECT COUNT(*) AS n FROM rishta_profiles')[0].n;
    const now = new Date().toISOString();
    const inserts = [];
    const updates = [];
    let added = 0;
    for (const p of list) {
      if (!p || !validId(p.id)) return res.status(400).json({ error: 'A profile is missing its id.' });
      const json = JSON.stringify(cleanData(p));
      if (json.length > MAX_RECORD) return res.status(400).json({ error: `Profile ${p.id} is too large.` });
      const prev = query('SELECT data FROM rishta_profiles WHERE id = ?', [p.id])[0];
      if (prev) {
        let old = {};
        try { old = JSON.parse(prev.data); } catch { /* ignore */ }
        const merged = cleanData({ ...p, sources: [...new Set([...(old.sources || []), ...(p.sources || [])])] });
        updates.push([JSON.stringify(merged), now, p.id]);
      } else {
        if (total + added >= MAX_PROFILES) return res.status(400).json({ error: 'The album is full.' });
        inserts.push([p.id, json, now, now]);
        added++;
      }
    }
    // One disk write per batch (see Database Rules in CLAUDE.md).
    if (inserts.length) {
      runMany(`INSERT INTO rishta_profiles (id, data, status, note, edits, first_seen, updated_at)
               VALUES (?, ?, 'new', '', '{}', ?, ?)`, inserts);
    }
    if (updates.length) runMany('UPDATE rishta_profiles SET data = ?, updated_at = ? WHERE id = ?', updates);
    res.json({ added, updated: updates.length });
  } catch (err) { next(err); }
});

router.patch('/profiles/:id', (req, res, next) => {
  try {
    const id = req.params.id;
    const row = query('SELECT * FROM rishta_profiles WHERE id = ?', [id])[0];
    if (!row) return res.status(404).json({ error: 'Profile not found.' });
    const b = req.body || {};
    let { status, note } = row;
    let edits = row.edits || '{}';
    if (b.status !== undefined) {
      if (!STATUSES.has(b.status)) return res.status(400).json({ error: 'Unknown status.' });
      status = b.status;
    }
    if (b.note !== undefined) note = String(b.note).slice(0, MAX_NOTE);
    if (b.edits !== undefined) {
      if (typeof b.edits !== 'object' || b.edits === null) return res.status(400).json({ error: 'Bad edits.' });
      const clean = {};
      for (const [k, v] of Object.entries(b.edits)) if (EDIT_KEYS.has(k)) clean[k] = String(v).slice(0, 300);
      edits = JSON.stringify(clean);
    }
    run('UPDATE rishta_profiles SET status = ?, note = ?, edits = ?, updated_at = ? WHERE id = ?',
      [status, note, edits, new Date().toISOString(), id]);
    res.json(rowToProfile(query('SELECT * FROM rishta_profiles WHERE id = ?', [id])[0]));
  } catch (err) { next(err); }
});

router.put('/images/:kind/:id', express.raw({ type: 'image/jpeg', limit: '4mb' }), (req, res, next) => {
  try {
    const { kind, id } = req.params;
    if (!KINDS.has(kind) || !validId(id)) return res.status(400).json({ error: 'Bad image address.' });
    if (!Buffer.isBuffer(req.body) || req.body.length < 100) return res.status(400).json({ error: 'Send a JPEG image.' });
    // JPEG magic bytes: refuse anything that is not actually a JPEG.
    if (req.body[0] !== 0xff || req.body[1] !== 0xd8) return res.status(400).json({ error: 'Send a JPEG image.' });
    if (!query('SELECT 1 AS x FROM rishta_profiles WHERE id = ?', [id]).length) {
      return res.status(404).json({ error: 'Save the profile before its image.' });
    }
    fs.writeFileSync(imgFile(kind, id), req.body);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/images/:kind/:id', (req, res) => {
  const { kind, id } = req.params;
  if (!KINDS.has(kind) || !validId(id)) return res.status(400).json({ error: 'Bad image address.' });
  // no-cache + ETag: a re-import replaces the file under the same URL.
  res.set('Cache-Control', 'no-cache');
  res.sendFile(imgFile(kind, id), (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'No image.' });
  });
});

router.get('/imports', (req, res, next) => {
  try {
    res.json(query('SELECT * FROM rishta_imports ORDER BY at DESC'));
  } catch (err) { next(err); }
});

router.post('/imports', (req, res, next) => {
  try {
    const b = req.body || {};
    const str = (v, n) => String(v || '').slice(0, n);
    const int = (v) => Math.max(0, Math.min(100000, parseInt(v, 10) || 0));
    run(`INSERT OR REPLACE INTO rishta_imports (id, name, title, at, pages, added, updated)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [str(b.id, 60) || 'imp_' + Date.now(), str(b.name, 200), str(b.title, 300),
        new Date().toISOString(), int(b.pages), int(b.added), int(b.updated)]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
