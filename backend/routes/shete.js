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
    `SELECT id, name, name_en AS nameEn, village, village_en AS villageEn, mobile
     FROM shete_members ORDER BY id`
  );
  res.json(rows.map((r, i) => ({ ...r, sr: i + 1 })));
});

// Public: submit a new member for the admin to review. No mobile-gating here
// (there is nothing yet to gate against — that is the point of this form) but
// duplicate mobiles are rejected so the same person can't queue twice.
router.post('/members/request', (req, res) => {
  const name = (req.body.name || '').toString().trim();
  const village = (req.body.village || '').toString().trim();
  const mobile = (req.body.mobile || '').toString().trim();

  if (!name || !village || !mobile) {
    return res.status(400).json({ error: 'नाव, गाव आणि मोबाईल क्रमांक आवश्यक आहे.' });
  }
  if (!MOBILE_RE.test(mobile)) {
    return res.status(400).json({ error: 'कृपया वैध १० अंकी मोबाईल क्रमांक टाका.' });
  }
  if (query(`SELECT id FROM shete_members WHERE mobile = ?`, [mobile]).length > 0) {
    return res.status(409).json({ error: 'हा मोबाईल क्रमांक आधीच सभासद यादीत आहे.' });
  }
  if (query(`SELECT id FROM shete_member_requests WHERE mobile = ? AND status = 'pending'`, [mobile]).length > 0) {
    return res.status(409).json({ error: 'या मोबाईल क्रमांकाची विनंती आधीच प्रलंबित आहे.' });
  }

  run(`INSERT INTO shete_member_requests (name, village, mobile) VALUES (?,?,?)`, [name, village, mobile]);
  res.json({ ok: true, message: 'विनंती पाठवली. Admin कडून मंजुरीनंतर सभासद यादीत दिसेल.' });
});

// Public: approved gallery photos only — never the submitter's mobile number.
router.get('/gallery/approved', (req, res) => {
  const rows = query(
    `SELECT id, image_file AS imageFile, caption, year
     FROM shete_gallery WHERE status = 'approved' ORDER BY year DESC, id DESC`
  );
  res.json(rows.map(r => ({ id: r.id, url: galleryUrl(r.imageFile), caption: r.caption, year: r.year })));
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

module.exports = router;
