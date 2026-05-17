const { getPool } = require('./src/db');

(async () => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT NOW() AS time');
    console.log('MySQL bağlantısı başarılı! Sunucu saati:', rows[0].time);
  } catch (err) {
    console.error('❌ Bağlantı hatası:', err.message);
  }
})();
