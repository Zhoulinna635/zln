# 校园失物招领平台

Web 程序设计课程期末小组项目（项目 15）。前端使用原生 HTML5 / CSS3 / JavaScript（DOM + BOM），后端使用 Node.js + Express，数据库使用 SQLite，无需额外安装数据库服务即可运行。

## 技术栈

| 层次 | 技术 |
| --- | --- |
| 前端 | HTML5、CSS3（Flex / Grid / 媒体查询）、原生 JavaScript、DOM、BOM、Canvas |
| 后端 | Node.js 18+、Express 4、Multer（图片上传） |
| 数据库 | SQLite（better-sqlite3） |
| 鉴权 | scrypt 密码哈希 + 服务端 Session Token（Bearer） |

## 快速开始

```bash
npm install      # 安装依赖
npm run init-db  # 初始化数据库并写入演示数据（可重复执行，会清空旧数据）
npm start        # 启动服务，默认 http://localhost:3000
```

开发模式（文件变更自动重启）：

```bash
npm run dev
```

### 演示账号

| 角色 | 用户名 | 密码 |
| --- | --- | --- |
| 管理员 | admin | 123456 |
| 普通用户 | xiaoming | 123456 |
| 普通用户 | xiaohong | 123456 |

## 目录结构

```
.
├── server.js             # Express 入口、静态资源与错误处理
├── src/
│   ├── db.js             # 建表、密码哈希、种子数据
│   ├── auth.js           # Token 会话与登录/管理员中间件
│   ├── upload.js         # Multer 图片上传配置
│   ├── util.js           # 消息、联系方式脱敏、分页工具
│   └── routes/
│       ├── auth.js       # 注册 / 登录 / 退出 / 当前用户
│       ├── items.js      # 信息 CRUD、收藏、评论、认领、我的数据
│       └── admin.js      # 审核、用户列表、消息、统计看板
├── public/               # 前端页面（多页应用）
│   ├── index.html        # 首页：轮播、搜索、筛选、分页
│   ├── detail.html       # 详情：联系方式脱敏、留言、认领、收藏
│   ├── publish.html      # 发布 / 编辑（图片上传、表单校验）
│   ├── my.html           # 个人中心：发布、收藏、申请、审核申请、消息
│   ├── admin.html        # 审核后台 + 统计看板
│   ├── login.html        # 登录
│   ├── register.html     # 注册
│   ├── css/style.css     # 全站样式与响应式
│   └── js/               # 各页面脚本 + common.js 公共能力
├── scripts/init-db.js    # 重置数据库
├── data/                 # SQLite 数据库文件（运行时生成，已忽略）
└── uploads/              # 上传图片（运行时生成，已忽略）
```

## 功能清单（共 20 项）

1. 用户注册（用户名 / 密码 / 昵称校验，密码 scrypt 加盐哈希）
2. 用户登录（Token 会话）
3. 退出登录
4. 失物信息发布（图片上传、表单校验）
5. 招领信息发布
6. 信息编辑（修改后重新进入审核）
7. 信息删除（级联清理评论、申请、收藏）
8. 信息列表（失物 / 招领筛选、分类筛选、关键词搜索、分页、按最新 / 热度排序）
9. 信息详情（浏览量统计、联系方式脱敏）
10. 留言评论（发布留言，给发布者发站内消息）
11. 认领申请提交
12. 认领申请处理（同意 / 拒绝；同意后信息自动标记为已完成，其他申请自动拒绝）
13. 我的发布（查看、编辑、标记完成、删除、待处理申请数提醒）
14. 我的收藏（收藏 / 取消收藏）
15. 我的申请 / 收到的申请
16. 审核后台（待审核 / 已发布 / 已完成 / 未通过分类，通过 / 驳回并通知作者）
17. 站内消息通知（审核、认领、留言、系统消息，未读角标）
18. 浏览器通知（BOM Notification，请求权限并推送未读提醒）
19. 搜索历史（localStorage 保存最近 6 条，支持清空）
20. 数据统计看板（总量、待审核、完成率、近 7 天趋势 Canvas 柱状图、分类占比、浏览量排行）

另有：首页最新信息轮播、详情页阅读进度条、返回顶部、全站响应式移动端适配。

## 知识点覆盖对照

| 知识点 | 覆盖方式 |
| --- | --- |
| HTML | 语义化标签、表单元素（input / select / textarea / file）、表格、多媒体图片 |
| CSS | Flex / Grid 布局、媒体查询响应式、transition 动效、渐变主题、Canvas 图表 |
| JS | 数组操作（filter / map / reduce 思路）、异步 async/await + fetch、模块化公共脚本、表单校验 |
| DOM | 动态创建 / 更新 / 删除节点、事件委托与绑定、节点遍历、类名与状态切换 |
| BOM | localStorage（Token、用户信息、搜索历史）、location 跳转、Notification、scroll 事件、window.scrollTo |
| 数据库 | SQLite 7 张表（用户 / 信息 / 评论 / 认领 / 收藏 / 消息 / 会话），含外键与唯一约束、完整 CRUD |
| 前后端 | RESTful API、Bearer Token 登录鉴权、文件上传、错误处理、联系方式脱敏 |
| 动态效果 | 轮播、进度条、返回顶部、趋势图与分类占比条、Toast 提示 |

## 数据表

- `users`：用户（用户名唯一、scrypt 密码、角色 user / admin）
- `items`：失物 / 招领信息（类型、分类、地点、联系方式、图片、状态 pending / active / resolved / rejected）
- `comments`：留言
- `claims`：认领申请（申请人、发布者、说明、状态）
- `favorites`：收藏（item_id + user_id 唯一）
- `messages`：站内消息（未读状态、类型）
- `sessions`：登录会话 Token

## 主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | /api/auth/register | 注册 |
| POST | /api/auth/login | 登录 |
| POST | /api/auth/logout | 退出 |
| GET | /api/auth/me | 当前用户与未读数 |
| GET | /api/items | 列表（type / category / keyword / sort / page） |
| GET | /api/items/hot | 首页轮播数据 |
| GET | /api/items/:id | 详情（登录后返回完整联系方式） |
| POST | /api/items | 发布（multipart，字段 image） |
| PUT | /api/items/:id | 编辑 |
| DELETE | /api/items/:id | 删除 |
| POST | /api/items/:id/resolve | 标记完成 |
| POST | /api/items/:id/favorite | 收藏 / 取消收藏 |
| POST | /api/items/:id/comments | 发表留言 |
| POST | /api/items/:id/claims | 提交认领申请 |
| PUT | /api/claims/:id | 同意 / 拒绝申请 |
| GET | /api/my/items · favorites · claims · received | 个人中心数据 |
| GET | /api/admin/items | 审核列表 |
| PUT | /api/admin/items/:id/audit | 通过 / 驳回 |
| GET | /api/messages | 站内消息 |
| GET | /api/stats/overview | 统计看板数据 |

## 部署说明

SQLite 会随项目生成数据库文件，部署时需选择支持持久化磁盘的平台（如 Render、Railway 或自有服务器），将 `data/` 与 `uploads/` 目录挂载为持久卷；启动命令为 `npm start`，通过 `PORT` 环境变量指定端口。纯静态托管（GitHub Pages）无法运行 Express，不能单独使用。

## 小组分工

| 成员 | 负责模块 |
| --- | --- |
| 周琳娜 | 前端开发（全部页面）：首页轮播与搜索筛选、详情页、发布页、个人中心、审核后台页面、响应式与 DOM 交互 |
| 滕婉莎 | 数据库与认证模块：7 张表建表脚本与种子数据、scrypt 密码哈希、注册登录与 Token 会话 |
| 孙瑞瑞 | 信息与认领接口：信息增删改查、Multer 图片上传、认领申请与处理、级联删除事务 |
| 朱茵玲 | 审核后台与统计：审核通过 / 驳回接口、用户列表、站内消息、统计看板数据聚合 |
| 肖鑫蕊 | 测试、部署与录屏：接口联调与边界用例测试、部署上线、演示录屏与讲解 PPT |
