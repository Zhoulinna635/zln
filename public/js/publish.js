const editId = new URLSearchParams(location.search).get('id');
let me = null;
let type = 'lost';
let previewUrl = '';

function bindTypeSwitch() {
  $$('.type-option', $('#typeSwitch')).forEach(opt => {
    opt.addEventListener('click', () => {
      $$('.type-option', $('#typeSwitch')).forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      type = opt.dataset.type;
    });
  });
}

function bindImage() {
  const input = $('#imageInput');
  const preview = $('#preview');

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast('图片不能超过 5MB', 'error');
      input.value = '';
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${previewUrl}" alt="预览">`;
  });
}

function fillForm(item) {
  type = item.type;
  $$('.type-option', $('#typeSwitch')).forEach(o => {
    o.classList.toggle('active', o.dataset.type === type);
  });
  $('#title').value = item.title;
  $('#category').value = item.category;
  $('#location').value = item.location;
  $('#contact').value = item.contact;
  $('#description').value = item.description;
  $('#descCount').textContent = item.description.length;

  if (item.image) {
    $('#preview').innerHTML = `<img src="${escapeHTML(item.image)}" alt="预览">`;
  }

  $('#pageTitle').textContent = '编辑信息';
  $('#submitBtn').textContent = '保存修改';
}

async function loadForEdit() {
  try {
    const data = await api('/items/' + editId);
    if (!data.item.canManage) {
      toast('只能编辑自己发布的信息', 'error');
      setTimeout(() => { location.href = '/index.html'; }, 900);
      return;
    }
    fillForm(data.item);
  } catch (e) {
    toast(e.message, 'error');
  }
}

function validate(form) {
  if (!form.title || form.title.length < 4) return '标题至少 4 个字符';
  if (form.title.length > 40) return '标题不能超过 40 个字符';
  if (!form.category) return '请选择物品分类';
  if (!form.location) return '请填写地点';
  if (!form.contact) return '请填写联系方式';
  if (form.description.length < 10) return '物品描述至少 10 个字符';
  return '';
}

(function init() {
  if (!requireLogin()) return;

  commonReady.then(user => {
    me = user;
    if (!me) return;
    if (editId) loadForEdit();
  });

  bindTypeSwitch();
  bindImage();

  $('#description').addEventListener('input', e => {
    $('#descCount').textContent = e.target.value.length;
  });

  $('#publishForm').addEventListener('submit', async e => {
    e.preventDefault();
    const errorBox = $('#formError');
    errorBox.textContent = '';

    const data = {
      type,
      title: $('#title').value.trim(),
      category: $('#category').value,
      location: $('#location').value.trim(),
      contact: $('#contact').value.trim(),
      description: $('#description').value.trim()
    };

    const error = validate(data);
    if (error) {
      errorBox.textContent = error;
      return;
    }

    const form = new FormData();
    Object.entries(data).forEach(([k, v]) => form.append(k, v));
    const file = $('#imageInput').files[0];
    if (file) form.append('image', file);

    const btn = $('#submitBtn');
    btn.disabled = true;
    btn.textContent = editId ? '保存中...' : '发布中...';

    try {
      if (editId) {
        const res = await api('/items/' + editId, { method: 'PUT', body: form });
        toast(res.message);
        setTimeout(() => { location.href = '/detail.html?id=' + editId; }, 800);
      } else {
        const res = await api('/items', { method: 'POST', body: form });
        toast(res.message);
        setTimeout(() => { location.href = '/my.html'; }, 900);
      }
    } catch (err) {
      errorBox.textContent = err.message;
      btn.disabled = false;
      btn.textContent = editId ? '保存修改' : '发布信息';
    }
  });
})();
