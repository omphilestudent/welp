const { query } = require('../src/utils/database');

const run = async () => {
  const sql = `
    DELETE FROM kodi_app_users au
    USING users u
    WHERE au.user_id = u.id
      AND u.role NOT IN ('admin','super_admin','hr_admin');
  `;
  const result = await query(sql);
  console.log('Removed non-admin app users:', result.rowCount);
  process.exit(0);
};

run().catch((error) => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});
