const express = require('express');
const crypto = require('crypto');
const { query, run } = require('../db');
const router = express.Router({ mergeParams: true });

const MAX_MEMBERS = 6;
const MAX_GROUPS = 20;
const NAME_MAX = 40;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const DATE_RE   = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE  = /^\d{4}-\d{2}$/;
const KEY_RE    = /^[a-z0-9][a-z0-9-]{0,39}$/;

function shareCodeIsValid(code) {
  return query('SELECT id FROM calendar_spaces WHERE share_code = ?', [code]).length > 0;
}

// Every route below is public, so the share code in the path is the only gate.
router.use('/:code', (req, res, next) => {
  if (!shareCodeIsValid(req.params.code)) {
    return res.status(404).json({ error: 'Unknown calendar link' });
  }
  next();
});

function readGroups() {
  const rows = query(
    'SELECT group_key, name_en, name_mr, sort_order, members FROM calendar_groups ORDER BY sort_order, id'
  );
  return rows.map(r => ({
    id: r.group_key,
    order: r.sort_order,
    name_en: r.name_en,
    name_mr: r.name_mr || '',
    members: parseMembers(r.members)
  }));
}

function parseMembers(raw) {
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
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

function slugify(name) {
  const out = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return out || 'f' + crypto.randomBytes(3).toString('hex');
}

router.get('/:code/groups', (req, res) => {
  res.json({ groups: readGroups() });
});

router.get('/:code/marks', (req, res) => {
  const { group, month } = req.query;
  if (!KEY_RE.test(group || '')) return res.status(400).json({ error: 'group required' });
  if (!MONTH_RE.test(month || '')) return res.status(400).json({ error: 'month must be YYYY-MM' });
  const rows = query(
    'SELECT mark_date, member_id FROM calendar_marks WHERE group_key = ? AND mark_date LIKE ?',
    [group, month + '-%']
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
    const { group, date, member_id, busy } = req.body || {};
    if (!KEY_RE.test(group || ''))     return res.status(400).json({ error: 'group required' });
    if (!DATE_RE.test(date || ''))     return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    if (!KEY_RE.test(member_id || '')) return res.status(400).json({ error: 'member_id required' });

    const rows = query('SELECT members FROM calendar_groups WHERE group_key = ?', [group]);
    if (rows.length === 0) return res.status(404).json({ error: 'Unknown group' });
    if (!parseMembers(rows[0].members).some(m => m.id === member_id)) {
      return res.status(400).json({ error: 'That friend is not in this group' });
    }

    run('DELETE FROM calendar_marks WHERE group_key = ? AND mark_date = ? AND member_id = ?',
        [group, date, member_id]);
    if (busy) {
      run('INSERT INTO calendar_marks (group_key, mark_date, member_id) VALUES (?,?,?)',
          [group, date, member_id]);
    }

    const after = query(
      'SELECT member_id FROM calendar_marks WHERE group_key = ? AND mark_date = ?',
      [group, date]
    );
    res.json({ date, members: after.map(r => r.member_id) });
  } catch (err) {
    next(err);
  }
});

router.post('/:code/groups', (req, res, next) => {
  try {
    const name = String((req.body && req.body.name_en) || '').trim().slice(0, NAME_MAX);
    if (!name) return res.status(400).json({ error: 'Group name required' });
    if (query('SELECT id FROM calendar_groups').length >= MAX_GROUPS) {
      return res.status(400).json({ error: `At most ${MAX_GROUPS} groups` });
    }
    let key = slugify(name);
    while (query('SELECT id FROM calendar_groups WHERE group_key = ?', [key]).length > 0) {
      key += '-2';
    }
    const order = query('SELECT COUNT(*) AS n FROM calendar_groups')[0].n + 1;
    run(`INSERT INTO calendar_groups (group_key, name_en, name_mr, sort_order, members)
         VALUES (?,?,?,?,?)`,
        [key, name, String((req.body && req.body.name_mr) || '').trim().slice(0, NAME_MAX), order, '[]']);
    res.status(201).json({ group_key: key, groups: readGroups() });
  } catch (err) {
    next(err);
  }
});

router.put('/:code/groups/:groupKey', (req, res, next) => {
  try {
    const key = req.params.groupKey;
    const existing = query('SELECT id FROM calendar_groups WHERE group_key = ?', [key]);
    if (existing.length === 0) return res.status(404).json({ error: 'Unknown group' });

    const members = cleanMembers((req.body && req.body.members) || []);
    run('UPDATE calendar_groups SET members = ? WHERE group_key = ?',
        [JSON.stringify(members), key]);

    // Marks belonging to a friend who was just removed would otherwise linger
    // as colours nobody can clear.
    const ids = members.map(m => m.id);
    const stale = query('SELECT DISTINCT member_id FROM calendar_marks WHERE group_key = ?', [key])
      .map(r => r.member_id)
      .filter(id => ids.indexOf(id) === -1);
    for (const id of stale) {
      run('DELETE FROM calendar_marks WHERE group_key = ? AND member_id = ?', [key, id]);
    }

    res.json({ groups: readGroups() });
  } catch (err) {
    if (/at most|needs a name|must be a list/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
