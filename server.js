const express = require('express');
const path = require('path');
require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api', require('./src/routes/items'));
app.use('/api', require('./src/routes/admin'));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api', (req, res) => {
  res.status(404).json({ message: '接口不存在' });
});

app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: '图片不能超过 5MB' });
  }
  if (err) {
    return res.status(400).json({ message: err.message || '请求处理失败' });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`校园失物招领平台已启动: http://localhost:${PORT}`);
});
