const { db } = require('./db');

function addMessage(userId, title, content, type = 'system') {
  db.prepare(`
    INSERT INTO messages (user_id, title, content, type, is_read, created_at)
    VALUES (?, ?, ?, ?, 0, ?)
  `).run(userId, title, content, type, new Date().toISOString());
}

function maskContact(contact) {
  const text = String(contact || '');
  if (/^1\d{10}$/.test(text)) return text.slice(0, 3) + '****' + text.slice(-4);
  if (text.includes('@')) {
    const [name, domain] = text.split('@');
    return name.slice(0, 1) + '***@' + domain;
  }
  if (text.length <= 2) return text.slice(0, 1) + '**';
  return text.slice(0, 1) + '***' + text.slice(-1);
}

function parsePager(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(query.pageSize, 10) || 8));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

module.exports = { addMessage, maskContact, parsePager };
