require('dotenv').config();
const { query } = require('./src/utils/database');

const email = process.argv[2];

if (!email) {
    console.error('Usage: node check_user.js <email>');
    process.exit(1);
}

(async () => {
    try {
        const res = await query(
            'SELECT id, email, role, status, is_active, password_hash FROM users WHERE LOWER(email) = LOWER($1)',
            [email]
        );
        console.log(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
})();
