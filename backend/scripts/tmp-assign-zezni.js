const { query } = require('../src/utils/database');

const sql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

WITH app AS (
  SELECT id FROM kodi_apps
  WHERE LOWER(name) = 'csu' OR LOWER(label) = 'csu'
  LIMIT 1
),
page AS (
  SELECT id FROM kodi_pages
  WHERE LOWER(label) LIKE '%sales%'
  LIMIT 1
),
user_row AS (
  SELECT id FROM users
  WHERE id = '6102cefb-fb0f-4a79-b06c-2eca965fc70b'
)
INSERT INTO app_page_mapping (app_id, page_id, nav_label, nav_order, is_default, is_visible)
SELECT app.id, page.id, 'Sales', 1, false, true
FROM app, page
WHERE NOT EXISTS (
  SELECT 1 FROM app_page_mapping m
  WHERE m.app_id = app.id AND m.page_id = page.id
);

WITH app AS (
  SELECT id FROM kodi_apps
  WHERE LOWER(name) = 'csu' OR LOWER(label) = 'csu'
  LIMIT 1
),
user_row AS (
  SELECT id FROM users
  WHERE id = '6102cefb-fb0f-4a79-b06c-2eca965fc70b'
)
INSERT INTO kodi_app_users (app_id, user_id, role_key, status, permissions)
SELECT app.id, user_row.id, 'employee', 'active', '{}'::jsonb
FROM app, user_row
WHERE NOT EXISTS (
  SELECT 1 FROM kodi_app_users u
  WHERE u.app_id = app.id AND u.user_id = user_row.id
);

UPDATE kodi_app_users
SET role_key = 'employee',
    status = 'active',
    permissions = '{}'::jsonb
WHERE app_id IN (SELECT id FROM kodi_apps WHERE LOWER(name) = 'csu' OR LOWER(label) = 'csu')
  AND user_id = '6102cefb-fb0f-4a79-b06c-2eca965fc70b';

UPDATE kodi_portal_identities
SET username = 'zeznidube',
    password_hash = crypt('Omphile725*', gen_salt('bf')),
    first_login_required = false,
    otp_hash = null,
    otp_expires_at = null,
    first_login_token = null,
    first_login_expires_at = null
WHERE user_id = '6102cefb-fb0f-4a79-b06c-2eca965fc70b';

INSERT INTO kodi_portal_identities (user_id, username, password_hash, first_login_required)
SELECT '6102cefb-fb0f-4a79-b06c-2eca965fc70b',
       'zeznidube',
       crypt('Omphile725*', gen_salt('bf')),
       false
WHERE NOT EXISTS (
  SELECT 1 FROM kodi_portal_identities WHERE user_id = '6102cefb-fb0f-4a79-b06c-2eca965fc70b'
);
`;

query(sql)
  .then(() => {
    console.log('SQL applied');
    process.exit(0);
  })
  .catch((err) => {
    console.error('SQL failed:', err);
    process.exit(1);
  });
