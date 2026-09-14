const crypto = require('crypto');
const { query, run } = require('./db');

// Link-preview fetchers are the big one here: every time somebody pastes the
// aarti link into WhatsApp, its crawler fetches the page. Counting those as
// readers would quietly inflate every number on the page.
const BOTS = /bot|crawler?|spider|slurp|facebookexternalhit|whatsapp|telegram|discord|skype|preview|embed|monitor|pingdom|uptime|curl|wget|python-requests|okhttp|headless|lighthouse/i;

function todayLocal() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

let _salt = null;
function salt() {
  if (_salt) return _salt;
  const row = query(`SELECT value FROM app_meta WHERE key = 'visitor_salt'`)[0];
  if (row) { _salt = row.value; return _salt; }
  _salt = crypto.randomBytes(32).toString('hex');
  run(`INSERT INTO app_meta (key, value) VALUES ('visitor_salt', ?)`, [_salt]);
  return _salt;
}

// An identifier that cannot be turned back into a person. The address and
// user-agent are hashed with an install secret AND the date, so the same phone
// hashes differently tomorrow and nothing links the two. No address is stored.
//
// The deliberate cost: "unique visitors" is only meaningful within a single day.
// Summing days counts a daily returner once per day, so the period figure is
// daily-visitors-summed, not distinct people — the API and the screen both say so.
function visitorId(req) {
  return crypto.createHash('sha256')
    .update(`${salt()}|${todayLocal()}|${req.ip || ''}|${req.get('user-agent') || ''}`)
    .digest('hex').slice(0, 32);
}

function recordVisit(req, page) {
  try {
    const ua = req.get('user-agent') || '';
    // Two gates, because a blocklist of bot names always trails reality. Every
    // real browser sends "Mozilla/"; scripts and scrapers (curl, python-urllib,
    // Go, Java) mostly do not, so that is the cheap positive filter. The
    // blocklist then catches the crawlers that do claim Mozilla — Googlebot and
    // the WhatsApp/Facebook link previewers among them.
    if (!/Mozilla\//.test(ua) || BOTS.test(ua)) return;
    const day = todayLocal();
    const visitor = visitorId(req);
    const existing = query(
      `SELECT id FROM page_hits WHERE day = ? AND page = ? AND visitor = ?`,
      [day, page, visitor]
    );
    if (existing.length) {
      run(`UPDATE page_hits SET views = views + 1, last_seen = datetime('now','localtime')
           WHERE id = ?`, [existing[0].id]);
    } else {
      run(`INSERT INTO page_hits (day, page, visitor) VALUES (?, ?, ?)`, [day, page, visitor]);
    }
  } catch (err) {
    // Counting is never worth failing a page load over.
    console.error('VISIT COUNT ERROR:', err && (err.message || err));
  }
}

module.exports = { recordVisit, todayLocal };
