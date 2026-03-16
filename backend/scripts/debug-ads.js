const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false, require: true } });
  await client.connect();
  const res = await client.query("SELECT id, name, status, review_status, submitted_at FROM advertising_campaigns ORDER BY created_at DESC LIMIT 5");
  console.log(res.rows);
  await client.end();
})();
