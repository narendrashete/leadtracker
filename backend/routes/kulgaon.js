// Kulgaon gat member list at /kulgaon — the Thane Jilha Maharashtriya Vaishya
// Samaj Sangh voter list (as of 30/9/2024), transcribed from the printed PDF.
//
// Public and anonymous by the owner's choice: anyone with the link can search
// the list and SUGGEST a change (मयत/हयात, a correction, a new member). A
// suggestion changes nothing by itself — it waits in kulgaon_requests until an
// admin approves it (routes/kulgaonAdmin.js). Nothing about the sender is
// stored: no name, no mobile, no address, and only the day it arrived, so the
// admin sees what was asked, never who asked.
//
// The list lives in kulgaon_members. It is loaded once from the transcribed
// kulgaon/members.json — uploaded through the admin page, or found on disk at
// boot. The file is git-ignored (private individuals' data; the repo is public).
const express = require('express');
const fs = require('fs');
const path = require('path');
const { query, run, runMany } = require('../db');

const router = express.Router();

const MEMBERS_FILE = path.resolve(__dirname, '..', '..', 'kulgaon', 'members.json');
const STATUSES = new Set(['alive', 'dead', 'double']);
const SEED_NOTES = {
  dead: 'मूळ छापील यादीत खोडलेले नाव',
  double: 'मूळ यादीत डबल नाव — वगळलेले',
};
const MAX_PENDING = 500;

// Per-address cap on suggestions. In memory only — never stored or shown.
const RATE_WINDOW = 60 * 60 * 1000;
const RATE_MAX = 20;
const recent = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter(t => now - t < RATE_WINDOW);
  const limited = hits.length >= RATE_MAX;
  if (!limited) hits.push(now);
  recent.set(ip, hits);
  return limited;
}

// Validates member fields. Only keys present in `b` are returned, so the same
// function serves a full record (add/import) and a partial one (correction).
// `admin` additionally allows status and note.
function cleanMember(b, { admin = false } = {}) {
  const out = {};
  const str = (v, n) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, n) || null;
  if ('name' in b) out.name = str(b.name, 80);
  if ('nameEn' in b) out.nameEn = str(b.nameEn, 80);
  if ('gender' in b) {
    if (!['M', 'F', '', null].includes(b.gender)) return { error: 'स्त्री/पुरुष निवडा.' };
    out.gender = b.gender || null;
  }
  if ('age' in b) {
    const raw = String(b.age ?? '').trim();
    const age = raw === '' ? null : parseInt(raw.replace(/[०-९]/g, d => '०१२३४५६७८९'.indexOf(d)), 10);
    if (age !== null && !(age >= 1 && age <= 120)) return { error: 'वय योग्य नाही.' };
    out.age = age;
  }
  if ('receipt' in b) out.receipt = str(b.receipt, 30);
  if ('date' in b) out.date = str(b.date, 20);
  if (admin && 'status' in b) {
    if (!STATUSES.has(b.status)) return { error: 'अवैध स्थिती.' };
    out.status = b.status;
  }
  if (admin && 'note' in b) out.note = str(b.note, 200);
  return { value: out };
}

function shapeMember(r) {
  return {
    sr: r.sr, name: r.name, nameEn: r.name_en || '', gender: r.gender, age: r.age,
    receipt: r.receipt, date: r.reg_date, status: r.status, note: r.note || '',
  };
}

const memberCount = () => query(`SELECT COUNT(*) AS n FROM kulgaon_members`)[0].n;

// Loads a whole list into an EMPTY table. Refuses once members exist, so a
// second upload can never wipe out approved changes.
function importMembers(list) {
  if (memberCount() > 0) return { error: 'यादी आधीच लोड झाली आहे.' };
  if (!Array.isArray(list) || !list.length) return { error: 'यादी रिकामी आहे.' };
  const seen = new Set();
  const rows = [];
  for (const m of list) {
    const sr = Number(m && m.sr);
    if (!Number.isInteger(sr) || sr < 1 || seen.has(sr)) return { error: `क्रमांक ${m && m.sr} चुकीचा किंवा दोनदा आहे.` };
    seen.add(sr);
    const status = STATUSES.has(m.status) ? m.status : 'alive';
    const c = cleanMember({ ...m, status, note: m.note || SEED_NOTES[status] || '' }, { admin: true });
    if (c.error || !c.value.name) return { error: `क्रमांक ${sr}: ${c.error || 'नाव नाही.'}` };
    const v = c.value;
    rows.push([sr, v.name, v.nameEn, v.gender, v.age, v.receipt, v.date, v.status, v.note]);
  }
  runMany(
    `INSERT INTO kulgaon_members (sr, name, name_en, gender, age, receipt, reg_date, status, note, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))`,
    rows
  );
  return { value: rows.length };
}

// The file on disk is the other way in: if it is there and the table is empty
// (fresh install, or copied by hand), load it.
function seedFromFile() {
  if (memberCount() > 0 || !fs.existsSync(MEMBERS_FILE)) return;
  try {
    const r = importMembers(JSON.parse(fs.readFileSync(MEMBERS_FILE, 'utf8')));
    if (r.error) console.warn('Kulgaon member list not loaded:', r.error);
    else console.log(`Kulgaon member list loaded from file: ${r.value} members.`);
  } catch (err) {
    console.warn('Kulgaon member list not loaded:', err.message);
  }
}
seedFromFile();

function listMembers() {
  return query(`SELECT * FROM kulgaon_members ORDER BY sr`).map(shapeMember);
}

router.use((req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});

router.get('/members', (req, res) => {
  seedFromFile();
  const list = listMembers();
  if (!list.length) return res.status(503).json({ error: 'सभासद यादी अजून उपलब्ध नाही.' });
  res.json(list);
});

// One endpoint for all three kinds of suggestion:
//   status — { kind, sr, data: { status: 'dead' | 'alive' } }
//   edit   — { kind, sr, data: { only the fields that change } }
//   add    — { kind, data: { name or nameEn, gender, age, receipt, date } }
// plus an optional free-text `message` for the admin.
router.post('/requests', (req, res, next) => {
  try {
    const b = req.body || {};
    const kind = String(b.kind || '');
    const data = b.data && typeof b.data === 'object' ? b.data : {};
    const message = String(b.message || '').trim().slice(0, 400) || null;
    let sr = null;
    let clean;

    if (kind === 'status' || kind === 'edit') {
      sr = parseInt(b.sr, 10);
      const member = query(`SELECT * FROM kulgaon_members WHERE sr = ?`, [sr])[0];
      if (!member) return res.status(404).json({ error: 'सभासद सापडला नाही.' });
      if (member.status === 'double') return res.status(400).json({ error: 'हे डबल नाव यादीतून वगळलेले आहे.' });
      if (kind === 'status') {
        if (!['alive', 'dead'].includes(data.status)) return res.status(400).json({ error: 'अवैध स्थिती.' });
        if (data.status === member.status) return res.status(400).json({ error: 'यादीत हीच स्थिती आधीच आहे.' });
        clean = { status: data.status };
      } else {
        const c = cleanMember(data);
        if (c.error) return res.status(400).json({ error: c.error });
        // Keep only real changes, so the admin sees exactly what is being asked.
        const cur = shapeMember(member);
        clean = {};
        for (const [k, v] of Object.entries(c.value)) {
          if ((v ?? null) !== (cur[k] === '' ? null : cur[k] ?? null)) clean[k] = v;
        }
        if ('name' in clean && !clean.name) return res.status(400).json({ error: 'नाव रिकामे ठेवता येणार नाही.' });
        if (!Object.keys(clean).length && !message) return res.status(400).json({ error: 'काहीच बदल केलेला नाही.' });
      }
    } else if (kind === 'add') {
      const c = cleanMember({ name: '', nameEn: '', gender: '', age: '', receipt: '', date: '', ...data });
      if (c.error) return res.status(400).json({ error: c.error });
      if (!c.value.name && !c.value.nameEn) return res.status(400).json({ error: 'कृपया सभासदाचे नाव लिहा.' });
      clean = c.value;
    } else {
      return res.status(400).json({ error: 'अवैध विनंती.' });
    }

    const pending = query(`SELECT kind, sr, data, message FROM kulgaon_requests WHERE state = 'pending'`);
    if (pending.length >= MAX_PENDING) {
      return res.status(503).json({ error: 'सध्या खूप विनंत्या प्रलंबित आहेत. कृपया नंतर प्रयत्न करा.' });
    }
    const json = JSON.stringify(clean);
    const dup = pending.some(p => p.kind === kind && p.sr === sr && p.data === json && (p.message || null) === message);
    if (!dup) {
      if (rateLimited(req.ip)) {
        return res.status(429).json({ error: 'खूप विनंत्या पाठवल्या आहेत. कृपया थोड्या वेळाने प्रयत्न करा.' });
      }
      run(
        `INSERT INTO kulgaon_requests (kind, sr, data, message, created_on) VALUES (?, ?, ?, ?, date('now','localtime'))`,
        [kind, sr, json, message]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.cleanMember = cleanMember;
router.shapeMember = shapeMember;
router.importMembers = importMembers;
router.listMembers = listMembers;
module.exports = router;
