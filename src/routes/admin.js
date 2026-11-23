const express = require('express');
const { db, CATEGORIES } = require('../db');
const { authRequired, adminRequired } = require('../auth');
const { addMessage } = require('../util');

const router = express.Router();

/* ------------------------------ 审核后台 ------------------------------ */

router.get('/admin/items', adminRequired, (req, res) => {
  const status = req.query.status || 'pending';
  const valid = ['pending', 'active', 'resolved', 'rejected', 'all'];
  const useStatus = valid.includes(status) ? status : 'pending';

  const where = useStatus === 'all' ? '' : 'WHERE i.status = ?';
  const params = useStatus === 'all' ? [] : [useStatus];

  const rows = db.prepare(`
    SELECT i.*, u.nickname AS author
    FROM items i JOIN users u ON u.id = i.user_id
    ${where}
    ORDER BY i.created_at DESC
    LIMIT 100
  `).all(...params);

  const counts = {};
  ['pending', 'active', 'resolved', 'rejected'].forEach(s => {
    counts[s] = db.prepare('SELECT COUNT(*) AS n FROM items WHERE status = ?').get(s).n;
  });

  res.json({ list: rows, counts, status: useStatus });
});

router.put('/admin/items/:id/audit', adminRequired, (req, res) => {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '信息不存在' });

  const action = req.body.action;
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ message: '无效的审核操作' });
  }

  const status = action === 'approve' ? 'active' : 'rejected';
  db.prepare('UPDATE items SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, new Date().toISOString(), row.id);

  if (action === 'approve') {
    addMessage(row.user_id, '审核通过',
      `你发布的「${row.title}」已通过审核，现已公开展示。`, 'audit');
  } else {
    addMessage(row.user_id, '审核未通过',
      `你发布的「${row.title}」未通过审核，请检查内容真实性后重新提交。`, 'audit');
  }

  res.json({ message: action === 'approve' ? '已通过审核' : '已驳回' });
});

router.get('/admin/users', adminRequired, (req, res) => {
  const list = db.prepare(`
    SELECT u.id, u.username, u.nickname, u.role, u.created_at,
      (SELECT COUNT(*) FROM items i WHERE i.user_id = u.id) AS itemCount,
      (SELECT COUNT(*) FROM claims c WHERE c.applicant_id = u.id) AS claimCount
    FROM users u ORDER BY u.id ASC
  `).all();
  res.json({ list });
});

/* ------------------------------ 消息通知 ------------------------------ */

router.get('/messages', authRequired, (req, res) => {
  const list = db.prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(req.user.id);
  const unread = db.prepare('SELECT COUNT(*) AS n FROM messages WHERE user_id = ? AND is_read = 0')
    .get(req.user.id).n;
  res.json({ list, unread });
});

router.put('/messages/read', authRequired, (req, res) => {
  db.prepare('UPDATE messages SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

router.put('/messages/:id/read', authRequired, (req, res) => {
  db.prepare('UPDATE messages SET is_read = 1 WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  res.json({ ok: true });
});

/* ------------------------------ 统计看板 ------------------------------ */

router.get('/stats/overview', (req, res) => {
  const totalItems = db.prepare('SELECT COUNT(*) AS n FROM items').get().n;
  const active = db.prepare("SELECT COUNT(*) AS n FROM items WHERE status = 'active'").get().n;
  const resolved = db.prepare("SELECT COUNT(*) AS n FROM items WHERE status = 'resolved'").get().n;
  const pending = db.prepare("SELECT COUNT(*) AS n FROM items WHERE status = 'pending'").get().n;
  const lost = db.prepare("SELECT COUNT(*) AS n FROM items WHERE type = 'lost'").get().n;
  const found = db.prepare("SELECT COUNT(*) AS n FROM items WHERE type = 'found'").get().n;
  const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const claims = db.prepare('SELECT COUNT(*) AS n FROM claims').get().n;
  const comments = db.prepare('SELECT COUNT(*) AS n FROM comments').get().n;

  const categories = CATEGORIES.map(name => ({
    name,
    value: db.prepare("SELECT COUNT(*) AS n FROM items WHERE category = ? AND status IN ('active','resolved')").get(name).n
  }));

  const rows = db.prepare("SELECT type, created_at FROM items WHERE status IN ('active','resolved')").all();
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const lostCount = rows.filter(r => r.type === 'lost' && new Date(r.created_at).toDateString() === day.toDateString()).length;
    const foundCount = rows.filter(r => r.type === 'found' && new Date(r.created_at).toDateString() === day.toDateString()).length;
    trend.push({ date: key.slice(5), lost: lostCount, found: foundCount });
  }

  const hot = db.prepare(`
    SELECT id, title, type, views FROM items
    WHERE status IN ('active','resolved') ORDER BY views DESC LIMIT 5
  `).all();

  res.json({
    totalItems, active, resolved, pending, lost, found, users, claims, comments,
    resolveRate: totalItems ? Math.round((resolved / totalItems) * 100) : 0,
    categories, trend, hot
  });
});

module.exports = router;
