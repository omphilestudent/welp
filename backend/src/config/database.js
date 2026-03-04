const { Sequelize } = require('sequelize');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.warn('DATABASE_URL is not set. Sequelize models may not function correctly.');
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
