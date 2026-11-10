// Admin side of the Naka Family yatra consent poll (/nakayatra/admin). The only
// place that sees personal codes (to build the WhatsApp links), adds or removes
// members, and freezes/reopens answers. Separate mount from /api/nakayatra, the
// same split as /api/kulgaon-admin.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
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
  const pays = nakayatraList.paymentsByMember();
  const target = nakayatraList.PER_MEMBER_AMOUNT;
  return {
    code: nakayatraList.listCode(),
    bookingCode: nakayatraList.bookingCode(),
    locked: nakayatraList.frozen(),
    booking: nakayatraList.BOOKING,
    perMember: target,
    rows: rows.map(r => ({
      ...(() => {
        const list = pays[r.id] || [];
        const paid = list.reduce((t, p) => t + p.amount, 0);
        return {
          paid, balance: Math.max(0, target - paid), extra: Math.max(0, paid - target),
          payments: list.map(p => ({
            id: p.id, date: p.paid_on, amount: p.amount, mode: p.mode || '', note: p.note || '',
            hasScreenshot: !!p.screenshot, createdAt: p.created_at,
          })),
        };
      })(),
      id: r.id, sr: r.sr, name: r.name, aadhaar: r.aadhaar || '', age: r.age, mobile: r.mobile || '',
      gothram: nakayatraList.currentValue(r, 'gothram'),
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
// Creates the booking link (full Aadhaar, for the trusted bookers), or replaces
// it with a new one so the old link stops working.
router.post('/final/booking-link', (req, res, next) => {
  try {
    if (!nakayatraList.allRows().length) return res.status(409).json({ error: 'Load the final list first.' });
    setSetting('booking_code', crypto.randomBytes(6).toString('hex'));
    res.json(finalState());
  } catch (err) { next(err); }
});

router.post('/final/rotate', (req, res, next) => {
  try {
    setSetting('list_code', crypto.randomBytes(6).toString('hex'));
    res.json(finalState());
  } catch (err) { next(err); }
});

// ---- Yatra contribution payments ----
// Screenshots are JPEG files (the admin page re-encodes whatever was picked to a
// JPEG of at most ~1800px, which keeps the request under nginx's 1 MB limit).
const PAY_DIR = path.resolve(__dirname, '..', '..', 'nakayatra-data', 'payments');
const MODES = ['UPI', 'NEFT / Bank transfer', 'Cash', 'Cheque', 'Other'];

function payFile(name) { return path.join(PAY_DIR, path.basename(name)); }

// "data:image/jpeg;base64,..." → saved file name, or { error }.
function saveScreenshot(dataUrl) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return { error: 'The screenshot could not be read. Please pick the image again.' };
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length < 100 || buf.length > 3 * 1024 * 1024 || buf[0] !== 0xFF || buf[1] !== 0xD8) {
    return { error: 'The screenshot could not be read. Please pick the image again.' };
  }
  fs.mkdirSync(PAY_DIR, { recursive: true });
  const name = crypto.randomBytes(12).toString('hex') + '.jpg';
  fs.writeFileSync(payFile(name), buf);
  return { name };
}
function removeScreenshot(name) {
  if (name) fs.promises.unlink(payFile(name)).catch(() => {});
}

// Validates { amount, date, mode, note }; returns { value } or { error }.
function cleanPayment(b) {
  const amount = Number(String(b.amount == null ? '' : b.amount).replace(/[₹,\s]/g, ''));
  if (!Number.isInteger(amount) || amount < 1 || amount > 1000000) return { error: 'Enter the amount in whole rupees, e.g. 5000.' };
  const date = String(b.date || '').trim();
  const d = new Date(date + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(d) || d.toISOString().slice(0, 10) !== date) return { error: 'Enter the payment date.' };
  const today = nakayatraList.nowIst().slice(0, 10);
  if (date > today) return { error: 'The payment date cannot be in the future.' };
  if (date < '2025-01-01') return { error: 'Please check the payment date.' };
  const mode = MODES.includes(b.mode) ? b.mode : '';
  const note = String(b.note || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  return { value: { amount, date, mode, note } };
}

function paymentRow(id) { return query(`SELECT * FROM nakayatra_payments WHERE id = ?`, [Number(id)])[0]; }

// { amount, date, mode?, note?, screenshot? (JPEG data URL) }
router.post('/final/:finalId/payments', (req, res, next) => {
  try {
    const member = query(`SELECT id FROM nakayatra_final WHERE id = ?`, [Number(req.params.finalId)])[0];
    if (!member) return res.status(404).json({ error: 'Member not found.' });
    const c = cleanPayment(req.body || {});
    if (c.error) return res.status(400).json({ error: c.error });
    let shot = null;
    if (req.body.screenshot) {
      const sv = saveScreenshot(req.body.screenshot);
      if (sv.error) return res.status(400).json({ error: sv.error });
      shot = sv.name;
    }
    const v = c.value;
    run(`INSERT INTO nakayatra_payments (final_id, amount, paid_on, mode, note, screenshot, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, [member.id, v.amount, v.date, v.mode, v.note, shot, nakayatraList.nowIst()]);
    res.json(finalState());
  } catch (err) { next(err); }
});

// Same fields as adding; `screenshot` replaces the image, `removeScreenshot: true` drops it.
router.patch('/payments/:id', (req, res, next) => {
  try {
    const p = paymentRow(req.params.id);
    if (!p) return res.status(404).json({ error: 'Payment not found.' });
    const c = cleanPayment(req.body || {});
    if (c.error) return res.status(400).json({ error: c.error });
    let shot = p.screenshot;
    if (req.body.screenshot) {
      const sv = saveScreenshot(req.body.screenshot);
      if (sv.error) return res.status(400).json({ error: sv.error });
      shot = sv.name;
    } else if (req.body.removeScreenshot) {
      shot = null;
    }
    const v = c.value;
    run(`UPDATE nakayatra_payments SET amount = ?, paid_on = ?, mode = ?, note = ?, screenshot = ? WHERE id = ?`,
      [v.amount, v.date, v.mode, v.note, shot, p.id]);
    if (p.screenshot && p.screenshot !== shot) removeScreenshot(p.screenshot);
    res.json(finalState());
  } catch (err) { next(err); }
});

router.delete('/payments/:id', (req, res, next) => {
  try {
    const p = paymentRow(req.params.id);
    if (!p) return res.status(404).json({ error: 'Payment not found.' });
    run(`DELETE FROM nakayatra_payments WHERE id = ?`, [p.id]);
    removeScreenshot(p.screenshot);
    res.json(finalState());
  } catch (err) { next(err); }
});

// Admin only (this whole router is behind requireAdmin); the page fetches it
// with its bearer token and shows it as a blob.
router.get('/payments/:id/screenshot', (req, res) => {
  const p = paymentRow(req.params.id);
  if (!p || !p.screenshot) return res.status(404).json({ error: 'No screenshot for this payment.' });
  res.set('Cache-Control', 'private, no-store');
  res.sendFile(payFile(p.screenshot), err => {
    if (err && !res.headersSent) res.status(404).json({ error: 'Screenshot file is missing.' });
  });
});

module.exports = router;
