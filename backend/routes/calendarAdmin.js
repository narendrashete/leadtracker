const express = require('express');
const crypto = require('crypto');
const { query, run } = require('../db');
const { requireAuth, requireAdmin } = require('../auth');

const router = express.Router();
router.use(requireAuth);
router.use(requireAdmin);

const MAX_GROUPS = 50;
const NAME_MAX = 40;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// Distinct enough to tell apart at a glance in a filled calendar cell.
const PALETTE = ['#E4572E', '#2E86AB', '#5E8C3F', '#8E5BD8', '#D9A404', '#C42A67'];

function newCode() {
  return crypto.randomBytes(6).toString('hex');
}

function slugify(name) {
  const out = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return out || 'g' + crypto.randomBytes(3).toString('hex');
}

function parseMembers(raw) {
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function uniqueKey(name) {
  let key = slugify(name);
  while (query('SELECT id FROM calendar_groups WHERE group_key = ?', [key]).length > 0) {
    key += '-2';
  }
  return key;
}

// The whole point of this screen: the admin sees every group's link. This is why
// the router sits behind requireAuth + requireAdmin and NOT under /api/calendar.
router.get('/', (req, res) => {
  const rows = query(
    `SELECT group_key, name_en, name_mr, sort_order, members, share_code, created_at
     FROM calendar_groups ORDER BY sort_order, id`
  );
  res.json(rows.map(r => {
    const members = parseMembers(r.members);
    const marks = query(
      'SELECT COUNT(*) AS n FROM calendar_marks WHERE group_key = ?', [r.group_key]
    )[0].n;
    return {
      group_key: r.group_key,
      name_en: r.name_en,
      name_mr: r.name_mr || '',
      share_code: r.share_code,
      share_path: `/calendar/${r.share_code}`,
      member_count: members.length,
      member_names: members.map(m => m.en),
      mark_count: marks,
      created_at: r.created_at
    };
  }));
});

router.post('/', (req, res, next) => {
  try {
    const name = String((req.body && req.body.name_en) || '').trim().slice(0, NAME_MAX);
    if (!name) return res.status(400).json({ error: 'Group name required' });
    if (query('SELECT id FROM calendar_groups').length >= MAX_GROUPS) {
      return res.status(400).json({ error: `At most ${MAX_GROUPS} groups` });
    }

    // A group with no members is a dead link — the friend who opens it has no
    // name to pick — so the first friend is created with the group.
    const firstName = String((req.body && req.body.first_member) || '').trim().slice(0, NAME_MAX);
    if (!firstName) return res.status(400).json({ error: 'Add at least one friend to start the group' });
    const color = HEX_COLOR.test(req.body && req.body.first_color) ? req.body.first_color : PALETTE[0];
    const members = [{ id: slugify(firstName), en: firstName, mr: '', color }];

    const key = uniqueKey(name);
    const order = query('SELECT COUNT(*) AS n FROM calendar_groups')[0].n + 1;
    const code = newCode();
    run(`INSERT INTO calendar_groups (group_key, name_en, name_mr, sort_order, members, share_code)
         VALUES (?,?,?,?,?,?)`,
        [key, name, String((req.body && req.body.name_mr) || '').trim().slice(0, NAME_MAX),
         order, JSON.stringify(members), code]);

    res.status(201).json({ group_key: key, share_code: code, share_path: `/calendar/${code}` });
  } catch (err) {
    next(err);
  }
});

// Invalidates the old link immediately — for when a link reaches someone it
// shouldn't have. The group's members and marks are untouched.
router.post('/:groupKey/rotate', (req, res, next) => {
  try {
    const key = req.params.groupKey;
    if (query('SELECT id FROM calendar_groups WHERE group_key = ?', [key]).length === 0) {
      return res.status(404).json({ error: 'Unknown group' });
    }
    const code = newCode();
    run('UPDATE calendar_groups SET share_code = ? WHERE group_key = ?', [code, key]);
    res.json({ group_key: key, share_code: code, share_path: `/calendar/${code}` });
  } catch (err) {
    next(err);
  }
});

router.delete('/:groupKey', (req, res, next) => {
  try {
    const key = req.params.groupKey;
    if (query('SELECT id FROM calendar_groups WHERE group_key = ?', [key]).length === 0) {
      return res.status(404).json({ error: 'Unknown group' });
    }
    run('DELETE FROM calendar_marks WHERE group_key = ?', [key]);
    run('DELETE FROM calendar_groups WHERE group_key = ?', [key]);
    res.json({ deleted: key });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
