// dashboard.js
console.log('DASHBOARD: JS YÜKLENDİ');
let gfIsAdmin = false;
let gfMeData = null;
// --- Browser notification helper ---
function gfBrowserNotify(title, body) {
  console.log(`[NOTIFY] ${title}: ${body}`);

  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    new Notification(title, { body });
  } catch (e) {
    console.warn("Notification gösterilemedi:", e);
  }
}

// ✅ GLOBAL ERROR LOGGER (en üste koy)
window.addEventListener("error", (e) => {
  console.group("🚨 JS ERROR");
  console.log("Message:", e.message);
  console.log("File:", e.filename);
  console.log("Line/Col:", e.lineno, e.colno);
  console.log("Error:", e.error);
  console.groupEnd();
});

window.addEventListener("unhandledrejection", (e) => {
  console.group("🚨 PROMISE REJECTION");
  console.log("Reason:", e.reason);
  console.groupEnd();
});

// ✅ FETCH LOGGER (isteğe bağlı, tüm API çağrılarını loglar)
(function patchFetch() {
  const _fetch = window.fetch;
  window.fetch = async (...args) => {
    const url = args?.[0];
    const opt = args?.[1] || {};
    console.log("➡️ FETCH:", opt.method || "GET", url);

    try {
      const res = await _fetch(...args);
      console.log("⬅️ FETCH RES:", res.status, url);

      // JSON değilse ilk kısmını yaz (500'de HTML dönerse görürsün)
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (!ct.includes("application/json") && res.status >= 400) {
        const txt = await res.clone().text().catch(() => "");
        console.warn("⚠️ Non-JSON error body (first 200):", txt.slice(0, 200));
      }
      return res;
    } catch (err) {
      console.error("❌ FETCH FAILED:", url, err);
      throw err;
    }
  };
})();


/* =========================
   i18n
========================= */

const I18N = {
  'tr-TR': {
    'nav.files': 'Dosyalarım',
    'nav.upload': 'Yeni Dosya Yükle',
    'nav.shared': 'Paylaşılanlar',
    'nav.security': 'Güvenlik',
    'nav.settings': 'Ayarlar',
    'nav.admin': 'Admin Paneli',

    'files.title': 'Dosyalarım',
    'files.subtitle': 'Bu cihazdaki şifreli dosyalarını buradan görüntüleyebilir, paylaşabilir ve yönetebilirsin',
    'files.empty': 'Henüz dosya yok.',
    'files.uploadCta': '+ Yeni Dosya Yükle',

    'storage.label': 'Depolama Kullanımı',
    'storage.subtext': 'Yer açmak için gereksiz dosyaları silebilirsin.',

    'upload.title': 'Dosya seç veya sürükleyip bırak',
    'upload.subtitle': 'maksimum boyut: 100MB | İzin verilen türler: PDF, DOCX, PNG',
    'upload.selectFile': 'Dosya Seç',
    'upload.start': 'Yüklemeyi Başlat',
    'upload.loading': 'Yükleniyor...',
    'upload.success': 'Dosya yüklendi ✔',
    'upload.pickFirst': 'Lütfen önce bir dosya seçin.',
    'upload.failed': 'Yükleme başarısız.',
    'upload.serverError': 'Sunucuya bağlanırken hata oluştu.',

    'shared.title': 'Paylaşılanlar',
    'shared.subtitle': 'Dosya gönder, gelen paylaşımları indir.',
    'shared.send.title': 'Dosya Gönder',
    'shared.send.desc': '3 adım: alıcı → dosya → gönder',
    'shared.send.step1.title': 'Alıcı e-postası',
    'shared.send.step1.placeholder': 'ornek@mail.com',
    'shared.send.step1.help': 'E-posta sadece kullanıcıyı bulmak için kullanılır.',
    'shared.send.step2.title': 'Dosya seç',
    'shared.send.loadingFiles': 'Dosyaların yükleniyor…',
    'shared.send.refresh': 'Listeyi Yenile',
    'shared.send.step2.help': 'Not: Burada “Dosyalarım” içinden seçim yapıyoruz (yeni upload değil).',
    'shared.send.step3.title': 'Gönder',
    'shared.send.sendBtn': 'Dosyayı Gönder',

    'shared.inbox.title': 'Gelen Dosyalar',
    'shared.inbox.desc': 'Şifreli gelir → cihazında çözülür',
    'shared.inbox.downloadBtn': 'İndir ve Aç',
    'shared.inbox.loading': 'Inbox yükleniyor…',
    'shared.inbox.empty': 'Henüz sana paylaşılmış dosya yok.',
    'shared.inbox.failed': 'Inbox alınamadı.',

    'shared.files.failed': 'Dosyalar alınamadı.',
    'shared.files.empty': 'Henüz dosyan yok. Önce Upload yap.',

    'shared.status.sending': 'Gönderiliyor…',
    'shared.status.sent': 'Gönderildi.',
    'shared.status.refreshing': 'Gönderildi. Inbox yenileniyor…',
    'shared.status.invalidEmail': 'Geçerli bir e-posta gir.',
    'shared.status.pickFile': 'Önce bir dosya seç.',
    'shared.status.sendFailed': 'Paylaşım başarısız.',
    'shared.status.download': 'İndiriliyor ve çözülüyor…',
    'shared.status.decrypted': 'Dosya çözüldü ve kaydedildi.',
    'shared.status.downloadFailed': 'İndirme/çözme başarısız.',

    'security.placeholder': 'Burada MFA, IP kara liste/ izin listesi ve oturum günlüklerini göstereceğiz.',
    'security.mfa.title': 'MFA',
    'security.mfa.desc': 'MFA durumunu buradan aç/kapat.',
    'security.mfa.statusLabel': 'Durum:',
    'security.mfa.toggle': 'MFA Aç/Kapat',
    'security.mfa.enable': 'MFA Aç',
    'security.mfa.disable': 'MFA Kapat',
    'security.mfa.on': 'Aktif',
    'security.mfa.off': 'Kapalı',
    'security.mfa.unknown': 'Bilinmiyor',
    'security.mfa.help': 'MFA yönetimini istersen admin paneline taşıyabiliriz.',

    'common.welcomeName': 'Hoş geldin, {name}',
    'common.userFallback': 'Kullanıcı',
    'common.logout': 'Çıkış Yap',
    'confirm.logout': 'Çıkış yapmak istediğine emin misin?',
    'error.logout': 'Çıkış sırasında bir hata oluştu.',
    'error.logoutServer': 'Sunucuya ulaşılamadı, çıkış tamamlanamadı.',

    'share.promptEmail': 'Paylaşılacak kullanıcının e-postası?',
    'share.needEmail': 'E-posta girmeden paylaşım yapılamaz.',
    'share.failed': 'Paylaşım başarısız.',
    'share.success': 'Dosya paylaşımı başlatıldı.',

    'file.deleteConfirm': 'Bu dosyayı silmek istediğine emin misin?',
    'file.deleteFailed': 'Dosya silinemedi.',
    'file.deleteServer': 'Sunucuya ulaşılamadı, silme işlemi başarısız.',
    'file.download': 'İndir',
    'file.share': 'Paylaş',
    'file.delete': 'Sil'
  },

  'en-US': {
    'nav.files': 'My Files',
    'nav.upload': 'Upload New File',
    'nav.shared': 'Shared',
    'nav.security': 'Security',
    'nav.settings': 'Settings',
    'nav.admin': 'Admin Panel',

    'files.title': 'My Files',
    'files.subtitle': 'View, share, and manage your encrypted files on this device.',
    'files.empty': 'No files yet.',
    'files.uploadCta': '+ Upload New File',

    'storage.label': 'Storage Usage',
    'storage.subtext': 'Delete unnecessary files to free up space.',

    'upload.title': 'Choose a file or drag & drop',
    'upload.subtitle': 'max size: 100MB | allowed types: PDF, DOCX, PNG',
    'upload.selectFile': 'Choose File',
    'upload.start': 'Start Upload',
    'upload.loading': 'Uploading...',
    'upload.success': 'File uploaded ✔',
    'upload.pickFirst': 'Please select a file first.',
    'upload.failed': 'Upload failed.',
    'upload.serverError': 'Could not reach the server.',

    'shared.title': 'Shared',
    'shared.subtitle': 'Send files, download incoming shares.',
    'shared.send.title': 'Send a File',
    'shared.send.desc': '3 steps: recipient → file → send',
    'shared.send.step1.title': 'Recipient email',
    'shared.send.step1.placeholder': 'example@mail.com',
    'shared.send.step1.help': 'Email is used only to find the user.',
    'shared.send.step2.title': 'Choose a file',
    'shared.send.loadingFiles': 'Loading your files…',
    'shared.send.refresh': 'Refresh list',
    'shared.send.step2.help': 'Note: You are selecting from “My Files” (not uploading).',
    'shared.send.step3.title': 'Send',
    'shared.send.sendBtn': 'Send File',

    'shared.inbox.title': 'Incoming Files',
    'shared.inbox.desc': 'Arrives encrypted → decrypted on your device',
    'shared.inbox.downloadBtn': 'Download & Open',
    'shared.inbox.loading': 'Loading inbox…',
    'shared.inbox.empty': 'No files shared with you yet.',
    'shared.inbox.failed': 'Inbox could not be loaded.',

    'shared.files.failed': 'Files could not be loaded.',
    'shared.files.empty': 'You have no files yet. Upload first.',

    'shared.status.sending': 'Sending…',
    'shared.status.sent': 'Sent.',
    'shared.status.refreshing': 'Sent. Refreshing inbox…',
    'shared.status.invalidEmail': 'Enter a valid email.',
    'shared.status.pickFile': 'Select a file first.',
    'shared.status.sendFailed': 'Share failed.',
    'shared.status.download': 'Downloading and decrypting…',
    'shared.status.decrypted': 'File decrypted and saved.',
    'shared.status.downloadFailed': 'Download/decrypt failed.',

    'security.placeholder': 'We will show MFA, IP allow/deny lists, and session logs here.',
    'security.mfa.title': 'MFA',
    'security.mfa.desc': 'Toggle MFA on/off here.',
    'security.mfa.statusLabel': 'Status:',
    'security.mfa.toggle': 'Toggle MFA',
    'security.mfa.enable': 'Enable MFA',
    'security.mfa.disable': 'Disable MFA',
    'security.mfa.on': 'Enabled',
    'security.mfa.off': 'Disabled',
    'security.mfa.unknown': 'Unknown',
    'security.mfa.help': 'If you want, we can move MFA management to admin.',

    'common.welcomeName': 'Welcome, {name}',
    'common.userFallback': 'User',
    'common.logout': 'Log Out',
    'confirm.logout': 'Are you sure you want to log out?',
    'error.logout': 'An error occurred during logout.',
    'error.logoutServer': 'Server unreachable, logout failed.',

    'share.promptEmail': 'Recipient email address?',
    'share.needEmail': 'Cannot share without an email.',
    'share.failed': 'Share failed.',
    'share.success': 'File share started.',

    'file.deleteConfirm': 'Are you sure you want to delete this file?',
    'file.deleteFailed': 'File could not be deleted.',
    'file.deleteServer': 'Server unreachable, delete failed.',
    'file.download': 'Download',
    'file.share': 'Share',
    'file.delete': 'Delete'
  }

};

const PREFS_KEY = 'gf_prefs';
let currentLang = 'tr-TR';

function normalizePrefs(input = {}) {
  const lang = typeof input.language === 'string' ? input.language : 'tr-TR';
  const up = input.notify_upload;
  const sh = input.notify_share;
  const notify_upload = Number(up) === 1 || up === true || up === '1' || up === 'true' ? 1 : 0;
  const notify_share = Number(sh) === 1 || sh === true || sh === '1' || sh === 'true' ? 1 : 0;
  return { language: lang, notify_upload, notify_share };
}

function getPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return normalizePrefs(raw);
  } catch {
    return normalizePrefs({});
  }
}

function setPrefs(patch = {}) {
  const next = normalizePrefs({ ...getPrefs(), ...patch });
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  return next;
}

function t(key, vars = {}) {
  const dict = I18N[currentLang] || I18N['tr-TR'];
  const str = dict[key] || key;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
}

function gfRenderUserActions() {
  const welcomeEl = document.getElementById('welcome-user');
  const logoutBtn = document.getElementById('logout-btn');

  const user = gfMeData?.user || {};
  const fallbackName = t('common.userFallback');
  const name = user.username || user.name || user.email || fallbackName;

  if (welcomeEl) welcomeEl.textContent = t('common.welcomeName', { name });
  if (logoutBtn) logoutBtn.textContent = t('common.logout');
}

function applyI18n(lang) {
  currentLang = lang || 'tr-TR';
  const dict = I18N[currentLang] || I18N['tr-TR'];
  document.documentElement.lang = currentLang.startsWith('en') ? 'en' : 'tr';

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key && dict[key]) el.textContent = dict[key];
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key && dict[key]) el.setAttribute('placeholder', dict[key]);
  });
}

/* =========================
   Helpers + Notifications
========================= */

let gfUserId = null;

function bytesToGB(bytes) {
  if (!bytes) return 0;
  return bytes / (1024 ** 3);
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const kb = 1024;
  const mb = kb * 1024;
  const gb = mb * 1024;

  if (bytes >= gb) return (bytes / gb).toFixed(1) + ' GB';
  if (bytes >= mb) return (bytes / mb).toFixed(1) + ' MB';
  if (bytes >= kb) return (bytes / kb).toFixed(1) + ' KB';
  return bytes + ' B';
}

function updateStorageUI(data) {
  const DEFAULT_QUOTA_BYTES = 10 * 1024 * 1024 * 1024; // 10GB
  const filesArr = Array.isArray(data?.files) ? data.files : [];

  const usedFromFiles = filesArr.reduce((sum, f) => {
    const s = Number(f.size_bytes ?? f.sizeBytes ?? f.size ?? 0);
    return sum + (isNaN(s) ? 0 : s);
  }, 0);

  const usedFromApi = Number(data?.storage?.totalBytes ?? data?.storage?.usedBytes ?? 0) || 0;
  const usedBytes = usedFromApi > 0 ? usedFromApi : usedFromFiles;

  let quotaBytes = Number(data?.storage?.quotaBytes ?? data?.storage?.totalQuotaBytes ?? 0) || 0;
  if (quotaBytes <= 0) quotaBytes = DEFAULT_QUOTA_BYTES;

  const amountEl = document.getElementById('storage-amount');
  const percentEl = document.getElementById('storage-percent');
  const ringEl = document.querySelector('.storage-ring');

  const usedGB = usedBytes / (1024 ** 3);
  const quotaGB = quotaBytes / (1024 ** 3);

  if (amountEl) {
    if (usedBytes < (1024 ** 3)) {
      const usedMB = usedBytes / (1024 ** 2);
      amountEl.textContent = `${usedMB.toFixed(1)}MB / ${quotaGB.toFixed(1)}GB`;
    } else {
      amountEl.textContent = `${usedGB.toFixed(1)}GB / ${quotaGB.toFixed(1)}GB`;
    }
  }

  const percent = quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0;
  const pctText = usedBytes > 0 && percent < 0.1 ? '0.1' : (percent < 1 ? percent.toFixed(1) : percent.toFixed(0));
  let ringPct = Math.round(percent);
  if (usedBytes > 0 && ringPct === 0) ringPct = 1;

  if (percentEl) percentEl.textContent = `${pctText}%`;
  if (ringEl) ringEl.style.setProperty('--p', ringPct);
}

// prefs: localStorage.gf_prefs = {"language":"en-US","notify_upload":1,"notify_share":1}
function gfGetNotifyPref(kind) {
  const prefs = getPrefs();
  if (kind === 'upload') return prefs.notify_upload === 1;
  if (kind === 'share') return prefs.notify_share === 1;
  return false;
}



/* =========================
   NAV
========================= */

function setupNav() {
  const navItems = document.querySelectorAll('.nav-item[data-section]');
  const pages = document.querySelectorAll('.gf-page');

  function showSection(sec) {
    const section = sec || 'files';

    pages.forEach((p) => {
      p.classList.toggle('hidden', p.dataset.section !== section);
    });

    navItems.forEach((item) => {
      item.classList.toggle('active', item.dataset.section === section);
    });

    // Header güncellemen varsa kalsın (yoksa bu blok sorun çıkarmaz)
    try {
      const titleEl = document.getElementById('page-title');
      const subEl = document.getElementById('page-subtitle');

      const map = {
        files: { title: t('files.title'), subtitle: t('files.subtitle') },
        upload: { title: t('nav.upload'), subtitle: t('upload.subtitle') },
        shared: { title: t('shared.title'), subtitle: t('shared.subtitle') },
        security: { title: t('nav.security'), subtitle: t('security.subtitle') || 'Güvenlik ayarları' },
      };

      const m = map[section] || map.files;
      if (titleEl) titleEl.textContent = m.title;
      if (subEl) subEl.textContent = m.subtitle;
    } catch (e) {
      console.warn('header update skipped:', e);
    }

    // ✅ Güvenlik yüklemesi dashboard’u ASLA kırmasın
    if (section === 'security') {
      try {
        if (typeof gfLoadSecurity === 'function') gfLoadSecurity();
      } catch (e) {
        console.warn('gfLoadSecurity failed:', e);
      }
    }
  }

  navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const sec = item.dataset.section;
      showSection(sec);
    });
  });

  showSection('files');
}


/* =========================
   Files rendering
========================= */

function renderFiles(files) {
  const listEl = document.getElementById('file-list');
  if (!listEl) return;

  if (!files || files.length === 0) {
    listEl.innerHTML = `<p class="placeholder-text">${t('files.empty')}</p>`;
    return;
  }

  const html = files.map((f) => {
    const displayName = gfDisplayName(f.original_name);
    const sizeText = (Number(f.size_bytes || 0) / (1024 * 1024)).toFixed(1) + ' MB';
    const dateText = new Date(f.created_at).toLocaleDateString('tr-TR');
    const ext = (displayName || '').split('.').pop().toUpperCase();

    return `
      <article class="file-card" data-file-id="${f.id}">
        <div class="file-main">
          <div class="file-icon">${ext || 'FILE'}</div>
          <div class="file-text">
            <div class="file-name">${displayName}</div>
            <div class="file-meta">${sizeText} • ${dateText}</div>
          </div>
        </div>

        <button class="file-menu" aria-label="Dosya menüsü">⋮</button>

        <div class="file-menu-panel hidden">
          <button class="file-menu-item" data-action="download" data-file-id="${f.id}">
            ${t('file.download')}
          </button>
          <button class="file-menu-item" data-action="share" data-file-id="${f.id}">
            ${t('file.share')}
          </button>
          <button class="file-menu-item file-menu-danger" data-action="delete" data-file-id="${f.id}">
            ${t('file.delete')}
          </button>
        </div>
      </article>
    `;
  }).join('');

  listEl.innerHTML = html;
}

/* =========================
   Upload
========================= */

function setupUploadUI() {
  const uploadMainBtn = document.getElementById('upload-main-btn');
  const uploadCard = document.getElementById('upload-card');
  const selectFileBtn = document.getElementById('select-file-btn');
  const fileInput = document.getElementById('file-input');
  const uploadStartBtn = document.getElementById('upload-start-btn');
  const fileNameEl = document.getElementById('upload-file-name');
  const hintEl = document.getElementById('upload-hint');

  if (uploadMainBtn) {
    uploadMainBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const uploadPage = document.querySelector('.gf-page[data-section="upload"]');
      const filesPage = document.querySelector('.gf-page[data-section="files"]');
      if (uploadPage && filesPage) {
        filesPage.classList.add('hidden');
        uploadPage.classList.remove('hidden');
      }
    });
  }

  if (!uploadCard || !fileInput || !uploadStartBtn) return;

  if (selectFileBtn) selectFileBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) {
      if (fileNameEl) fileNameEl.textContent = '';
      return;
    }
    if (fileNameEl) fileNameEl.textContent = `${file.name} (${formatSize(file.size)})`;
  });

  ['dragenter', 'dragover'].forEach((evt) => {
    uploadCard.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadCard.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach((evt) => {
    uploadCard.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadCard.classList.remove('drag-over');
    });
  });

  uploadCard.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file) {
      fileInput.files = e.dataTransfer.files;
      if (fileNameEl) fileNameEl.textContent = `${file.name} (${formatSize(file.size)})`;
    }
  });

  uploadStartBtn.addEventListener('click', async () => {
    if (hintEl) hintEl.textContent = '';

    const file = fileInput.files[0];
    if (!file) {
      if (hintEl) hintEl.textContent = t('upload.pickFirst');
      return;
    }

    const keyInfo = await gfEnsureKeysAndUploadIfNeeded(gfUserId);
    if (!keyInfo?.publicKeyPem) {
      if (hintEl) hintEl.textContent = 'Public key bulunamadı.';
      return;
    }

    try {
      uploadStartBtn.disabled = true;
      uploadStartBtn.textContent = t('upload.loading');

      // 1) AES key + iv üret
      const fileKey = crypto.getRandomValues(new Uint8Array(32));
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // 2) WebCrypto AES key import
      const aesKey = await crypto.subtle.importKey('raw', fileKey, 'AES-GCM', false, ['encrypt']);

      // 3) plaintext bytes
      const plainBuf = await file.arrayBuffer();

      // 4) encrypt -> WebCrypto ciphertext+tag birlikte döner (tag sonda)
      const encAll = new Uint8Array(await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, tagLength: 128 },
        aesKey,
        plainBuf
      ));

      // 5) tag ayır (son 16 byte)
      const tag = encAll.slice(encAll.length - 16);
      const ciphertext = encAll.slice(0, encAll.length - 16);

      // 6) cipher hash (ciphertext’i hashlemek yeterli)
      const cipher_hash_b64 = await sha256B64(ciphertext);

      if (!window.gfWrapKey) throw new Error('Web wrapKey desteklenmiyor.');
      const rawKey_b64 = u8ToB64(fileKey);
      const { wrapped_key_b64: wrapped_key_self_b64 } = await window.gfWrapKey(
        keyInfo.publicKeyPem,
        rawKey_b64
      );

      const fd = new FormData();
      fd.append('file', new Blob([ciphertext]), `${file.name}.enc`);
      fd.append('original_name', file.name);
      fd.append('iv_b64', u8ToB64(iv));
      fd.append('tag_b64', u8ToB64(tag));
      fd.append('cipher_hash_b64', cipher_hash_b64);
      fd.append('wrapped_key_self_b64', wrapped_key_self_b64);

      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        if (hintEl) hintEl.textContent = data.message || t('upload.failed');
        return;
      }

      if (data.fileId && rawKey_b64) {
        localStorage.setItem(`gf_filekey_${data.fileId}`, rawKey_b64);
      }

      const msg = t('upload.success');
      if (hintEl) hintEl.textContent = msg;

      // ✅ notification (upload)
      if (gfGetNotifyPref('upload')) {
        gfBrowserNotify('GlossFile', msg);
      }

      fileInput.value = '';
      if (fileNameEl) fileNameEl.textContent = '';

      const filesPage = document.querySelector('.gf-page[data-section="files"]');
      const uploadPage = document.querySelector('.gf-page[data-section="upload"]');
      if (filesPage && uploadPage) {
        uploadPage.classList.add('hidden');
        filesPage.classList.remove('hidden');
      }

      await loadDashboard();
    } catch (err) {
      console.error('Upload error:', err);
      if (hintEl) hintEl.textContent = t('upload.serverError');
    } finally {
      uploadStartBtn.disabled = false;
      uploadStartBtn.textContent = t('upload.start');
    }

  });
}

/* =========================
   Dashboard load
========================= */

async function loadDashboard() {
  console.log("DEBUG data scope ok");
  console.log('DASHBOARD: loadDashboard başladı');

  // ✅ data en üst scope: her yerde erişilebilir
  let data = {};

  try {
    const res = await fetch('/api/me', {
      credentials: 'include',
      cache: 'no-store',
    });

    console.log('DASHBOARD: /api/me status:', res.status);
    
    if (res.status === 401) {
      window.location.href = '/';
      return;
    }

    const ct = (res.headers.get('content-type') || '').toLowerCase();

    if (ct.includes('application/json')) {
      data = await res.json().catch(() => ({}));
    } else {
      const txt = await res.text().catch(() => '');
      console.error('DASHBOARD: /api/me JSON değil. İlk 120 karakter:', txt.slice(0, 120));
      throw new Error('API JSON dönmedi (server HTML dönüyor olabilir).');
    }

    console.log('DASHBOARD: /api/me data:', data);

    // ✅ Dil - data artık kesin tanımlı
    try {
      const langValue =
        typeof data?.user?.language === 'string'
          ? data.user.language
          : getPrefs().language || 'tr-TR';

      applyI18n(langValue);
      setPrefs({ language: langValue });
      const langSelect = document.getElementById('gf-lang-select');
      if (langSelect) langSelect.value = langValue;
    } catch (e) {
      console.warn("i18n apply skipped:", e);
    }

    // ✅ Devamı: user/admin
    gfUserId = data.user?.id || null;
    gfIsAdmin = Number(data.user?.is_admin) === 1;

    const welcomeEl = document.getElementById('welcome-user');
    if (welcomeEl) {
      const u = data.user || {};
      const fallbackName = t('common.userFallback');
      const name = u.username || u.name || u.email || fallbackName;
      welcomeEl.textContent = t('common.welcomeName', { name });
    }

    updateStorageUI(data);

    const adminLink = document.getElementById('admin-link');
    if (adminLink) adminLink.classList.toggle('hidden', !gfIsAdmin);

    if (typeof applySecurityAdminGate === "function") applySecurityAdminGate();

    // ✅ Dosyalar
    renderFiles(data.files || []);

    gfMeData = data;
    gfRenderUserActions();

  } catch (err) {
    console.error('DASHBOARD: loadDashboard hata:', err);
  }
}



function applySecurityAdminGate(){
  const ipPanel = document.getElementById("gf-ip-panel");
  const ipNote = document.getElementById("gf-ip-note");

  if(!ipPanel) return;

  if(gfIsAdmin){
    ipPanel.classList.remove("hidden");
    if(ipNote) ipNote.style.display = "none";  
  } else {
    ipPanel.classList.add("hidden");
    if (ipNote) ipNote.style.display = "block";  }
}

/* =========================
   Language picker (header)
========================= */

async function gfSavePrefs(patch) {
  try {
    await fetch('/api/users/me/prefs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch || {}),
    });
  } catch (e) {
    console.warn('prefs save failed:', e);
  }
}

function initLangPicker() {
  const sel = document.getElementById('gf-lang-select');
  if (!sel) return;

  const prefs = getPrefs();
  sel.value = prefs.language;

  sel.addEventListener('change', async () => {
    const lang = sel.value || 'tr-TR';
    const next = setPrefs({ language: lang });
    applyI18n(next.language);
    gfRenderUserActions();
    await gfSavePrefs({ language: lang });
  });
}

/* =========================
   Init
========================= */

function initDashboard() {
  console.log('DASHBOARD: initDashboard çağrıldı');
  applyI18n(getPrefs().language);
  setupNav();
  setupUploadUI();
  loadDashboard();
  setupFileMenuInteractions();
  setupLogout();
  gfBindSharedUI();
  gfRenderUserActions();
if (typeof gfBindIpAdminUI === 'function') gfBindIpAdminUI();
if (typeof gfBindSecurityUI === 'function') gfBindSecurityUI();
  initLangPicker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}

console.log('DASHBOARD: dashboard.js yüklendi');

/* =========================
   Small helper
========================= */

function closeAllFileMenus() {
  document.querySelectorAll('.file-menu-panel').forEach((panel) => panel.classList.add('hidden'));
  document.querySelectorAll('.file-card.selected').forEach((card) => card.classList.remove('selected'));
}

async function gfEnsureKeysAndUploadIfNeeded(meUserId) {
  if (!meUserId) return;

  if (window.gfEnsureKeysAndUpload) {
    return await window.gfEnsureKeysAndUpload(meUserId);
  }
  return null;
}

/* =========================
   Logout
========================= */

function setupLogout() {
  const btn = document.getElementById('logout-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (!confirm(t('confirm.logout'))) return;

    try {
      const res = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok && res.status !== 204) {
        alert(t('error.logout'));
        return;
      }

      window.location.href = '/';
    } catch (err) {
      console.error('DASHBOARD: logout hatası', err);
      alert(t('error.logoutServer'));
    }
  });
}

/* =========================
   File menu (⋮)
========================= */

function setupFileMenuInteractions() {
  document.addEventListener('click', async (event) => {
    const target = event.target;

    // open/close (⋮)
    const menuBtn = target.closest('.file-menu');
    if (menuBtn) {
      const card = menuBtn.closest('.file-card');
      if (!card) return;

      const panel = card.querySelector('.file-menu-panel');
      if (!panel) return;

      const alreadyOpen = !panel.classList.contains('hidden');
      closeAllFileMenus();

      if (!alreadyOpen) {
        panel.classList.remove('hidden');
        card.classList.add('selected');
      }
      return;
    }

    // menu item click
    const item = target.closest('.file-menu-item');
    if (item) {
      const action = item.dataset.action;
      const fileId = item.dataset.fileId;
      if (!fileId) return;

     if (action === 'download') {
  const url = `/api/files/${fileId}/download`;

  const msg = currentLang?.startsWith('en')
    ? 'Download started.'
    : 'İndirme başlatıldı.';

  // (İstersen preference’a bağla)
  // if (gfGetNotifyPref('share', true)) gfBrowserNotify('GlossFile', msg);

  if (gfGetNotifyPref('upload')) {
    gfBrowserNotify('GlossFile', msg);
  }

  // Aynı sekmede gezinme -> sayfa unload olunca bildirim bazen düşmüyor.
  // Yeni sekmede aç: hem bildirim görünür, hem indirme başlar.
  setTimeout(() => {
    window.open(url, '_blank', 'noopener');
  }, 50);

  closeAllFileMenus?.(); // varsa kapat
  return;
}


      if (action === 'share') {
        try {
          const receiverEmail = (prompt(t('share.promptEmail')) || '').trim();
          if (!receiverEmail) {
            alert(t('share.needEmail'));
            closeAllFileMenus();
            return;
          }

          await gfEnsureKeysAndUploadIfNeeded(gfUserId);
          const senderUserId = await gfFetchSenderUserId();
          const sharePayload = await gfBuildSharePayload(fileId, receiverEmail, senderUserId);

          const res = await fetch('/api/files/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ fileId, ...sharePayload }),
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) {
            alert(data.detail || data.sqlMessage || data.error || t('share.failed'));
            return;
          }

          const msg = t('share.success');
          alert(msg);

          // ✅ notification (share)
          if (gfGetNotifyPref('share')) {
            gfBrowserNotify('GlossFile', msg);
          }
        } catch (err) {
          console.error('DASHBOARD: share hatası', err);
          alert(err?.message || t('share.failed'));
        }
      }

      if (action === 'delete') {
        const ok = confirm(t('file.deleteConfirm'));
        if (!ok) return;

        try {
          const res = await fetch(`/api/files/${fileId}`, {
            method: 'DELETE',
            credentials: 'include',
          });

          if (!res.ok) {
            alert(t('file.deleteFailed'));
            return;
          }

          const card = item.closest('.file-card');
          if (card) card.remove();
        } catch (err) {
          console.error('DASHBOARD: dosya silme hatası', err);
          alert(t('file.deleteServer'));
        }
      }

      closeAllFileMenus();
      return;
    }

    // click outside cards
    if (!target.closest('.file-card')) {
      closeAllFileMenus();
    }
  });
}

/* =========================
   Shared (decrypt flow)
========================= */

function base64ToArrayBuffer(b64) {
  const binary = atob(String(b64 || ''));
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
function u8ToB64(u8){
  let bin = '';
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin);
}
async function sha256B64(u8){
  const hash = await crypto.subtle.digest('SHA-256', u8);
  return u8ToB64(new Uint8Array(hash));
}



async function downloadSharedAndDecrypt(shareId, userId) {
  if (!userId) throw new Error('userId gerekli');

  const payloadRes = await fetch(`/api/shared/${shareId}/payload`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!payloadRes.ok) throw new Error('Payload alınamadı');

  const payload = await payloadRes.json().catch(() => ({}));
  if (!payload.ok) throw new Error(payload.error || 'Payload alınamadı');

  if (!payload.signed_payload_b64 || !payload.sender_signature_b64 || !payload.sender_public_key_pem) {
    throw new Error('İmza doğrulanamadı. Dosya güvenli değil.');
  }
  if (!window.gfVerifyPss) {
    throw new Error('İmza doğrulanamadı. Dosya güvenli değil.');
  }
  const canonical = atob(payload.signed_payload_b64);
  const verifyRes = await window.gfVerifyPss(
    payload.sender_public_key_pem,
    canonical,
    payload.sender_signature_b64
  );
  if (!verifyRes?.ok) {
    throw new Error('İmza doğrulanamadı. Dosya güvenli değil.');
  }

  if (window.gfDecryptSharedAndSave) {
    return await window.gfDecryptSharedAndSave({
      userId,
      filename: gfDisplayName(payload.filename),
      encBuf: base64ToArrayBuffer(payload.encB64),
      wrapped_key_b64: payload.wrapped_key_b64,
      iv_b64: payload.iv_b64,
      tag_b64: payload.tag_b64,
    });
  }

  throw new Error('Decrypt desteklenmiyor');
}

/* =========================
   Shared UI
========================= */

function gfSetStatus(type, text) {
  const el = document.getElementById('gf-share-status');
  if (!el) return;
  el.className = 'gf-status' + (type ? ` ${type}` : '');
  el.textContent = text || '';
}

function gfDisplayName(name) {
  const raw = String(name || '');
  return raw.replace(/\.encblob$/i, '').replace(/\.enc$/i, '');
}

async function gfFetchSenderUserId() {
  const res = await fetch('/api/me', { credentials: 'include', cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  const senderUserId = data?.user?.id;
  if (!res.ok || !senderUserId) {
    throw new Error(data.error || 'Kullanıcı bilgisi alınamadı.');
  }
  return senderUserId;
}

async function gfFetchReceiverByEmail(receiverEmail) {
  const res = await fetch(
    '/api/users/public-key-by-email?email=' + encodeURIComponent(receiverEmail),
    { credentials: 'include' }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok || !data?.publicKeyPem || !data?.id) {
    throw new Error(data.error || data.message || 'Alıcının public key bulunamadı.');
  }
  return { receiverUserId: Number(data.id), receiverPublicKeyPem: data.publicKeyPem };
}

async function gfFetchFileCryptoMeta(fileId) {
  const res = await fetch(`/api/files/${fileId}/crypto`, {
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data.error || 'Dosya meta alınamadı.');
  }
  return data;
}

async function gfGetRawKeyForFile(fileId, userId, wrapped_key_self_b64) {
  let rawKey_b64 = localStorage.getItem(`gf_filekey_${fileId}`);
  if (rawKey_b64) return rawKey_b64;

  if (!window.gfUnwrapKeyForUser) {
    throw new Error('Dosya anahtarı bulunamadı. Önce dosyayı bu cihazdan yükleyin.');
  }

  rawKey_b64 = await window.gfUnwrapKeyForUser(userId, wrapped_key_self_b64);
  localStorage.setItem(`gf_filekey_${fileId}`, rawKey_b64);
  return rawKey_b64;
}

async function gfBuildSharePayload(fileId, receiverEmail, senderUserIdOverride) {
  if (!window.gfWrapKey) throw new Error('Web wrapKey desteklenmiyor.');
  if (!window.gfSignPss) throw new Error('İmza üretilemedi, paylaşım yapılamadı.');

  const senderUserId = senderUserIdOverride || (await gfFetchSenderUserId());
  const { receiverUserId, receiverPublicKeyPem } = await gfFetchReceiverByEmail(receiverEmail);
  const meta = await gfFetchFileCryptoMeta(fileId);

  const rawKey_b64 = await gfGetRawKeyForFile(fileId, senderUserId, meta.wrapped_key_self_b64);
  const { wrapped_key_b64 } = await window.gfWrapKey(receiverPublicKeyPem, rawKey_b64);

  const canonicalObj = {
    v: 1,
    algo: 'AES-256-GCM + RSA-OAEP + RSA-PSS',
    fileId: Number(fileId),
    senderUserId: Number(senderUserId),
    receiverUserId: Number(receiverUserId),
    iv_b64: meta.iv_b64,
    tag_b64: meta.tag_b64,
    cipher_hash_b64: meta.cipher_hash_b64,
    wrapped_key_b64,
  };
  const canonical = JSON.stringify(canonicalObj, Object.keys(canonicalObj).sort());
  let signature_b64 = null;
  try {
    const sigRes = await window.gfSignPss(senderUserId, canonical);
    signature_b64 = sigRes.signature_b64;
  } catch {
    throw new Error('İmza üretilemedi, paylaşım yapılamadı.');
  }
  const signed_payload_b64 = btoa(canonical);

  return {
    receiverUserId,
    wrapped_key_b64,
    sender_signature_b64: signature_b64,
    signed_payload_b64,
  };
}

function gfValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

function gfInitial(s) {
  const tt = String(s || '').trim();
  if (!tt) return '?';
  return tt[0].toUpperCase();
}

function gfFormatDateTime(ts) {
  try {
    return new Date(ts).toLocaleString('tr-TR');
  } catch {
    return String(ts || '');
  }
}

async function gfLoadMyFilesForShare() {
  const box = document.getElementById('gf-share-files');
  if (!box) return;

  box.innerHTML = `<div class="gf-muted">${t('shared.send.loadingFiles')}</div>`;

  const res = await fetch('/api/me', { credentials: 'include' });
  const data = await res.json().catch(() => ({}));

if(data?.user?.id){
  await gfEnsureKeysAndUploadIfNeeded(data.user.id);
}

  if (!res.ok || !data.files) {
    box.innerHTML = `<div class="gf-muted">${t('shared.files.failed')}</div>`;
    return;
  }

  const files = data.files || [];
  if (!files.length) {
    box.innerHTML = `<div class="gf-muted">${t('shared.files.empty')}</div>`;
    return;
  }

  box.innerHTML = files.map(f => `
    <label class="gf-pick">
      <input type="checkbox" name="gfSharePick" value="${f.id}" />
      <div class="gf-pick-main">
        <div class="gf-pick-name">${gfDisplayName(f.original_name)}</div>
        <div class="gf-pick-meta">${formatSize(f.size_bytes)} • ${gfFormatDateTime(f.created_at)}</div>
      </div>
    </label>
  `).join('');

  box.querySelectorAll('input[name="gfSharePick"]').forEach((r) => {
    r.addEventListener('change', gfUpdateShareSendEnabled);
  });

  gfUpdateShareSendEnabled();
}

function gfSelectedFileIds() {
  const list = Array.from(document.querySelectorAll('input[name="gfSharePick"]:checked'));
  return list.map((r) => Number(r.value)).filter(Boolean);
}

function gfUpdateShareSendEnabled() {
  const btn = document.getElementById('gf-share-send');
  const emailEl = document.getElementById('gf-share-email');
  if (!btn || !emailEl) return;

  const ok = gfValidEmail(emailEl.value) && gfSelectedFileIds().length > 0;
  btn.disabled = !ok;
}

async function gfLoadInbox() {
  const box = document.getElementById('gf-inbox');
  if (!box) return;

  box.innerHTML = `<div class="gf-muted">${t('shared.inbox.loading')}</div>`;

  const res = await fetch('/api/shared/inbox', { credentials: 'include' });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.ok) {
    box.innerHTML = `<div class="gf-muted">${t('shared.inbox.failed')}</div>`;
    return;
  }

  const items = data.items || [];
  if (!items.length) {
    box.innerHTML = `<div class="gf-muted">${t('shared.inbox.empty')}</div>`;
    return;
  }

  box.innerHTML = items.map(it => {
    const who = it.sender_email || it.sender_username || 'Sender';
    const avatar = gfInitial(who);
    const displayName = gfDisplayName(it.filename);
    return `
      <article class="gf-card">
        <div class="gf-avatar">${avatar}</div>
        <div class="gf-card-main">
          <div class="gf-card-title">${displayName}</div>
          <div class="gf-card-meta">${who} • ${gfFormatDateTime(it.uploaded_at)}</div>
          <div class="gf-card-actions">
            <button class="gf-btn gf-btn-primary" data-action="gf-inbox-download" data-share-id="${it.id}">
              ${t('shared.inbox.downloadBtn')}
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

async function gfSendShare() {
  gfSetStatus('', '');
  const emailEl = document.getElementById('gf-share-email');
  const receiverEmail = (emailEl?.value || '').trim();
  const fileIds = gfSelectedFileIds();

  if (!gfValidEmail(receiverEmail)) {
    gfSetStatus('err', t('shared.status.invalidEmail'));
    return;
  }
  if (!fileIds.length) {
    gfSetStatus('err', t('shared.status.pickFile'));
    return;
  }

  const btn = document.getElementById('gf-share-send');
  if (btn) btn.disabled = true;

  try {
    gfSetStatus('', t('shared.status.sending'));

    const senderUserId = await gfFetchSenderUserId();
    for (const fileId of fileIds) {
      const sharePayload = await gfBuildSharePayload(fileId, receiverEmail, senderUserId);
      const res = await fetch('/api/files/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileId, ...sharePayload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.detail || data.sqlMessage || data.error || t('shared.status.sendFailed'));
      }
    }

    gfSetStatus('ok', t('shared.status.refreshing'));
    await gfLoadInbox();
    gfSetStatus('ok', t('shared.status.sent'));

    // ✅ notification (share) for shared page too
    if (gfGetNotifyPref('share')) {
      gfBrowserNotify('GlossFile', t('shared.status.sent'));
    }
  } catch (e) {
    console.error(e);
    gfSetStatus('err', e.message || t('shared.status.sendFailed'));
  } finally {
    gfUpdateShareSendEnabled();
  }
}

function gfBindSharedUI() {
  const emailEl = document.getElementById('gf-share-email');
  const refreshBtn = document.getElementById('gf-share-refresh');
  const sendBtn = document.getElementById('gf-share-send');

  emailEl?.addEventListener('input', gfUpdateShareSendEnabled);
  refreshBtn?.addEventListener('click', gfLoadMyFilesForShare);
  sendBtn?.addEventListener('click', gfSendShare);

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="gf-inbox-download"]');
    if (!btn) return;

    const shareId = Number(btn.dataset.shareId);
    if (!shareId) return;

    try {
      btn.disabled = true;
      gfSetStatus('', t('shared.status.download'));

      await downloadSharedAndDecrypt(shareId, gfUserId);

      gfSetStatus('ok', t('shared.status.decrypted'));
    } catch (err) {
      console.error(err);
      gfSetStatus('err', err.message || err.name || t('shared.status.downloadFailed'));
    } finally {
      btn.disabled = false;
    }
  });

  gfLoadMyFilesForShare();
  gfLoadInbox();
}

// =====================
// SECURITY TAB (IP rules + session logs)
// =====================

const GF_SEC_IP_LS_KEY = "gf_sec_ip_rules"; // fallback storage
let gfSecLoadedOnce = false;

function gfSecSetStatus(type, text) {
  const el = document.getElementById("gf-sec-status");
  if (!el) return;
  el.className = "gf-status" + (type ? ` ${type}` : "");
  el.textContent = text || "";
}

function gfSecSafeJson(s, def) {
  try { return JSON.parse(s); } catch { return def; }
}

function gfSecGetIpRulesFromLS() {
  const arr = gfSecSafeJson(localStorage.getItem(GF_SEC_IP_LS_KEY) || "[]", []);
  return Array.isArray(arr) ? arr : [];
}

function gfSecSaveIpRulesToLS(rules) {
  localStorage.setItem(GF_SEC_IP_LS_KEY, JSON.stringify(rules || []));
}

function gfSecIsValidIpOrCidr(input) {
  const s = String(input || "").trim();
  if (!s) return false;

  // IP v4
  const ip = /^(\d{1,3}\.){3}\d{1,3}$/;
  // CIDR v4
  const cidr = /^(\d{1,3}\.){3}\d{1,3}\/([0-9]|[1-2][0-9]|3[0-2])$/;

  const ok = ip.test(s) || cidr.test(s);
  if (!ok) return false;

  const base = s.split("/")[0];
  const parts = base.split(".").map(Number);
  return parts.length === 4 && parts.every(n => n >= 0 && n <= 255);
}

function gfSecRenderIpRules(rules) {
  const box = document.getElementById("gf-ip-list");
  if (!box) return;

  if (!rules || !rules.length) {
    box.innerHTML = `<div class="gf-muted">${t?.("security.ip.empty") || "Henüz kural yok."}</div>`;
    return;
  }

  box.innerHTML = rules.map(r => `
    <div class="gf-card" style="align-items:center">
      <div class="gf-avatar">${String(r.mode || "A")[0].toUpperCase()}</div>
      <div class="gf-card-main">
        <div class="gf-card-title">${(r.mode || "").toUpperCase()} • ${r.value}</div>
        <div class="gf-card-meta">${r.created_at ? new Date(r.created_at).toLocaleString("tr-TR") : ""}</div>
        <div class="gf-card-actions">
          <button class="gf-btn gf-btn-secondary" data-action="gf-ip-remove" data-rule-id="${r.id}">
            Kaldır
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

function gfSecRenderSessions(items) {
  const box = document.getElementById("gf-sessions");
  if (!box) return;

  if (!items || !items.length) {
    box.innerHTML = `<div class="gf-muted">${t?.("security.sessions.empty") || "Henüz oturum kaydı yok."}</div>`;
    return;
  }

  box.innerHTML = items.map(it => {
    const who = it.device || it.user_agent || "Session";
    const avatar = (who.trim()[0] || "S").toUpperCase();
    const when = it.created_at ? new Date(it.created_at).toLocaleString("tr-TR") : "";
    const meta = `${it.ip || "?"} • ${when}`;
    return `
      <article class="gf-card">
        <div class="gf-avatar">${avatar}</div>
        <div class="gf-card-main">
          <div class="gf-card-title">${it.event || "LOGIN"}</div>
          <div class="gf-card-meta">${meta}</div>
        </div>
      </article>
    `;
  }).join("");
}

async function gfSecFetchStatus() {
  // Backend varsa buradan çekeriz:
  // GET /api/security/status  -> { ok:true, mfa_enabled:0/1, ip_rules:[], sessions:[] }
  try {
    const res = await fetch("/api/security/status", { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error("status " + res.status);
    const data = await res.json().catch(() => ({}));
    if (!data || data.ok !== true) throw new Error(data.error || "bad response");
    return data;
  } catch (e) {
    // Backend yoksa boş dön
    return {
      ok: true,
      fallback: true,
      mfa_enabled: null,
      ip_rules: [],
      sessions: []
    };
  }
}

function gfSecApplyMfaBadge(mfaEnabled) {
  const badge = document.getElementById("gf-mfa-badge");
  const btn = document.getElementById("gf-mfa-toggle");
  if (!badge) return;

  if (mfaEnabled === 1 || mfaEnabled === true) {
    badge.className = "gf-status ok";
    badge.textContent = t?.("security.mfa.on") || "Aktif";
    if (btn) btn.textContent = t?.("security.mfa.disable") || "MFA Kapat";
  } else if (mfaEnabled === 0 || mfaEnabled === false) {
    badge.className = "gf-status err";
    badge.textContent = t?.("security.mfa.off") || "Kapalı";
    if (btn) btn.textContent = t?.("security.mfa.enable") || "MFA Aç";
  } else {
    badge.className = "gf-status";
    badge.textContent = t?.("security.mfa.unknown") || "Bilinmiyor";
    if (btn) btn.textContent = t?.("security.mfa.toggle") || "MFA Aç/Kapat";
  }
}

async function gfLoadSecurity() {
  gfSecSetStatus("", "");
  const hint = document.getElementById("gf-ip-hint");
  if (hint) hint.textContent = "";

  // İlk render: loading
  const ipBox = document.getElementById("gf-ip-list");
  if (ipBox) ipBox.innerHTML = `<div class="gf-muted">Kurallar yükleniyor…</div>`;
  const sesBox = document.getElementById("gf-sessions");
  if (sesBox) sesBox.innerHTML = `<div class="gf-muted">Yükleniyor…</div>`;

  const data = await gfSecFetchStatus();

  gfSecApplyMfaBadge(data.mfa_enabled);
  gfSecRenderIpRules(data.ip_rules || []);
  const sesPanel = document.getElementById("gf-sessions-panel");
  if (data.is_admin) {
    if (sesPanel) sesPanel.classList.remove("hidden");
    gfSecRenderSessions(data.sessions || []);
  } else {
    if (sesPanel) sesPanel.classList.add("hidden");
  }

  if (data.fallback) {
    gfSecSetStatus("", "Not: Backend endpoint yok, bu sayfa sadece görüntüleniyor.");
  }
}

function gfBindSecurityUI() {
  const btnRefresh = document.getElementById("gf-sec-refresh");
  btnRefresh?.addEventListener("click", gfLoadSecurity);

  const btnMfa = document.getElementById("gf-mfa-toggle");
  btnMfa?.addEventListener("click", async () => {
    gfSecSetStatus("", "");
    try {
      if (btnMfa) btnMfa.disabled = true;
      const res = await fetch("/api/users/me/mfa", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "MFA güncellenemedi.");
      }
      gfSecApplyMfaBadge(Number(data.mfa_enabled) === 1 ? 1 : 0);
    } catch (e) {
      gfSecSetStatus("err", e.message || "MFA güncellenemedi.");
    } finally {
      if (btnMfa) btnMfa.disabled = false;
    }
  });

  const btnAdd = document.getElementById("gf-ip-add");
  btnAdd?.addEventListener("click", async () => {
    const modeEl = document.getElementById("gf-ip-mode");
    const ipEl = document.getElementById("gf-ip-input");
    const hint = document.getElementById("gf-ip-hint");
    if (!modeEl || !ipEl) return;

    const mode = modeEl.value === "deny" ? "deny" : "allow";
    const value = String(ipEl.value || "").trim();

    if (!gfSecIsValidIpOrCidr(value)) {
      if (hint) hint.textContent = "Geçerli bir IP veya CIDR gir (örn 192.168.1.10 ya da 10.0.0.0/24).";
      return;
    }

    try {
      const res = await fetch("/api/security/ip-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode, value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Kural eklenemedi");
      }
      ipEl.value = "";
      await gfLoadSecurity();
    } catch (e) {
      if (hint) hint.textContent = e.message || "Kural eklenemedi.";
    }
  });

  // remove rule (delegation)
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest('[data-action="gf-ip-remove"]');
    if (!btn) return;
    const id = Number(btn.dataset.ruleId);
    if (!id) return;

    try {
      const res = await fetch(`/api/security/ip-rules/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Silinemedi");
      }
      await gfLoadSecurity();
    } catch (e) {
      gfSecSetStatus("err", e.message || "Silinemedi");
    }
  });
}
