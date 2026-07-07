const express = require('express');
const { query, run, hashPassword } = require('../db');
const { requireAuth, requireAdmin } = require('../auth');

const router = express.Router();
router.use(requireAuth);
router.use(requireAdmin);

// List all users (no password hashes)
router.get('/', (req, res) => {
  const users = query(`SELECT id, username, role, created_at FROM users ORDER BY id`);
  res.json(users);
});

// Create new user
router.post('/', (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const existing = query(`SELECT id FROM users WHERE username = ? COLLATE NOCASE`, [username]);
    if (existing.length) return res.status(409).json({ error: 'Username already exists' });

    const id = run(
      `INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'user')`,
      [username.trim(), hashPassword(password)]
    );
    const rows = query(`SELECT id, username, role, created_at FROM users WHERE id = ?`, [id]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// Reset any user's password (admin only; admin's own password cannot be reset)
router.put('/:id/reset-password', (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'New password required' });

    const rows = query(`SELECT id, username, role FROM users WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const target = rows[0];
    if (target.role === 'admin') {
      return res.status(403).json({ error: 'Admin password cannot be reset' });
    }

    run(`UPDATE users SET password_hash = ? WHERE id = ?`, [hashPassword(password), req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Delete user (admin only; cannot delete admin)
router.delete('/:id', (req, res, next) => {
  try {
    const rows = query(`SELECT id, role FROM users WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    if (rows[0].role === 'admin') return res.status(403).json({ error: 'Admin user cannot be deleted' });
    run(`DELETE FROM users WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
