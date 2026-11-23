function redirectAfterAuth() {
  const redirect = new URLSearchParams(location.search).get('redirect');
  const target = redirect && redirect.startsWith('/') ? redirect : '/index.html';
  location.href = target;
}

function setLoading(btn, loading, text) {
  btn.disabled = loading;
  btn.textContent = loading ? '处理中...' : text;
}

(function init() {
  const loginForm = $('#loginForm');
  const registerForm = $('#registerForm');

  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const errorBox = $('#errorBox');
      const btn = $('#submitBtn');
      const username = $('#username').value.trim();
      const password = $('#password').value;

      errorBox.textContent = '';
      if (!username) { errorBox.textContent = '请输入用户名'; return; }
      if (!password) { errorBox.textContent = '请输入密码'; return; }

      setLoading(btn, true, '登录');
      try {
        const data = await api('/auth/login', { method: 'POST', body: { username, password } });
        setToken(data.token, data.user);
        toast('登录成功，欢迎 ' + data.user.nickname);
        setTimeout(redirectAfterAuth, 500);
      } catch (err) {
        errorBox.textContent = err.message;
        setLoading(btn, false, '登录');
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async e => {
      e.preventDefault();
      const errorBox = $('#errorBox');
      const btn = $('#submitBtn');
      const username = $('#username').value.trim();
      const nickname = $('#nickname').value.trim();
      const password = $('#password').value;
      const confirm = $('#confirm').value;

      errorBox.textContent = '';
      if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
        errorBox.textContent = '用户名需为 3~16 位字母、数字或下划线';
        return;
      }
      if (password.length < 6) { errorBox.textContent = '密码至少 6 位'; return; }
      if (password !== confirm) { errorBox.textContent = '两次输入的密码不一致'; return; }

      setLoading(btn, true, '注册并登录');
      try {
        const data = await api('/auth/register', {
          method: 'POST',
          body: { username, password, nickname: nickname || username }
        });
        setToken(data.token, data.user);
        toast('注册成功，已自动登录');
        setTimeout(redirectAfterAuth, 600);
      } catch (err) {
        errorBox.textContent = err.message;
        setLoading(btn, false, '注册并登录');
      }
    });
  }
})();
