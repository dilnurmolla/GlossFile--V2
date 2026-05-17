// server.js

require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const fs = require('fs');
const db = require('./db'); // db.query(...) çalışır

 // Eski kodlarda pool kullanımı vardı → aynı objeye bağladık
const { sendMfaEmail } = require('./mailer');
const { encryptFileForShare } = require('./share-crypto');

const multer = require('multer');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const upload = multer({ dest: UPLOAD_DIR });

const SHARED_DIR = path.join(UPLOAD_DIR, 'shared');
fs.mkdirSync(SHARED_DIR, { recursive: true });

const session = require('express-session');

const USER_QUOTA_BYTES = 10 * 1024 * 1024 * 1024; // 10GB

const app = express();

// Debug log
app.use((req, _res, next) => {
  const ip = getClientIp(req);
  console.log('REQ:', req.method, req.url, 'IP:', ip);
  next();
});

// Basit IP engel kontrolu (adminin ekledigi deny kurallari)
app.use((req, res, next) => {
  const ip = getClientIp(req);
  const blocked = securityIpRules.find((r) => r.mode === 'deny' && normalizeIp(r.value) === ip);
  if (blocked) {
    return res.status(403).json({ message: 'IP engellendi' });
  }
  next();
});

// Body parser
app.use(express.json());

let cachedUserColumns = null;

async function getUserColumns() {
  if (cachedUserColumns) return cachedUserColumns;
  const [cols] = await db.query('SHOW COLUMNS FROM users');
  cachedUserColumns = cols.map((c) => c.Field);
  return cachedUserColumns;
}

async function ensureSharedFilesSignatureColumns() {
  const dbName = process.env.DB_NAME;
  if (!dbName) return;

  try {
    const [rows] = await db.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'shared_files'
         AND COLUMN_NAME IN ('sender_signature_b64', 'signed_payload_b64')`,
      [dbName]
    );

    const existing = new Set(rows.map((r) => r.COLUMN_NAME));
    if (!existing.has('sender_signature_b64')) {
      await db.query('ALTER TABLE shared_files ADD COLUMN sender_signature_b64 TEXT NULL');
    }
    if (!existing.has('signed_payload_b64')) {
      await db.query('ALTER TABLE shared_files ADD COLUMN signed_payload_b64 TEXT NULL');
    }
  } catch (err) {
    console.error('DB MIGRATION ERROR (shared_files signature columns):', err.message);
  }
}
app.use(express.urlencoded({ extended: true }));

// Session
app.use(
  session({
    secret: 'glossfile-super-secret',
    resave: false,
    saveUninitialized: false,
  })
);

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Giriş yapmalısın' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Giriş yapmalısın' });
  }
  if (!req.session.user.is_admin) {
    return res.status(403).json({ message: 'Bu işlem için admin olmalısın' });
  }
  next();
}

// MFA kodlarını email'e göre hafızada tutuyoruz
// email -> { code, expiresAt }
const pendingMfa = new Map();
// Basit IP kural listesi (global)
const securityIpRules = [];
const securitySessions = [];

function normalizeIp(ip) {
  if (!ip) return '';
  const s = String(ip).trim();
  if (s.startsWith('::ffff:')) return s.replace('::ffff:', '');
  return s;
}

function getClientIp(req) {
  const rawIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  return normalizeIp(String(rawIp).split(',')[0].trim());
}

function stripEncryptedExt(name) {
  return String(name || '').replace(/\.encblob$/i, '').replace(/\.enc$/i, '');
}

function addSessionLog(entry) {
  securitySessions.unshift(entry);
  if (securitySessions.length > 50) securitySessions.length = 50;
}

// Statik dosyalar (index.html, app.js, dashboard.html vs. src klasöründe)
app.use(express.static(path.join(__dirname, 'src')));

// Ana sayfa
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

// Security endpoints (basic in-memory rules)
app.get('/api/security/status', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const rules = req.session.user?.is_admin ? securityIpRules : [];
  let mfaEnabled = req.session.user?.mfa_enabled ?? null;

  try {
    const cols = await getUserColumns();
    if (cols.includes('mfa_enabled')) {
      const [rows] = await db.query('SELECT mfa_enabled FROM users WHERE id = ? LIMIT 1', [userId]);
      mfaEnabled = Number(rows?.[0]?.mfa_enabled || 0);
    }
  } catch (err) {
    console.error('SECURITY status hata:', err);
  }

  if (mfaEnabled === null || mfaEnabled === undefined) {
    mfaEnabled = 0;
  }

  const isAdmin = Number(req.session.user?.is_admin) === 1;
  return res.json({
    ok: true,
    mfa_enabled: mfaEnabled,
    ip_rules: rules,
    sessions: isAdmin ? securitySessions : [],
    is_admin: isAdmin,
  });
});

// MFA status (basic)
app.get('/api/mfa/status', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  let mfaEnabled = req.session.user?.mfa_enabled ?? null;

  try {
    const cols = await getUserColumns();
    if (cols.includes('mfa_enabled')) {
      const [rows] = await db.query('SELECT mfa_enabled FROM users WHERE id = ? LIMIT 1', [userId]);
      mfaEnabled = Number(rows?.[0]?.mfa_enabled || 0);
    }
  } catch (err) {
    console.error('MFA status hata:', err);
  }

  if (mfaEnabled === null || mfaEnabled === undefined) {
    mfaEnabled = 0;
  }

  return res.json({ ok: true, mfa_enabled: mfaEnabled });
});

app.post('/api/security/ip-rules', requireAdmin, (req, res) => {
  const { value, label } = req.body || {};
  const mode = req.body?.mode === 'allow' ? 'allow' : 'deny';

  if (!value || !String(value).trim()) {
    return res.status(400).json({ ok: false, error: 'Geçersiz kural' });
  }

  const rule = {
    id: Date.now(),
    value: normalizeIp(String(value).trim()),
    mode,
    label: String(label || '').trim(),
    created_at: new Date().toISOString(),
  };

  securityIpRules.unshift(rule);
  return res.json({ ok: true, rule });
});

app.delete('/api/security/ip-rules/:id', requireAdmin, (req, res) => {
  const ruleId = Number(req.params.id);
  const next = securityIpRules.filter((r) => Number(r.id) !== ruleId);
  securityIpRules.length = 0;
  securityIpRules.push(...next);
  return res.json({ ok: true });
});

// Kayıt (basit)
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body || {};

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ success: false, message: 'Kullanıcı adı, e-posta ve şifre gerekli.' });
  }

  if (String(password).length < 8) {
    return res
      .status(400)
      .json({ success: false, message: 'Şifre en az 8 karakter olmalıdır.' });
  }

  try {
    const [exists] = await db.query(
      'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
      [username, email]
    );

    if (exists.length) {
      return res
        .status(409)
        .json({ success: false, message: 'Bu kullanıcı adı veya e-posta zaten var.' });
    }

    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, hash]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('REGISTER hata:', err);
    return res.status(500).json({ success: false, message: 'Kayıt oluşturulamadı.' });
  }
});

// Debug için kullanıcı listesi
app.get('/api/debug-users', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, username, email FROM users');
    console.log('DEBUG USERS:', rows);
    res.json(rows);
  } catch (err) {
    console.error('DEBUG USERS HATASI:', err);
    res.status(500).json({ message: 'Debug users hatası' });
  }
});

// LOGIN: email/kullanıcı adı + şifre kontrolü + MFA kodu üretme
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  // IP'yi al
  const rawIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  const clientIp = rawIp.split(',')[0].trim();

  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, message: 'Email/kullanıcı adı ve şifre gerekli.' });
  }

  try {
    // kullanıcıyı bul
    const [rows] = await db.query(
      `SELECT id, username, email, password_hash, is_admin, mfa_enabled
       FROM users
       WHERE email = ? OR username = ?
       LIMIT 1`,
      [email, email]
    );

    if (rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: 'Kullanıcı bulunamadı veya şifre hatalı.' });
    }

    const user = rows[0];

    // şifreyi karşılaştır
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res
        .status(401)
        .json({ success: false, message: 'Kullanıcı bulunamadı veya şifre hatalı.' });
    }

    // Son IP'yi kaydet
    try {
      await db.query('UPDATE users SET last_ip = ? WHERE id = ?', [clientIp || null, user.id]);
    } catch (err) {
      console.error('Son IP güncellenirken hata:', err);
    }

    const mfaEnabled = Number(user.mfa_enabled) === 1;

    if (!mfaEnabled) {
      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        is_admin: user.is_admin,
        mfa_enabled: 0,
      };

      addSessionLog({
        event: 'LOGIN',
        user_id: user.id,
        email: user.email,
        ip: clientIp || null,
        created_at: new Date().toISOString(),
      });

      return res.json({
        success: true,
        mfaRequired: false,
        redirect: '/dashboard.html',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          is_admin: user.is_admin,
          mfa_enabled: 0,
        },
      });
    }

    app.get("/api/mfa/status", async(req, res) => {
      try{
        const uid = req.session?.userId;
        if(!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

        const [[row]] = await db.query(
          "SELECT COUNT(*) AS c FROM mfa_secrets WHERE user_id=? AND is_active=1",
          [uid]
        );

        const enabled = Number(row?.c || 0) > 0 ? 1: 0;
        res.json({ ok: true, enabled });
      }catch (e){
        console.error("mfa/status error:", e);
        res.status(500).json({ ok: false, error: "server_error" });
      }
    });

    // ŞİFRE DOĞRUYSA: MFA kodu üret
    const mfaCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 dakika

    // email'e göre kodu tut
    pendingMfa.set(user.email, { code: mfaCode, expiresAt });

    // Geçici kullanıcı bilgisini session'a koy (MFA sonrası kullanmak için)
    req.session.pendingUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      is_admin: user.is_admin,
      mfa_enabled: 1,
    };

    // E-postaya MFA kodunu gönder
    try {
      await sendMfaEmail(user.email, mfaCode);
      console.log(`MFA kodu ${user.email} adresine gönderildi: ${mfaCode}`);
    } catch (err) {
      console.error('MFA e-posta hatası:', err);
      return res.status(500).json({
        success: false,
        message: 'MFA kodu e-posta ile gönderilemedi. Lütfen daha sonra tekrar deneyin.',
      });
    }

    // Frontend'e "MFA gerekiyor" bilgisi
    return res.json({
      success: true,
      mfaRequired: true,
      message: 'MFA_REQUIRED',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        is_admin: user.is_admin,
        mfa_enabled: 1,
      },
      mfa: {
        method: 'email',
        expiresIn: 300,
      },
    });
  } catch (err) {
    console.error('Login hatası:', err);
    return res.status(500).json({ success: false, message: 'Sunucu hatası (login)' });
  }
});

// MFA DOĞRULAMA
app.post('/api/verify-mfa', (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ success: false, message: 'Email ve kod gerekli.' });
  }

  const entry = pendingMfa.get(email);
  if (!entry) {
    return res.status(400).json({
      success: false,
      message: 'Bu email için aktif bir MFA isteği yok ya da süresi dolmuş.',
    });
  }

  const now = Date.now();
  if (now > entry.expiresAt) {
    pendingMfa.delete(email);
    return res.status(400).json({ success: false, message: 'MFA kodunun süresi dolmuş.' });
  }

  if (entry.code !== String(code).trim()) {
    return res.status(400).json({ success: false, message: 'MFA kodu hatalı.' });
  }

  // Kod doğru → bir daha kullanılmasın diye sil
  pendingMfa.delete(email);

  // Session'da pendingUser olmalı
  const pendingUser = req.session.pendingUser;
  if (!pendingUser || pendingUser.email !== email) {
    return res.status(400).json({
      success: false,
      message: 'Oturum bilgisi bulunamadı. Lütfen yeniden giriş yapın.',
    });
  }

  // Artık kullanıcıyı gerçekten login yaptık
  req.session.user = pendingUser;
  delete req.session.pendingUser;

  addSessionLog({
    event: 'LOGIN',
    user_id: pendingUser.id,
    email: pendingUser.email,
    ip: getClientIp(req) || null,
    created_at: new Date().toISOString(),
  });

  return res.json({
    success: true,
    message: 'MFA başarılı',
    redirect: '/dashboard.html',
  });
});

// LOGOUT
app.post('/api/logout', (req, res) => {
  try {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) console.error('LOGOUT session destroy error:', err);
        res.clearCookie('connect.sid');
        return res.status(204).end();
      });
    } else {
      res.status(204).end();
    }
  } catch (err) {
    console.error('LOGOUT error:', err);
    res.status(500).json({ error: 'Logout sırasında sunucu hatası' });
  }
});

// Şu an login olmuş kullanıcı bilgisi + dosyalar + depolama kullanımı
app.get('/api/me', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Giriş yapmalısın' });

  const userId = req.session.user.id;

  const [files] = await db.query(
    `SELECT id, original_name, size_bytes, mime_type, is_encrypted, created_at
     FROM personal_files
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId]
  );

  const [usageRows] = await db.query(
    `SELECT COALESCE(SUM(size_bytes), 0) AS totalBytes
     FROM personal_files
     WHERE user_id = ?`,
    [userId]
  );

  // /api/me içinde, user alanını DB'den zenginleştir (kolon varsa seç)
  let user = req.session.user;
  try {
    const cols = await getUserColumns();
    const selectCols = ['id', 'username', 'email', 'is_admin', 'mfa_enabled'];
    if (cols.includes('language')) selectCols.push('language');
    if (cols.includes('notify_upload')) selectCols.push('notify_upload');
    if (cols.includes('notify_share')) selectCols.push('notify_share');

    const [uRows] = await db.query(
      `SELECT ${selectCols.join(', ')} FROM users WHERE id=? LIMIT 1`,
      [userId]
    );
    if (uRows[0]) {
      user = { ...req.session.user, ...uRows[0] };
    }
  } catch (err) {
    console.error('GET /api/me user query hata:', err);
  }

  const totalBytes = Number(usageRows[0].totalBytes) || 0;
  const quotaBytes = USER_QUOTA_BYTES;
  const percent = quotaBytes > 0 ? Math.min(100, (totalBytes / quotaBytes) * 100) : 0;

  req.session.user = user;
  return res.json({
    user,
    files,
    storage: { totalBytes, quotaBytes, percent },
  });
});

// Dosya upload (kotalı)
app.post('/api/files/upload', upload.single('file'), async (req, res) => {
  console.log('✅ E2EE UPLOAD ENDPOINT ÇALIŞTI', {
  hasFile: !!req.file,
  bodyKeys: Object.keys(req.body || {}),
  iv: !!req.body?.iv_b64,
  tag: !!req.body?.tag_b64,
  hash: !!req.body?.cipher_hash_b64,
  self: !!req.body?.wrapped_key_self_b64
});

  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'Giriş yapmalısın' });
    }

    const userId = req.session.user.id;
    const file = req.file;

    // ✅ E2EE meta (multipart/form-data alanları)
    const { iv_b64, tag_b64, cipher_hash_b64, wrapped_key_self_b64 } = req.body || {};

    if (!file) return res.status(400).json({ success: false, message: 'Dosya bulunamadı' });

    if (!iv_b64 || !tag_b64 || !cipher_hash_b64 || !wrapped_key_self_b64) {
      return res.status(400).json({
        success: false,
        message: 'E2EE meta eksik (iv_b64, tag_b64, cipher_hash_b64, wrapped_key_self_b64)',
      });
    }

    // quota (ciphertext boyutu üzerinden)
    const [usageRows] = await db.query(
      `SELECT COALESCE(SUM(size_bytes), 0) AS totalBytes
       FROM personal_files
       WHERE user_id = ?`,
      [userId]
    );
    const currentBytes = Number(usageRows[0].totalBytes) || 0;
    const newTotal = currentBytes + file.size;

    if (USER_QUOTA_BYTES > 0 && newTotal > USER_QUOTA_BYTES) {
      return res.status(400).json({
        success: false,
        message: 'Depolama limitiniz dolu. Yükleme yapmadan önce gereksiz dosyaları silmelisiniz.',
      });
    }

    // ✅ personal_files artık encrypted meta ile yazılıyor
    const originalName = String(req.body?.original_name || file.originalname || '').trim();
    const [ins] = await db.query(
      `INSERT INTO personal_files
       (user_id, original_name, stored_name, size_bytes, mime_type, is_encrypted,
        iv_b64, tag_b64, cipher_hash_b64, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, NOW())`,
      [userId, originalName, file.filename, file.size, file.mimetype, iv_b64, tag_b64, cipher_hash_b64]
    );

    const fileId = ins.insertId;

    // ✅ self wrapped key kaydı
    await db.query(
      `INSERT INTO file_keys (file_id, user_id, wrapped_key_b64)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE wrapped_key_b64 = VALUES(wrapped_key_b64)`,
      [fileId, userId, wrapped_key_self_b64]
    );

    return res.json({ success: true, message: 'Şifreli dosya yüklendi', fileId });
  } catch (err) {
    console.error('upload hatası:', err);
    return res.status(500).json({ success: false, message: 'Sunucu hatası (upload)' });
  }
});



// Kullanıcı kendi dosyasını indir
app.get('/api/files/:id/download', requireAuth, async (req, res) => {
  const fileId = Number(req.params.id);
  const userId = req.session.user.id;

  try {
    const [rows] = await db.query(
      `SELECT stored_name, original_name
       FROM personal_files
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [fileId, userId]
    );

    if (!rows.length) return res.status(404).send('Dosya bulunamadı');

    const fp = path.join(UPLOAD_DIR, rows[0].stored_name);
    if (!fs.existsSync(fp)) return res.status(404).send('Dosya sunucuda bulunamadı');

    const downloadName = stripEncryptedExt(rows[0].original_name) || rows[0].original_name;
    return res.download(fp, downloadName);
  } catch (err) {
    console.error('GET /api/files/:id/download hata:', err);
    return res.status(500).send('Sunucu hatası');
  }
});

// Kullanıcı kendi dosyasını sil
app.delete('/api/files/:id', requireAuth, async (req, res) => {
  const fileId = Number(req.params.id);
  const userId = req.session.user.id;

  try {
    const [rows] = await db.query(
      `SELECT stored_name
       FROM personal_files
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [fileId, userId]
    );

    if (!rows.length) return res.status(404).json({ ok: false, error: 'Dosya bulunamadı' });

    const fp = path.join(UPLOAD_DIR, rows[0].stored_name);

    await db.query(`DELETE FROM personal_files WHERE id = ? AND user_id = ?`, [fileId, userId]);

    try { fs.unlinkSync(fp); } catch {}
    return res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/files/:id hata:', err);
    return res.status(500).json({ ok: false, error: 'Sunucu hatası' });
  }
});

function authMiddleware(req, res, next) {
  if (!req.session?.user?.id) return res.status(401).json({ message: 'Unauthorized' });
  req.user = req.session.user;
  next();
}

// public key kaydediyorum
app.post('/api/users/me/public-key', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { publicKeyPem } = req.body;

  if (!publicKeyPem || !publicKeyPem.includes('BEGIN PUBLIC KEY')) {
    return res.status(400).json({ message: 'Geçersiz public key' });
  }

  await db.query('UPDATE users SET public_key_pem = ? WHERE id = ?', [publicKeyPem, userId]);
  res.json({ ok: true });
});

// kullanıcı public key'ini alalım
app.get('/api/users/:id/public-key', authMiddleware, async (req, res) => {
  const targetId = Number(req.params.id);
  const [rows] = await db.query('SELECT public_key_pem FROM users WHERE id=?', [targetId]);

  if (!rows.length || !rows[0].public_key_pem) {
    return res.status(404).json({ message: 'Public key yok' });
  }
  res.json({ publicKeyPem: rows[0].public_key_pem });
});

app.get('/api/users/public-key-by-email', requireAuth, async (req, res) => {
  const email = String(req.query.email || '').trim();
  if (!email) return res.status(400).json({ ok: false, error: 'email gerekli' });

  const [rows] = await db.query(
    'SELECT id, public_key_pem FROM users WHERE email=? LIMIT 1',
    [email]
  );
  if (!rows.length || !rows[0].public_key_pem) {
    return res.status(404).json({ ok: false, error: 'Kullanıcı bulunamadı veya public key yok' });
  }

  return res.json({ ok: true, id: rows[0].id, publicKeyPem: rows[0].public_key_pem });
});

// PAYLAŞ (AES+RSA şifreleme)
app.post('/api/files/share', requireAuth, async (req, res) => {


  try {
    const senderUserId = req.session.user.id;
      console.log('✅ SHARE V2 HIT', {
  senderUserId,
  keys: Object.keys(req.body || {}),
  fileId: req.body?.fileId,
  receiverUserId: req.body?.receiverUserId,
  receiverEmail: req.body?.receiverEmail,
  wrappedLen: (req.body?.wrapped_key_b64 || '').length
});
const {
  fileId,
  receiverUserId,
  receiverEmail,
  wrapped_key_b64,
  sender_signature_b64,
  signed_payload_b64,
} = req.body;

    if (!fileId) return res.status(400).json({ ok: false, error: 'fileId gerekli.' });
    if (!wrapped_key_b64) return res.status(400).json({ ok: false, error: 'wrapped_key_b64 gerekli.' });
    if (!receiverUserId && !receiverEmail) {
      return res.status(400).json({ ok: false, error: 'receiverEmail veya receiverUserId gerekli.' });
    }

    // receiver bul
    let receiver = null;
    if (receiverUserId) {
      const [r] = await db.query(`SELECT id FROM users WHERE id=? LIMIT 1`, [receiverUserId]);
      receiver = r[0] || null;
    } else {
      const [r] = await db.query(`SELECT id FROM users WHERE email=? LIMIT 1`, [receiverEmail]);
      receiver = r[0] || null;
    }
    if (!receiver) return res.status(404).json({ ok: false, error: 'Kullanıcı yok.' });

    const receiverUserIdFinal = Number(receiver.id);

    // dosya sender'ın mı?
    const [fileRows] = await db.query(
      `SELECT id, user_id, original_name, stored_name, is_encrypted
       FROM personal_files
       WHERE id=? AND user_id=?
       LIMIT 1`,
      [fileId, senderUserId]
    );
    if (!fileRows.length) return res.status(404).json({ ok: false, error: 'Dosya yok veya sana ait değil.' });

    // ✅ 1) receiver wrapped key kaydı (asıl kritik)
    await db.query(
      `INSERT INTO file_keys (file_id, user_id, wrapped_key_b64)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE wrapped_key_b64 = VALUES(wrapped_key_b64)`,
      [fileId, receiverUserIdFinal, wrapped_key_b64]
    );

    // ✅ 2) shared_files kayıt (şifreli dosya yolu gerekli)
    if (!fileRows[0].stored_name) {
      return res.status(500).json({ ok: false, error: 'Dosya yolu bulunamadı (stored_name yok).' });
    }
    const sharedFilePath = path.join(UPLOAD_DIR, fileRows[0].stored_name);
    const [ins] = await db.query(
      `INSERT INTO shared_files
       (filename, filepath, uploaded_at, file_id, sender_user_id, receiver_user_id, wrapped_key_b64,
        sender_signature_b64, signed_payload_b64)
       VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?)`,
      [
        fileRows[0].original_name,
        sharedFilePath,
        fileId,
        senderUserId,
        receiverUserIdFinal,
        wrapped_key_b64,
        sender_signature_b64 || null,
        signed_payload_b64 || null,
      ]
    );

    return res.json({ ok: true, shareId: ins.insertId });
  } catch (err) {
    console.error('SHARE ERROR:', err);
    return res.status(500).json({
      ok: false,
      error: 'Paylaşım başarısız.',
      detail: err.message,
      code: err.code,
      sqlMessage: err.sqlMessage,
    });
  }
});


// Inbox (paylaşılanlar listesi)
app.get('/api/shared/inbox', requireAuth, async (req, res) => {
  const userId = req.session.user.id;

  try {
    const [rows] = await db.query(
      `SELECT sf.id,
              sf.file_id,
              sf.sender_user_id,
              sf.receiver_user_id,
              sf.filename,
              sf.uploaded_at,
              u.username AS sender_username,
              u.email    AS sender_email
       FROM shared_files sf
       JOIN users u ON sf.sender_user_id = u.id
       WHERE sf.receiver_user_id = ?
       ORDER BY sf.uploaded_at DESC`,
      [userId]
    );

    res.json({ ok: true, items: rows });
  } catch (err) {
    console.error('INBOX ERROR:', err);
    res.status(500).json({ ok: false, message: 'Inbox alınamadı' });
  }
});

// Meta (wrapped key / iv / tag)
app.get('/api/shared/:id/meta', requireAuth, async (req, res) => {
  const shareId = Number(req.params.id);
  const userId = req.session.user.id;

  try {
    const [rows] = await db.query(
      `SELECT sf.id,
              sf.filename,
              sf.wrapped_key_b64,
              sf.sender_signature_b64,
              sf.signed_payload_b64,
              pf.iv_b64,
              pf.tag_b64,
              pf.cipher_hash_b64,
              u.public_key_pem AS sender_public_key_pem
       FROM shared_files sf
       JOIN personal_files pf ON pf.id = sf.file_id
       JOIN users u ON u.id = sf.sender_user_id
       WHERE sf.id = ? AND sf.receiver_user_id = ?
       LIMIT 1`,
      [shareId, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, error: 'Paylaşım bulunamadı.' });
    }

    return res.json({ ok: true, ...rows[0] });
  } catch (err) {
    console.error('META ERROR:', err);
    return res.status(500).json({ ok: false, error: 'Meta alınamadı.' });
  }
});

// Şifreli dosya indir (enc)
app.get('/api/shared/:id/file', requireAuth, async (req, res) => {
  const shareId = Number(req.params.id);
  const userId = req.session.user.id;

  try {
    const [rows] = await db.query(
      `SELECT filepath, filename
       FROM shared_files
       WHERE id = ? AND receiver_user_id = ?
       LIMIT 1`,
      [shareId, userId]
    );

    if (!rows.length) return res.status(404).send('Paylaşım bulunamadı');

    const filepath = rows[0].filepath;
    const filename = rows[0].filename;

    if (!filepath || !fs.existsSync(filepath)) {
      return res.status(404).send('Şifreli dosya diskte yok');
    }

    const downloadName = stripEncryptedExt(filename) || filename || 'shared';
    return res.download(filepath, downloadName);
  } catch (err) {
    console.error('FILE ERROR:', err);
    return res.status(500).send('Şifreli dosya indirilemedi');
  }
});

// Tek çağrıda payload (UI kolaylığı için)
app.get('/api/shared/:id/payload', requireAuth, async (req, res) => {
  const shareId = Number(req.params.id);
  const userId = req.session.user.id;

  try {
    const [rows] = await db.query(
      `SELECT sf.filename,
              sf.filepath,
              sf.wrapped_key_b64,
              sf.sender_signature_b64,
              sf.signed_payload_b64,
              pf.iv_b64,
              pf.tag_b64,
              pf.cipher_hash_b64,
              u.public_key_pem AS sender_public_key_pem
       FROM shared_files sf
       JOIN personal_files pf ON pf.id = sf.file_id
       JOIN users u ON u.id = sf.sender_user_id
       WHERE sf.id = ? AND sf.receiver_user_id = ?
       LIMIT 1`,
      [shareId, userId]
    );

    if (!rows.length) return res.status(404).json({ ok: false, error: 'Paylaşım bulunamadı.' });

    const r = rows[0];
    if (!r.filepath || !fs.existsSync(r.filepath)) {
      return res.status(404).json({ ok: false, error: 'Şifreli dosya diskte yok.' });
    }

    const encB64 = fs.readFileSync(r.filepath).toString('base64');

    return res.json({
      ok: true,
      filename: r.filename,
      encB64,
      wrapped_key_b64: r.wrapped_key_b64,
      iv_b64: r.iv_b64,
      tag_b64: r.tag_b64,
      cipher_hash_b64: r.cipher_hash_b64,
      signed_payload_b64: r.signed_payload_b64,
      sender_signature_b64: r.sender_signature_b64,
      sender_public_key_pem: r.sender_public_key_pem,
    });
  } catch (err) {
    console.error('PAYLOAD ERROR:', err);
    return res.status(500).json({ ok: false, error: 'Payload alınamadı.' });
  }
});

// ADMIN OVERVIEW (senin eski yapı)
app.get('/api/admin/overview', requireAdmin, async (req, res) => {
  try {
    const [[userCountRow]] = await db.query('SELECT COUNT(*) AS totalUsers FROM users');

    const [users] = await db.query(
      `SELECT id, username, email, last_ip
       FROM users
       ORDER BY id DESC
       LIMIT 50`
    );

    const [files] = await db.query(
      `SELECT f.id,
              f.original_name,
              f.size_bytes,
              f.created_at,
              f.is_encrypted,
              u.username AS uploader_username,
              u.email   AS uploader_email
       FROM personal_files f
       JOIN users u ON f.user_id = u.id
       ORDER BY f.created_at DESC
       LIMIT 100`
    );

    let blockedIps = 0;
    try {
      const [[ipRow]] = await db.query(
        'SELECT COUNT(*) AS blockedIps FROM ip_blacklist WHERE is_active = 1'
      );
      blockedIps = ipRow.blockedIps || 0;
    } catch (e) {
      blockedIps = 0;
    }

    return res.json({
      stats: { totalUsers: userCountRow.totalUsers || 0, blockedIps },
      users,
      files,
    });
  } catch (err) {
    console.error('ADMIN overview hatası:', err);
    return res.status(500).json({ message: 'Admin overview hatası', error: err.message });
  }
});

// ADMIN: yeni kullanıcı oluşturma
app.post('/api/admin/users', requireAdmin, async (req, res) => {
  const { username, email, password, is_admin } = req.body || {};

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: 'Kullanıcı adı, e-posta ve şifre gerekli.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Şifre en az 8 karakter olmalıdır.' });
  }

  try {
    const cols = await getUserColumns();
    const hash = await bcrypt.hash(password, 10);

    const fields = ['username', 'email', 'password_hash'];
    const values = [username, email, hash];

    if (cols.includes('is_admin')) {
      fields.push('is_admin');
      values.push(is_admin ? 1 : 0);
    }

    const placeholders = fields.map(() => '?').join(', ');
    await db.query(
      `INSERT INTO users (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('ADMIN create user hata:', err);
    return res.status(500).json({ success: false, message: 'Kullanıcı oluşturulamadı.' });
  }
});

// ADMIN: kullanıcı detayları
app.get('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  if (!userId) return res.status(400).json({ message: 'Geçersiz kullanıcı' });

  try {
    const cols = await getUserColumns();
    const selectCols = ['id', 'username', 'email'];
    if (cols.includes('is_admin')) selectCols.push('is_admin');
    if (cols.includes('last_ip')) selectCols.push('last_ip');
    if (cols.includes('created_at')) selectCols.push('created_at');

    const [rows] = await db.query(
      `SELECT ${selectCols.join(', ')} FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

    const user = rows[0];
    if (!Object.prototype.hasOwnProperty.call(user, 'is_admin')) user.is_admin = 0;

    const [files] = await db.query(
      `SELECT id, original_name, size_bytes, created_at, is_encrypted
       FROM personal_files
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.json({ user, files });
  } catch (err) {
    console.error('ADMIN user detail hata:', err);
    return res.status(500).json({ message: 'Kullanıcı bilgisi alınamadı.' });
  }
});

// ADMIN: dosya indir
app.get('/api/admin/files/:id/download', requireAdmin, async (req, res) => {
  const fileId = Number(req.params.id);
  if (!fileId) return res.status(400).send('Geçersiz dosya');

  try {
    const [rows] = await db.query(
      `SELECT stored_name, original_name
       FROM personal_files
       WHERE id = ?
       LIMIT 1`,
      [fileId]
    );
    if (!rows.length) return res.status(404).send('Dosya bulunamadı');

    const fp = path.join(UPLOAD_DIR, rows[0].stored_name);
    if (!fs.existsSync(fp)) return res.status(404).send('Dosya sunucuda bulunamadı');

    const downloadName = stripEncryptedExt(rows[0].original_name) || rows[0].original_name;
    return res.download(fp, downloadName);
  } catch (err) {
    console.error('ADMIN download hata:', err);
    return res.status(500).send('Sunucu hatası');
  }
});

// ADMIN: dosya sil
app.delete('/api/admin/files/:id', requireAdmin, async (req, res) => {
  const fileId = Number(req.params.id);
  if (!fileId) return res.status(400).json({ ok: false, error: 'Geçersiz dosya' });

  try {
    const [rows] = await db.query(
      `SELECT stored_name
       FROM personal_files
       WHERE id = ?
       LIMIT 1`,
      [fileId]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Dosya bulunamadı' });

    const fp = path.join(UPLOAD_DIR, rows[0].stored_name);
    await db.query(`DELETE FROM personal_files WHERE id = ?`, [fileId]);
    try { fs.unlinkSync(fp); } catch {}

    return res.json({ ok: true });
  } catch (err) {
    console.error('ADMIN delete file hata:', err);
    return res.status(500).json({ ok: false, error: 'Sunucu hatası' });
  }
});

// Kullanıcı ayarları + hesap yönetimi
app.put('/api/users/me', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const { username, email } = req.body || {};

  try {
    await db.query(
      'UPDATE users SET username = COALESCE(?, username), email = COALESCE(?, email) WHERE id = ?',
      [username ?? null, email ?? null, userId]
    );

    // session'ı da güncelle
    req.session.user.username = username ?? req.session.user.username;
    req.session.user.email = email ?? req.session.user.email;

    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/users/me:', err);
    res.status(500).json({ error: 'Hesap güncellenemedi.' });
  }
});

app.put('/api/users/me/prefs', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const { language, notify_upload, notify_share } = req.body || {};

  try {
    const cols = await getUserColumns();
    const updates = [];
    const values = [];

    if (typeof language === 'string' && cols.includes('language')) {
      updates.push('language = ?');
      values.push(language);
    }
    if (typeof notify_upload === 'number' && cols.includes('notify_upload')) {
      updates.push('notify_upload = ?');
      values.push(notify_upload);
    }
    if (typeof notify_share === 'number' && cols.includes('notify_share')) {
      updates.push('notify_share = ?');
      values.push(notify_share);
    }

    if (!updates.length) {
      return res.json({ ok: true, skipped: true });
    }

    values.push(userId);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    return res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/users/me/prefs:', err);
    return res.status(500).json({ error: 'Tercihler güncellenemedi.' });
  }
});

app.post('/api/users/me/mfa', requireAuth, async (req, res) => {
  const userId = req.session.user.id;

  try {
    await db.query(
      'UPDATE users SET mfa_enabled = IF(mfa_enabled=1, 0, 1) WHERE id = ?',
      [userId]
    );

    const [rows] = await db.query('SELECT mfa_enabled FROM users WHERE id=? LIMIT 1', [userId]);
    const mfa_enabled = Number(rows?.[0]?.mfa_enabled || 0);
    if (req.session.user) {
      req.session.user.mfa_enabled = mfa_enabled;
    }
    res.json({ ok: true, mfa_enabled });
  } catch (err) {
    console.error('POST /api/users/me/mfa:', err);
    res.status(500).json({ error: 'MFA güncellenemedi.' });
  }
});

app.delete('/api/users/me', requireAuth, async (req, res) => {
  const userId = req.session.user.id;

  try {
    // Basit temizlik (minimum)
    await db.query('DELETE FROM personal_files WHERE user_id = ?', [userId]);
    await db.query('DELETE FROM shared_files WHERE sender_user_id = ? OR receiver_user_id = ?', [userId, userId]);
    await db.query('DELETE FROM users WHERE id = ?', [userId]);

    req.session.destroy(() => {});
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/users/me:', err);
    res.status(500).json({ error: 'Hesap silinemedi.' });
  }
});

//lets find  out the takers email adress and use their public key
app.get('/api/users/public-key-by-email', requireAuth, async (req, res) => {
  const email = String(req.query.email || '').trim();
  if (!email) return res.status(400).json({ ok: false, error: 'email gerekli' });

  const [rows] = await db.query(
    `SELECT id, public_key_pem FROM users WHERE email = ? LIMIT 1`,
    [email]
  );

  if (!rows.length) return res.status(404).json({ ok: false, error: 'Kullanıcı yok' });
  if (!rows[0].public_key_pem) return res.status(400).json({ ok: false, error: 'Kullanıcının public key’i yok' });

  res.json({ ok: true, id: rows[0].id, publicKeyPem: rows[0].public_key_pem });
});

//self wrapped key + iv + tag + cipher_hash tek çağrıda
app.get('/api/files/:id/crypto', requireAuth, async (req, res) => {
  const fileId = Number(req.params.id);
  const userId = req.session.user.id;

  const [fRows] = await db.query(
    `SELECT id, iv_b64, tag_b64, cipher_hash_b64
     FROM personal_files
     WHERE id = ? AND user_id = ?
     LIMIT 1`,
    [fileId, userId]
  );
  if (!fRows.length) return res.status(404).json({ ok: false, error: 'Dosya yok veya sana ait değil' });

  const [kRows] = await db.query(
    `SELECT wrapped_key_b64
     FROM file_keys
     WHERE file_id = ? AND user_id = ?
     LIMIT 1`,
    [fileId, userId]
  );
  if (!kRows.length) return res.status(404).json({ ok: false, error: 'Self wrapped key yok' });

  res.json({
    ok: true,
    fileId,
    iv_b64: fRows[0].iv_b64,
    tag_b64: fRows[0].tag_b64,
    cipher_hash_b64: fRows[0].cipher_hash_b64,
    wrapped_key_self_b64: kRows[0].wrapped_key_b64,
  });
});


const PORT = process.env.PORT || 3000;
ensureSharedFilesSignatureColumns().finally(() => {
  app.listen(PORT, () => {
    console.log(`✅ Server running: http://localhost:${PORT}`);
  });
});
