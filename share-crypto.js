const crypto = require('crypto');
const fs = require('fs');

function rsaWrapKey(publicKeyPem, aesKey) {
  return crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    aesKey
  );
}

function encryptFileAesGcm({ inputPath, outputPath, aesKey, iv }) {
  return new Promise((resolve, reject) => {
    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);

    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);

    input.on('error', reject);
    output.on('error', reject);

    output.on('finish', () => {
      const tag = cipher.getAuthTag();
      resolve({ tag });
    });

    input.pipe(cipher).pipe(output);
  });
}

async function encryptFileForShare({ inputPath, outputPath, receiverPublicKeyPem }) {
  if (!receiverPublicKeyPem) throw new Error('receiver public key gerekli');

  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);

  const { tag } = await encryptFileAesGcm({ inputPath, outputPath, aesKey, iv });
  const wrappedKey = rsaWrapKey(receiverPublicKeyPem, aesKey);

  return {
    wrapped_key_b64: wrappedKey.toString('base64'),
    iv_b64: iv.toString('base64'),
    tag_b64: tag.toString('base64'),
  };
}

module.exports = { encryptFileForShare };
