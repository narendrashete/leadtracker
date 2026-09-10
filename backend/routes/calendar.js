const express = require('express');
const crypto = require('crypto');
const { query, run } = require('../db');
const router = express.Router({ mergeParams: true });

const MAX_MEMBERS = 6;
const NAME_MAX = 40;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const DATE_RE   = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE  = /^\d{4}-\d{2}$/;
const KEY_RE    = /^[a-z0-9][a-z0-9-]{0,39}$/;

function parseMembers(raw) {
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function slugify(name) {
  const out = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return out || 'f' + crypto.randomBytes(3).toString('hex');
}

// Trusts nothing from the request body: names are trimmed and capped, colours
// must be hex, ids are regenerated from the name rather than taken as given.
function cleanMembers(input) {
  if (!Array.isArray(input)) throw new Error('members must be a list');
  if (input.length > MAX_MEMBERS) throw new Error(`A group can hold at most ${MAX_MEMBERS} friends`);
  const seen = new Set();
  return input.map(m => {
    const en = String((m && m.en) || '').trim().slice(0, NAME_MAX);
    if (!en) throw new Error('Every friend needs a name');
    let id = slugify(en);
    while (seen.has(id)) id += '-2';
    seen.add(id);
    const color = HEX_COLOR.test(m && m.color) ? m.color : '#888888';
    return { id, en, mr: String((m && m.mr) || '').trim().slice(0, NAME_MAX), color };
  });
}

// The share code resolves to exactly ONE group, and every route below is scoped
// to it. A friend holding one group's link cannot see, name, or touch any other
// group — there is deliberately no endpoint here that lists groups.
router.use('/:code', (req, res, next) => {
  const rows = query(
    `SELECT group_key, name_en, name_mr, members FROM calendar_groups WHERE share_code = ?`,
    [req.params.code]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Unknown calendar link' });
  req.calGroup = rows[0];
  next();
});

function shape(g) {
  return {
    id: g.group_key,
    name_en: g.name_en,
    name_mr: g.name_mr || '',
    members: parseMembers(g.members)
  };
}

router.get('/:code', (req, res) => {
  res.json({ group: shape(req.calGroup) });
});

router.get('/:code/marks', (req, res) => {
  const { month } = req.query;
  if (!MONTH_RE.test(month || '')) return res.status(400).json({ error: 'month must be YYYY-MM' });
  const rows = query(
    'SELECT mark_date, member_id FROM calendar_marks WHERE group_key = ? AND mark_date LIKE ?',
    [req.calGroup.group_key, month + '-%']
  );
  const days = {};
  for (const r of rows) {
    (days[r.mark_date] = days[r.mark_date] || []).push(r.member_id);
  }
  res.json({ days });
});

// Toggle one friend's unavailability on one date. Idempotent in both directions.
router.post('/:code/marks', (req, res, next) => {
  try {
    const { date, member_id, busy } = req.body || {};
    const groupKey = req.calGroup.group_key;
    if (!DATE_RE.test(date || ''))     return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    if (!KEY_RE.test(member_id || '')) return res.status(400).json({ error: 'member_id required' });
    if (!parseMembers(req.calGroup.members).some(m => m.id === member_id)) {
      return res.status(400).json({ error: 'That friend is not in this group' });
    }

    run('DELETE FROM calendar_marks WHERE group_key = ? AND mark_date = ? AND member_id = ?',
        [groupKey, date, member_id]);
    if (busy) {
      run('INSERT INTO calendar_marks (group_key, mark_date, member_id) VALUES (?,?,?)',
          [groupKey, date, member_id]);
    }

    const after = query(
      'SELECT member_id FROM calendar_marks WHERE group_key = ? AND mark_date = ?',
      [groupKey, date]
    );
    res.json({ date, members: after.map(r => r.member_id) });
  } catch (err) {
    next(err);
  }
});

// Friends manage their own group's roster. There is no route to create a group:
// only an admin can, through /api/calendar-admin.
router.put('/:code/members', (req, res, next) => {
  try {
    const groupKey = req.calGroup.group_key;
    const members = cleanMembers((req.body && req.body.members) || []);
    run('UPDATE calendar_groups SET members = ? WHERE group_key = ?',
        [JSON.stringify(members), groupKey]);

    // Marks belonging to a friend who was just removed would otherwise linger
    // as colours nobody can clear.
    const ids = members.map(m => m.id);
    const stale = query('SELECT DISTINCT member_id FROM calendar_marks WHERE group_key = ?', [groupKey])
      .map(r => r.member_id)
      .filter(id => ids.indexOf(id) === -1);
    for (const id of stale) {
      run('DELETE FROM calendar_marks WHERE group_key = ? AND member_id = ?', [groupKey, id]);
    }

    const fresh = query(
      `SELECT group_key, name_en, name_mr, members FROM calendar_groups WHERE group_key = ?`,
      [groupKey]
    );
    res.json({ group: shape(fresh[0]) });
  } catch (err) {
    if (/at most|needs a name|must be a list/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
