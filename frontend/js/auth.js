// Redirect if already logged in
if (localStorage.getItem('ttm_token')) {
  window.location.href = '/dashboard.html';
}

const loginForm   = document.getElementById('login-form');
const signupForm  = document.getElementById('signup-form');
const tabLogin    = document.getElementById('tab-login');
const tabSignup   = document.getElementById('tab-signup');
const errorMsg    = document.getElementById('error-msg');

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.add('visible');
  setTimeout(() => errorMsg.classList.remove('visible'), 4000);
}

function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.innerHTML = loading
    ? `<span class="spinner"></span> Please wait…`
    : btn.dataset.label;
}

// ── Tab switching ─────────────────────────────────────────────────────────────
tabLogin.addEventListener('click', () => {
  tabLogin.classList.add('active');
  tabSignup.classList.remove('active');
  loginForm.classList.remove('hidden');
  signupForm.classList.add('hidden');
  errorMsg.classList.remove('visible');
});

tabSignup.addEventListener('click', () => {
  tabSignup.classList.add('active');
  tabLogin.classList.remove('active');
  signupForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
  errorMsg.classList.remove('visible');
});

// ── Login ─────────────────────────────────────────────────────────────────────
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = loginForm.querySelector('button[type=submit]');
  setLoading(btn, true);
  try {
    const data = await api.login({
      email:    document.getElementById('login-email').value.trim(),
      password: document.getElementById('login-password').value,
    });
    localStorage.setItem('ttm_token', data.token);
    localStorage.setItem('ttm_user', JSON.stringify(data.user));
    window.location.href = '/dashboard.html';
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(btn, false);
  }
});

// ── Signup ────────────────────────────────────────────────────────────────────
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = signupForm.querySelector('button[type=submit]');
  const pwd  = document.getElementById('signup-password').value;
  const pwd2 = document.getElementById('signup-password2').value;

  if (pwd !== pwd2) return showError('Passwords do not match');

  setLoading(btn, true);
  try {
    const data = await api.signup({
      name:     document.getElementById('signup-name').value.trim(),
      email:    document.getElementById('signup-email').value.trim(),
      password: pwd,
    });
    localStorage.setItem('ttm_token', data.token);
    localStorage.setItem('ttm_user', JSON.stringify(data.user));
    window.location.href = '/dashboard.html';
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(btn, false);
  }
});
