const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { query, run } = require('../db');

const router = express.Router();

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', 'shetenavratri', 'uploads', 'gallery');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MOBILE_RE = /^[0-9]{10}$/;
const MAX_CAPTION = 200;
const MIN_YEAR = 1990;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype] || '';
      cb(null, crypto.randomBytes(16).toString('hex') + ext);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB — a phone photo comfortably, not a video smuggled in as one
  fileFilter: (req, file, cb) => cb(null, ALLOWED_TYPES.has(file.mimetype)),
});

function currentMaxYear() {
  return new Date().getFullYear();
}

function galleryUrl(imageFile) {
  return '/shetenavratri/uploads/gallery/' + imageFile;
}

// Public: the live, approved member directory. members.html fetches this
// instead of shipping a static data file, so an admin-approved addition shows
// up immediately with no redeploy.
router.get('/members/approved', (req, res) => {
  const rows = query(
    `SELECT m.id, m.name, m.name_en AS nameEn, m.village, m.village_en AS villageEn, m.mobile,
            m.alt_mobile AS altMobile, (t.published IS NOT NULL) AS hasTree
     FROM shete_members m LEFT JOIN shete_family_trees t ON t.member_id = m.id ORDER BY m.id`
  );
  res.json(rows.map((r, i) => ({ ...r, hasTree: !!r.hasTree, sr: i + 1 })));
});

// Public: submit a new member for the admin to review. No mobile-gating here
// (there is nothing yet to gate against — that is the point of this form) but
// duplicate mobiles are rejected so the same person can't queue twice.
router.post('/members/request', (req, res) => {
  const name = (req.body.name || '').toString().trim();
  const village = (req.body.village || '').toString().trim();
  const mobile = (req.body.mobile || '').toString().trim();
  const altMobile = (req.body.altMobile || '').toString().trim();

  if (!name || !village || !mobile) {
    return res.status(400).json({ error: 'नाव, गाव आणि मोबाईल क्रमांक आवश्यक आहे.' });
  }
  if (!MOBILE_RE.test(mobile)) {
    return res.status(400).json({ error: 'कृपया वैध १० अंकी मोबाईल क्रमांक टाका.' });
  }
  if (altMobile && !MOBILE_RE.test(altMobile)) {
    return res.status(400).json({ error: 'पर्यायी क्रमांक १० अंकी असावा.' });
  }
  if (query(`SELECT id FROM shete_members WHERE mobile = ?`, [mobile]).length > 0) {
    return res.status(409).json({ error: 'हा मोबाईल क्रमांक आधीच सभासद यादीत आहे.' });
  }
  if (query(`SELECT id FROM shete_member_requests WHERE mobile = ? AND status = 'pending'`, [mobile]).length > 0) {
    return res.status(409).json({ error: 'या मोबाईल क्रमांकाची विनंती आधीच प्रलंबित आहे.' });
  }

  run(
    `INSERT INTO shete_member_requests (name, village, mobile, alt_mobile) VALUES (?,?,?,?)`,
    [name, village, mobile, altMobile && altMobile !== mobile ? altMobile : null]
  );
  res.json({ ok: true, message: 'विनंती पाठवली. Admin कडून मंजुरीनंतर सभासद यादीत दिसेल.' });
});

// Public: approved gallery photos only — never the submitter's mobile number.
router.get('/gallery/approved', (req, res) => {
  // Name and village come from the member directory (looked up by the
  // submitter's mobile, which is never returned); the year is the photo's own.
  const rows = query(
    `SELECT g.id, g.image_file AS imageFile, g.caption, g.year, m.id AS memberId,
            m.name, m.village
     FROM shete_gallery g LEFT JOIN shete_members m ON m.mobile = g.mobile
     WHERE g.status = 'approved' ORDER BY g.year DESC, g.id DESC`
  );
  res.json(rows.map(r => ({
    id: r.id, url: galleryUrl(r.imageFile), caption: r.caption, year: r.year,
    name: r.name || '', village: r.village || '', member: r.memberId,
  })));
});

// Public: the Navratri history list, edited from the admin page directly
// (no request/approval queue — this is the admin's own record, not something
// friends submit). Ordered by year, with sr 31's null year sorted to the end.
router.get('/history', (req, res) => {
  const rows = query(
    `SELECT id, name, village, year
     FROM shete_history ORDER BY (year IS NULL), year ASC, id ASC`
  );
  res.json(rows.map((r, i) => ({ ...r, sr: i + 1 })));
});

// Public: submit a photo for the gallery. Gated on membership — the mobile
// number must already be in shete_members — but even a match only reaches the
// pending queue; nothing here ever writes status='approved'.
router.post('/gallery/request', (req, res) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'फोटो 8MB पेक्षा लहान असावा.' : 'फोटो अपलोड अयशस्वी.' });
    }
    const cleanup = () => { if (req.file) fs.unlink(req.file.path, () => {}); };

    const caption = (req.body.caption || '').toString().trim();
    const yearRaw = (req.body.year || '').toString().trim();
    const mobile = (req.body.mobile || '').toString().trim();
    const year = parseInt(yearRaw, 10);

    if (!req.file) {
      return res.status(400).json({ error: 'कृपया एक फोटो निवडा (JPG/PNG/WebP, 8MB पर्यंत).' });
    }
    if (!caption || caption.length > MAX_CAPTION) {
      cleanup();
      return res.status(400).json({ error: `कॅप्शन आवश्यक आहे (जास्तीत जास्त ${MAX_CAPTION} अक्षरे).` });
    }
    if (!Number.isInteger(year) || year < MIN_YEAR || year > currentMaxYear()) {
      cleanup();
      return res.status(400).json({ error: `वर्ष ${MIN_YEAR} ते ${currentMaxYear()} दरम्यान असावे.` });
    }
    if (!MOBILE_RE.test(mobile)) {
      cleanup();
      return res.status(400).json({ error: 'कृपया वैध १० अंकी मोबाईल क्रमांक टाका.' });
    }
    if (query(`SELECT id FROM shete_members WHERE mobile = ?`, [mobile]).length === 0) {
      cleanup();
      return res.status(403).json({ error: 'फक्त सभासद यादीतील मोबाईल क्रमांकानेच फोटो अपलोड करता येईल.' });
    }

    run(
      `INSERT INTO shete_gallery (image_file, caption, year, mobile) VALUES (?,?,?,?)`,
      [req.file.filename, caption, year, mobile]
    );
    res.json({ ok: true, message: 'फोटो सबमिट झाला. Admin कडून मंजुरीनंतर गॅलरीत दिसेल.' });
  });
});

// ---- Family tree ----
// A tree is nested JSON: { id, name, spouse, children: [...] }, root = मूळपुरुष.
// The client's tree is never stored as sent — sanitizeTree() rebuilds it from
// the allowed fields only, with size/depth caps.
const TREE_MAX_NODES = 400;
const TREE_MAX_DEPTH = 15;
const TREE_NAME_MAX = 80;

function sanitizeTree(node) {
  let count = 0;
  function walk(n, depth) {
    if (!n || typeof n !== 'object') throw new Error('अवैध वृक्ष.');
    if (++count > TREE_MAX_NODES) throw new Error(`जास्तीत जास्त ${TREE_MAX_NODES} व्यक्ती जोडता येतील.`);
    if (depth > TREE_MAX_DEPTH) throw new Error(`जास्तीत जास्त ${TREE_MAX_DEPTH} पिढ्या जोडता येतील.`);
    const name = (n.name || '').toString().trim().slice(0, TREE_NAME_MAX);
    if (!name) throw new Error('प्रत्येक व्यक्तीचे नाव आवश्यक आहे.');
    const id = /^[a-z0-9]{1,24}$/.test(n.id) ? n.id : crypto.randomBytes(6).toString('hex');
    const kids = Array.isArray(n.children) ? n.children : [];
    return {
      id,
      name,
      spouse: (n.spouse || '').toString().trim().slice(0, TREE_NAME_MAX),
      dead: n.dead === true,
      spouseDead: n.spouseDead === true,
      children: kids.map(k => walk(k, depth + 1)),
    };
  }
  return walk(node, 1);
}

function memberByMobile(mobile) {
  if (!MOBILE_RE.test(mobile)) return null;
  return query(
    `SELECT id, name FROM shete_members WHERE mobile = ? OR alt_mobile = ?`, [mobile, mobile]
  )[0] || null;
}

function treeState(memberId) {
  const t = query(`SELECT * FROM shete_family_trees WHERE member_id = ?`, [memberId])[0];
  if (!t) return { status: 'none', data: null, hasPublished: false };
  return { status: t.status, data: JSON.parse(t.data), hasPublished: !!t.published, ownerName: t.owner_name };
}

function ownerNameFrom(body) {
  const parts = ['firstName', 'fatherName', 'surname'].map(k => (body[k] || '').toString().trim().slice(0, 40));
  return parts.every(Boolean) ? parts.join(' ') : null;
}

// Identify the member (full name + registered mobile) and return their tree.
router.post('/tree/login', (req, res) => {
  const ownerName = ownerNameFrom(req.body);
  if (!ownerName) return res.status(400).json({ error: 'नाव, वडिलांचे नाव आणि आडनाव आवश्यक आहे.' });
  const member = memberByMobile((req.body.mobile || '').toString().trim());
  if (!member) return res.status(403).json({ error: 'हा मोबाईल क्रमांक सभासद यादीत नाही.' });
  res.json({ memberId: member.id, memberName: member.name, ownerName, ...treeState(member.id) });
});

// Save (draft) or submit (pending) the working copy. Refused once approved.
router.put('/tree', (req, res) => {
  const ownerName = ownerNameFrom(req.body);
  if (!ownerName) return res.status(400).json({ error: 'नाव, वडिलांचे नाव आणि आडनाव आवश्यक आहे.' });
  const member = memberByMobile((req.body.mobile || '').toString().trim());
  if (!member) return res.status(403).json({ error: 'हा मोबाईल क्रमांक सभासद यादीत नाही.' });

  let tree;
  try { tree = sanitizeTree(req.body.data); } catch (e) { return res.status(400).json({ error: e.message }); }
  const status = req.body.submit ? 'pending' : 'draft';

  const existing = query(`SELECT id, status FROM shete_family_trees WHERE member_id = ?`, [member.id])[0];
  if (existing && existing.status === 'approved') {
    return res.status(423).json({ error: 'वृक्ष मंजूर झाला आहे. बदलासाठी Admin शी संपर्क करा.' });
  }
  if (existing) {
    run(
      `UPDATE shete_family_trees SET owner_name = ?, data = ?, status = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
      [ownerName, JSON.stringify(tree), status, existing.id]
    );
  } else {
    run(
      `INSERT INTO shete_family_trees (member_id, owner_name, data, status) VALUES (?,?,?,?)`,
      [member.id, ownerName, JSON.stringify(tree), status]
    );
  }
  res.json({
    ok: true, status, data: tree,
    message: status === 'pending' ? 'वृक्ष मंजुरीसाठी पाठवला. मंजुरीपर्यंत बदल करता येतील.' : 'वृक्ष जतन केला.',
  });
});

// Public: the published (approved) tree only — never the working copy.
router.get('/tree/:memberId', (req, res) => {
  const t = query(
    `SELECT t.published, t.owner_name AS ownerName, t.approved_at AS approvedAt, m.name AS memberName
     FROM shete_family_trees t JOIN shete_members m ON m.id = t.member_id
     WHERE t.member_id = ? AND t.published IS NOT NULL`, [Number(req.params.memberId)]
  )[0];
  if (!t) return res.status(404).json({ error: 'प्रकाशित कुटुंब वृक्ष सापडला नाही.' });
  res.json({ memberName: t.memberName, ownerName: t.ownerName, approvedAt: t.approvedAt, data: JSON.parse(t.published) });
});

module.exports = router;
