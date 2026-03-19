const { query } = require('../src/utils/database');

const run = async () => {
  const row = await query(
    `SELECT id, email, display_name, role, is_active, password_hash
     FROM users
     WHERE id = $1 OR LOWER(email) = $2`,
    ['6102cefb-fb0f-4a79-b06c-2eca965fc70b', 'zeznidube@welp.com']
  );
  console.log(row.rows[0]);
};

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
