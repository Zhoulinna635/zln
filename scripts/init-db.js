/**
 * 重置数据库：删除旧库文件后重新建表并写入种子数据
 * 用法：npm run init-db
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'loster.db');
['', '-wal', '-shm'].forEach(suffix => {
  const target = file + suffix;
  if (fs.existsSync(target)) fs.unlinkSync(target);
});

require('../src/db');
console.log('数据库已重置，种子数据写入完成');
