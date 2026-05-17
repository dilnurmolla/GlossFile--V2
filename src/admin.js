// admin.js
console.log('ADMIN: admin.js yüklendi');

/* ---------------------------------------------------
 * 1. Küçük yardımcı fonksiyonlar
 * --------------------------------------------------*/

// Byte → okunabilir metin (1.2 MB gibi)
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return value.toFixed(1) + ' ' + units[i];
}

// ISO tarih → TR formatı
function formatDate(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('tr-TR');
}

/* ---------------------------------------------------
 * 2. Ekranı dolduran render fonksiyonları
 * --------------------------------------------------*/

// Üst istatistikler (toplam kullanıcı, engelli IP)
function renderStats(stats) {
  const totalUsersEl = document.getElementById('stat-total-users');
  const blockedIpsEl = document.getElementById('stat-blocked-ips');

  if (totalUsersEl) totalUsersEl.textContent = stats.totalUsers ?? 0;
  if (blockedIpsEl) blockedIpsEl.textContent = stats.blockedIps ?? 0;
}

// Kullanıcı tablosu
// Kullanıcı tablosu
function renderUsers(users) {
  const tbody = document.getElementById('admin-user-rows');
  const label = document.getElementById('user-count-label');

  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="empty-row">Kayıtlı kullanıcı bulunamadı.</td></tr>';
    if (label) label.textContent = '0 kullanıcı listelendi';
    return;
  }

  const rowsHtml = users
    .map((u) => {
      const statusTag =
        '<span class="tag-status tag-encrypted">Aktif</span>';

      return `
        <tr>
          <td>${u.username || '-'}</td>
          <td>${u.email || '-'}</td>
          <td><span class="ip-muted">${u.last_ip || '-'}</span></td>
          <td>${statusTag}</td>
          <td>
            <button
              class="btn-pill btn-user-open"
              data-user-id="${u.id}"
            >
              Kullanıcıyı Aç
            </button>
          </td>
        </tr>
      `;
    })
    .join('');

  tbody.innerHTML = rowsHtml;
  if (label) label.textContent = `${users.length} kullanıcı listelendi`;
}


// Dosya tablosu
function renderFiles(files) {
  const tbody = document.getElementById('admin-file-rows');
  const label = document.getElementById('file-count-label');

  if (!tbody) return;

  if (!files || files.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="empty-row">Henüz yüklenmiş dosya yok.</td></tr>';
    if (label) label.textContent = '0 dosya listelendi';
    return;
  }

  const rowsHtml = files
    .map((f) => {
      const statusTag =
        f.is_encrypted === 0 || f.is_encrypted === false
          ? '<span class="tag-status tag-plain">Şifresiz</span>'
          : '<span class="tag-status tag-encrypted">Şifrelendi</span>';

      return `
        <tr>
          <td>${f.original_name || '-'}</td>
          <td>${formatBytes(f.size_bytes)}</td>
          <td>${f.uploader_username || f.uploader_email || '-'}</td>
          <td>${formatDate(f.created_at)}</td>
          <td>${statusTag}</td>
          <td>
            <button class="btn-pill" data-action="download" data-file-id="${f.id}">
              İndir
            </button>
            <button class="btn-pill btn-pill-danger" data-action="delete-file" data-file-id="${f.id}">
              Sil
            </button>
          </td>
        </tr>
      `;
    })
    .join('');

  tbody.innerHTML = rowsHtml;
  if (label) label.textContent = `${files.length} dosya listelendi`;
}

/* ---------------------------------------------------
 * 3. Sunucudan admin özeti çekme (/api/admin/overview)
 * --------------------------------------------------*/

async function loadAdminOverview() {
  try {
    const res = await fetch('/api/admin/overview');
    console.log('ADMIN: /api/admin/overview status:', res.status);

    // Admin değilse / giriş ekranına at
    if (res.status === 401 || res.status === 403) {
      alert('Bu sayfayı görmek için admin olarak giriş yapmalısın.');
      window.location.href = '/';
      return;
    }

    if (!res.ok) {
      console.error('ADMIN: overview isteği başarısız');
      return;
    }

    const data = await res.json();
    console.log('ADMIN: overview data:', data);

    renderStats(data.stats || {});
    renderUsers(data.users || []);
    renderFiles(data.files || []);
  } catch (err) {
    console.error('ADMIN: overview yüklenirken hata:', err);
  }
}

/* ---------------------------------------------------
 * 4. Yeni kullanıcı oluşturma formu
 * --------------------------------------------------*/

function setupCreateUserForm() {
  const usernameEl = document.getElementById('new-username');
  const emailEl = document.getElementById('new-email');
  const passwordEl = document.getElementById('new-password');
  const isAdminEl = document.getElementById('new-is-admin');
  const btn = document.getElementById('create-user-btn');
  const msgEl = document.getElementById('create-user-msg');

  if (!btn || !usernameEl || !emailEl || !passwordEl || !msgEl) {
    console.warn('ADMIN: Yeni kullanıcı formu elemanları bulunamadı.');
    return;
  }

  btn.addEventListener('click', async () => {
    // Mesajı sıfırla
    msgEl.textContent = '';
    msgEl.className = 'create-user-msg';

    const username = usernameEl.value.trim();
    const email = emailEl.value.trim();
    const password = passwordEl.value;
    const isAdmin = !!isAdminEl.checked;

    // Basit validasyon
    if (!username || !email || !password) {
      msgEl.textContent = 'Kullanıcı adı, e-posta ve şifre zorunludur.';
      msgEl.classList.add('error');
      return;
    }

    if (password.length < 8) {
      msgEl.textContent = 'Şifre en az 8 karakter olmalıdır.';
      msgEl.classList.add('error');
      return;
    }

    try {
      btn.disabled = true;
      btn.textContent = 'Kaydediliyor...';

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          email,
          password,
          is_admin: isAdmin,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        msgEl.textContent = data.message || 'Kullanıcı oluşturulamadı.';
        msgEl.classList.add('error');
        return;
      }

      msgEl.textContent = 'Kullanıcı oluşturuldu.';
      msgEl.classList.add('success');

      // Formu temizle
      usernameEl.value = '';
      emailEl.value = '';
      passwordEl.value = '';
      isAdminEl.checked = false;

      // Listeleri güncelle
      await loadAdminOverview();
    } catch (err) {
      console.error('ADMIN: kullanıcı oluşturma hatası', err);
      msgEl.textContent = 'Sunucu hatası. Lütfen tekrar deneyin.';
      msgEl.classList.add('error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Kullanıcıyı Oluştur';
    }
  });
}

/* ---------------------------------------------------
 * 5. Sayfa yüklendiğinde çalışacak ana blok
 * --------------------------------------------------*/

document.addEventListener('DOMContentLoaded', () => {
  console.log('ADMIN: DOMContentLoaded');
  loadAdminOverview();   // Sayfa açılır açılmaz verileri çek
  setupCreateUserForm(); // Yeni kullanıcı formu events
});

// Kullanıcıyı Aç / Dosya indir / sil tıklamalarını yakala
document.addEventListener('click', async (event) => {
  const target = event.target;

  /* -------------------------
   * 1) Kullanıcıyı Aç
   * ------------------------*/
  const userBtn = target.closest('.btn-user-open');
  if (userBtn) {
    const userId = userBtn.dataset.userId;

    try {
    const res = await fetch(`/api/admin/users/${userId}`);
console.log('USER DETAIL status:', res.status);

if (!res.ok) {
  const text = await res.text().catch(() => '');
  console.error('USER DETAIL error body:', text);
  alert('Kullanıcı bilgisi alınamadı.');
  return;
}


      const data = await res.json(); // { user: {...}, files: [...] }

      // Şimdilik sadece popup gösteriyoruz
      alert(
        `Kullanıcı: ${data.user.username}\n` +
        `E-posta: ${data.user.email}\n` +
        `Admin mi: ${data.user.is_admin ? 'Evet' : 'Hayır'}\n` +
        `Toplam dosya: ${data.files.length}`
      );

      // İleride: burada bir modal / sağ panel açıp
      // detaylı görünüm yapabiliriz.
    } catch (err) {
      console.error(err);
      alert('Sunucu ile iletişimde bir hata oluştu.');
    }

    return; // kullanıcı butonu işini bitirdik
  }

  /* -------------------------
   * 2) Dosya İndir
   * ------------------------*/
  const downloadBtn = target.closest('[data-action="download"]');
  if (downloadBtn) {
    const fileId = downloadBtn.dataset.fileId;
    // Direkt endpoint'e yönlendir → browser indirir
    window.location.href = `/api/admin/files/${fileId}/download`;
    return;
  }

  /* -------------------------
   * 3) Dosya Sil
   * ------------------------*/
  const deleteBtn = target.closest('[data-action="delete-file"]');
  if (deleteBtn) {
    const fileId = deleteBtn.dataset.fileId;
    const row = deleteBtn.closest('tr');

    if (!confirm('Bu dosyayı silmek istediğine emin misin?')) return;

    try {
      const res = await fetch(`/api/admin/files/${fileId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        alert('Dosya silinemedi.');
        return;
      }

      if (row) row.remove();
    } catch (err) {
      console.error(err);
      alert('Dosya silinirken hata oluştu.');
    }
  }
});

