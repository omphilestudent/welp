const { query } = require('../src/utils/database');

const run = async () => {
  const sql = `
    INSERT INTO welp_staff (user_id, staff_role_key, department, is_active)
    SELECT u.id,
           CASE
             WHEN u.role = 'super_admin' THEN 'admin'
             WHEN u.role = 'hr_admin' THEN 'hr_admin'
             WHEN u.role = 'admin' THEN 'admin'
             WHEN u.role = 'welp_employee' THEN 'welp_employee'
             ELSE 'welp_employee'
           END AS staff_role_key,
           NULL,
           true
    FROM users u
    WHERE u.role IN ('admin','super_admin','hr_admin','welp_employee')
      AND NOT EXISTS (SELECT 1 FROM welp_staff ws WHERE ws.user_id = u.id);
  `;
  const result = await query(sql);
  console.log('Welp staff backfill rows:', result.rowCount);
  process.exit(0);
};

run().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
