const express = require('express');
const { query } = require('../db');
const { verifyPassword } = require('../db');
const { createSession, destroySession, requireAuth } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const rows = query(`SELECT * FROM users WHERE username = ? COLLATE NOCASE`, [username]);
  if (!rows.length) return res.status(401).json({ error: 'Invalid username or password' });

  const user = rows[0];
  if (!verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = createSession(user);
  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role },
  });
});

router.post('/logout', requireAuth, (req, res) => {
  const token = req.headers['authorization'].slice(7);
  destroySession(token);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

module.exports = router;
