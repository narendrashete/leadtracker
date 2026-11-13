// Public side of the yatra's final travellers list (/nakayatra/list/<code>).
// One shared code for the whole group (shared in the WhatsApp group); anyone
// holding it can view the list and correct any row — no approval, by the
// owner's explicit choice. Every correction is flagged with the IST time and
// the fields changed, and the old → new values go to `history` (admin only).
// Full Aadhaar numbers stay on the server for the group link: the page sees the
// last 4 digits, and a member re-types the full number only to change it.
// A second, separate code — the booking link (`booking_code`), handed only to the
// trusted members who do the TTD booking — opens the same page with full Aadhaar
// numbers to copy. Rotating either code (admin) kills its old link at once.
const path = require('path');
const express = require('express');
const { query, run } = require('../db');

// Payment screenshots (written by the admin routes), git-ignored.
const PAY_DIR = path.resolve(__dirname, '..', '..', 'nakayatra-data', 'payments');
function payFile(name) { return path.join(PAY_DIR, path.basename(name)); }

const router = express.Router();
router.use((req, res, next) => { res.set('X-Robots-Tag', 'noindex, nofollow'); next(); });

const FIELDS = ['name', 'aadhaar', 'age', 'mobile', 'gothram'];
const LABELS = { name: 'Name', aadhaar: 'Aadhaar', age: 'Age', mobile: 'Mobile', gothram: 'Gothram' };

// Group default gothram: a NULL gothram column means this, so members only
// change it when theirs differs (and saving the default is not a correction).
const DEFAULT_GOTHRAM = 'Kashyap';
// Details common to the whole group's TTD darshan booking, shown with copy
// buttons on the list and admin pages. Edit here; both pages read them from the API.
const BOOKING = { darshanDate: '12-02-2027', state: 'Maharashtra', city: 'Badlapur', pincode: '421503' };
// Each member's full yatra contribution. Paid / balance are derived from the
// payments the admin enters (nakayatra_payments); edit the figure here.
const PER_MEMBER_AMOUNT = 10000;

// { final_id: [payment rows, oldest first] }
function paymentsByMember() {
  const out = {};
  query(`SELECT * FROM nakayatra_payments ORDER BY paid_on, id`).forEach(p => {
    (out[p.final_id] = out[p.final_id] || []).push(p);
  });
  return out;
}

// What the members' page may see: date, amount, mode and the screenshot (so
// members can check it — the owner's choice); never the admin's note.
function paymentSummary(list) {
  const paid = (list || []).reduce((t, p) => t + p.amount, 0);
  return {
    paid, balance: Math.max(0, PER_MEMBER_AMOUNT - paid), extra: Math.max(0, paid - PER_MEMBER_AMOUNT),
    payments: (list || []).map(p => ({ id: p.id, date: p.paid_on, amount: p.amount, mode: p.mode || '', hasScreenshot: !!p.screenshot })),
  };
}

function currentValue(row, f) {
  if (f === 'gothram') return row.gothram || DEFAULT_GOTHRAM;
  return row[f] == null ? '' : row[f];
}

function setting(key) {
  const r = query(`SELECT value FROM nakayatra_settings WHERE key = ?`, [key])[0];
  return r ? r.value : '';
}
function listCode() { return setting('list_code'); }
function bookingCode() { return setting('booking_code'); }

function nowIst() {
  // "YYYY-MM-DD HH:MM:SS" in India time, whatever the server's clock zone is.
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });
}

function maskAadhaar(a) {
  return a ? 'XXXX XXXX ' + a.slice(-4) : '';
}

function publicRow(r, booker, payments) {
  return {
    ...paymentSummary(payments),
    ...(booker && r.aadhaar ? { aadhaarFull: r.aadhaar } : {}),
    id: r.id, sr: r.sr, name: r.name, aadhaar: maskAadhaar(r.aadhaar), hasAadhaar: !!r.aadhaar,
    age: r.age, mobile: r.mobile || '', gothram: currentValue(r, 'gothram'),
    corrected: !!r.corrected_at, correctedAt: r.corrected_at || '',
    correctedFields: r.corrected_fields ? r.corrected_fields.split(',').map(f => LABELS[f] || f) : [],
  };
}

// Validates and normalizes one field; returns { value } or { error }.
function cleanField(field, raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (field === 'name') {
    const v = s.replace(/\s+/g, ' ').slice(0, 80);
    return v ? { value: v } : { error: 'Name cannot be empty.' };
  }
  if (field === 'aadhaar') {
    const d = s.replace(/\D/g, '');
    if (!/^[2-9]\d{11}$/.test(d)) return { error: 'Aadhaar number must be 12 digits.' };
    return { value: d };
  }
  if (field === 'age') {
    const n = Number(s);
    if (!Number.isInteger(n) || n < 1 || n > 120) return { error: 'Age must be a number between 1 and 120.' };
    return { value: n };
  }
  if (field === 'mobile') {
    // One canonical spelling, so re-saving the same number in another format
    // ("+91 98201 01355" vs "9820101355") is never flagged as a correction.
    let digits = s.replace(/\D/g, '');
    if (digits.length === 11 && digits[0] === '0') digits = digits.slice(1);
    if (digits.length < 10 || digits.length > 15) return { error: 'Mobile number must have 10 to 15 digits.' };
    if (digits.length === 10) digits = '91' + digits;
    if (digits.length === 12 && digits.startsWith('91')) return { value: '+91 ' + digits.slice(2, 7) + ' ' + digits.slice(7) };
    return { value: '+' + digits };
  }
  if (field === 'gothram') {
    const v = s.replace(/\s+/g, ' ');
    if (!v) return { error: 'Gothram cannot be empty.' };
    if (v.length > 40 || !/^[\p{L}\p{M} .'-]+$/u.test(v)) return { error: 'Gothram should be letters only, up to 40 characters.' };
    return { value: v };
  }
  return { error: 'Unknown field.' };
}

// Edits per IP per hour, in memory only — stops a runaway script, not people.
const edits = new Map();
function tooManyEdits(ip) {
  const now = Date.now();
  const list = (edits.get(ip) || []).filter(t => now - t < 3600000);
  list.push(now);
  edits.set(ip, list);
  return list.length > 60;
}

// Sets req.booker when the code is the booking link's. Returns false (and has
// answered 404) for any other code.
function checkCode(req, res) {
  const c = String(req.params.code || '');
  const list = listCode(), booking = bookingCode();
  if (list && c === list) { req.booker = false; return true; }
  if (booking && c === booking) { req.booker = true; return true; }
  res.status(404).json({ error: 'This link is not valid. Please ask the admin for the current link.' });
  return false;
}

function allRows() {
  return query(`SELECT * FROM nakayatra_final ORDER BY sr, id`);
}

function frozen() {
  const r = query(`SELECT value FROM nakayatra_settings WHERE key = 'list_locked'`)[0];
  return !!(r && r.value === '1');
}

router.get('/:code', (req, res, next) => {
  try {
    if (!checkCode(req, res)) return;
    const pays = paymentsByMember();
    res.json({
      locked: frozen(), booker: req.booker, booking: BOOKING, perMember: PER_MEMBER_AMOUNT,
      rows: allRows().map(r => publicRow(r, req.booker, pays[r.id])),
    });
  } catch (err) { next(err); }
});

// A payment's screenshot, for anyone holding the group (or booking) link, so
// members can check what the admin uploaded for them.
router.get('/:code/payments/:pid/screenshot', (req, res, next) => {
  try {
    if (!checkCode(req, res)) return;
    const p = query(`SELECT screenshot FROM nakayatra_payments WHERE id = ?`, [Number(req.params.pid)])[0];
    if (!p || !p.screenshot) return res.status(404).json({ error: 'No screenshot for this payment.' });
    res.set('Cache-Control', 'private, no-store');
    res.sendFile(payFile(p.screenshot), err => {
      if (err && !res.headersSent) res.status(404).json({ error: 'Screenshot file is missing.' });
    });
  } catch (err) { next(err); }
});

// { name?, aadhaar?, age?, mobile?, gothram? } — only fields that differ are saved.
router.patch('/:code/:id', (req, res, next) => {
  try {
    if (!checkCode(req, res)) return;
    if (frozen()) return res.status(409).json({ error: 'The list is locked by the admin. Please contact him for changes.' });
    if (tooManyEdits(req.ip || '')) return res.status(429).json({ error: 'Too many changes. Please try again later.' });
    const row = query(`SELECT * FROM nakayatra_final WHERE id = ?`, [Number(req.params.id)])[0];
    if (!row) return res.status(404).json({ error: 'Member not found.' });

    const body = req.body || {};
    const changes = {};
    for (const f of FIELDS) {
      if (body[f] === undefined || body[f] === null || String(body[f]).trim() === '') continue;
      const c = cleanField(f, body[f]);
      if (c.error) return res.status(400).json({ error: c.error });
      if (String(c.value) !== String(currentValue(row, f))) changes[f] = c.value;
    }
    const keys = Object.keys(changes);
    const pays = () => paymentsByMember()[row.id];
    if (!keys.length) return res.json({ ok: true, changed: [], row: publicRow(row, req.booker, pays()) });

    const at = nowIst();
    const fields = new Set((row.corrected_fields || '').split(',').filter(Boolean));
    keys.forEach(k => fields.add(k));
    const history = row.history ? JSON.parse(row.history) : [];
    keys.forEach(k => history.push({ at, field: k, from: currentValue(row, k), to: changes[k] }));

    run(
      `UPDATE nakayatra_final SET ${keys.map(k => k + ' = ?').join(', ')},
         corrected_at = ?, corrected_fields = ?, history = ? WHERE id = ?`,
      [...keys.map(k => changes[k]), at, [...fields].join(','), JSON.stringify(history), row.id]
    );
    const updated = query(`SELECT * FROM nakayatra_final WHERE id = ?`, [row.id])[0];
    res.json({ ok: true, changed: keys.map(k => LABELS[k]), row: publicRow(updated, req.booker, pays()) });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.listCode = listCode;
module.exports.bookingCode = bookingCode;
module.exports.allRows = allRows;
module.exports.frozen = frozen;
module.exports.cleanField = cleanField;
module.exports.currentValue = currentValue;
module.exports.BOOKING = BOOKING;
module.exports.DEFAULT_GOTHRAM = DEFAULT_GOTHRAM;
module.exports.PER_MEMBER_AMOUNT = PER_MEMBER_AMOUNT;
module.exports.paymentsByMember = paymentsByMember;
module.exports.nowIst = nowIst;
module.exports.PAY_DIR = PAY_DIR;
module.exports.payFile = payFile;
