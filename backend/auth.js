const crypto = require('crypto');

// In-memory session store: token -> { id, username, role }
const sessions = new Map();

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { id: user.id, username: user.username, role: user.role });
  return token;
}

function getSession(token) {
  return sessions.get(token) || null;
}

function destroySession(token) {
  sessions.delete(token);
}

// Express middleware — attaches req.user or returns 401
function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const user = getSession(token);
  if (!user) return res.status(401).json({ error: 'Session expired' });
  req.user = user;
  next();
}

// Middleware — requires admin role
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

module.exports = { createSession, getSession, destroySession, requireAuth, requireAdmin };
