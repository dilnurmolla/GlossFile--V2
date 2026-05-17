console.log('REGISTER: yüklendi');

const I18N = {
  'tr-TR': {
    'register.title': 'GlossFile • Kayıt',
    'register.username': 'Kullanıcı Adı',
    'register.usernamePlaceholder': 'Kullanıcı Adı',
    'register.email': 'E-posta',
    'register.emailPlaceholder': 'ornek@mail.com',
    'register.password': 'Parola',
    'register.passwordPlaceholder': 'Şifre (min 8)',
    'register.submit': 'Kayıt Ol',
    'register.haveAccount': 'Zaten hesabın var mı?',
    'register.loginLink': 'Giriş Yap',
    'error.required': 'Kullanıcı adı, e-posta ve şifre gerekli.',
    'error.passwordLen': 'Şifre en az 8 karakter olmalıdır.',
    'success.registered': 'Kayıt başarılı. Giriş yapabilirsin.',
    'status.saving': 'Kaydediliyor...'
  },
  'en-US': {
    'register.title': 'GlossFile • Sign Up',
    'register.username': 'Username',
    'register.usernamePlaceholder': 'Username',
    'register.email': 'Email',
    'register.emailPlaceholder': 'example@mail.com',
    'register.password': 'Password',
    'register.passwordPlaceholder': 'Password (min 8)',
    'register.submit': 'Sign Up',
    'register.haveAccount': 'Already have an account?',
    'register.loginLink': 'Log In',
    'error.required': 'Username, email, and password are required.',
    'error.passwordLen': 'Password must be at least 8 characters.',
    'success.registered': 'Registration successful. You can log in.',
    'status.saving': 'Saving...'
  }
};

function getLang() {
  try {
    const prefs = JSON.parse(localStorage.getItem('gf_prefs') || '{}');
    if (typeof prefs.language === 'string') return prefs.language;
  } catch {}
  return 'tr-TR';
}

function t(key) {
  const dict = I18N[getLang()] || I18N['tr-TR'];
  return dict[key] || key;
}

function applyI18n() {
  const dict = I18N[getLang()] || I18N['tr-TR'];
  document.documentElement.lang = getLang().startsWith('en') ? 'en' : 'tr';

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key && dict[key]) el.textContent = dict[key];
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key && dict[key]) el.setAttribute('placeholder', dict[key]);
  });
}

async function apiJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'İşlem başarısız');
  return data;
}

function setMsg(el, type, text) {
  if (!el) return;
  el.textContent = text || '';
  el.className = 'msg ' + (type || '');
}

document.getElementById('register-btn')?.addEventListener('click', async () => {
  const username = (document.getElementById('reg-username')?.value || '').trim();
  const email = (document.getElementById('reg-email')?.value || '').trim();
  const password = document.getElementById('reg-password')?.value || '';
  const msgEl = document.getElementById('register-msg');

  setMsg(msgEl, '', '');
  if (!username || !email || !password) {
    setMsg(msgEl, 'error', t('error.required'));
    return;
  }
  if (password.length < 8) {
    setMsg(msgEl, 'error', t('error.passwordLen'));
    return;
  }

  try {
    const btn = document.getElementById('register-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = t('status.saving');
    }

    await apiJSON('/api/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });

    setMsg(msgEl, 'success', t('success.registered'));
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 800);
  } catch (e) {
    setMsg(msgEl, 'error', e.message);
  } finally {
    const btn = document.getElementById('register-btn');
    if (btn) {
      btn.disabled = false;
      btn.textContent = t('register.submit');
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  applyI18n();
});
