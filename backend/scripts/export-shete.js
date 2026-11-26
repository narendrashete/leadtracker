// One-time export of the Shete Parivar Navratri data, which moved to its own app
// (www.shetenavratri.in, repo narendrashete/shetenavratri) on 2026-11-26.
//   node backend/scripts/export-shete.js [out.db]     (default /tmp/shete-export.db)
// Writes a small SQLite file holding only: every shete_* table, the admin
// logins (username + password hash, so the same login works on the new site),
// the site's page_hits rows and the visitor salt. Nothing else from leads.db.
// Read-only on leads.db. The new app's scripts/import-from-leadtracker.js reads it.
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

(async () => {
  const out = process.argv[2] || '/tmp/shete-export.db';
  const SQL = await initSqlJs();
  const src = new SQL.Database(fs.readFileSync(path.join(__dirname, '..', 'leads.db')));
  const dst = new SQL.Database();

  const copy = (table, select) => {
    const ddl = src.exec(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`, [table])[0];
    if (!ddl) return 0;
    dst.run(ddl.values[0][0]);
    const res = src.exec(select)[0];
    if (!res) return 0;
    const stmt = dst.prepare(
      `INSERT INTO ${table} (${res.columns.join(',')}) VALUES (${res.columns.map(() => '?').join(',')})`
    );
    for (const row of res.values) stmt.run(row);
    stmt.free();
    return res.values.length;
  };

  const tables = src.exec(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'shete\\_%' ESCAPE '\\'`)[0];
  for (const [t] of tables ? tables.values : []) console.log(`${t}: ${copy(t, `SELECT * FROM ${t}`)}`);
  console.log(`admin logins: ${copy('users', `SELECT * FROM users WHERE role = 'admin'`)}`);
  console.log(`visitor rows: ${copy('page_hits', `SELECT * FROM page_hits WHERE page LIKE 'shetenavratri%'`)}`);
  copy('app_meta', `SELECT * FROM app_meta WHERE key = 'visitor_salt'`);

  fs.writeFileSync(out, Buffer.from(dst.export()));
  fs.chmodSync(out, 0o600);
  console.log(`Wrote ${out}`);
})().catch(e => { console.error(e); process.exit(1); });
