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

// Approved photos — listed so an admin can correct a mistyped year afterwards.
router.get('/gallery/approved', (req, res) => {
  const rows = query(
    `SELECT g.id, g.image_file AS imageFile, g.caption, g.year, m.name, m.village
     FROM shete_gallery g LEFT JOIN shete_members m ON m.mobile = g.mobile
     WHERE g.status = 'approved' ORDER BY g.year DESC, g.id DESC`
  );
  res.json(rows.map(r => ({ ...r, url: galleryUrl(r.imageFile) })));
});

router.post('/gallery/set-year', (req, res) => {
  const ids = parseIds(req.body);
  const year = Number(req.body.year);
  if (!ids.length) return res.status(400).json({ error: 'No ids given.' });
  if (!Number.isInteger(year) || year < 1990 || year > new Date().getFullYear()) {
    return res.status(400).json({ error: 'Year must be between 1990 and ' + new Date().getFullYear() + '.' });
  }
  for (const id of ids) {
    run(`UPDATE shete_gallery SET year = ? WHERE id = ? AND status = 'approved'`, [year, id]);
  }
  res.json({ ok: true, updated: ids.length });
});

// Removes an already-approved photo (wrong/duplicate upload) — distinct from
// /reject, which only applies to a still-pending request.
router.delete('/gallery/:id', (req, res) => {
  const id = Number(req.params.id);
  const rows = query(`SELECT id, image_file AS imageFile FROM shete_gallery WHERE id = ?`, [id]);
  if (!rows.length) return res.status(404).json({ error: 'फोटो सापडला नाही.' });
  run(`DELETE FROM shete_gallery WHERE id = ?`, [id]);
  fs.unlink(path.join(UPLOAD_DIR, rows[0].imageFile), () => {});
  res.json({ ok: true });
});

// ---- Member requests ----

router.get('/members/pending', (req, res) => {
  const rows = query(
    `SELECT id, name, village, mobile, alt_mobile AS altMobile, created_at AS createdAt
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
    run(
      `INSERT INTO shete_members (name, village, mobile, alt_mobile) VALUES (?,?,?,?)`,
      [reqRow.name, reqRow.village, reqRow.mobile, reqRow.alt_mobile]
    );
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
    `SELECT id, name, name_en AS nameEn, village, village_en AS villageEn, mobile, alt_mobile AS altMobile
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
  const altMobile = (req.body.altMobile || '').toString().trim();

  if (!name || !village) return res.status(400).json({ error: 'नाव आणि गाव आवश्यक आहे.' });
  if (!MOBILE_RE.test(mobile)) return res.status(400).json({ error: 'कृपया वैध १० अंकी मोबाईल क्रमांक टाका.' });
  if (altMobile && !MOBILE_RE.test(altMobile)) return res.status(400).json({ error: 'पर्यायी क्रमांक १० अंकी असावा.' });
  if (altMobile && altMobile === mobile) return res.status(400).json({ error: 'पर्यायी क्रमांक मुख्य क्रमांकापेक्षा वेगळा असावा.' });
  const dupe = query(`SELECT id FROM shete_members WHERE mobile = ? AND id != ?`, [mobile, id]);
  if (dupe.length) return res.status(409).json({ error: 'हा मोबाईल क्रमांक आधीच दुसऱ्या सभासदाकडे आहे.' });

  run(
    `UPDATE shete_members SET name = ?, name_en = ?, village = ?, village_en = ?, mobile = ?, alt_mobile = ? WHERE id = ?`,
    [name, nameEn || null, village, villageEn || null, mobile, altMobile || null, id]
  );
  res.json({ ok: true });
});

// Removes a member outright — e.g. a duplicate entry whose number has been
// merged into another member's alternate number.
router.delete('/members/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = query(`SELECT id FROM shete_members WHERE id = ?`, [id]);
  if (!existing.length) return res.status(404).json({ error: 'सभासद सापडला नाही.' });
  run(`DELETE FROM shete_members WHERE id = ?`, [id]);
  res.json({ ok: true });
});

// ---- Family trees ----

router.get('/trees', (req, res) => {
  const rows = query(
    `SELECT t.member_id AS memberId, t.owner_name AS ownerName, t.status, t.data,
            t.published IS NOT NULL AS hasPublished, t.updated_at AS updatedAt, m.name, m.mobile
     FROM shete_family_trees t JOIN shete_members m ON m.id = t.member_id
     ORDER BY CASE t.status WHEN 'pending' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, t.updated_at DESC`
  );
  res.json(rows.map(r => ({ ...r, hasPublished: !!r.hasPublished, data: JSON.parse(r.data) })));
});

// Approve: the working copy becomes the published one and is locked.
router.post('/trees/:memberId/approve', (req, res) => {
  const id = Number(req.params.memberId);
  const t = query(`SELECT id FROM shete_family_trees WHERE member_id = ? AND status != 'approved'`, [id])[0];
  if (!t) return res.status(404).json({ error: 'वृक्ष सापडला नाही किंवा आधीच मंजूर.' });
  run(
    `UPDATE shete_family_trees SET published = data, status = 'approved', approved_at = datetime('now','localtime') WHERE id = ?`,
    [t.id]
  );
  res.json({ ok: true });
});

// Reopen: unlock an approved tree for the member to edit. The published copy
// stays visible to everyone until the next approval replaces it.
router.post('/trees/:memberId/reopen', (req, res) => {
  const id = Number(req.params.memberId);
  const t = query(`SELECT id FROM shete_family_trees WHERE member_id = ? AND status = 'approved'`, [id])[0];
  if (!t) return res.status(404).json({ error: 'मंजूर वृक्ष सापडला नाही.' });
  run(`UPDATE shete_family_trees SET status = 'draft' WHERE id = ?`, [t.id]);
  res.json({ ok: true });
});

// Copy one member's tree to other members (brothers/cousins sharing the same
// family). The copy is published and locked straight away — the admin is the
// one choosing it, so there is nothing left to approve. A target's existing
// tree is replaced. Source = its approved copy if it has one, else its draft.
router.post('/trees/:memberId/copy', (req, res) => {
  const srcId = Number(req.params.memberId);
  const src = query(
    `SELECT t.data, t.published, m.name FROM shete_family_trees t JOIN shete_members m ON m.id = t.member_id
     WHERE t.member_id = ?`, [srcId]
  )[0];
  if (!src) return res.status(404).json({ error: 'मूळ वृक्ष सापडला नाही.' });
  const ids = parseIds(req.body).filter(id => id !== srcId);
  if (!ids.length) return res.status(400).json({ error: 'कोणताही सभासद निवडला नाही.' });

  const tree = src.published || src.data;
  const ownerName = 'Admin (' + src.name + ' यांच्या वृक्षावरून कॉपी)';
  let copied = 0;
  for (const id of ids) {
    if (!query(`SELECT id FROM shete_members WHERE id = ?`, [id]).length) continue;
    if (query(`SELECT id FROM shete_family_trees WHERE member_id = ?`, [id]).length) {
      run(
        `UPDATE shete_family_trees SET owner_name = ?, data = ?, published = ?, status = 'approved',
           updated_at = datetime('now','localtime'), approved_at = datetime('now','localtime') WHERE member_id = ?`,
        [ownerName, tree, tree, id]
      );
    } else {
      run(
        `INSERT INTO shete_family_trees (member_id, owner_name, data, published, status, approved_at)
         VALUES (?,?,?,?, 'approved', datetime('now','localtime'))`,
        [id, ownerName, tree, tree]
      );
    }
    copied++;
  }
  res.json({ ok: true, copied });
});

function findTreeNode(node, id) {
  if (String(node.id) === id) return node;
  for (const c of (node.children || [])) {
    const r = findTreeNode(c, id);
    if (r) return r;
  }
  return null;
}

// Reorders one node's children to match `order` (a list of child ids). Child
// ids not in `order` (e.g. one copy has since had a child added/removed) keep
// their existing relative order, appended after the ones that were placed.
function reorderTreeChildren(tree, parentId, order) {
  const parent = findTreeNode(tree, parentId);
  if (!parent || !parent.children || parent.children.length < 2) return false;
  const byId = {};
  parent.children.forEach(c => { byId[String(c.id)] = c; });
  const placed = order.filter(id => byId[id]);
  const rest = parent.children.filter(c => placed.indexOf(String(c.id)) === -1);
  parent.children = placed.map(id => byId[id]).concat(rest);
  return true;
}

// Reorders siblings under one node, and applies the identical order to every
// OTHER tree in the table whose root id matches — i.e. every copy made via
// /copy above, since a copy carries the original node ids forward unchanged.
// A copy that has since diverged (a child added/removed only there) just
// keeps whichever of the requested ids it still has; see reorderTreeChildren.
router.post('/trees/:memberId/reorder', (req, res) => {
  const id = Number(req.params.memberId);
  const parentId = (req.body.parentId || '').toString();
  const order = Array.isArray(req.body.order) ? req.body.order.map(String) : [];
  if (!parentId || order.length < 2) return res.status(400).json({ error: 'अपुरी माहिती.' });

  const src = query(`SELECT data FROM shete_family_trees WHERE member_id = ?`, [id])[0];
  if (!src) return res.status(404).json({ error: 'वृक्ष सापडला नाही.' });
  let rootId;
  try { rootId = JSON.parse(src.data).id; } catch { return res.status(400).json({ error: 'वृक्ष वाचता आला नाही.' }); }

  const rows = query(`SELECT member_id AS memberId, data, published FROM shete_family_trees`);
  let updated = 0;
  for (const row of rows) {
    let data;
    try { data = JSON.parse(row.data); } catch { continue; }
    if (data.id !== rootId) continue;
    if (!reorderTreeChildren(data, parentId, order)) continue;

    let pub = row.published;
    if (pub) {
      try {
        const pubData = JSON.parse(pub);
        if (pubData.id === rootId) { reorderTreeChildren(pubData, parentId, order); pub = JSON.stringify(pubData); }
      } catch { /* leave published as it was if it won't parse */ }
    }
    run(`UPDATE shete_family_trees SET data = ?, published = ?, updated_at = datetime('now','localtime') WHERE member_id = ?`,
      [JSON.stringify(data), pub, row.memberId]);
    updated++;
  }
  res.json({ ok: true, updated });
});

// ---- History list (add/edit/delete) ----

function parseYear(raw) {
  const s = (raw === undefined || raw === null || raw === '') ? null : raw;
  if (s === null) return null;
  const y = Number(s);
  return Number.isInteger(y) ? y : NaN;
}

router.get('/history', (req, res) => {
  const rows = query(
    `SELECT id, name, village, year
     FROM shete_history ORDER BY (year IS NULL), year ASC, id ASC`
  );
  res.json(rows);
});

router.post('/history', (req, res) => {
  const name = (req.body.name || '').toString().trim();
  const village = (req.body.village || '').toString().trim();
  const year = parseYear(req.body.year);

  if (!name) return res.status(400).json({ error: 'यजमानाचे नाव आवश्यक आहे.' });
  if (Number.isNaN(year)) return res.status(400).json({ error: 'वर्ष वैध क्रमांक असावा.' });

  run(`INSERT INTO shete_history (name, village, year) VALUES (?,?,?)`, [name, village || null, year]);
  res.json({ ok: true });
});

router.patch('/history/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = query(`SELECT id FROM shete_history WHERE id = ?`, [id]);
  if (!existing.length) return res.status(404).json({ error: 'नोंद सापडली नाही.' });

  const name = (req.body.name || '').toString().trim();
  const village = (req.body.village || '').toString().trim();
  const year = parseYear(req.body.year);

  if (!name) return res.status(400).json({ error: 'यजमानाचे नाव आवश्यक आहे.' });
  if (Number.isNaN(year)) return res.status(400).json({ error: 'वर्ष वैध क्रमांक असावा.' });

  run(`UPDATE shete_history SET name = ?, village = ?, year = ? WHERE id = ?`, [name, village || null, year, id]);
  res.json({ ok: true });
});

router.delete('/history/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = query(`SELECT id FROM shete_history WHERE id = ?`, [id]);
  if (!existing.length) return res.status(404).json({ error: 'नोंद सापडली नाही.' });
  run(`DELETE FROM shete_history WHERE id = ?`, [id]);
  res.json({ ok: true });
});

// ---- WhatsApp group list ----

// Keeps the last 10 digits, so +91 / 91 / spaces from a phone export all land
// on the same number the members table uses.
function waMobile(raw) {
  const d = (raw || '').toString().replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : '';
}

router.get('/wa', (req, res) => {
  res.json(query(`SELECT id, name, mobile, tree_name AS treeName FROM shete_wa_contacts ORDER BY name = '', name, id`));
});

router.post('/wa', (req, res) => {
  const name = (req.body.name || '').toString().trim();
  const mobile = waMobile(req.body.mobile);
  if (!MOBILE_RE.test(mobile)) return res.status(400).json({ error: 'कृपया वैध १० अंकी मोबाईल क्रमांक टाका.' });
  if (query(`SELECT id FROM shete_wa_contacts WHERE mobile = ?`, [mobile]).length) {
    return res.status(409).json({ error: 'हा क्रमांक आधीच यादीत आहे.' });
  }
  run(`INSERT INTO shete_wa_contacts (name, mobile) VALUES (?,?)`, [name, mobile]);
  res.json({ ok: true });
});

// Bulk import from the WhatsApp group CSV export (parsed in the browser into
// { name, mobile } rows). New numbers are added; a number already on the list
// only gets its name filled in if the admin left it blank.
router.post('/wa/import', (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  let added = 0, updated = 0, skipped = 0;
  for (const r of rows) {
    const mobile = waMobile(r.mobile);
    const name = (r.name || '').toString().trim().slice(0, 100);
    if (!MOBILE_RE.test(mobile)) { skipped++; continue; }
    const existing = query(`SELECT id, name FROM shete_wa_contacts WHERE mobile = ?`, [mobile])[0];
    if (!existing) {
      run(`INSERT INTO shete_wa_contacts (name, mobile) VALUES (?,?)`, [name, mobile]);
      added++;
    } else if (!existing.name && name) {
      run(`UPDATE shete_wa_contacts SET name = ? WHERE id = ?`, [name, existing.id]);
      updated++;
    } else {
      skipped++;
    }
  }
  res.json({ ok: true, added, updated, skipped });
});

router.patch('/wa/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!query(`SELECT id FROM shete_wa_contacts WHERE id = ?`, [id]).length) {
    return res.status(404).json({ error: 'संपर्क सापडला नाही.' });
  }
  const name = (req.body.name || '').toString().trim();
  const mobile = waMobile(req.body.mobile);
  const treeName = (req.body.treeName || '').toString().trim();
  if (!MOBILE_RE.test(mobile)) return res.status(400).json({ error: 'कृपया वैध १० अंकी मोबाईल क्रमांक टाका.' });
  if (query(`SELECT id FROM shete_wa_contacts WHERE mobile = ? AND id != ?`, [mobile, id]).length) {
    return res.status(409).json({ error: 'हा क्रमांक आधीच दुसऱ्या संपर्काकडे आहे.' });
  }
  run(`UPDATE shete_wa_contacts SET name = ?, mobile = ?, tree_name = ? WHERE id = ?`, [name, mobile, treeName || null, id]);
  res.json({ ok: true });
});

router.delete('/wa/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!query(`SELECT id FROM shete_wa_contacts WHERE id = ?`, [id]).length) {
    return res.status(404).json({ error: 'संपर्क सापडला नाही.' });
  }
  run(`DELETE FROM shete_wa_contacts WHERE id = ?`, [id]);
  res.json({ ok: true });
});

module.exports = router;
