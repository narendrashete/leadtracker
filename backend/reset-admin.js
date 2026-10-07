// Usage (stop the app first, it holds the DB in memory and would overwrite this):
//   printf %s "$PW" | node backend/reset-admin.js
// Reads the new admin password from stdin so no shell quoting can alter it.
process.chdir(__dirname);
const db = require('./db');

let pw = '';
process.stdin.on('data', d => (pw += d));
process.stdin.on('end', async () => {
  if (!pw) { console.error('No password given'); process.exit(1); }
  await db.getDb();
  await db.run("UPDATE users SET password_hash = ? WHERE username = 'admin'", [db.hashPassword(pw)]);
  const row = (await db.query("SELECT password_hash FROM users WHERE username = 'admin'"))[0];
  console.log('length', pw.length, 'verifies:', db.verifyPassword(pw, row.password_hash));
});
