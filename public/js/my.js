let me = null;
let activeTab = 'items';

const CLAIM_STATUS = {
  pending: '待处理',
  approved: '已通过',
  rejected: '已拒绝'
};

function renderProfile() {
  if (!me) return;
  $('#profileCard').innerHTML = `
    <span class="avatar">${escapeHTML(initials(me.nickname))}</span>
    <div>
      <h2>${escapeHTML(me.nickname)}</h2>
      <p>账号：${escapeHTML(me.username)} · ${me.role === 'admin' ? '管理员' : '普通用户'}</p>
    </div>
    <div class="spacer"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <a class="btn btn-sm" href="/publish.html">发布信息</a>
      <button class="btn btn-sm" id="notifyBtn">开启浏览器通知</button>
    </div>
  `;

  $('#notifyBtn').addEventListener('click', async () => {
    if (!('Notification' in window)) return toast('当前浏览器不支持通知', 'error');
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      toast('已开启通知');
      new Notification('校园失物招领平台', { body: '通知已开启，有新消息时会提醒你' });
    } else {
      toast('你拒绝了通知权限', 'error');
    }
  });
}

function itemRow(item) {
  return `
    <div class="list-row">
      <div class="list-thumb">${thumbHTML(item)}</div>
      <div class="list-body">
        <h4>${escapeHTML(item.title)}</h4>
        <div class="meta">
          <span class="pill ${item.type}">${typeText(item.type)}</span>
          <span>${escapeHTML(item.category)}</span>
          <span>${statusText(item.status)}</span>
          <span>${item.views} 次浏览</span>
          <span>${formatTime(item.createdAt)}</span>
          ${item.pendingClaims ? `<span style="color:#d97706">${item.pendingClaims} 条待处理申请</span>` : ''}
        </div>
        <div class="meta" style="margin-top:6px">${escapeHTML(item.description.slice(0, 60))}${item.description.length > 60 ? '...' : ''}</div>
      </div>
      <div class="list-actions">
        <a class="btn btn-sm" href="/detail.html?id=${item.id}">查看</a>
        <a class="btn btn-sm" href="/publish.html?id=${item.id}">编辑</a>
        ${item.status !== 'resolved' ? `<button class="btn btn-sm" data-resolve="${item.id}">标记完成</button>` : ''}
        <button class="btn btn-sm btn-danger" data-del="${item.id}">删除</button>
      </div>
    </div>
  `;
}

async function loadItems() {
  const panel = $('#panel');
  panel.innerHTML = '<div class="empty">加载中...</div>';
  try {
    const { list } = await api('/my/items');
    if (!list.length) {
      panel.innerHTML = '<div class="empty">你还没有发布信息，<a href="/publish.html" style="color:#0d9488">去发布 →</a></div>';
      return;
    }
    panel.innerHTML = '<div class="list">' + list.map(itemRow).join('') + '</div>';

    $$('[data-del]', panel).forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('删除后不可恢复，确认删除吗？')) return;
        try {
          await api('/items/' + btn.dataset.del, { method: 'DELETE' });
          toast('已删除');
          loadItems();
        } catch (e) {
          toast(e.message, 'error');
        }
      });
    });

    $$('[data-resolve]', panel).forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('确认将该信息标记为“已完成”吗？')) return;
        try {
          const res = await api(`/items/${btn.dataset.resolve}/resolve`, { method: 'POST' });
          toast(res.message);
          loadItems();
        } catch (e) {
          toast(e.message, 'error');
        }
      });
    });
  } catch (e) {
    panel.innerHTML = `<div class="empty">${escapeHTML(e.message)}</div>`;
  }
}

async function loadFavorites() {
  const panel = $('#panel');
  panel.innerHTML = '<div class="empty">加载中...</div>';
  try {
    const { list } = await api('/my/favorites');
    if (!list.length) {
      panel.innerHTML = '<div class="empty">还没有收藏任何信息</div>';
      return;
    }
    panel.innerHTML = '<div class="list">' + list.map(item => `
      <div class="list-row">
        <div class="list-thumb">${thumbHTML(item)}</div>
        <div class="list-body">
          <h4>${escapeHTML(item.title)}</h4>
          <div class="meta">
            <span class="pill ${item.type}">${typeText(item.type)}</span>
            <span>${escapeHTML(item.category)}</span>
            <span>${escapeHTML(item.location)}</span>
            <span>收藏于 ${formatTime(item.favAt)}</span>
          </div>
        </div>
        <div class="list-actions">
          <a class="btn btn-sm" href="/detail.html?id=${item.id}">查看</a>
          <button class="btn btn-sm btn-danger" data-unfav="${item.id}">取消收藏</button>
        </div>
      </div>
    `).join('') + '</div>';

    $$('[data-unfav]', panel).forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api(`/items/${btn.dataset.unfav}/favorite`, { method: 'POST' });
          toast('已取消收藏');
          loadFavorites();
        } catch (e) {
          toast(e.message, 'error');
        }
      });
    });
  } catch (e) {
    panel.innerHTML = `<div class="empty">${escapeHTML(e.message)}</div>`;
  }
}

async function loadMyClaims() {
  const panel = $('#panel');
  panel.innerHTML = '<div class="empty">加载中...</div>';
  try {
    const { list } = await api('/my/claims');
    if (!list.length) {
      panel.innerHTML = '<div class="empty">还没有提交过认领申请</div>';
      return;
    }
    panel.innerHTML = '<div class="list">' + list.map(c => `
      <div class="list-row">
        <div class="list-thumb">${c.image ? `<img src="${escapeHTML(c.image)}" alt="">` : `<div class="placeholder ${catMeta(c.category).cls}">${catMeta(c.category).initial}</div>`}</div>
        <div class="list-body">
          <h4>${escapeHTML(c.title)}</h4>
          <div class="meta">
            <span class="pill ${c.type}">${typeText(c.type)}</span>
            <span>发布者：${escapeHTML(c.ownerName)}</span>
            <span>${CLAIM_STATUS[c.status] || c.status}</span>
            <span>${formatTime(c.created_at)}</span>
          </div>
          <div class="meta" style="margin-top:6px">认领说明：${escapeHTML(c.message)}</div>
        </div>
        <div class="list-actions">
          <a class="btn btn-sm" href="/detail.html?id=${c.item_id}">查看信息</a>
        </div>
      </div>
    `).join('') + '</div>';
  } catch (e) {
    panel.innerHTML = `<div class="empty">${escapeHTML(e.message)}</div>`;
  }
}

async function loadReceived() {
  const panel = $('#panel');
  panel.innerHTML = '<div class="empty">加载中...</div>';
  try {
    const { list } = await api('/my/received');
    if (!list.length) {
      panel.innerHTML = '<div class="empty">还没有收到认领申请</div>';
      return;
    }
    panel.innerHTML = '<div class="list">' + list.map(c => `
      <div class="list-row">
        <div class="list-body">
          <h4>${escapeHTML(c.title)}</h4>
          <div class="meta">
            <span class="pill ${c.type}">${typeText(c.type)}</span>
            <span>申请人：${escapeHTML(c.applicantName)}</span>
            <span>${CLAIM_STATUS[c.status] || c.status}</span>
            <span>${formatTime(c.created_at)}</span>
          </div>
          <div class="meta" style="margin-top:6px">认领说明：${escapeHTML(c.message)}</div>
        </div>
        <div class="list-actions">
          <a class="btn btn-sm" href="/detail.html?id=${c.item_id}">查看信息</a>
          ${c.status === 'pending' ? `
            <button class="btn btn-sm btn-primary" data-claim="${c.id}" data-action="approved">同意</button>
            <button class="btn btn-sm btn-danger" data-claim="${c.id}" data-action="rejected">拒绝</button>
          ` : ''}
        </div>
      </div>
    `).join('') + '</div>';

    $$('[data-claim]', panel).forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        if (!confirm(action === 'approved' ? '确认同意该认领申请？同意后信息将标记为已完成' : '确认拒绝该认领申请？')) return;
        try {
          const res = await api('/claims/' + btn.dataset.claim, {
            method: 'PUT',
            body: { status: action }
          });
          toast(res.message);
          loadReceived();
        } catch (e) {
          toast(e.message, 'error');
        }
      });
    });
  } catch (e) {
    panel.innerHTML = `<div class="empty">${escapeHTML(e.message)}</div>`;
  }
}

async function loadMessages() {
  const panel = $('#panel');
  panel.innerHTML = '<div class="empty">加载中...</div>';
  try {
    const { list, unread } = await api('/messages');

    if (unread && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('校园失物招领平台', { body: `你有 ${unread} 条未读消息` });
    }

    if (!list.length) {
      panel.innerHTML = '<div class="empty">暂无消息</div>';
      return;
    }

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:14px;color:#6b7280">共 ${list.length} 条消息，未读 ${unread} 条</span>
        <button class="btn btn-sm" id="readAll">全部标为已读</button>
      </div>
      <div class="list">
        ${list.map(m => `
          <div class="msg-item ${m.is_read ? '' : 'unread'}">
            ${m.is_read ? '' : '<span class="msg-dot"></span>'}
            <div style="flex:1">
              <h4>${escapeHTML(m.title)}</h4>
              <p>${escapeHTML(m.content)}</p>
            </div>
            <time>${formatTime(m.created_at)}</time>
          </div>
        `).join('')}
      </div>
    `;

    $('#readAll').addEventListener('click', async () => {
      try {
        await api('/messages/read', { method: 'PUT' });
        toast('已全部标为已读');
        me = await commonReady;
        renderHeader();
        loadMessages();
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  } catch (e) {
    panel.innerHTML = `<div class="empty">${escapeHTML(e.message)}</div>`;
  }
}

const loaders = {
  items: loadItems,
  favorites: loadFavorites,
  claims: loadMyClaims,
  received: loadReceived,
  messages: loadMessages
};

function bindTabs() {
  $$('#tabBar button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('active')) return;
      $$('#tabBar button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      loaders[activeTab]();
    });
  });
}

(async function init() {
  if (!requireLogin()) return;
  me = await commonReady;
  if (!me) return;

  renderProfile();
  bindTabs();
  loaders[activeTab]();

  const url = new URLSearchParams(location.search);
  if (url.get('tab') && loaders[url.get('tab')]) {
    const btn = $(`#tabBar button[data-tab="${url.get('tab')}"]`);
    if (btn) btn.click();
  }
})();
