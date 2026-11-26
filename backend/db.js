const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'leads.db');

let _db = null;

// Initial rosters for the shared availability calendar. Seeded once; after that
// the groups are edited in the app, so changing this has no effect on a live DB.
const CALENDAR_SEED_GROUPS = [
  {
    group_key: 'funda', name_en: 'Funda', name_mr: 'फंडा', sort_order: 1,
    members: [
      { id: 'narendra', en: 'Narendra', mr: 'नरेंद्र', color: '#E4572E' },
      { id: 'vivek',    en: 'Vivek',    mr: 'विवेक',   color: '#2E86AB' },
      { id: 'prasad',   en: 'Prasad',   mr: 'प्रसाद',  color: '#5E8C3F' },
      { id: 'bhushan',  en: 'Bhushan',  mr: 'भूषण',    color: '#8E5BD8' },
      { id: 'mishal',   en: 'Mishal',   mr: 'मिशाल',   color: '#D9A404' },
      { id: 'pant',     en: 'Pant',     mr: 'पंत',     color: '#C42A67' }
    ]
  },
  {
    group_key: 'thigdam', name_en: 'Thigdam', name_mr: 'ठिगडम', sort_order: 2,
    members: [
      { id: 'narendra',  en: 'Narendra',  mr: 'नरेंद्र',   color: '#E4572E' },
      { id: 'siddharth', en: 'Siddharth', mr: 'सिद्धार्थ', color: '#2E86AB' },
      { id: 'riyaz',     en: 'Riyaz',     mr: 'रियाझ',     color: '#5E8C3F' }
    ]
  }
];

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const h = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return h === hash;
}

async function getDb() {
  if (_db) return _db;

  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(fileBuffer);
  } else {
    _db = new SQL.Database();
  }

  _db.run(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      enquiry_id TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      company_name TEXT NOT NULL,
      contact_person TEXT,
      contact_no TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      required_software TEXT,
      customer_description TEXT,
      committed_to_customer TEXT,
      next_followup_date TEXT,
      status TEXT NOT NULL DEFAULT 'In-Process',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
  // Existing databases predate the address/city/state columns — add them if missing.
  for (const col of ['address', 'city', 'state', 'source', 'product', 'category']) {
    try {
      _db.run(`ALTER TABLE leads ADD COLUMN ${col} TEXT`);
    } catch { /* column already exists */ }
  }
  _db.run(`
    CREATE TABLE IF NOT EXISTS followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id),
      followup_date TEXT NOT NULL,
      discussion TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
  _db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);

  // Shared availability calendar (mokla-divas). Public, code-gated, independent
  // of the lead pipeline — it shares this database file only for storage.
  // Small key/value store for install-level values that belong to no feature.
  // Currently holds only the visitor-counting salt.
  _db.run(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // One row per visitor per page per day. Unique visitors for a day are the
  // rows; views are their summed counters. `visitor` is a salted hash, never an
  // address — see analytics.js for why it is only comparable within one day.
  _db.run(`
    CREATE TABLE IF NOT EXISTS page_hits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      page TEXT NOT NULL,
      visitor TEXT NOT NULL,
      views INTEGER NOT NULL DEFAULT 1,
      first_seen TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
  // Integrity, not speed: one row per visitor per page per day, so a reload
  // bumps the counter instead of inventing a second visitor.
  try {
    _db.run(`CREATE UNIQUE INDEX IF NOT EXISTS page_hits_unique
             ON page_hits (day, page, visitor)`);
  } catch { /* index already exists */ }


  _db.run(`
    CREATE TABLE IF NOT EXISTS calendar_spaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      share_code TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
  _db.run(`
    CREATE TABLE IF NOT EXISTS calendar_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_key TEXT UNIQUE NOT NULL,
      name_en TEXT NOT NULL,
      name_mr TEXT,
      sort_order INTEGER NOT NULL DEFAULT 99,
      members TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
  _db.run(`
    CREATE TABLE IF NOT EXISTS calendar_marks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_key TEXT NOT NULL,
      mark_date TEXT NOT NULL,
      member_id TEXT NOT NULL,
      mark_kind TEXT NOT NULL DEFAULT 'busy',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
  // A mark is either 'busy' (cannot make it) or 'prefer' (would like this date
  // for the event). Databases predating the second kind get the column here.
  try {
    _db.run(`ALTER TABLE calendar_marks ADD COLUMN mark_kind TEXT NOT NULL DEFAULT 'busy'`);
  } catch { /* column already exists */ }

  // Integrity, not speed: one friend, one mark of each kind per date. The old
  // index left mark_kind out, which would have collapsed the two kinds into one
  // row, so it is replaced. Dropping an index discards no data.
  try { _db.run(`DROP INDEX IF EXISTS calendar_marks_unique`); } catch { /* never existed */ }
  try {
    _db.run(`CREATE UNIQUE INDEX IF NOT EXISTS calendar_marks_unique_kind
             ON calendar_marks (group_key, mark_date, member_id, mark_kind)`);
  } catch { /* index already exists */ }

  // calendar_spaces held the original single install-wide code. Each group now
  // carries its own, so this table only survives to donate that original code to
  // the first group below, keeping a link already handed out working.
  if (query(`SELECT id FROM calendar_spaces`).length === 0) {
    const code = process.env.CALENDAR_SHARE_CODE || crypto.randomBytes(6).toString('hex');
    _db.run(`INSERT INTO calendar_spaces (share_code) VALUES (?)`, [code]);
  }

  if (query(`SELECT id FROM calendar_groups`).length === 0) {
    for (const g of CALENDAR_SEED_GROUPS) {
      _db.run(
        `INSERT INTO calendar_groups (group_key, name_en, name_mr, sort_order, members)
         VALUES (?,?,?,?,?)`,
        [g.group_key, g.name_en, g.name_mr, g.sort_order, JSON.stringify(g.members)]
      );
    }
  }

  // One share code per GROUP: a friend's link resolves to exactly one group, so
  // they never see another group or its members.
  try {
    _db.run(`ALTER TABLE calendar_groups ADD COLUMN share_code TEXT`);
  } catch { /* column already exists */ }

  const uncoded = query(
    `SELECT id FROM calendar_groups WHERE share_code IS NULL OR share_code = '' ORDER BY sort_order, id`
  );
  if (uncoded.length > 0) {
    const legacy = query(`SELECT share_code FROM calendar_spaces ORDER BY id LIMIT 1`);
    const firstHasCode = query(`SELECT id FROM calendar_groups WHERE share_code IS NOT NULL AND share_code != ''`).length > 0;
    uncoded.forEach((row, i) => {
      // The very first group inherits the old install-wide code so a link already
      // shared with friends keeps working — and now points at just that group.
      const inherit = i === 0 && !firstHasCode && legacy.length > 0;
      const code = inherit ? legacy[0].share_code : crypto.randomBytes(6).toString('hex');
      _db.run(`UPDATE calendar_groups SET share_code = ? WHERE id = ?`, [code, row.id]);
    });
  }
  try {
    _db.run(`CREATE UNIQUE INDEX IF NOT EXISTS calendar_groups_share_code
             ON calendar_groups (share_code)`);
  } catch { /* index already exists */ }

  // Rishta Album (shared marriage-profile album). Parsed profile JSON per row;
  // status/note/edits kept as their own columns so a PDF re-import (which only
  // rewrites `data`) can never wipe the family's shortlist or notes. Images are
  // files in rishta-data/images, not blobs here.
  _db.run(`
    CREATE TABLE IF NOT EXISTS rishta_profiles (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      note TEXT NOT NULL DEFAULT '',
      edits TEXT NOT NULL DEFAULT '{}',
      first_seen TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  _db.run(`
    CREATE TABLE IF NOT EXISTS rishta_imports (
      id TEXT PRIMARY KEY,
      name TEXT,
      title TEXT,
      at TEXT NOT NULL,
      pages INTEGER,
      added INTEGER,
      updated INTEGER
    )
  `);
  // Thigdam — the friends' group photo album at /thigdam. One row per photo;
  // the photo itself (original bytes, never re-encoded) and its small preview
  // are files in thigdam-data/photos, not blobs here, because run() rewrites
  // this whole file on every write. note/taken_on/taken_year/added_by are all
  // optional. owner_token lets the browser that uploaded a photo delete it.
  _db.run(`
    CREATE TABLE IF NOT EXISTS thigdam_photos (
      id TEXT PRIMARY KEY,
      file TEXT NOT NULL,
      thumb TEXT,
      mime TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      note TEXT,
      taken_on TEXT,
      taken_year INTEGER,
      added_by TEXT,
      owner_token TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT
    )
  `);

  // Kulgaon gat member list at /kulgaon. kulgaon_members is the list itself
  // (sr = list number), loaded once from the transcribed members.json and
  // changed only by an admin. kulgaon_requests holds the public's anonymous
  // suggestions (kind status/edit/add, proposed fields as JSON in data) until
  // an admin approves or rejects them. Deliberately no column about the sender,
  // and only the day it arrived.
  _db.run(`
    CREATE TABLE IF NOT EXISTS kulgaon_members (
      sr INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      name_en TEXT,
      gender TEXT,
      age INTEGER,
      receipt TEXT,
      reg_date TEXT,
      status TEXT NOT NULL DEFAULT 'alive',
      note TEXT,
      updated_at TEXT
    )
  `);
  _db.run(`
    CREATE TABLE IF NOT EXISTS kulgaon_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      sr INTEGER,
      data TEXT NOT NULL,
      message TEXT,
      state TEXT NOT NULL DEFAULT 'pending',
      created_on TEXT NOT NULL,
      decided_on TEXT,
      result_sr INTEGER
    )
  `);

  // Naka Family yatra consent poll at /nakayatra. One row per invited member;
  // `code` is that member's personal link (/nakayatra/<code>) and is the only
  // thing that lets anyone answer as them. Names are entered through the admin
  // page, never committed (this repo is public). nakayatra_settings holds the
  // freeze flag (key 'frozen', '1' = answers closed).
  _db.run(`
    CREATE TABLE IF NOT EXISTS nakayatra_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      response TEXT,
      responded_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
  // The yatra's final travellers list (/nakayatra/list/<code>): ID details the
  // members check and correct themselves, no approval. Loaded by the admin
  // (paste), never committed — Aadhaar numbers, public repo. corrected_at /
  // corrected_fields flag a member's change; history keeps old → new values
  // for the admin's download only.
  _db.run(`
    CREATE TABLE IF NOT EXISTS nakayatra_final (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sr INTEGER NOT NULL,
      name TEXT NOT NULL,
      aadhaar TEXT,
      age INTEGER,
      mobile TEXT,
      corrected_at TEXT,
      corrected_fields TEXT,
      history TEXT
    )
  `);
  _db.run(`
    CREATE TABLE IF NOT EXISTS nakayatra_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // Gothram for the TTD darshan booking form, added after the list was loaded.
  // NULL means the group default (Kashyap, set in routes/nakayatraList.js).
  try {
    _db.run(`ALTER TABLE nakayatra_final ADD COLUMN gothram TEXT`);
  } catch { /* column already exists */ }

  // Yatra contribution payments, entered by the admin per final-list member
  // (amount, payment date, mode, note, screenshot). The screenshot itself is a
  // JPEG file in nakayatra-data/payments/ (git-ignored); `screenshot` holds its
  // file name. The per-member target (₹10,000) is PER_MEMBER_AMOUNT in
  // routes/nakayatraList.js — balance is derived, never stored.
  _db.run(`
    CREATE TABLE IF NOT EXISTS nakayatra_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      final_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      paid_on TEXT NOT NULL,
      mode TEXT,
      note TEXT,
      screenshot TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // Seed admin if not exists
  const existing = query(`SELECT id FROM users WHERE username = 'admin'`);
  if (existing.length === 0) {
    const seedPassword = process.env.ADMIN_SEED_PASSWORD || 'admin123';
    if (!process.env.ADMIN_SEED_PASSWORD) {
      console.warn('ADMIN_SEED_PASSWORD not set — seeding admin with dev-only default password.');
    }
    const adminHash = hashPassword(seedPassword);
    _db.run(
      `INSERT INTO users (username, password_hash, role) VALUES ('admin', ?, 'admin')`,
      [adminHash]
    );
  }

  save();
  return _db;
}

function save() {
  if (!_db) return;
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// sql.js cannot bind `undefined` — coerce any undefined param to null.
function sanitize(params) {
  return params.map(p => (p === undefined ? null : p));
}

function query(sql, params = []) {
  const stmt = _db.prepare(sql);
  stmt.bind(sanitize(params));
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function run(sql, params = []) {
  _db.run(sql, sanitize(params));
  // Capture the new row id BEFORE saving/exporting.
  const rowid = _db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
  save();
  return rowid;
}

// Many inserts, one disk write — run() rewrites the whole DB file per call.
function runMany(sql, paramsList) {
  for (const params of paramsList) _db.run(sql, sanitize(params));
  save();
}

module.exports = { getDb, query, run, runMany, save, hashPassword, verifyPassword };
