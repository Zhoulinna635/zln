const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'loster.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  nickname TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('lost', 'found')),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  contact TEXT NOT NULL,
  image TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  applicant_id INTEGER NOT NULL,
  owner_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (item_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'system',
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_status ON items (status);
CREATE INDEX IF NOT EXISTS idx_items_type ON items (type);
CREATE INDEX IF NOT EXISTS idx_comments_item ON comments (item_id);
CREATE INDEX IF NOT EXISTS idx_claims_item ON claims (item_id);
`);

const CATEGORIES = ['证件卡类', '电子产品', '书籍资料', '衣物饰品', '钥匙', '其他'];

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(String(password), salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(test, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function iso(daysAgo = 0, hoursAgo = 0) {
  return new Date(Date.now() - daysAgo * 86400000 - hoursAgo * 3600000).toISOString();
}

function seed() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count > 0) return;

  const insertUser = db.prepare(
    'INSERT INTO users (username, password, nickname, role, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  const adminId = insertUser.run('admin', hashPassword('123456'), '平台管理员', 'admin', iso(30)).lastInsertRowid;
  const mingId = insertUser.run('xiaoming', hashPassword('123456'), '张小明', 'user', iso(20)).lastInsertRowid;
  const hongId = insertUser.run('xiaohong', hashPassword('123456'), '李小红', 'user', iso(18)).lastInsertRowid;

  const insertItem = db.prepare(`
    INSERT INTO items (user_id, type, title, category, description, location, contact, image, status, views, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
  `);

  const items = [
    ['found', '图书馆三楼捡到一张校园卡', '证件卡类', '在一楼入口闸机旁的座位上捡到一张校园卡，姓名处被磨得看不清了，请失主描述卡面特征认领。', '图书馆三楼自习区', '13800138001', 'active', 186, 0, 2],
    ['lost', '丢失黑色蓝牙耳机（充电盒有划痕）', '电子产品', '周三傍晚在西区食堂二楼靠窗位置遗失，耳机为黑色入耳式，充电盒背面有一道明显划痕，里面有重要课程录音。', '西区食堂二楼', '13800138002', 'active', 132, 0, 5],
    ['found', '捡到一本《高等数学》笔记本', '书籍资料', '教三 204 教室最后一排捡到，扉页写着“计算机 2303 班”，内附多页手写公式推导。', '教三楼 204', '13800138003', 'active', 97, 1, 3],
    ['lost', '丢失一串宿舍钥匙（三把）', '钥匙', '黑色钥匙扣，上面有三把钥匙和一个小熊挂件，可能落在体育馆更衣室或操场看台。', '体育馆更衣室', '13800138004', 'active', 74, 1, 8],
    ['found', '捡到蓝色保温杯', '其他', '东门快递站门口的台阶上捡到，杯身贴有“考研加油”贴纸，已交给快递站旁边的值班室。', '东门快递站', '13800138005', 'active', 58, 2, 1],
    ['lost', '丢失白色 AirPods 充电盒', '电子产品', '充电盒为白色，盖子内侧有一块小贴纸，最后一次使用是在实验楼 B 座 302 机房。', '实验楼 B 座 302', '13800138006', 'active', 203, 2, 6],
    ['found', '捡到身份证一张（张同学）', '证件卡类', '在学生事务中心门口捡到，姓氏为“张”，为避免信息泄露，请本人携带学生证到 6 号窗口核对领取。', '学生事务中心门口', '13800138007', 'resolved', 311, 3, 10],
    ['lost', '丢失灰色连帽卫衣', '衣物饰品', '田径场看台第二排遗落，卫衣左袖口有一处小面积染色，口袋里有食堂饭卡。', '田径场看台', '13800138008', 'active', 45, 3, 4],
    ['found', '捡到校园一卡通（尾号 3721）', '证件卡类', '二食堂二楼餐盘回收处捡到，卡面照片为男生，已交至二食堂一楼服务台。', '二食堂二楼', '13800138009', 'active', 168, 4, 2],
    ['lost', '丢失 U 盘（内有课设资料）', '电子产品', '银色 64G U 盘，挂了蓝色编织绳，里面是数据库课程设计资料，非常着急，拾到必有重谢。', '计算机楼 405 机房', '13800138010', 'active', 240, 5, 1],
    ['found', '捡到钥匙串（带小熊挂件）', '钥匙', '宿舍 7 号楼一楼洗衣机旁捡到，共四把钥匙，失主可到 7 号楼宿管处认领。', '7 号宿舍楼一层', '13800138011', 'active', 88, 6, 7],
    ['lost', '丢失英语四级词汇书', '书籍资料', '绿色封面，书名《四级词汇闪过》，书内夹着一张模拟考成绩单，图书馆二楼东侧自习区遗失。', '图书馆二楼东侧', '13800138012', 'active', 66, 6, 3]
  ];

  const owners = [mingId, hongId, mingId, hongId, mingId, hongId, mingId, hongId, mingId, hongId, mingId, hongId];
  items.forEach((it, index) => {
    insertItem.run(
      owners[index], it[0], it[1], it[2], it[3], it[4], it[5],
      it[6], it[7], iso(it[8], it[9] || 0), iso(it[8], it[9] || 0)
    );
  });

  // 一条待审核数据，方便演示后台审核
  insertItem.run(
    hongId, 'found', '捡到一副黑框眼镜', '其他',
    '在教一楼大厅沙发上捡到，黑框、镜片有轻微划痕，已放在教一楼值班室。',
    '教一楼大厅', '13800138013', 'pending', 0, iso(0, 2), iso(0, 2)
  );

  const insertComment = db.prepare(
    'INSERT INTO comments (item_id, user_id, content, created_at) VALUES (?, ?, ?, ?)'
  );
  insertComment.run(1, hongId, '我昨天也去过三楼自习，帮你在群里转一下。', iso(0, 3));
  insertComment.run(1, mingId, '谢谢！卡背面有一个小贴纸，麻烦留意一下。', iso(0, 2));
  insertComment.run(2, mingId, '耳机找到了吗？我在食堂二楼见过类似的。', iso(1, 2));

  const insertClaim = db.prepare(
    'INSERT INTO claims (item_id, applicant_id, owner_id, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insertClaim.run(1, hongId, mingId, '卡面照片是我本人，学号尾号 214，可以当面核对。', 'pending', iso(0, 1));
  insertClaim.run(7, mingId, hongId, '身份证是我的，已联系学生事务中心确认。', 'approved', iso(3, 5));

  const insertFav = db.prepare(
    'INSERT INTO favorites (item_id, user_id, created_at) VALUES (?, ?, ?)'
  );
  insertFav.run(2, mingId, iso(1, 1));
  insertFav.run(6, hongId, iso(2, 2));

  const insertMsg = db.prepare(
    'INSERT INTO messages (user_id, title, content, type, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insertMsg.run(mingId, '审核通过', '你发布的「图书馆三楼捡到一张校园卡」已通过审核，现已公开展示。', 'audit', 0, iso(0, 2));
  insertMsg.run(mingId, '收到新的认领申请', '李小红 申请认领你发布的「图书馆三楼捡到一张校园卡」，请及时处理。', 'claim', 0, iso(0, 1));
  insertMsg.run(hongId, '欢迎加入校园失物招领平台', '发布信息前请确认联系方式准确，平台会对联系方式做脱敏保护。', 'system', 1, iso(2, 3));

  console.log('[db] 种子数据已写入');
}

seed();

module.exports = { db, hashPassword, verifyPassword, CATEGORIES };
