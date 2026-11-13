// Public side of the Naka Family yatra consent poll (/nakayatra/<code>).
// No login: a member's personal code is what lets them answer, and only as
// themselves. Everyone else's answers are shown only once the member has
// answered (or the admin has frozen the poll). Codes are never returned here —
// knowing someone else's code would let you answer for them.
const express = require('express');
const { query, run } = require('../db');

const router = express.Router();

const RESPONSES = ['Yes', 'No'];
const CODE_RE = /^NF\d{7}$/;

// Wrong-code lookups per IP per hour, in memory only — makes guessing codes slow.
const misses = new Map();
function tooManyMisses(ip) {
  const now = Date.now();
  const list = (misses.get(ip) || []).filter(t => now - t < 3600000);
  misses.set(ip, list);
  return list.length >= 30;
}
function recordMiss(ip) {
  const list = misses.get(ip) || [];
  list.push(Date.now());
  misses.set(ip, list);
}

function isFrozen() {
  const r = query(`SELECT value FROM nakayatra_settings WHERE key = 'frozen'`)[0];
  return !!(r && r.value === '1');
}

function allMembers() {
  return query(`SELECT id, name, code, response, responded_at FROM nakayatra_members ORDER BY name COLLATE NOCASE, id`);
}

function summarize(members) {
  const s = { yes: 0, no: 0, pending: 0, total: members.length };
  for (const m of members) {
    if (m.response === 'Yes') s.yes++;
    else if (m.response === 'No') s.no++;
    else s.pending++;
  }
  return s;
}

function findByCode(code) {
  if (!CODE_RE.test(code || '')) return null;
  return query(`SELECT * FROM nakayatra_members WHERE code = ?`, [code])[0] || null;
}

function memberState(me) {
  const frozen = isFrozen();
  const canSeeOthers = !!me.response || frozen;
  const members = canSeeOthers ? allMembers() : [];
  return {
    me: { id: me.id, name: me.name, response: me.response || '', respondedAt: me.responded_at || '' },
    frozen,
    summary: canSeeOthers ? summarize(members) : null,
    members: canSeeOthers
      ? members.map(m => ({ id: m.id, name: m.name, response: m.response || '', respondedAt: m.responded_at || '' }))
      : null,
  };
}

function lookup(req, res) {
  const ip = req.ip || '';
  if (tooManyMisses(ip)) {
    res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    return null;
  }
  const me = findByCode(req.params.code);
  if (!me) {
    recordMiss(ip);
    res.status(404).json({ error: 'This link is not valid. Please ask the admin for your personal link.' });
    return null;
  }
  return me;
}

router.use((req, res, next) => { res.set('X-Robots-Tag', 'noindex, nofollow'); next(); });

router.get('/:code', (req, res, next) => {
  try {
    const me = lookup(req, res);
    if (me) res.json(memberState(me));
  } catch (err) { next(err); }
});

router.post('/:code', (req, res, next) => {
  try {
    const me = lookup(req, res);
    if (!me) return;
    const response = req.body && req.body.response;
    if (!RESPONSES.includes(response)) return res.status(400).json({ error: 'Answer must be Yes or No.' });
    if (isFrozen()) return res.status(409).json({ error: 'Responses are closed by the admin.' });
    if (me.response !== response) {
      run(`UPDATE nakayatra_members SET response = ?, responded_at = datetime('now','localtime') WHERE id = ?`, [response, me.id]);
    }
    res.json(memberState(findByCode(me.code)));
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.isFrozen = isFrozen;
module.exports.allMembers = allMembers;
module.exports.summarize = summarize;
