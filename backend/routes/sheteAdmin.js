const express = require('express');
const fs = require('fs');
const path = require('path');
const { query, run } = require('../db');
const { requireAuth, requireAdmin } = require('../auth');

const router = express.Router();
router.use(requireAuth);
router.use(requireAdmin);

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', 'shetenavratri', 'uploads', 'gallery');

function galleryUrl(imageFile) {
  return '/shetenavratri/uploads/gallery/' + imageFile;
}

function parseIds(body) {
  const ids = Array.isArray(body.ids) ? body.ids : [];
  return ids.map(Number).filter(Number.isInteger);
}

// ---- Gallery requests ----

router.get('/gallery/pending', (req, res) => {
  const rows = query(
    `SELECT id, image_file AS imageFile, caption, year, mobile, created_at AS createdAt
     FROM shete_gallery WHERE status = 'pending' ORDER BY id`
  );
  res.json(rows.map(r => ({ ...r, url: galleryUrl(r.imageFile) })));
});

router.post('/gallery/:id/approve', (req, res) => {
  const id = Number(req.params.id);
  const rows = query(`SELECT id FROM shete_gallery WHERE id = ? AND status = 'pending'`, [id]);
  if (!rows.length) return res.status(404).json({ error: 'Request not found or already reviewed.' });
  run(`UPDATE shete_gallery SET status = 'approved', reviewed_at = datetime('now','localtime') WHERE id = ?`, [id]);
  res.json({ ok: true });
});

router.post('/gallery/:id/reject', (req, res) => {
  const id = Number(req.params.id);
  const rows = query(`SELECT id, image_file AS imageFile FROM shete_gallery WHERE id = ? AND status = 'pending'`, [id]);
  if (!rows.length) return res.status(404).json({ error: 'Request not found or already reviewed.' });
  run(`UPDATE shete_gallery SET status = 'rejected', reviewed_at = datetime('now','localtime') WHERE id = ?`, [id]);
  // A rejected photo serves no purpose sitting on disk.
  fs.unlink(path.join(UPLOAD_DIR, rows[0].imageFile), () => {});
  res.json({ ok: true });
});

router.post('/gallery/bulk-approve', (req, res) => {
  const ids = parseIds(req.body);
  if (!ids.length) return res.status(400).json({ error: 'No ids given.' });
  let count = 0;
  for (const id of ids) {
    const rows = query(`SELECT id FROM shete_gallery WHERE id = ? AND status = 'pending'`, [id]);
    if (!rows.length) continue;
    run(`UPDATE shete_gallery SET status = 'approved', reviewed_at = datetime('now','localtime') WHERE id = ?`, [id]);
    count++;
  }
  res.json({ ok: true, approved: count });
});

// ---- Member requests ----

router.get('/members/pending', (req, res) => {
  const rows = query(
    `SELECT id, name, village, mobile, created_at AS createdAt
     FROM shete_member_requests WHERE status = 'pending' ORDER BY id`
  );
  res.json(rows);
});

function approveMemberRequest(id) {
  const rows = query(`SELECT * FROM shete_member_requests WHERE id = ? AND status = 'pending'`, [id]);
  if (!rows.length) return false;
  const reqRow = rows[0];
  // A duplicate may have been approved from elsewhere between submission and
  // review; skip inserting a second row for the same mobile rather than erroring.
  if (query(`SELECT id FROM shete_members WHERE mobile = ?`, [reqRow.mobile]).length === 0) {
    run(`INSERT INTO shete_members (name, village, mobile) VALUES (?,?,?)`, [reqRow.name, reqRow.village, reqRow.mobile]);
  }
  run(`UPDATE shete_member_requests SET status = 'approved', reviewed_at = datetime('now','localtime') WHERE id = ?`, [id]);
  return true;
}

router.post('/members/:id/approve', (req, res) => {
  const ok = approveMemberRequest(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Request not found or already reviewed.' });
  res.json({ ok: true });
});

router.post('/members/:id/reject', (req, res) => {
  const id = Number(req.params.id);
  const rows = query(`SELECT id FROM shete_member_requests WHERE id = ? AND status = 'pending'`, [id]);
  if (!rows.length) return res.status(404).json({ error: 'Request not found or already reviewed.' });
  run(`UPDATE shete_member_requests SET status = 'rejected', reviewed_at = datetime('now','localtime') WHERE id = ?`, [id]);
  res.json({ ok: true });
});

router.post('/members/bulk-approve', (req, res) => {
  const ids = parseIds(req.body);
  if (!ids.length) return res.status(400).json({ error: 'No ids given.' });
  let count = 0;
  for (const id of ids) {
    if (approveMemberRequest(id)) count++;
  }
  res.json({ ok: true, approved: count });
});

// ---- Member roster (edit already-approved entries) ----

const MOBILE_RE = /^[0-9]{10}$/;

router.get('/members', (req, res) => {
  const rows = query(
    `SELECT id, name, name_en AS nameEn, village, village_en AS villageEn, mobile
     FROM shete_members ORDER BY id`
  );
  res.json(rows);
});

router.patch('/members/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = query(`SELECT id FROM shete_members WHERE id = ?`, [id]);
  if (!existing.length) return res.status(404).json({ error: 'सभासद सापडला नाही.' });

  const name = (req.body.name || '').toString().trim();
  const nameEn = (req.body.nameEn || '').toString().trim();
  const village = (req.body.village || '').toString().trim();
  const villageEn = (req.body.villageEn || '').toString().trim();
  const mobile = (req.body.mobile || '').toString().trim();

  if (!name || !village) return res.status(400).json({ error: 'नाव आणि गाव आवश्यक आहे.' });
  if (!MOBILE_RE.test(mobile)) return res.status(400).json({ error: 'कृपया वैध १० अंकी मोबाईल क्रमांक टाका.' });
  const dupe = query(`SELECT id FROM shete_members WHERE mobile = ? AND id != ?`, [mobile, id]);
  if (dupe.length) return res.status(409).json({ error: 'हा मोबाईल क्रमांक आधीच दुसऱ्या सभासदाकडे आहे.' });

  run(
    `UPDATE shete_members SET name = ?, name_en = ?, village = ?, village_en = ?, mobile = ? WHERE id = ?`,
    [name, nameEn || null, village, villageEn || null, mobile, id]
  );
  res.json({ ok: true });
});

module.exports = router;
