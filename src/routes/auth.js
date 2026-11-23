const express = require('express');
const { db, hashPassword, verifyPassword } = require('../db');
const { publicUser, createSession, readToken, authRequired } = require('../auth');

const router = express.Router();

router.post('/register', (req, res) => {
  const { username = '', password = '', nickname = '' } = req.body || {};
  const name = String(username).trim();
  const nick = String(nickname).trim() || name;

  if (!/^[a-zA-Z0-9_]{3,16}$/.test(name)) {
    return res.status(400).json({ message: '用户名需为 3~16 位字母、数字或下划线' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ message: '密码至少 6 位' });
  }
  if (nick.length > 12) {
    return res.status(400).json({ message: '昵称不能超过 12 个字符' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(name);
  if (exists) return res.status(400).json({ message: '该用户名已被注册' });

  const info = db.prepare(
    'INSERT INTO users (username, password, nickname, role, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(name, hashPassword(password), nick, 'user', new Date().toISOString());

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  const token = createSession(user.id);
  res.json({ token, user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { username = '', password = '' } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username).trim());
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(400).json({ message: '用户名或密码错误' });
  }
  const token = createSession(user.id);
  res.json({ token, user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  const token = readToken(req);
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ ok: true });
});

router.get('/me', authRequired, (req, res) => {
  const unread = db.prepare('SELECT COUNT(*) AS n FROM messages WHERE user_id = ? AND is_read = 0')
    .get(req.user.id).n;
  res.json({ user: publicUser(req.user), unread });
});

module.exports = router;
