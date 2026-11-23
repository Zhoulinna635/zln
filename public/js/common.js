const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const TOKEN_KEY = 'lf_token';
const USER_KEY = 'lf_user';

const CATEGORY_MAP = {
  '证件卡类': { initial: '证', cls: 'c0' },
  '电子产品': { initial: '电', cls: 'c1' },
  '书籍资料': { initial: '书', cls: 'c2' },
  '衣物饰品': { initial: '衣', cls: 'c3' },
  '钥匙': { initial: '钥', cls: 'c4' },
  '其他': { initial: '物', cls: 'c5' }
};

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function setToken(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function cachedUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch (e) {
    return null;
  }
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;

  let body = options.body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const res = await fetch('/api' + path, {
    method: options.method || 'GET',
    headers,
    body
  });

  if (res.status === 401) {
    clearAuth();
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || '请求失败');
    err.status = res.status;
    throw err;
  }
  return data;
}

function toast(message, type = '') {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = 'toast show ' + type;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.className = 'toast ' + type; }, 2400);
}

function escapeHTML(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  if (diff < 60 * 1000) return '刚刚';
  if (diff < 3600 * 1000) return Math.floor(diff / 60000) + ' 分钟前';
  if (diff < 86400 * 1000) return Math.floor(diff / 3600000) + ' 小时前';
  if (diff < 7 * 86400 * 1000) return Math.floor(diff / 86400000) + ' 天前';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${mi}`;
}

function catMeta(category) {
  return CATEGORY_MAP[category] || CATEGORY_MAP['其他'];
}

function thumbHTML(item, opts = {}) {
  if (item.image) {
    return `<img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.title)}" loading="lazy">`;
  }
  const meta = catMeta(item.category);
  return `<div class="placeholder ${meta.cls}">${meta.initial}</div>`;
}

function typeText(type) {
  return type === 'lost' ? '失物' : '招领';
}

function statusText(status) {
  return ({ pending: '待审核', active: '已发布', resolved: '已完成', rejected: '未通过' })[status] || status;
}

function initials(name) {
  return String(name || '?').slice(0, 1);
}

async function renderHeader() {
  const area = $('#userArea');
  if (!area) return null;

  let user = getToken() ? cachedUser() : null;
  let unread = 0;

  if (getToken()) {
    try {
      const data = await api('/auth/me');
      user = data.user;
      unread = data.unread;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) {
      user = null;
      clearAuth();
    }
  }

  if (!user) {
    area.innerHTML = `
      <a class="btn btn-sm" href="/login.html">登录</a>
      <a class="btn btn-sm btn-primary" href="/register.html">注册</a>
    `;
  } else {
    area.innerHTML = `
      <a href="/my.html" style="display:flex;align-items:center;gap:8px">
        <span class="avatar">${escapeHTML(initials(user.nickname))}</span>
        <span>${escapeHTML(user.nickname)}</span>
        ${unread ? `<span class="badge-dot">${unread}</span>` : ''}
      </a>
      <button class="btn btn-sm" id="logoutBtn">退出</button>
    `;
    $('#logoutBtn').addEventListener('click', async () => {
      try { await api('/auth/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
      clearAuth();
      toast('已退出登录');
      setTimeout(() => { location.href = '/index.html'; }, 400);
    });
  }

  return user;
}

function requireLogin() {
  if (!getToken()) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    location.href = '/login.html?redirect=' + redirect;
    return false;
  }
  return true;
}

function isAdmin(user) {
  return !!user && user.role === 'admin';
}

function setActiveNav() {
  const path = location.pathname.replace(/\/$/, '/index.html');
  $$('.nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path) a.classList.add('active');
  });
}

function renderFooter() {
  const footer = $('#siteFooter');
  if (footer) {
    footer.innerHTML = `校园失物招领平台 · Web 程序设计期末小组项目（项目 15） · 数据仅供课程演示`;
  }
}

const commonReady = (async () => {
  setActiveNav();
  renderFooter();
  const user = await renderHeader();
  $$('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin(user)));
  return user;
})();
