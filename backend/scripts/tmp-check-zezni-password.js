const bcrypt = require('bcryptjs');
const { query } = require('../src/utils/database');

const run = async () => {
  const res = await query(
    `SELECT password_hash FROM users WHERE id = $1`,
    ['6102cefb-fb0f-4a79-b06c-2eca965fc70b']
  );
  const hash = res.rows[0]?.password_hash;
  const ok = await bcrypt.compare('Omphile725*', hash || '');
  console.log({ hash, match: ok });
};

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
