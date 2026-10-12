const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Marketing contacts (bulk cold lists — the "Internet" GST list is ~500k rows) live
// in their own sql.js file, not leads.db. db.js rewrites its whole file on every
// run(), so half a million rows there would turn every follow-up and every page
// view into a ~75 MB disk write. This file is written only by imports.
const DB_PATH = path.join(__dirname, 'contacts.db');

let _db = null;
let saveTimer = null;

async function getContactsDb() {
  if (_db) return _db;
  const SQL = await initSqlJs();
  _db = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();
  // `category` is a comma-joined list ("Consultants,Services"); the list page
  // filters it with a ',' || category || ',' LIKE match.
  _db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      city TEXT,
      phone TEXT,
      email TEXT,
      category TEXT,
      source TEXT,
      imported_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
  // Integrity (re-import skips rows already present) and the list's sort order.
  _db.run('CREATE UNIQUE INDEX IF NOT EXISTS ux_contacts_phone_name ON contacts(phone, company_name)');
  _db.run('CREATE INDEX IF NOT EXISTS ix_contacts_name ON contacts(company_name)');
  return _db;
}

function query(sql, params = []) {
  const stmt = _db.prepare(sql);
  stmt.bind(params.map(p => (p === undefined ? null : p)));
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// An import arrives as many chunked requests; write the file once, shortly after
// the last one, instead of re-exporting the whole DB per chunk.
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFileSync(DB_PATH, Buffer.from(_db.export()));
  }, 2000);
}

function insertMany(rows, source) {
  const stmt = _db.prepare(
    'INSERT OR IGNORE INTO contacts (company_name, city, phone, email, category, source) VALUES (?,?,?,?,?,?)'
  );
  let inserted = 0;
  _db.run('BEGIN');
  try {
    for (const r of rows) {
      stmt.run([r.company_name, r.city, r.phone, r.email, r.category, source].map(p => p || null));
      inserted += _db.getRowsModified();
    }
    _db.run('COMMIT');
  } catch (e) {
    _db.run('ROLLBACK');
    throw e;
  } finally {
    stmt.free();
  }
  scheduleSave();
  return inserted;
}

module.exports = { getContactsDb, query, insertMany };
