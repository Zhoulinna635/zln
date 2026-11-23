let auditStatus = 'pending';
let stats = null;

function drawTrend(canvas, trend) {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = 220;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const padding = { top: 24, right: 12, bottom: 30, left: 30 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const max = Math.max(4, ...trend.map(t => Math.max(t.lost, t.found)));
  const step = chartW / trend.length;

  ctx.clearRect(0, 0, width, height);

  // 网格
  ctx.strokeStyle = '#eef2f7';
  ctx.fillStyle = '#9ca3af';
  ctx.font = '11px Microsoft YaHei';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const value = Math.round((max / 4) * i);
    const y = padding.top + chartH - (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillText(String(value), padding.left - 6, y + 4);
  }

  const barW = Math.min(16, step / 3.2);
  trend.forEach((t, i) => {
    const cx = padding.left + step * i + step / 2;
    const lostH = (t.lost / max) * chartH;
    const foundH = (t.found / max) * chartH;

    ctx.fillStyle = '#f87171';
    ctx.fillRect(cx - barW - 2, padding.top + chartH - lostH, barW, lostH);
    ctx.fillStyle = '#2dd4bf';
    ctx.fillRect(cx + 2, padding.top + chartH - foundH, barW, foundH);

    ctx.fillStyle = '#9ca3af';
    ctx.textAlign = 'center';
    ctx.fillText(t.date, cx, height - 10);
  });

  // 图例
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f87171';
  ctx.fillRect(width - 118, 6, 8, 8);
  ctx.fillStyle = '#6b7280';
  ctx.fillText('失物', width - 105, 14);
  ctx.fillStyle = '#2dd4bf';
  ctx.fillRect(width - 62, 6, 8, 8);
  ctx.fillStyle = '#6b7280';
  ctx.fillText('招领', width - 49, 14);
}

async function loadStats() {
  try {
    stats = await api('/stats/overview');
    const cards = [
      ['信息总数', stats.totalItems],
      ['待审核', stats.pending],
      ['已发布', stats.active],
      ['已完成认领', stats.resolved],
      ['注册用户', stats.users],
      ['认领申请', stats.claims],
      ['留言总数', stats.comments],
      ['认领完成率', stats.resolveRate + '%']
    ];

    $('#statGrid').innerHTML = cards.map(([label, value]) => `
      <div class="card stat-card"><span>${label}</span><strong>${value}</strong></div>
    `).join('');

    $('#categoryBars').innerHTML = stats.categories.map(c => {
      const max = Math.max(1, ...stats.categories.map(x => x.value));
      const percent = Math.round((c.value / max) * 100);
      return `
        <div class="bar-row">
          <span class="bar-label">${escapeHTML(c.name)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${percent}%"></div></div>
          <span class="bar-value">${c.value}</span>
        </div>
      `;
    }).join('');

    $('#hotList').innerHTML = stats.hot.length ? stats.hot.map(item => `
      <div class="bar-row" style="align-items:center">
        <a class="bar-label" style="width:auto;flex:1;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
           href="/detail.html?id=${item.id}">${escapeHTML(item.title)}</a>
        <span class="bar-value" style="width:auto">${item.views} 次</span>
      </div>
    `).join('') : '<div style="color:#94a3b8;font-size:13px">暂无数据</div>';

    drawTrend($('#trendCanvas'), stats.trend);
  } catch (e) {
    toast(e.message, 'error');
  }
}

function statusPill(status) {
  const map = {
    pending: '<span class="pill" style="background:#fffbeb;color:#b45309">待审核</span>',
    active: '<span class="pill" style="background:#f0fdfa;color:#0d9488">已发布</span>',
    resolved: '<span class="pill" style="background:#eff6ff;color:#2563eb">已完成</span>',
    rejected: '<span class="pill" style="background:#fef2f2;color:#dc2626">未通过</span>'
  };
  return map[status] || status;
}

async function loadAudit() {
  const box = $('#auditBox');
  box.innerHTML = '<div class="empty">加载中...</div>';

  const tabDefs = [
    ['pending', '待审核'],
    ['active', '已发布'],
    ['resolved', '已完成'],
    ['rejected', '未通过'],
    ['all', '全部']
  ];

  try {
    const data = await api('/admin/items?status=' + auditStatus);

    box.innerHTML = `
      <div class="tab-bar" style="margin-bottom:16px">
        ${tabDefs.map(([key, label]) => `
          <button data-status="${key}" class="${auditStatus === key ? 'active' : ''}">
            ${label}${data.counts[key] != null ? `（${data.counts[key]}）` : ''}
          </button>
        `).join('')}
      </div>
      ${data.list.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>标题</th><th>类型</th><th>分类</th><th>发布者</th><th>状态</th><th>发布时间</th><th>操作</th></tr>
            </thead>
            <tbody>
              ${data.list.map(item => `
                <tr>
                  <td style="max-width:240px">
                    <a href="/detail.html?id=${item.id}" style="font-weight:600">${escapeHTML(item.title)}</a>
                    <div style="font-size:12px;color:#9ca3af;margin-top:2px">${escapeHTML(item.location)}</div>
                  </td>
                  <td><span class="pill ${item.type}">${typeText(item.type)}</span></td>
                  <td>${escapeHTML(item.category)}</td>
                  <td>${escapeHTML(item.author)}</td>
                  <td>${statusPill(item.status)}</td>
                  <td style="white-space:nowrap">${formatDate(item.created_at)}</td>
                  <td style="white-space:nowrap">
                    ${item.status === 'pending' ? `
                      <button class="btn btn-sm btn-primary" data-audit="${item.id}" data-action="approve">通过</button>
                      <button class="btn btn-sm btn-danger" data-audit="${item.id}" data-action="reject">驳回</button>
                    ` : `<a class="btn btn-sm" href="/detail.html?id=${item.id}">查看</a>`}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="empty">当前分类暂无数据</div>'}
    `;

    $$('#auditBox [data-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        auditStatus = btn.dataset.status;
        loadAudit();
      });
    });

    $$('[data-audit]', box).forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        if (!confirm(action === 'approve' ? '确认通过该条信息？' : '确认驳回该条信息？')) return;
        try {
          const res = await api(`/admin/items/${btn.dataset.audit}/audit`, {
            method: 'PUT',
            body: { action }
          });
          toast(res.message);
          await loadStats();
          loadAudit();
        } catch (e) {
          toast(e.message, 'error');
        }
      });
    });
  } catch (e) {
    box.innerHTML = `<div class="empty">${escapeHTML(e.message)}</div>`;
  }
}

function renderLayout() {
  $('#adminMain').innerHTML = `
    <div class="stat-grid" id="statGrid"></div>

    <div class="chart-row">
      <section class="card panel">
        <h3>近 7 天发布趋势</h3>
        <canvas id="trendCanvas" style="width:100%;height:220px"></canvas>
      </section>
      <section class="card panel">
        <h3>分类占比</h3>
        <div id="categoryBars"></div>
        <h3 style="margin-top:22px">浏览最多</h3>
        <div id="hotList"></div>
      </section>
    </div>

    <section class="card panel">
      <h3>信息审核</h3>
      <div id="auditBox"></div>
    </section>
  `;
}

function watchResize() {
  let timer = null;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (stats) drawTrend($('#trendCanvas'), stats.trend);
    }, 200);
  });
}

(async function init() {
  if (!requireLogin()) return;
  const user = await commonReady;
  if (!user) return;

  if (user.role !== 'admin') {
    $('#adminMain').innerHTML = `
      <div class="empty">
        该页面仅管理员可访问<br><br>
        <a class="btn" href="/index.html">返回首页</a>
      </div>`;
    return;
  }

  renderLayout();
  await loadStats();
  loadAudit();
  watchResize();
})();
