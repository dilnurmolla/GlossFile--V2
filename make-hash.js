// make-hash.js
const bcrypt = require('bcrypt');

const plain = process.argv[2];

if (!plain) {
  console.log('Kullanım: node make-hash.js Sifrem123');
  process.exit(1);
}

bcrypt
  .hash(plain, 10)
  .then(hash => {
    console.log('Şifre:', plain);
    console.log('Hash  :', hash);
  })
  .catch(console.error);
