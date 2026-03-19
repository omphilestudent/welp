const { query } = require('../src/utils/database');

const sql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE users
SET email = 'zeznidube@welp.com',
    password_hash = crypt('Omphile725*', gen_salt('bf'))
WHERE id = '6102cefb-fb0f-4a79-b06c-2eca965fc70b';
`;

query(sql)
  .then(() => {
    console.log('Zezni website login reset applied');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Reset failed:', err);
    process.exit(1);
  });
