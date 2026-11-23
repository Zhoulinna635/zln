const itemId = new URLSearchParams(location.search).get('id');
let me = null;
let current = null;
let comments = [];

function renderItem(data) {
  const { item } = data;
  current = item;
  comments = data.comments || [];

  if (item.status === 'pending' && !item.canManage) {
    $('#detailMain').innerHTML = '<div class="empty">该信息正在审核中，暂未公开</div>';
    $('#publisherBox').innerHTML = '';
    $('#commentBox').innerHTML = '';
    return;
  }

  document.title = item.title + ' · 校园失物招领平台';

  const contactHtml = item.contactMasked
    ? `<div class="contact-box">${escapeHTML(item.contact)}<div style="font-size:12px;color:#94a3b8;margin-top:4px">
        登录后可查看完整联系方式，平台对未登录用户的联系方式做脱敏处理</div></div>`
    : `<div class="contact-box"><strong>${escapeHTML(item.contact)}</strong></div>`;

  const ownerActions = item.canManage ? `
    <a class="btn btn-sm" href="/publish.html?id=${item.id}">编辑</a>
    ${item.status !== 'resolved' ? '<button class="btn btn-sm" id="resolveBtn">标记已完成</button>' : ''}
    <button class="btn btn-sm btn-danger" id="deleteBtn">删除</button>
  ` : '';

  $('#detailMain').innerHTML = `
    <div class="detail-image">
      ${item.image
        ? `<img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.title)}">`
        : `<div class="placeholder ${catMeta(item.category).cls}" style="height:100%;display:grid;place-items:center;font-size:64px;color:#fff">${catMeta(item.category).initial}</div>`}
    </div>
    <h1 class="detail-title">${escapeHTML(item.title)}</h1>
    <div class="detail-tags">
      <span class="pill ${item.type}">${typeText(item.type)}</span>
      <span class="pill">${escapeHTML(item.category)}</span>
      ${item.status === 'resolved' ? '<span class="pill resolved">已完成认领</span>' : ''}
      ${item.status === 'pending' ? '<span class="pill">待审核</span>' : ''}
      ${item.status === 'rejected' ? '<span class="pill">审核未通过</span>' : ''}
    </div>
    <p class="detail-desc">${escapeHTML(item.description)}</p>

    <div class="info-list">
      <div class="info-row"><span class="label">地点</span><span>${escapeHTML(item.location)}</span></div>
      <div class="info-row"><span class="label">发布时间</span><span>${formatDate(item.createdAt)}（${formatTime(item.createdAt)}）</span></div>
      <div class="info-row"><span class="label">发布者</span><span>${escapeHTML(item.author)}</span></div>
      <div class="info-row"><span class="label">浏览量</span><span>${item.views} 次</span></div>
      <div class="info-row"><span class="label">联系方式</span><span style="flex:1">${contactHtml}</span></div>
    </div>

    <div class="detail-actions">
      <button class="btn btn-primary" id="favBtn">${data.favorited ? '已收藏' : '收藏信息'}</button>
      ${item.canManage ? '' : `<button class="btn" id="claimBtn">申请认领</button>`}
      ${ownerActions}
      <a class="btn" href="/index.html">返回列表</a>
    </div>

    <div id="claimFormWrap" class="hidden" style="margin-top:18px">
      <div class="form-item">
        <label>认领说明 <span class="hint">描述物品特征，便于发布者确认</span></label>
        <textarea class="textarea" id="claimMessage" placeholder="例如：卡面照片是我本人，学号尾号 214，可以当面核对"></textarea>
        <p class="error-text" id="claimError"></p>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-primary" id="submitClaim">提交申请</button>
        <button class="btn" id="cancelClaim">取消</button>
      </div>
    </div>
  `;

  $('#publisherBox').innerHTML = `
    <div class="publisher-head">
      <span class="avatar">${escapeHTML(initials(item.author))}</span>
      <div>
        <strong>${escapeHTML(item.author)}</strong>
        <div style="font-size:12px;color:#94a3b8">发布者</div>
      </div>
    </div>
    <div style="font-size:13px;color:#6b7280;line-height:1.8">
      <div>信息类型：${typeText(item.type)}</div>
      <div>物品分类：${escapeHTML(item.category)}</div>
      <div>当前状态：${statusText(item.status)}</div>
      ${data.myClaim ? `<div>我的申请：${({ pending: '待处理', approved: '已通过', rejected: '已拒绝' })[data.myClaim.status]}</div>` : ''}
    </div>
  `;

  renderComments();
  bindActions();
}

function renderComments() {
  const canComment = !!me;
  $('#commentBox').innerHTML = `
    <h3>留言（${comments.length}）</h3>
    <div id="commentList">
      ${comments.length ? comments.map(c => `
        <div class="comment">
          <div class="comment-head">
            <span>${escapeHTML(c.nickname)}</span>
            <span>${formatTime(c.created_at)}</span>
          </div>
          <p>${escapeHTML(c.content)}</p>
        </div>
      `).join('') : '<div style="color:#94a3b8;font-size:13px;padding:6px 0 12px">暂无留言，登录后可以留言沟通</div>'}
    </div>
    ${canComment ? `
      <div class="form-item" style="margin-top:14px">
        <textarea class="textarea" id="commentInput" style="min-height:80px" placeholder="文明留言，帮助失主或拾主更快确认信息"></textarea>
      </div>
      <button class="btn btn-primary btn-sm" id="commentSubmit">发布留言</button>
    ` : '<a class="btn btn-sm" href="/login.html?redirect=' + encodeURIComponent(location.pathname + location.search) + '">登录后留言</a>'}
  `;

  const btn = $('#commentSubmit');
  if (btn) {
    btn.addEventListener('click', async () => {
      const content = $('#commentInput').value.trim();
      if (content.length < 2) return toast('留言至少 2 个字', 'error');
      btn.disabled = true;
      try {
        await api(`/items/${itemId}/comments`, { method: 'POST', body: { content } });
        toast('留言成功');
        $('#commentInput').value = '';
        await load();
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }
}

function bindActions() {
  const favBtn = $('#favBtn');
  if (favBtn) {
    favBtn.addEventListener('click', async () => {
      if (!requireLogin()) return;
      try {
        const data = await api(`/items/${itemId}/favorite`, { method: 'POST' });
        favBtn.textContent = data.favorited ? '已收藏' : '收藏信息';
        toast(data.message);
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  }

  const claimBtn = $('#claimBtn');
  if (claimBtn) {
    claimBtn.addEventListener('click', () => {
      if (!requireLogin()) return;
      $('#claimFormWrap').classList.remove('hidden');
      $('#claimMessage').focus();
    });
  }

  const cancelClaim = $('#cancelClaim');
  if (cancelClaim) {
    cancelClaim.addEventListener('click', () => $('#claimFormWrap').classList.add('hidden'));
  }

  const submitClaim = $('#submitClaim');
  if (submitClaim) {
    submitClaim.addEventListener('click', async () => {
      const message = $('#claimMessage').value.trim();
      if (message.length < 5) {
        $('#claimError').textContent = '请填写至少 5 个字的认领说明';
        return;
      }
      submitClaim.disabled = true;
      try {
        const data = await api(`/items/${itemId}/claims`, { method: 'POST', body: { message } });
        toast(data.message);
        setTimeout(() => location.reload(), 800);
      } catch (e) {
        $('#claimError').textContent = e.message;
      } finally {
        submitClaim.disabled = false;
      }
    });
  }

  const resolveBtn = $('#resolveBtn');
  if (resolveBtn) {
    resolveBtn.addEventListener('click', async () => {
      if (!confirm('确认将该信息标记为“已完成”吗？')) return;
      try {
        const data = await api(`/items/${itemId}/resolve`, { method: 'POST' });
        toast(data.message);
        await load();
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  }

  const deleteBtn = $('#deleteBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('删除后不可恢复，确认删除这条信息吗？')) return;
      try {
        await api(`/items/${itemId}`, { method: 'DELETE' });
        toast('已删除');
        setTimeout(() => { location.href = '/index.html'; }, 600);
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  }
}

async function load() {
  if (!itemId) {
    $('#detailMain').innerHTML = '<div class="empty">缺少信息 ID</div>';
    return;
  }
  try {
    const data = await api('/items/' + itemId);
    renderItem(data);
  } catch (e) {
    $('#detailMain').innerHTML = `<div class="empty">${escapeHTML(e.message)}<br><br><a class="btn" href="/index.html">返回首页</a></div>`;
    $('#publisherBox').innerHTML = '';
    $('#commentBox').innerHTML = '';
  }
}

(function bindScroll() {
  const bar = $('#progressBar');
  const top = $('#backTop');
  window.addEventListener('scroll', () => {
    const height = document.documentElement.scrollHeight - window.innerHeight;
    const percent = height > 0 ? (window.scrollY / height) * 100 : 0;
    bar.style.width = percent + '%';
    top.classList.toggle('show', window.scrollY > 320);
  });
  top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();

(async function init() {
  me = await commonReady;
  await load();
})();
