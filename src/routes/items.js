const express = require('express');
const { db, CATEGORIES } = require('../db');
const { authRequired, optionalAuth } = require('../auth');
const { addMessage, maskContact, parsePager } = require('../util');
const { upload } = require('../upload');

const router = express.Router();

const ITEM_FIELDS = `
  i.id, i.user_id, i.type, i.title, i.category, i.description, i.location,
  i.contact, i.image, i.status, i.views, i.created_at, i.updated_at,
  u.nickname AS author
`;

function mapItem(row, viewer) {
  const item = {
    id: row.id,
    type: row.type,
    title: row.title,
    category: row.category,
    description: row.description,
    location: row.location,
    image: row.image,
    status: row.status,
    views: row.views,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: row.author,
    authorId: row.user_id,
    mine: !!viewer && viewer.id === row.user_id,
    canManage: !!viewer && (viewer.id === row.user_id || viewer.role === 'admin')
  };
  if (viewer) {
    item.contact = row.contact;
  } else {
    item.contact = maskContact(row.contact);
    item.contactMasked = true;
  }
  return item;
}

function validateItem(body) {
  const data = {
    type: body.type,
    title: String(body.title || '').trim(),
    category: String(body.category || '').trim(),
    description: String(body.description || '').trim(),
    location: String(body.location || '').trim(),
    contact: String(body.contact || '').trim()
  };
  if (!['lost', 'found'].includes(data.type)) return { error: '请选择信息类型（失物 / 招领）' };
  if (data.title.length < 4 || data.title.length > 40) return { error: '标题需为 4~40 个字符' };
  if (!CATEGORIES.includes(data.category)) return { error: '请选择有效的物品分类' };
  if (data.description.length < 10) return { error: '物品描述至少 10 个字符' };
  if (!data.location) return { error: '请填写地点' };
  if (!data.contact) return { error: '请填写联系方式' };
  return { data };
}

/* ------------------------------ 公开列表 ------------------------------ */

router.get('/items', optionalAuth, (req, res) => {
  const { page, pageSize, offset } = parsePager(req.query);
  const where = ["i.status IN ('active', 'resolved')"];
  const params = [];

  if (['lost', 'found'].includes(req.query.type)) {
    where.push('i.type = ?');
    params.push(req.query.type);
  }
  if (CATEGORIES.includes(req.query.category)) {
    where.push('i.category = ?');
    params.push(req.query.category);
  }
  if (req.query.status === 'resolved') {
    where.push("i.status = 'resolved'");
  }
  const keyword = String(req.query.keyword || '').trim();
  if (keyword) {
    where.push('(i.title LIKE ? OR i.description LIKE ? OR i.location LIKE ?)');
    const like = `%${keyword}%`;
    params.push(like, like, like);
  }

  const whereSql = 'WHERE ' + where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS n FROM items i ${whereSql}`).get(...params).n;
  const orderBy = req.query.sort === 'hot' ? 'i.views DESC, i.created_at DESC' : 'i.created_at DESC';

  const rows = db.prepare(`
    SELECT ${ITEM_FIELDS}
    FROM items i JOIN users u ON u.id = i.user_id
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);

  res.json({
    list: rows.map(r => mapItem(r, req.user)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    categories: CATEGORIES
  });
});

router.get('/items/hot', optionalAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT ${ITEM_FIELDS}
    FROM items i JOIN users u ON u.id = i.user_id
    WHERE i.status = 'active'
    ORDER BY i.created_at DESC
    LIMIT 4
  `).all();
  res.json({ list: rows.map(r => mapItem(r, req.user)) });
});

/* ------------------------------ 我的信息 ------------------------------ */

router.get('/my/items', authRequired, (req, res) => {
  const rows = db.prepare(`
    SELECT ${ITEM_FIELDS},
      (SELECT COUNT(*) FROM claims c WHERE c.item_id = i.id AND c.status = 'pending') AS pendingClaims,
      (SELECT COUNT(*) FROM comments cm WHERE cm.item_id = i.id) AS commentCount
    FROM items i JOIN users u ON u.id = i.user_id
    WHERE i.user_id = ?
    ORDER BY i.created_at DESC
  `).all(req.user.id);
  res.json({
    list: rows.map(r => ({
      ...mapItem(r, req.user),
      pendingClaims: r.pendingClaims,
      commentCount: r.commentCount
    }))
  });
});

router.get('/my/claims', authRequired, (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, i.title, i.type, i.category, i.image, i.status AS itemStatus, u.nickname AS ownerName
    FROM claims c
    JOIN items i ON i.id = c.item_id
    JOIN users u ON u.id = c.owner_id
    WHERE c.applicant_id = ?
    ORDER BY c.created_at DESC
  `).all(req.user.id);
  res.json({ list: rows });
});

router.get('/my/received', authRequired, (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, i.title, i.type, u.nickname AS applicantName
    FROM claims c
    JOIN items i ON i.id = c.item_id
    JOIN users u ON u.id = c.applicant_id
    WHERE c.owner_id = ?
    ORDER BY c.created_at DESC
  `).all(req.user.id);
  res.json({ list: rows });
});

router.get('/my/favorites', authRequired, (req, res) => {
  const rows = db.prepare(`
    SELECT ${ITEM_FIELDS}, f.created_at AS favAt
    FROM favorites f
    JOIN items i ON i.id = f.item_id
    JOIN users u ON u.id = i.user_id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).all(req.user.id);
  res.json({ list: rows.map(r => ({ ...mapItem(r, req.user), favAt: r.favAt })) });
});

/* ------------------------------ 详情 / 增删改 ------------------------------ */

router.get('/items/:id', optionalAuth, (req, res) => {
  const row = db.prepare(`
    SELECT ${ITEM_FIELDS} FROM items i JOIN users u ON u.id = i.user_id WHERE i.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ message: '信息不存在或已删除' });

  if (req.user || row.status !== 'pending') {
    db.prepare('UPDATE items SET views = views + 1 WHERE id = ?').run(row.id);
    row.views += 1;
  }

  const comments = db.prepare(`
    SELECT c.id, c.content, c.created_at, c.user_id, u.nickname
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.item_id = ? ORDER BY c.created_at ASC
  `).all(row.id);

  let favorited = false;
  let myClaim = null;
  if (req.user) {
    favorited = !!db.prepare('SELECT id FROM favorites WHERE item_id = ? AND user_id = ?')
      .get(row.id, req.user.id);
    myClaim = db.prepare('SELECT * FROM claims WHERE item_id = ? AND applicant_id = ? ORDER BY id DESC')
      .get(row.id, req.user.id) || null;
  }

  res.json({
    item: mapItem(row, req.user),
    comments,
    favorited,
    myClaim
  });
});

router.post('/items', authRequired, upload.single('image'), (req, res) => {
  const { data, error } = validateItem(req.body);
  if (error) return res.status(400).json({ message: error });

  const now = new Date().toISOString();
  const status = req.user.role === 'admin' ? 'active' : 'pending';
  const image = req.file ? '/uploads/' + req.file.filename : null;

  const info = db.prepare(`
    INSERT INTO items (user_id, type, title, category, description, location, contact, image, status, views, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(req.user.id, data.type, data.title, data.category, data.description,
    data.location, data.contact, image, status, now, now);

  if (status === 'pending') {
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
    admins.forEach(a => addMessage(a.id, '新的待审核信息',
      `${req.user.nickname} 发布了「${data.title}」，请到审核后台处理。`, 'audit'));
  }

  const row = db.prepare(`SELECT ${ITEM_FIELDS} FROM items i JOIN users u ON u.id = i.user_id WHERE i.id = ?`)
    .get(info.lastInsertRowid);
  res.status(201).json({
    item: mapItem(row, req.user),
    message: status === 'pending' ? '发布成功，等待管理员审核后公开展示' : '发布成功'
  });
});

router.put('/items/:id', authRequired, upload.single('image'), (req, res) => {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '信息不存在' });
  if (row.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: '只能修改自己发布的信息' });
  }

  const body = { ...row, ...req.body, type: req.body.type || row.type };
  const { data, error } = validateItem(body);
  if (error) return res.status(400).json({ message: error });

  const image = req.file ? '/uploads/' + req.file.filename : row.image;
  const status = req.user.role === 'admin' ? row.status : 'pending';
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE items SET type = ?, title = ?, category = ?, description = ?, location = ?,
      contact = ?, image = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).run(data.type, data.title, data.category, data.description, data.location,
    data.contact, image, status, now, row.id);

  res.json({ message: status === 'pending' ? '已保存，修改后需重新审核' : '已保存' });
});

router.post('/items/:id/resolve', authRequired, (req, res) => {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '信息不存在' });
  if (row.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: '无权操作' });
  }
  db.prepare("UPDATE items SET status = 'resolved', updated_at = ? WHERE id = ?")
    .run(new Date().toISOString(), row.id);
  res.json({ message: '已标记为已完成' });
});

router.delete('/items/:id', authRequired, (req, res) => {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '信息不存在' });
  if (row.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: '只能删除自己发布的信息' });
  }
  db.prepare('DELETE FROM comments WHERE item_id = ?').run(row.id);
  db.prepare('DELETE FROM claims WHERE item_id = ?').run(row.id);
  db.prepare('DELETE FROM favorites WHERE item_id = ?').run(row.id);
  db.prepare('DELETE FROM items WHERE id = ?').run(row.id);
  res.json({ message: '已删除' });
});

/* ------------------------------ 收藏 ------------------------------ */

router.post('/items/:id/favorite', authRequired, (req, res) => {
  const item = db.prepare('SELECT id FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ message: '信息不存在' });

  const exists = db.prepare('SELECT id FROM favorites WHERE item_id = ? AND user_id = ?')
    .get(item.id, req.user.id);
  if (exists) {
    db.prepare('DELETE FROM favorites WHERE id = ?').run(exists.id);
    return res.json({ favorited: false, message: '已取消收藏' });
  }
  db.prepare('INSERT INTO favorites (item_id, user_id, created_at) VALUES (?, ?, ?)')
    .run(item.id, req.user.id, new Date().toISOString());
  res.json({ favorited: true, message: '收藏成功' });
});

/* ------------------------------ 评论 ------------------------------ */

router.get('/items/:id/comments', (req, res) => {
  const list = db.prepare(`
    SELECT c.id, c.content, c.created_at, c.user_id, u.nickname
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.item_id = ? ORDER BY c.created_at ASC
  `).all(req.params.id);
  res.json({ list });
});

router.post('/items/:id/comments', authRequired, (req, res) => {
  const item = db.prepare('SELECT id, user_id, title FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ message: '信息不存在' });

  const content = String(req.body.content || '').trim();
  if (content.length < 2 || content.length > 200) {
    return res.status(400).json({ message: '留言需为 2~200 个字符' });
  }

  const now = new Date().toISOString();
  db.prepare('INSERT INTO comments (item_id, user_id, content, created_at) VALUES (?, ?, ?, ?)')
    .run(item.id, req.user.id, content, now);

  if (item.user_id !== req.user.id) {
    addMessage(item.user_id, '收到新的留言',
      `${req.user.nickname} 在你的「${item.title}」下留言：${content.slice(0, 40)}`, 'comment');
  }

  res.status(201).json({
    comment: { id: 0, content, created_at: now, user_id: req.user.id, nickname: req.user.nickname }
  });
});

router.delete('/comments/:id', authRequired, (req, res) => {
  const row = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '留言不存在' });
  if (row.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: '只能删除自己的留言' });
  }
  db.prepare('DELETE FROM comments WHERE id = ?').run(row.id);
  res.json({ message: '已删除' });
});

/* ------------------------------ 认领 ------------------------------ */

router.post('/items/:id/claims', authRequired, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ message: '信息不存在' });
  if (item.user_id === req.user.id) return res.status(400).json({ message: '不能认领自己发布的信息' });
  if (item.status !== 'active') return res.status(400).json({ message: '该信息当前不可申请认领' });

  const message = String(req.body.message || '').trim();
  if (message.length < 5) return res.status(400).json({ message: '请填写至少 5 个字的认领说明' });

  const pending = db.prepare("SELECT id FROM claims WHERE item_id = ? AND applicant_id = ? AND status = 'pending'")
    .get(item.id, req.user.id);
  if (pending) return res.status(400).json({ message: '你已提交过认领申请，请等待处理' });

  db.prepare(`
    INSERT INTO claims (item_id, applicant_id, owner_id, message, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(item.id, req.user.id, item.user_id, message, new Date().toISOString());

  addMessage(item.user_id, '收到新的认领申请',
    `${req.user.nickname} 申请认领「${item.title}」，请及时处理。`, 'claim');

  res.status(201).json({ message: '认领申请已提交，等待发布者确认' });
});

router.put('/claims/:id', authRequired, (req, res) => {
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) return res.status(404).json({ message: '申请不存在' });
  if (claim.owner_id !== req.user.id) return res.status(403).json({ message: '只能处理自己收到的认领申请' });

  const status = req.body.status;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: '无效的处理结果' });
  }
  if (claim.status !== 'pending') return res.status(400).json({ message: '该申请已处理' });

  db.prepare('UPDATE claims SET status = ? WHERE id = ?').run(status, claim.id);
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(claim.item_id);

  if (status === 'approved') {
    db.prepare("UPDATE items SET status = 'resolved', updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), item.id);
    // 同一物品的其他待处理申请自动拒绝
    const others = db.prepare("SELECT * FROM claims WHERE item_id = ? AND id <> ? AND status = 'pending'")
      .all(item.id, claim.id);
    others.forEach(c => {
      db.prepare("UPDATE claims SET status = 'rejected' WHERE id = ?").run(c.id);
      addMessage(c.applicant_id, '认领申请未通过',
        `「${item.title}」已由其他申请者认领成功。`, 'claim');
    });
    addMessage(claim.applicant_id, '认领申请已通过',
      `你申请认领的「${item.title}」已通过，请与发布者联系：${item.contact}`, 'claim');
  } else {
    addMessage(claim.applicant_id, '认领申请被拒绝',
      `你申请认领的「${item.title}」未被通过，如有疑问可留言沟通。`, 'claim');
  }

  res.json({ message: status === 'approved' ? '已同意认领，该信息标记为已完成' : '已拒绝该申请' });
});

module.exports = router;
