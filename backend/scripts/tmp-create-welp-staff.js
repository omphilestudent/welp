const { query } = require('../src/utils/database');

const email = 'kcody7147@gmail.com';
const displayName = 'Cody Mohala';
const password = 'Omphile725*';
const staffRoleKey = 'welp_employee';

const run = async () => {
  try {
    await query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    await query('BEGIN');

    const upsertUserSql = `
      WITH existing_user AS (
        SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1
      ),
      inserted AS (
        INSERT INTO users (email, password_hash, role, is_active, is_verified, status, display_name)
        SELECT $1, crypt($3, gen_salt('bf')), $4, true, true, 'active', $2
        WHERE NOT EXISTS (SELECT 1 FROM existing_user)
        RETURNING id
      )
      SELECT id FROM inserted
      UNION ALL
      SELECT id FROM existing_user
      LIMIT 1;
    `;

    const userResult = await query(upsertUserSql, [email, displayName, password, staffRoleKey]);
    const userId = userResult.rows[0]?.id;
    if (!userId) {
      throw new Error('Unable to resolve user id for staff creation');
    }

    await query(
      `UPDATE users
       SET password_hash = crypt($2, gen_salt('bf')),
           role = $3,
           is_active = true,
           is_verified = true,
           status = 'active',
           display_name = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId, password, staffRoleKey, displayName]
    );

    await query(
      `INSERT INTO welp_staff (user_id, staff_role_key, department, is_active)
       VALUES ($1, $2, null, true)
       ON CONFLICT (user_id) DO UPDATE
       SET staff_role_key = EXCLUDED.staff_role_key,
           department = EXCLUDED.department,
           is_active = EXCLUDED.is_active,
           updated_at = CURRENT_TIMESTAMP`,
      [userId, staffRoleKey]
    );

    await query('COMMIT');
    console.log('Welp staff user upserted');
    process.exit(0);
  } catch (err) {
    try {
      await query('ROLLBACK');
    } catch (_) {
      // ignore rollback errors
    }
    console.error('Failed to create staff user:', err);
    process.exit(1);
  }
};

run();
