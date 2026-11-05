// Admin side of the Naka Family yatra consent poll (/nakayatra/admin). The only
// place that sees personal codes (to build the WhatsApp links), adds or removes
// members, and freezes/reopens answers. Separate mount from /api/nakayatra, the
// same split as /api/kulgaon-admin.
const crypto = require('crypto');
const express = require('express');
const { query, run, runMany } = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const nakayatra = require('./nakayatra');

const router = express.Router();
router.use(requireAuth);
router.use(requireAdmin);
router.use((req, res, next) => { res.set('X-Robots-Tag', 'noindex, nofollow'); next(); });

function newCode(taken) {
  for (;;) {
    const code = 'NF' + crypto.randomInt(1000000, 10000000);
    if (!taken.has(code)) { taken.add(code); return code; }
  }
}

function adminState() {
  const members = nakayatra.allMembers();
  return {
    frozen: nakayatra.isFrozen(),
    summary: nakayatra.summarize(members),
    members: members.map(m => ({
      id: m.id, name: m.name, code: m.code, response: m.response || '', respondedAt: m.responded_at || '',
    })),
  };
}

router.get('/', (req, res, next) => {
  try { res.json(adminState()); } catch (err) { next(err); }
});

// Add members: { names: ["Ajit Kulkarni", ...] }. Names already on the list
// (case-insensitive) are skipped, so pasting the same list twice is safe.
router.post('/members', (req, res, next) => {
  try {
    const raw = Array.isArray(req.body && req.body.names) ? req.body.names : [];
    const existing = new Set(nakayatra.allMembers().map(m => m.name.toLowerCase()));
    const taken = new Set(query(`SELECT code FROM nakayatra_members`).map(r => r.code));
    const rows = [];
    for (const n of raw) {
      const name = String(n || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      if (!name || existing.has(name.toLowerCase())) continue;
      existing.add(name.toLowerCase());
      rows.push([name, newCode(taken)]);
    }
    if (rows.length > 200) return res.status(400).json({ error: 'Too many names at once.' });
    if (rows.length) runMany(`INSERT INTO nakayatra_members (name, code) VALUES (?, ?)`, rows);
    res.json(Object.assign(adminState(), { added: rows.length }));
  } catch (err) { next(err); }
});

router.delete('/members/:id', (req, res, next) => {
  try {
    run(`DELETE FROM nakayatra_members WHERE id = ?`, [Number(req.params.id)]);
    res.json(adminState());
  } catch (err) { next(err); }
});

// { frozen: true|false }
router.post('/freeze', (req, res, next) => {
  try {
    const frozen = !!(req.body && req.body.frozen);
    run(`INSERT INTO nakayatra_settings (key, value) VALUES ('frozen', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [frozen ? '1' : '0']);
    res.json(adminState());
  } catch (err) { next(err); }
});

// ---- Final travellers list (/nakayatra/list/<code>) ----
const nakayatraList = require('./nakayatraList');

function finalState() {
  const rows = nakayatraList.allRows();
  return {
    code: nakayatraList.listCode(),
    locked: nakayatraList.frozen(),
    rows: rows.map(r => ({
      id: r.id, sr: r.sr, name: r.name, aadhaar: r.aadhaar || '', age: r.age, mobile: r.mobile || '',
      correctedAt: r.corrected_at || '', correctedFields: r.corrected_fields || '',
      history: r.history ? JSON.parse(r.history) : [],
    })),
  };
}

function setSetting(key, value) {
  run(`INSERT INTO nakayatra_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [key, value]);
}

router.get('/final', (req, res, next) => {
  try { res.json(finalState()); } catch (err) { next(err); }
});

// { rows: [{ name, aadhaar, age, mobile }] } — loads the list once. Refuses if
// a list already exists, so it can never wipe members' corrections.
router.post('/final/import', (req, res, next) => {
  try {
    if (nakayatraList.allRows().length) return res.status(409).json({ error: 'The final list is already loaded.' });
    const raw = Array.isArray(req.body && req.body.rows) ? req.body.rows : [];
    if (!raw.length || raw.length > 200) return res.status(400).json({ error: 'Paste between 1 and 200 rows.' });
    const rows = [];
    for (const [i, r] of raw.entries()) {
      const name = nakayatraList.cleanField('name', r.name);
      if (name.error) return res.status(400).json({ error: `Row ${i + 1}: ${name.error}` });
      const out = [i + 1, name.value, null, null, null];
      for (const [k, idx] of [['aadhaar', 2], ['age', 3], ['mobile', 4]]) {
        if (r[k] === undefined || r[k] === null || String(r[k]).trim() === '') continue;
        const c = nakayatraList.cleanField(k, r[k]);
        if (c.error) return res.status(400).json({ error: `Row ${i + 1} (${name.value}): ${c.error}` });
        out[idx] = c.value;
      }
      rows.push(out);
    }
    runMany(`INSERT INTO nakayatra_final (sr, name, aadhaar, age, mobile) VALUES (?, ?, ?, ?, ?)`, rows);
    if (!nakayatraList.listCode()) setSetting('list_code', crypto.randomBytes(6).toString('hex'));
    res.json(finalState());
  } catch (err) { next(err); }
});

// { locked: true|false } — locked stops all corrections.
router.post('/final/lock', (req, res, next) => {
  try {
    setSetting('list_locked', req.body && req.body.locked ? '1' : '0');
    res.json(finalState());
  } catch (err) { next(err); }
});

// New link; the old one stops working at once.
router.post('/final/rotate', (req, res, next) => {
  try {
    setSetting('list_code', crypto.randomBytes(6).toString('hex'));
    res.json(finalState());
  } catch (err) { next(err); }
});

module.exports = router;
