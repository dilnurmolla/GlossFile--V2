console.log('APP JS VERSION:', '2025-12-16 MFA FIX');

const step1       = document.getElementById('step-1');
const step2       = document.getElementById('step-2');
const toStep2Btn  = document.getElementById('to-step-2');
const backBtn     = document.getElementById('back-to-1');
const submitBtn   = document.getElementById('submit-login');

const step1Msg    = document.getElementById('step1-msg');
const step2Msg    = document.getElementById('step2-msg');

const email       = document.getElementById('email');
const password    = document.getElementById('password');
const totp        = document.getElementById('totp');

console.log('app.js YÜKLENDİ');

const loginError = document.getElementById('login-error');
const jsStatus   = document.getElementById('js-status');
if (jsStatus) jsStatus.textContent = 'READY';

let lastLoginEmail = null;
let currentUserId = null;

const show = (el) => el?.classList.remove('hidden');
const hide = (el) => el?.classList.add('hidden');

function showLoginError(text) {
  if (!loginError) return;
  loginError.textContent = text;
  loginError.classList.remove('hidden');
}

function clearLoginError() {
  if (!loginError) return;
  loginError.textContent = '';
  loginError.classList.add('hidden');
}

function setBtnLoading(btn, isLoading, loadingText = 'Lütfen bekleyin...') {
  if (!btn) return;
  if (!btn.dataset.text) btn.dataset.text = btn.textContent;
  btn.disabled = !!isLoading;
  btn.textContent = isLoading ? loadingText : btn.dataset.text;
}

function setMsg(el, type, text) {
  if (!el) return;
  el.className = '';
  el.textContent = '';
  if (text) el.textContent = text;
  if (type) el.classList.add(type);
}

// =============== STEP 1: LOGIN ===============
toStep2Btn?.addEventListener('click', async () => {
  clearLoginError();
  setMsg(step1Msg, '', '');

  const u = (email?.value || '').trim();
  const p = (password?.value || '');

  if (!u) {
    showLoginError('Kullanıcı adı / e-posta gerekli.');
    email?.focus();
    if (jsStatus) jsStatus.textContent = 'EMAIL_EMPTY';
    return;
  }

  if (p.length < 8) {
    showLoginError('Şifre en az 8 karakter olmalı.');
    password?.focus();
    if (jsStatus) jsStatus.textContent = 'PASS_SHORT';
    return;
  }

  try {
    setBtnLoading(toStep2Btn, true, 'Kontrol ediliyor...');
    if (jsStatus) jsStatus.textContent = 'LOADING';

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: u, password: p }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      const msg = (data && data.message) ? data.message : 'Kullanıcı adı veya şifre hatalı.';
      showLoginError(msg);
      if (jsStatus) jsStatus.textContent = 'LOGIN_FAILED';
      return;
    }

    const mfaRequired = data?.mfaRequired !== false;
    currentUserId = data.user?.id || null;

    if (!mfaRequired) {
      if (currentUserId && window.gfEnsureKeysAndUpload) {
        try {
          await window.gfEnsureKeysAndUpload(currentUserId);
        } catch (e) {
          console.warn('Public key kaydedilemedi:', e);
        }
      }
      window.location.href = data.redirect || '/dashboard.html';
      return;
    }

    // MFA için email’i sakla
    lastLoginEmail = data.user?.email || u;

    // cihaz keyleri
    if (currentUserId && window.gfEnsureKeys) {
      try {
        await window.gfEnsureKeys(currentUserId);
      } catch (e) {
        console.warn('Key init hatası:', e);
      }
    }

    // MFA ekranına geç
    hide(step1);
    show(step2);
    if (jsStatus) jsStatus.textContent = 'MFA';

    setMsg(step2Msg, '', 'Kod e-posta adresine gönderildi. 5 dakika içinde girmeniz gerekiyor.');
    if (totp) totp.value = '';
    totp?.focus();

  } catch (err) {
    console.error('Login hata:', err);
    showLoginError('Sunucuya bağlanırken hata oluştu.');
    if (jsStatus) jsStatus.textContent = 'SERVER_ERROR';
  } finally {
    setBtnLoading(toStep2Btn, false);
  }
});

// =============== STEP 2: BACK ===============
backBtn?.addEventListener('click', () => {
  hide(step2);
  show(step1);
  setMsg(step1Msg, '', '');
  setMsg(step2Msg, '', '');
  email?.focus();
  if (jsStatus) jsStatus.textContent = 'BACK_TO_STEP1';
});

// =============== STEP 2: VERIFY MFA ===============
submitBtn?.addEventListener('click', async () => {
  setMsg(step2Msg, '', '');

  const code = (totp?.value || '').trim();

  if (!code) {
    setMsg(step2Msg, 'error', 'Lütfen doğrulama kodunu girin.');
    return;
  }

  if (code.length !== 6) {
    setMsg(step2Msg, 'error', 'Kod 6 haneli olmalıdır.');
    return;
  }

  if (!lastLoginEmail) {
    setMsg(step2Msg, 'error', 'Oturum bilgisi bulunamadı. Lütfen yeniden giriş yapın.');
    return;
  }

  try {
    setBtnLoading(submitBtn, true, 'Kod doğrulanıyor...');
    if (jsStatus) jsStatus.textContent = 'MFA_CHECK';

    // MFA fetch burada:
    const res = await fetch('/api/verify-mfa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: lastLoginEmail, code }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      const msg = (data && data.message) ? data.message : 'Kod doğrulanamadı.';
      setMsg(step2Msg, 'error', msg);
      if (jsStatus) jsStatus.textContent = 'MFA_FAILED';
      return;
    }

    if (jsStatus) jsStatus.textContent = 'AUTH_OK';
    if (currentUserId && window.gfEnsureKeysAndUpload) {
      try {
        await window.gfEnsureKeysAndUpload(currentUserId);
      } catch (e) {
        console.warn('Public key kaydedilemedi:', e);
      }
    }
    window.location.href = data.redirect || '/dashboard.html';

  } catch (err) {
    console.error('MFA hata:', err);
    setMsg(step2Msg, 'error', 'Sunucuya bağlanırken hata oluştu.');
    if (jsStatus) jsStatus.textContent = 'MFA_SERVER_ERROR';
  } finally {
    setBtnLoading(submitBtn, false);
  }
});

// Enter ile gönderme
(email || password)?.form?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target !== totp) {
    e.preventDefault();
    toStep2Btn?.click();
  }
});

totp?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    submitBtn?.click();
  }
});
