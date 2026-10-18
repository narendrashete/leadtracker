// Thigdam — the friends' group photo album at /thigdam. Public by the owner's
// choice, like Rishta: anyone with the link can see the album, add photos and
// add or fix the optional note (hotel, event) and date/year on any photo.
// Deleting is narrower: only the browser that uploaded a photo (it keeps the
// owner token it was given) or a signed-in Lead Tracker admin.
//
// Photos are stored as the exact bytes the friend picked — never resized or
// re-encoded. A phone photo is several MB and nginx in front refuses bodies
// over 1 MB, so the page sends the file in 768 KB chunks that are appended here
// in order and checked against the announced size before the photo is saved.
// The page also sends a small JPEG preview it draws itself, used only for the
// collage tiles; the viewer always shows the original.
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { query, run } = require('../db');
const { getSession } = require('../auth');

const router = express.Router();

const DATA_DIR  = path.resolve(__dirname, '..', '..', 'thigdam-data');
const PHOTO_DIR = path.join(DATA_DIR, 'photos');
const TMP_DIR   = path.join(DATA_DIR, 'tmp');
fs.mkdirSync(PHOTO_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

// Only these three friends can add photos — everyone else can still view, zoom
// and swipe, since the album itself stays public. Matched on the last 10
// digits so a national (9820677340) or E.164-with-country-code
// (+1 201 923 8479) number both normalize the same way; a wrong digit, or a
// mobile not on this list, is rejected with the same generic message so the
// real numbers never round-trip to the browser.
const ALLOWED_MOBILES = new Set(['2019238479', '9820677340', '9820101355']);
const WRONG_MOBILE_MSG = 'Only Siddharth, Riyaz or Narendra can add photos to this album. Please check the mobile number.';

function normalizeMobile(s) {
  return String(s || '').replace(/\D/g, '').slice(-10);
}

const CHUNK = 768 * 1024;            // stays under nginx's default 1 MB body limit
const MAX_BYTES = 40 * 1024 * 1024;  // a big phone photo, with room to spare
const MAX_THUMB = 600 * 1024;
const MAX_PHOTOS = 5000;
const UPLOAD_TTL = 60 * 60 * 1000;   // an unfinished upload is dropped after an hour
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// Unfinished uploads. In memory on purpose: a restart mid-upload just means
// the page reports a failure and the friend taps upload again.
const uploads = new Map();

// Leftovers from before a restart can never be finished, so they go at boot.
for (const f of fs.readdirSync(TMP_DIR)) {
  try { fs.unlinkSync(path.join(TMP_DIR, f)); } catch { /* ignore */ }
}

router.use((req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});

const newId = (n) => crypto.randomBytes(n).toString('hex');
const isHexId = (s, n) => typeof s === 'string' && new RegExp(`^[0-9a-f]{${n}}$`).test(s);
const photoUrl = (file) => '/thigdam/photos/' + file;

function sniff(buf, mime) {
  if (mime === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mime === 'image/png')  return buf.slice(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (mime === 'image/webp') return buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP';
  return false;
}

// note, date and year are all optional. A full date wins over a bare year,
// and the year is taken from it so the album can group by year either way.
function cleanDetails(b, prev = {}) {
  const out = {
    note: prev.note ?? null,
    taken_on: prev.taken_on ?? null,
    taken_year: prev.taken_year ?? null,
    added_by: prev.added_by ?? null,
  };
  const str = (v, n) => { const s = String(v ?? '').trim().slice(0, n); return s || null; };
  if (b.note !== undefined) out.note = str(b.note, 300);
  if (b.added_by !== undefined) out.added_by = str(b.added_by, 60);
  if (b.taken_on !== undefined || b.taken_year !== undefined) {
    out.taken_on = null;
    out.taken_year = null;
    const d = String(b.taken_on ?? '').trim();
    if (d) {
      const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const t = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      if (!m || t.getUTCMonth() !== +m[2] - 1 || +m[1] < 1950 || +m[1] > 2100) {
        return { error: 'That date does not look right.' };
      }
      out.taken_on = d;
      out.taken_year = +m[1];
    } else if (b.taken_year !== undefined && String(b.taken_year).trim() !== '') {
      const y = parseInt(b.taken_year, 10);
      if (!(y >= 1950 && y <= 2100)) return { error: 'The year should be like 2026.' };
      out.taken_year = y;
    }
  }
  return { value: out };
}

function shape(r) {
  return {
    id: r.id,
    url: photoUrl(r.file),
    thumb_url: r.thumb ? photoUrl(r.thumb) : null,
    mime: r.mime,
    bytes: r.bytes,
    width: r.width,
    height: r.height,
    note: r.note || '',
    taken_on: r.taken_on || '',
    taken_year: r.taken_year || null,
    added_by: r.added_by || '',
    created_at: r.created_at,
  };
}

function isAdmin(req) {
  const h = req.headers['authorization'] || '';
  const user = h.startsWith('Bearer ') ? getSession(h.slice(7)) : null;
  return !!(user && user.role === 'admin');
}

function dropStale() {
  const now = Date.now();
  for (const [uid, u] of uploads) {
    if (now - u.started > UPLOAD_TTL) {
      uploads.delete(uid);
      fs.rm(u.tmp, { force: true }, () => {});
    }
  }
}

// Checked once up front so the page can show one clear message before the
// friend picks files, rather than failing on every queued photo at once.
// The real numbers never leave the server either way.
router.post('/verify-mobile', (req, res) => {
  const mobile = normalizeMobile((req.body || {}).mobile);
  if (mobile.length !== 10 || !ALLOWED_MOBILES.has(mobile)) {
    return res.status(403).json({ error: WRONG_MOBILE_MSG });
  }
  res.json({ ok: true });
});

router.get('/photos', (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const rows = query('SELECT * FROM thigdam_photos ORDER BY created_at DESC');
    res.json(rows.map(shape));
  } catch (err) { next(err); }
});

// 1. Announce an upload: how big, what type.
router.post('/uploads', (req, res, next) => {
  try {
    dropStale();
    const b = req.body || {};
    const mobile = normalizeMobile(b.mobile);
    if (mobile.length !== 10 || !ALLOWED_MOBILES.has(mobile)) {
      return res.status(403).json({ error: WRONG_MOBILE_MSG });
    }
    const size = parseInt(b.size, 10);
    if (!TYPES[b.mime]) return res.status(400).json({ error: 'Only JPEG, PNG or WebP photos can be added.' });
    if (!(size > 100)) return res.status(400).json({ error: 'That file looks empty.' });
    if (size > MAX_BYTES) return res.status(400).json({ error: 'That photo is over 40 MB.' });
    if (query('SELECT COUNT(*) AS n FROM thigdam_photos')[0].n >= MAX_PHOTOS) {
      return res.status(400).json({ error: 'The album is full.' });
    }
    if (uploads.size > 50) return res.status(429).json({ error: 'Too many uploads at once. Try again in a minute.' });
    const uid = newId(12);
    const tmp = path.join(TMP_DIR, uid + '.part');
    fs.writeFileSync(tmp, Buffer.alloc(0));
    uploads.set(uid, { tmp, size, mime: b.mime, next: 0, received: 0, started: Date.now() });
    res.json({ upload_id: uid, chunk_size: CHUNK });
  } catch (err) { next(err); }
});

// 2. Send the bytes, chunk 0, 1, 2… in order.
router.put('/uploads/:uid/:n', express.raw({ type: () => true, limit: CHUNK + 1024 }), (req, res, next) => {
  try {
    const u = uploads.get(req.params.uid);
    if (!u) return res.status(404).json({ error: 'This upload expired. Please try again.' });
    const n = parseInt(req.params.n, 10);
    if (n !== u.next) return res.status(409).json({ error: 'Upload pieces arrived out of order.', expected: u.next });
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!buf.length) return res.status(400).json({ error: 'Empty upload piece.' });
    if (u.received + buf.length > u.size) return res.status(400).json({ error: 'The photo is bigger than announced.' });
    fs.appendFileSync(u.tmp, buf);
    u.received += buf.length;
    u.next++;
    res.json({ received: u.received });
  } catch (err) { next(err); }
});

// 3. Finish: check the whole file arrived and is really an image, then save.
router.post('/uploads/:uid/finish', (req, res, next) => {
  try {
    const uid = req.params.uid;
    const u = uploads.get(uid);
    if (!u) return res.status(404).json({ error: 'This upload expired. Please try again.' });
    if (u.received !== u.size) return res.status(400).json({ error: 'Part of the photo is missing. Please try again.' });
    const head = Buffer.alloc(16);
    const fd = fs.openSync(u.tmp, 'r');
    fs.readSync(fd, head, 0, 16, 0);
    fs.closeSync(fd);
    if (!sniff(head, u.mime)) {
      uploads.delete(uid);
      fs.rm(u.tmp, { force: true }, () => {});
      return res.status(400).json({ error: 'That file is not a JPEG, PNG or WebP photo.' });
    }
    const b = req.body || {};
    const det = cleanDetails(b);
    if (det.error) return res.status(400).json({ error: det.error });
    const dim = (v) => { const x = parseInt(v, 10); return x > 0 && x < 100000 ? x : null; };

    const id = newId(8);
    const file = id + '.' + TYPES[u.mime];
    fs.renameSync(u.tmp, path.join(PHOTO_DIR, file));
    uploads.delete(uid);
    const owner = newId(16);
    const d = det.value;
    run(`INSERT INTO thigdam_photos
           (id, file, mime, bytes, width, height, note, taken_on, taken_year, added_by, owner_token)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [id, file, u.mime, u.size, dim(b.width), dim(b.height), d.note, d.taken_on, d.taken_year, d.added_by, owner]);
    const row = query('SELECT * FROM thigdam_photos WHERE id = ?', [id])[0];
    res.json({ photo: shape(row), owner_token: owner });
  } catch (err) { next(err); }
});

// The collage preview, drawn by the uploading page. Optional: without one the
// tile just loads the original.
router.put('/photos/:id/thumb', express.raw({ type: () => true, limit: MAX_THUMB }), (req, res, next) => {
  try {
    const id = req.params.id;
    if (!isHexId(id, 16)) return res.status(400).json({ error: 'Bad photo address.' });
    const row = query('SELECT * FROM thigdam_photos WHERE id = ?', [id])[0];
    if (!row) return res.status(404).json({ error: 'Photo not found.' });
    if (req.get('X-Owner-Token') !== row.owner_token) return res.status(403).json({ error: 'Only the uploader can set the preview.' });
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || buf.length < 100 || !sniff(buf, 'image/jpeg')) {
      return res.status(400).json({ error: 'Preview must be a JPEG.' });
    }
    const thumb = id + '-thumb.jpg';
    fs.writeFileSync(path.join(PHOTO_DIR, thumb), buf);
    run('UPDATE thigdam_photos SET thumb = ? WHERE id = ?', [thumb, id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Anyone can add or correct the note, date/year and name on any photo.
router.patch('/photos/:id', (req, res, next) => {
  try {
    const id = req.params.id;
    const row = query('SELECT * FROM thigdam_photos WHERE id = ?', [id])[0];
    if (!row) return res.status(404).json({ error: 'Photo not found.' });
    const det = cleanDetails(req.body || {}, row);
    if (det.error) return res.status(400).json({ error: det.error });
    const d = det.value;
    run(`UPDATE thigdam_photos SET note = ?, taken_on = ?, taken_year = ?, added_by = ?,
           updated_at = datetime('now','localtime') WHERE id = ?`,
      [d.note, d.taken_on, d.taken_year, d.added_by, id]);
    res.json(shape(query('SELECT * FROM thigdam_photos WHERE id = ?', [id])[0]));
  } catch (err) { next(err); }
});

router.delete('/photos/:id', (req, res, next) => {
  try {
    const id = req.params.id;
    const row = query('SELECT * FROM thigdam_photos WHERE id = ?', [id])[0];
    if (!row) return res.status(404).json({ error: 'Photo not found.' });
    const token = req.get('X-Owner-Token');
    if (!(token && token === row.owner_token) && !isAdmin(req)) {
      return res.status(403).json({ error: 'Only the person who added this photo can remove it.' });
    }
    run('DELETE FROM thigdam_photos WHERE id = ?', [id]);
    for (const f of [row.file, row.thumb]) {
      if (f) fs.rm(path.join(PHOTO_DIR, f), { force: true }, () => {});
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.PHOTO_DIR = PHOTO_DIR;
module.exports = router;
