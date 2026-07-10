const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'leads.db');

let _db = null;

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
  for (const col of ['address', 'city', 'state']) {
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

module.exports = { getDb, query, run, save, hashPassword, verifyPassword };
