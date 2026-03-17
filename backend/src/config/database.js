const { Sequelize } = require('sequelize');
require('dotenv').config();

const buildUrlFromPgEnv = () => {
    const host = process.env.PGHOST || 'localhost';
    const port = process.env.PGPORT || '5432';
    const database = process.env.PGDATABASE || 'postgres';
    const user = process.env.PGUSER || 'postgres';
    const password = process.env.PGPASSWORD || 'postgres';
    const sslmode = process.env.PGSSLMODE || process.env.SSLMODE || '';
    const useLibpq = process.env.USELIBPQCOMPAT || '';
    const channelBinding = process.env.PGCHANNELBINDING || '';

    const params = new URLSearchParams();
    if (sslmode) params.set('sslmode', sslmode);
    if (useLibpq) params.set('uselibpqcompat', 'true');
    if (channelBinding) params.set('channel_binding', channelBinding);

    const query = params.toString();
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}${query ? `?${query}` : ''}`;
};

let databaseUrl = process.env.DATABASE_URL;
let databaseUrlSource = 'DATABASE_URL';
if (!databaseUrl && (process.env.PGHOST || process.env.PGUSER || process.env.PGDATABASE || process.env.PGPASSWORD)) {
    databaseUrl = buildUrlFromPgEnv();
    databaseUrlSource = 'PG* env vars';
}

if (!databaseUrl) {
    console.warn('DATABASE_URL is not set and no PG* env vars were found. Sequelize models may not function correctly.');
} else {
    try {
        const parsed = new URL(databaseUrl);
        console.log(`Database host (${databaseUrlSource}): ${parsed.hostname}:${parsed.port || '5432'} db=${parsed.pathname.replace('/', '') || 'postgres'}`);
    } catch (error) {
        console.warn('DATABASE_URL is set but could not be parsed for logging.');
    }
}

const sequelize = new Sequelize(databaseUrl || 'postgres://postgres:postgres@localhost:5432/postgres', {
    dialect: 'postgres',
    logging: false,
    dialectOptions: process.env.NODE_ENV === 'production'
        ? {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        }
        : {}
});

module.exports = sequelize;

