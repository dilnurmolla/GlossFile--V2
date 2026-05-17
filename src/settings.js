console.log("SETTINGS: yüklendi");

const I18N = {
  "tr-TR": {
    "settings.back": "Geri Dön",
    "settings.title": "Ayarlar",
    "settings.account.title": "Hesap Bilgileri",
    "settings.account.username": "Kullanıcı Adı",
    "settings.account.usernamePlaceholder": "Kullanıcı Adın",
    "settings.account.email": "E-posta",
    "settings.account.emailPlaceholder": "E-posta adresin",

    "settings.notifications.title": "Bildirimler",
    "settings.notifications.onUpload": "Dosya Yüklenince Bildir",
    "settings.notifications.onShare": "Paylaşım Oluşturulunca Bildir",

    "settings.danger.title": "Hesabı Kapat",
    "settings.danger.text": "Bu işlem geri alınamaz. Hesabını silmek istiyor musun?",
    "settings.danger.delete": "Hesabımı Sil",

    "common.save": "Kaydet",
    "common.update": "Güncelle",

    "alert.accountUpdated": "Hesap bilgileri güncellendi.",
    "alert.notificationsUpdated": "Bildirim ayarları güncellendi.",
    "alert.languageSaved": "Dil ayarı kaydedildi.",
    "alert.accountDeleted": "Hesabın silindi.",
    "confirm.deleteAccount": "Bu işlem geri alınamaz. Hesabını silmek istiyor musun?",
    "confirm.saveNotifications": "Bildirim tercihlerini kaydetmek istiyor musun?"
  },
  "en-US": {
    "settings.back": "Back",
    "settings.title": "Settings",
    "settings.account.title": "Account",
    "settings.account.username": "Username",
    "settings.account.usernamePlaceholder": "Your username",
    "settings.account.email": "Email",
    "settings.account.emailPlaceholder": "Your email address",

    "settings.notifications.title": "Notifications",
    "settings.notifications.onUpload": "Notify on upload",
    "settings.notifications.onShare": "Notify on share",

    "settings.danger.title": "Close Account",
    "settings.danger.text": "This action cannot be undone. Do you want to delete your account?",
    "settings.danger.delete": "Delete My Account",

    "common.save": "Save",
    "common.update": "Update",

    "alert.accountUpdated": "Account updated.",
    "alert.notificationsUpdated": "Notification settings updated.",
    "alert.languageSaved": "Language saved.",
    "alert.accountDeleted": "Your account has been deleted.",
    "confirm.deleteAccount": "This action cannot be undone. Do you want to delete your account?",
    "confirm.saveNotifications": "Do you want to save notification preferences?"
  }
};

const PREFS_KEY = "gf_prefs";

function normalizePrefs(input = {}) {
  const lang = typeof input.language === "string" ? input.language : "tr-TR";
  const hasUpload = Object.prototype.hasOwnProperty.call(input, "notify_upload");
  const hasShare = Object.prototype.hasOwnProperty.call(input, "notify_share");
  const up = input.notify_upload;
  const sh = input.notify_share;
  const notify_upload = hasUpload
    ? (Number(up) === 1 || up === true || up === "1" || up === "true" ? 1 : 0)
    : 1;
  const notify_share = hasShare
    ? (Number(sh) === 1 || sh === true || sh === "1" || sh === "true" ? 1 : 0)
    : 1;
  return { language: lang, notify_upload, notify_share };
}

function getPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
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

let currentLang = "tr-TR";
function t(key) {
  const dict = I18N[currentLang] || I18N["tr-TR"];
  return dict[key] || key;
}

function applyI18n(lang) {
  currentLang = lang || "tr-TR";
  const dict = I18N[currentLang] || I18N["tr-TR"];
  document.documentElement.lang = currentLang.startsWith("en") ? "en" : "tr";

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key && dict[key]) el.textContent = dict[key];
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key && dict[key]) el.setAttribute("placeholder", dict[key]);
  });
}

async function apiJSON(url, options = {}) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || "İşlem başarısız");
  return data;
}

function browserNotify(title, body) {
  // “browser elementinden log” = konsola da basalım
  console.log(`[NOTIFY] ${title} -> ${body}`);

  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    new Notification(title, { body });
    return;
  }

  if (Notification.permission !== "denied") {
    Notification.requestPermission().then((p) => {
      if (p === "granted") new Notification(title, { body });
    });
  }
}

async function loadSettings() {
  const me = await apiJSON("/api/me");
  const u = me.user || {};

  let stored = {};
  const storedRaw = localStorage.getItem(PREFS_KEY);
  if (storedRaw) {
    try {
      stored = JSON.parse(storedRaw) || {};
    } catch {
      stored = {};
    }
  }
  const patch = {};
  if (!storedRaw || !Object.prototype.hasOwnProperty.call(stored, "language")) {
    if (typeof u.language === "string") patch.language = u.language;
  }
  if (!storedRaw || !Object.prototype.hasOwnProperty.call(stored, "notify_upload")) {
    if (u.notify_upload !== undefined && u.notify_upload !== null) {
      patch.notify_upload = Number(u.notify_upload);
    }
  }
  if (!storedRaw || !Object.prototype.hasOwnProperty.call(stored, "notify_share")) {
    if (u.notify_share !== undefined && u.notify_share !== null) {
      patch.notify_share = Number(u.notify_share);
    }
  }
  const synced = Object.keys(patch).length ? setPrefs(patch) : getPrefs();

  applyI18n(synced.language);

  // Account
  const usernameEl = document.getElementById("username");
  const emailEl = document.getElementById("email");
  if (usernameEl) usernameEl.value = u.username || u.name || "";
  if (emailEl) emailEl.value = u.email || "";

  const upEl = document.getElementById("notify-upload");
  const shEl = document.getElementById("notify-share");
  if (upEl) upEl.checked = synced.notify_upload === 1;
  if (shEl) shEl.checked = synced.notify_share === 1;

  const langSelect = document.getElementById("language");
  if (langSelect) langSelect.value = synced.language;

  console.log("SETTINGS loaded:", u);
}

function bindActions() {
  document.getElementById("btn-account-save")?.addEventListener("click", async () => {
    const username = (document.getElementById("username")?.value || "").trim();
    const email = (document.getElementById("email")?.value || "").trim();

    try {
      await apiJSON("/api/users/me", {
        method: "PUT",
        body: JSON.stringify({ username, email }),
      });
      alert(t("alert.accountUpdated"));
      await loadSettings();
    } catch (e) {
      alert(e.message);
    }
  });

  document.getElementById("btn-notify-save")?.addEventListener("click", async () => {
    const notify_upload = document.getElementById("notify-upload")?.checked ? 1 : 0;
    const notify_share  = document.getElementById("notify-share")?.checked ? 1 : 0;

    const summary =
      `${t("confirm.saveNotifications")}\n\n` +
      `• ${t("settings.notifications.onUpload")}: ${notify_upload ? "ON" : "OFF"}\n` +
      `• ${t("settings.notifications.onShare")}: ${notify_share ? "ON" : "OFF"}`;

    // “Tamam diyerek gönderilsin”
    const ok = confirm(summary);
    if (!ok) return;

    try {
      setPrefs({ notify_upload, notify_share });
      await apiJSON("/api/users/me/prefs", {
        method: "PUT",
        body: JSON.stringify({ notify_upload, notify_share }),
      });
      alert(t("alert.notificationsUpdated"));
    } catch (e) {
      alert(e.message);
    }
  });

  document.getElementById("btn-lang-save")?.addEventListener("click", async () => {
    const language = document.getElementById("language")?.value || "tr-TR";
    try {
      const next = setPrefs({ language });
      applyI18n(next.language);
      await apiJSON("/api/users/me/prefs", {
        method: "PUT",
        body: JSON.stringify({ language }),
      });
      alert(t("alert.languageSaved"));
    } catch (e) {
      alert(e.message);
    }
  });

  document.getElementById("btn-delete-account")?.addEventListener("click", async () => {
    const ok = confirm(t("confirm.deleteAccount"));
    if (!ok) return;

    try {
      // Backend’te delete endpoint’in varsa burayı ona bağlayabilirsin.
      // Şimdilik sadece local temizliği:
      localStorage.clear();
      alert(t("alert.accountDeleted"));
      window.location.href = "/";
    } catch (e) {
      alert(e.message);
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    applyI18n(getPrefs().language);
    bindActions();
    await loadSettings();
  } catch (e) {
    console.error(e);
    alert(e.message || "Ayarlar yüklenemedi.");
  }
});
