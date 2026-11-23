const HISTORY_KEY = 'lf_search_history';

const state = {
  type: '',
  category: '',
  keyword: '',
  sort: 'latest',
  page: 1,
  pageSize: 8
};

function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function pushHistory(keyword) {
  if (!keyword) return;
  const list = readHistory().filter(k => k !== keyword);
  list.unshift(keyword);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 6)));
  renderHistory();
}

function renderHistory() {
  const row = $('#historyRow');
  const list = readHistory();
  if (!list.length) {
    row.innerHTML = '<span>试试搜索：</span>' + ['校园卡', '耳机', '钥匙', '图书馆']
      .map(k => `<button class="chip" data-keyword="${escapeHTML(k)}">${escapeHTML(k)}</button>`).join('');
  } else {
    row.innerHTML = '<span>最近搜索：</span>' +
      list.map(k => `<button class="chip" data-keyword="${escapeHTML(k)}">${escapeHTML(k)}</button>`).join('') +
      '<button class="chip" data-clear="1">清空</button>';
  }

  $$('.chip', row).forEach(chip => {
    chip.addEventListener('click', () => {
      if (chip.dataset.clear) {
        localStorage.removeItem(HISTORY_KEY);
        renderHistory();
        return;
      }
      $('#searchInput').value = chip.dataset.keyword;
      state.keyword = chip.dataset.keyword;
      state.page = 1;
      loadItems();
    });
  });
}

async function loadStats() {
  try {
    const data = await api('/stats/overview');
    $('#heroStats').innerHTML = `
      <div><strong>${data.totalItems}</strong>累计信息</div>
      <div><strong>${data.lost}</strong>失物求助</div>
      <div><strong>${data.found}</strong>招领信息</div>
      <div><strong>${data.resolved}</strong>已完成认领</div>
    `;
  } catch (e) {
    $('#heroStats').innerHTML = '';
  }
}

async function loadCarousel() {
  try {
    const { list } = await api('/items/hot');
    const box = $('#carousel');
    if (!list.length) {
      box.innerHTML = '';
      return;
    }
    box.innerHTML = list.map(item => `
      <article class="slide" data-id="${item.id}">
        <div class="thumb">
          ${thumbHTML(item)}
          <span class="type-tag ${item.type}">${typeText(item.type)}</span>
        </div>
        <div class="slide-body">
          <h3>${escapeHTML(item.title)}</h3>
          <span>${escapeHTML(item.category)} · ${formatTime(item.createdAt)}</span>
        </div>
      </article>
    `).join('');

    $$('.slide', box).forEach(el => {
      el.addEventListener('click', () => { location.href = '/detail.html?id=' + el.dataset.id; });
    });

    let index = 0;
    clearInterval(window._carouselTimer);
    window._carouselTimer = setInterval(() => {
      const first = box.querySelector('.slide');
      if (!first) return;
      const step = first.offsetWidth + 16;
      index += 1;
      if (index >= list.length) index = 0;
      box.scrollTo({ left: index * step, behavior: 'smooth' });
    }, 4200);
  } catch (e) {
    $('#carousel').innerHTML = '';
  }
}

function itemCard(item) {
  return `
    <article class="item-card" data-id="${item.id}">
      <div class="thumb">
        ${thumbHTML(item)}
        <span class="type-tag ${item.type}">${typeText(item.type)}</span>
        ${item.status === 'resolved' ? '<span class="status-tag">已完成</span>' : ''}
      </div>
      <div class="item-body">
        <h3>${escapeHTML(item.title)}</h3>
        <div class="item-desc">${escapeHTML(item.description)}</div>
        <div class="item-meta">
          <span class="cate">${escapeHTML(item.category)}</span>
          <span>${escapeHTML(item.location)} · ${formatTime(item.createdAt)}</span>
        </div>
        <div class="item-meta">
          <span>发布者：${escapeHTML(item.author)}</span>
          <span>${item.views} 次浏览</span>
        </div>
      </div>
    </article>
  `;
}

async function loadItems() {
  const grid = $('#itemGrid');
  grid.innerHTML = '<div class="empty">加载中...</div>';

  const params = new URLSearchParams({
    page: state.page,
    pageSize: state.pageSize,
    sort: state.sort
  });
  if (state.type) params.set('type', state.type);
  if (state.category) params.set('category', state.category);
  if (state.keyword) params.set('keyword', state.keyword);

  try {
    const data = await api('/items?' + params.toString());
    if (!data.list.length) {
      grid.innerHTML = '<div class="empty">没有找到相关信息，换个关键词试试吧</div>';
      $('#pager').innerHTML = '';
      return;
    }

    grid.innerHTML = data.list.map(itemCard).join('');
    $$('.item-card', grid).forEach(el => {
      el.addEventListener('click', () => { location.href = '/detail.html?id=' + el.dataset.id; });
    });

    renderPager(data);
  } catch (e) {
    grid.innerHTML = `<div class="empty">加载失败：${escapeHTML(e.message)}</div>`;
    $('#pager').innerHTML = '';
  }
}

function renderPager(data) {
  const pager = $('#pager');
  if (data.totalPages <= 1) {
    pager.innerHTML = '';
    return;
  }
  const { page, totalPages } = data;
  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) pages.push(i);

  pager.innerHTML = `
    <button data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>上一页</button>
    ${pages.map(p => `<button data-page="${p}" class="${p === page ? 'active' : ''}">${p}</button>`).join('')}
    <button data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>下一页</button>
  `;

  $$('button[data-page]', pager).forEach(btn => {
    btn.addEventListener('click', () => {
      const p = Number(btn.dataset.page);
      if (!p || p === state.page) return;
      state.page = p;
      loadItems();
      document.getElementById('listSection').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

function bindFilters() {
  $$('.tab', $('#typeTabs')).forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab', $('#typeTabs')).forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.type = tab.dataset.type;
      state.page = 1;
      loadItems();
    });
  });

  $('#categorySelect').addEventListener('change', e => {
    state.category = e.target.value;
    state.page = 1;
    loadItems();
  });

  $('#sortSelect').addEventListener('change', e => {
    state.sort = e.target.value;
    state.page = 1;
    loadItems();
  });

  const doSearch = () => {
    const keyword = $('#searchInput').value.trim();
    state.keyword = keyword;
    state.page = 1;
    pushHistory(keyword);
    loadItems();
  };

  $('#searchBtn').addEventListener('click', doSearch);
  $('#searchInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch();
  });
}

(function init() {
  const url = new URLSearchParams(location.search);
  if (url.get('keyword')) {
    state.keyword = url.get('keyword');
    $('#searchInput').value = state.keyword;
  }
  if (url.get('type')) {
    state.type = url.get('type');
    $$('.tab', $('#typeTabs')).forEach(t => {
      t.classList.toggle('active', t.dataset.type === state.type);
    });
  }

  renderHistory();
  bindFilters();
  loadStats();
  loadCarousel();
  loadItems();
})();
