// Admin side of the Kulgaon gat member list (/kulgaon/admin). Approving a
// suggestion is the only way a member's change reaches the public list; the
// admin can also edit or add members directly, and loads the list itself the
// first time. Mounted separately from /api/kulgaon, the same split as
// /api/shete-admin, so the public surface can never approve its own requests.
//
// Requests carry no information about who sent them (see routes/kulgaon.js),
// and nobody is notified of a decision — the list simply changes.
const express = require('express');
const { query, run } = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const kulgaon = require('./kulgaon');

const router = express.Router();
router.use(requireAuth);
router.use(requireAdmin);

const COLUMNS = { name: 'name', nameEn: 'name_en', gender: 'gender', age: 'age', receipt: 'receipt', date: 'reg_date', status: 'status', note: 'note' };

function getMember(sr) {
  const r = query(`SELECT * FROM kulgaon_members WHERE sr = ?`, [sr])[0];
  return r ? kulgaon.shapeMember(r) : null;
}

function updateMember(sr, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  run(
    `UPDATE kulgaon_members SET ${keys.map(k => COLUMNS[k] + ' = ?').join(', ')},
       updated_at = datetime('now','localtime') WHERE sr = ?`,
    [...keys.map(k => fields[k]), sr]
  );
}

// New members go on the end of the list, numbered by the server.
function addMember(fields) {
  const sr = query(`SELECT COALESCE(MAX(sr), 0) + 1 AS next FROM kulgaon_members`)[0].next;
  run(
    `INSERT INTO kulgaon_members (sr, name, name_en, gender, age, receipt, reg_date, status, note, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))`,
    [sr, fields.name, fields.nameEn, fields.gender, fields.age, fields.receipt, fields.date,
      fields.status || 'alive', fields.note]
  );
  return sr;
}

function shapeRequest(r) {
  return {
    id: r.id, kind: r.kind, sr: r.sr, data: JSON.parse(r.data), message: r.message || '',
    state: r.state, createdOn: r.created_on, decidedOn: r.decided_on, resultSr: r.result_sr,
    member: r.sr ? getMember(r.sr) : null,
  };
}

// Loads the transcribed list (members.json) into the empty table.
router.post('/import', (req, res, next) => {
  try {
    const r = kulgaon.importMembers(req.body && req.body.members);
    if (r.error) return res.status(400).json({ error: r.error });
    res.json({ ok: true, count: r.value });
  } catch (err) {
    next(err);
  }
});

router.get('/summary', (req, res) => {
  res.json({
    members: query(`SELECT COUNT(*) AS n FROM kulgaon_members`)[0].n,
    pending: query(`SELECT COUNT(*) AS n FROM kulgaon_requests WHERE state = 'pending'`)[0].n,
  });
});

router.get('/members', (req, res) => {
  res.json(kulgaon.listMembers());
});

router.put('/members/:sr', (req, res, next) => {
  try {
    const sr = parseInt(req.params.sr, 10);
    if (!getMember(sr)) return res.status(404).json({ error: 'सभासद सापडला नाही.' });
    const c = kulgaon.cleanMember(req.body || {}, { admin: true });
    if (c.error) return res.status(400).json({ error: c.error });
    if ('name' in c.value && !c.value.name) return res.status(400).json({ error: 'नाव रिकामे ठेवता येणार नाही.' });
    updateMember(sr, c.value);
    res.json(getMember(sr));
  } catch (err) {
    next(err);
  }
});

router.post('/members', (req, res, next) => {
  try {
    const c = kulgaon.cleanMember(
      { name: '', nameEn: '', gender: '', age: '', receipt: '', date: '', status: 'alive', note: '', ...req.body },
      { admin: true }
    );
    if (c.error) return res.status(400).json({ error: c.error });
    if (!c.value.name) return res.status(400).json({ error: 'मराठी नाव आवश्यक आहे.' });
    res.json(getMember(addMember(c.value)));
  } catch (err) {
    next(err);
  }
});

router.get('/requests', (req, res) => {
  const pending = req.query.state !== 'decided';
  const rows = query(
    pending
      ? `SELECT * FROM kulgaon_requests WHERE state = 'pending' ORDER BY id`
      : `SELECT * FROM kulgaon_requests WHERE state != 'pending' ORDER BY id DESC LIMIT 100`
  );
  res.json(rows.map(shapeRequest));
});

// Approves with the data as sent, or as the admin adjusted it in the form.
router.post('/requests/:id/approve', (req, res, next) => {
  try {
    const r = query(`SELECT * FROM kulgaon_requests WHERE id = ? AND state = 'pending'`, [req.params.id])[0];
    if (!r) return res.status(404).json({ error: 'विनंती सापडली नाही (आधीच निर्णय झाला असेल).' });
    const body = req.body && req.body.data ? req.body.data : JSON.parse(r.data);
    const c = kulgaon.cleanMember(body, { admin: true });
    if (c.error) return res.status(400).json({ error: c.error });
    const fields = c.value;

    let resultSr = r.sr;
    if (r.kind === 'add') {
      if (!fields.name) return res.status(400).json({ error: 'मराठी नाव आवश्यक आहे.' });
      resultSr = addMember(fields);
    } else {
      if (!getMember(r.sr)) return res.status(404).json({ error: 'सभासद आता यादीत नाही.' });
      if ('name' in fields && !fields.name) return res.status(400).json({ error: 'नाव रिकामे ठेवता येणार नाही.' });
      updateMember(r.sr, fields);
    }
    run(
      `UPDATE kulgaon_requests SET state = 'approved', decided_on = date('now','localtime'), result_sr = ? WHERE id = ?`,
      [resultSr, r.id]
    );
    res.json({ ok: true, sr: resultSr });
  } catch (err) {
    next(err);
  }
});

router.post('/requests/:id/reject', (req, res, next) => {
  try {
    const r = query(`SELECT id FROM kulgaon_requests WHERE id = ? AND state = 'pending'`, [req.params.id])[0];
    if (!r) return res.status(404).json({ error: 'विनंती सापडली नाही (आधीच निर्णय झाला असेल).' });
    run(`UPDATE kulgaon_requests SET state = 'rejected', decided_on = date('now','localtime') WHERE id = ?`, [r.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
