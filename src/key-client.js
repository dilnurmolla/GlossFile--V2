// key-client.js
(function () {
  function bufToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function wrapPem(b64, label) {
    const lines = [];
    for (let i = 0; i < b64.length; i += 64) {
      lines.push(b64.slice(i, i + 64));
    }
    return '-----BEGIN ' + label + '-----\n' + lines.join('\n') + '\n-----END ' + label + '-----';
  }

  function base64ToArrayBuffer(b64) {
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function pemToArrayBuffer(pem) {
    const b64 = String(pem || '')
      .replace(/-----BEGIN [^-]+-----/g, '')
      .replace(/-----END [^-]+-----/g, '')
      .replace(/\s+/g, '');
    return base64ToArrayBuffer(b64);
  }

  async function exportPublicKeyPem(publicKey) {
    const spki = await crypto.subtle.exportKey('spki', publicKey);
    return wrapPem(bufToBase64(spki), 'PUBLIC KEY');
  }

  async function exportPrivateKeyPem(privateKey) {
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey);
    return wrapPem(bufToBase64(pkcs8), 'PRIVATE KEY');
  }

  async function ensureBrowserKeys(userId) {
    const keyName = 'gf_keys_' + userId;
    const raw = localStorage.getItem(keyName);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.publicKeyPem && parsed.privateKeyPem) {
          return { created: false, publicKeyPem: parsed.publicKeyPem, privateKeyPem: parsed.privateKeyPem };
        }
      } catch {}
    }

    if (!crypto?.subtle) {
      throw new Error('WebCrypto yok');
    }

    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 3072,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['encrypt', 'decrypt']
    );

    const publicKeyPem = await exportPublicKeyPem(keyPair.publicKey);
    const privateKeyPem = await exportPrivateKeyPem(keyPair.privateKey);

    const payload = { publicKeyPem, privateKeyPem };
    localStorage.setItem(keyName, JSON.stringify(payload));

    return { created: true, publicKeyPem, privateKeyPem };
  }

  async function ensureKeys(userId) {
    if (!userId) return null;
    return await ensureBrowserKeys(userId);
  }

  async function ensureKeysAndUpload(userId) {
    const result = await ensureKeys(userId);
    if (result?.publicKeyPem) {
      const res = await fetch('/api/users/me/public-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ publicKeyPem: result.publicKeyPem }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'Public key kaydedilemedi');
      }
    }
    return result;
  }

  async function decryptSharedAndSave(payload) {
    const { userId, filename, encBuf, wrapped_key_b64, iv_b64, tag_b64 } = payload || {};
    if (!userId) throw new Error('userId gerekli');
    if (!encBuf) throw new Error('encBuf gerekli');
    if (!wrapped_key_b64 || !iv_b64 || !tag_b64) throw new Error('Meta eksik (wrapped/iv/tag)');

    const keyName = 'gf_keys_' + userId;
    const raw = localStorage.getItem(keyName);
    if (!raw) throw new Error('Private key bulunamadı');

    let privateKeyPem = null;
    try {
      const parsed = JSON.parse(raw);
      privateKeyPem = parsed.privateKeyPem || null;
    } catch {}

    if (!privateKeyPem) throw new Error('Private key bulunamadı');

    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      pemToArrayBuffer(privateKeyPem),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['decrypt']
    );

    const wrappedKey = base64ToArrayBuffer(wrapped_key_b64);
    let aesKeyRaw;
    try {
      aesKeyRaw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, wrappedKey);
    } catch (e) {
      throw new Error('RSA çözme başarısız. Anahtar uyuşmuyor olabilir.');
    }
    const aesKey = await crypto.subtle.importKey(
      'raw',
      aesKeyRaw,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const iv = new Uint8Array(base64ToArrayBuffer(iv_b64));
    const tag = new Uint8Array(base64ToArrayBuffer(tag_b64));
    const encBytes = new Uint8Array(encBuf);
    const combined = new Uint8Array(encBytes.length + tag.length);
    combined.set(encBytes, 0);
    combined.set(tag, encBytes.length);

    let plainBuf;
    try {
      plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, tagLength: tag.length * 8 },
        aesKey,
        combined
      );
    } catch (e) {
      throw new Error('AES çözme başarısız. Dosya bozulmuş olabilir.');
    }

    const blob = new Blob([plainBuf], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || ('shared_file_' + Date.now());
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return { ok: true };
  }

  async function unwrapSelfKeyForUser(userId, wrapped_key_b64) {
    if (!userId) throw new Error('userId gerekli');
    if (!wrapped_key_b64) throw new Error('wrapped_key_b64 gerekli');

    const keyName = 'gf_keys_' + userId;
    const raw = localStorage.getItem(keyName);
    if (!raw) throw new Error('Private key bulunamadı');

    let privateKeyPem = null;
    try {
      const parsed = JSON.parse(raw);
      privateKeyPem = parsed.privateKeyPem || null;
    } catch {}

    if (!privateKeyPem) throw new Error('Private key bulunamadı');

    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      pemToArrayBuffer(privateKeyPem),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['decrypt']
    );

    const wrappedKey = base64ToArrayBuffer(wrapped_key_b64);
    const rawKey = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, wrappedKey);
    return bufToBase64(rawKey);
  }

  async function wrapKeyForPublicKey(publicKeyPem, rawKey_b64) {
    if (!publicKeyPem) throw new Error('publicKeyPem gerekli');
    if (!rawKey_b64) throw new Error('rawKey_b64 gerekli');

    const publicKey = await crypto.subtle.importKey(
      'spki',
      pemToArrayBuffer(publicKeyPem),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt']
    );

    const rawKey = base64ToArrayBuffer(rawKey_b64);
    const wrapped = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawKey);
    return { wrapped_key_b64: bufToBase64(wrapped) };
  }

  async function signPss(userId, canonicalString) {
    if (!userId) throw new Error('userId gerekli');
    if (!canonicalString) throw new Error('canonicalString gerekli');

    const keyName = 'gf_keys_' + userId;
    const raw = localStorage.getItem(keyName);
    if (!raw) throw new Error('Private key bulunamadı');

    let privateKeyPem = null;
    try {
      const parsed = JSON.parse(raw);
      privateKeyPem = parsed.privateKeyPem || null;
    } catch {}

    if (!privateKeyPem) throw new Error('Private key bulunamadı');

    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      pemToArrayBuffer(privateKeyPem),
      { name: 'RSA-PSS', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const data = new TextEncoder().encode(String(canonicalString));
    const sig = await crypto.subtle.sign(
      { name: 'RSA-PSS', saltLength: 32 },
      privateKey,
      data
    );

    return { signature_b64: bufToBase64(sig) };
  }

  async function verifyPss(publicKeyPem, canonicalString, signature_b64) {
    if (!publicKeyPem) throw new Error('publicKeyPem gerekli');
    if (!canonicalString) throw new Error('canonicalString gerekli');
    if (!signature_b64) throw new Error('signature_b64 gerekli');

    const publicKey = await crypto.subtle.importKey(
      'spki',
      pemToArrayBuffer(publicKeyPem),
      { name: 'RSA-PSS', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const data = new TextEncoder().encode(String(canonicalString));
    const sigBuf = base64ToArrayBuffer(signature_b64);
    const ok = await crypto.subtle.verify(
      { name: 'RSA-PSS', saltLength: 32 },
      publicKey,
      sigBuf,
      data
    );

    return { ok: !!ok };
  }

  window.gfEnsureKeys = ensureKeys;
  window.gfEnsureKeysAndUpload = ensureKeysAndUpload;
  window.gfDecryptSharedAndSave = decryptSharedAndSave;
  window.gfUnwrapKeyForUser = unwrapSelfKeyForUser;
  window.gfWrapKey = wrapKeyForPublicKey;
  window.gfSignPss = signPss;
  window.gfVerifyPss = verifyPss;
})();
