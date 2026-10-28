// Kulgaon gat member list at /kulgaon — the Thane Jilha Maharashtriya Vaishya
// Samaj Sangh voter list (as of 30/9/2024), transcribed from the printed PDF.
// Public by the owner's choice: anyone with the link can search it and mark a
// member as मयत (dead) — or back to हयात if a mark was wrong.
//
// The list itself is the committed kulgaon/members.json and is never written.
// Only status changes live in leads.db: kulgaon_status holds the current
// override per member, kulgaon_status_log every change ever made. A change
// needs the reporter's name and mobile, and the page shows who made it, so a
// wrong or malicious mark is visible and can be put right by anyone.
const express = require('express');
const fs = require('fs');
const path = require('path');
const { query, run } = require('../db');

const router = express.Router();

// A missing list must not take the whole process (and Lead Tracker) down with
// it — the page just reports that the list isn't available.
const MEMBERS_FILE = path.resolve(__dirname, '..', '..', 'kulgaon', 'members.json');
let MEMBERS = [];
try {
  MEMBERS = JSON.parse(fs.readFileSync(MEMBERS_FILE, 'utf8'));
} catch (err) {
  console.warn('Kulgaon member list not loaded:', err.message);
}
const BY_SR = new Map(MEMBERS.map(m => [m.sr, m]));

// A member can be set to these two. 'double' (a duplicate entry struck off in
// the printed list) is not a person's state, so it can be neither set nor undone.
const SETTABLE = new Set(['alive', 'dead']);

// Per-address cap on changes, so one person (or script) can't repaint the list.
const RATE_WINDOW = 60 * 60 * 1000;
const RATE_MAX = 30;
const recent = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter(t => now - t < RATE_WINDOW);
  if (hits.length >= RATE_MAX) { recent.set(ip, hits); return true; }
  hits.push(now);
  recent.set(ip, hits);
  return false;
}

// Only the last 4 digits ever leave the server.
const maskMobile = (m) => (m ? '******' + String(m).slice(-4) : '');

router.use((req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});

router.get('/members', (req, res) => {
  if (!MEMBERS.length) return res.status(503).json({ error: 'सभासद यादी उपलब्ध नाही.' });
  const overrides = new Map(
    query(`SELECT sr, status, reported_by, note, updated_at FROM kulgaon_status`).map(r => [r.sr, r])
  );
  res.json(MEMBERS.map(m => {
    const o = overrides.get(m.sr);
    if (!o) return m;
    return {
      ...m,
      status: o.status,
      listStatus: m.status,
      update: { by: o.reported_by, note: o.note || '', at: o.updated_at },
    };
  }));
});

router.post('/members/:sr/status', (req, res, next) => {
  try {
    const sr = parseInt(req.params.sr, 10);
    const member = BY_SR.get(sr);
    if (!member) return res.status(404).json({ error: 'सभासद सापडला नाही.' });
    if (member.status === 'double') {
      return res.status(400).json({ error: 'हे डबल नाव यादीतून वगळलेले आहे — त्याची स्थिती बदलता येत नाही.' });
    }

    const b = req.body || {};
    const status = String(b.status || '');
    const name = String(b.name || '').trim().slice(0, 60);
    const mobile = String(b.mobile || '').replace(/\D/g, '').slice(-10);
    const note = String(b.note || '').trim().slice(0, 200) || null;
    if (!SETTABLE.has(status)) return res.status(400).json({ error: 'अवैध स्थिती.' });
    if (name.length < 2) return res.status(400).json({ error: 'कृपया आपले नाव लिहा.' });
    if (!/^[6-9]\d{9}$/.test(mobile)) return res.status(400).json({ error: 'कृपया वैध १० अंकी मोबाईल क्रमांक टाका.' });

    const current = query(`SELECT status FROM kulgaon_status WHERE sr = ?`, [sr])[0];
    const oldStatus = current ? current.status : member.status;
    if (oldStatus === status) {
      return res.status(400).json({ error: status === 'dead' ? 'ही नोंद आधीच मयत आहे.' : 'ही नोंद आधीच हयात आहे.' });
    }
    if (rateLimited(req.ip)) {
      return res.status(429).json({ error: 'खूप बदल झाले आहेत. कृपया थोड्या वेळाने प्रयत्न करा.' });
    }

    // Back to what the printed list says → drop the override instead of
    // storing one that merely repeats the list.
    if (status === member.status) {
      run(`DELETE FROM kulgaon_status WHERE sr = ?`, [sr]);
    } else {
      run(
        `INSERT INTO kulgaon_status (sr, status, reported_by, mobile, note, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
         ON CONFLICT(sr) DO UPDATE SET status = excluded.status, reported_by = excluded.reported_by,
           mobile = excluded.mobile, note = excluded.note, updated_at = excluded.updated_at`,
        [sr, status, name, mobile, note]
      );
    }
    run(
      `INSERT INTO kulgaon_status_log (sr, old_status, new_status, reported_by, mobile, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sr, oldStatus, status, name, mobile, note]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// The change history, newest first — what makes an open, no-login edit
// accountable.
router.get('/changes', (req, res) => {
  const rows = query(
    `SELECT sr, old_status, new_status, reported_by, mobile, note, created_at
       FROM kulgaon_status_log ORDER BY id DESC LIMIT 100`
  );
  res.json(rows.map(r => ({
    sr: r.sr,
    name: BY_SR.get(r.sr)?.name || '',
    from: r.old_status,
    to: r.new_status,
    by: r.reported_by,
    mobile: maskMobile(r.mobile),
    note: r.note || '',
    at: r.created_at,
  })));
});

module.exports = router;
