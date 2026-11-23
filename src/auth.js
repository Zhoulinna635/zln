const crypto = require('crypto');
const { db } = require('./db');

function publicUser(row) {
  if (!row) return null;
  return { id: row.id, username: row.username, nickname: row.nickname, role: row.role };
}

function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)')
    .run(token, userId, new Date().toISOString());
  return token;
}

function userFromToken(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?
  `).get(token);
  return row || null;
}

function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

function authRequired(req, res, next) {
  const user = userFromToken(readToken(req));
  if (!user) return res.status(401).json({ message: '请先登录后再操作' });
  req.user = user;
  next();
}

function optionalAuth(req, res, next) {
  req.user = userFromToken(readToken(req));
  next();
}

function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: '仅管理员可访问' });
    next();
  });
}

module.exports = { publicUser, createSession, userFromToken, readToken, authRequired, optionalAuth, adminRequired };
