// backend/migrate.js
const { Pool } = require('pg');
require('dotenv').config();

async function runMigrations() {
    console.log('🔍 Running database migrations...');

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false,
            require: true
        },
        connectionTimeoutMillis: 30000
    });

    try {
        const client = await pool.connect();
        console.log('✅ Connected to database');

        // Create job_postings table
        await client.query(`
            CREATE TABLE IF NOT EXISTS job_postings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title VARCHAR(255) NOT NULL,
                department_id UUID,
                employment_type VARCHAR(50),
                location VARCHAR(255),
                is_remote BOOLEAN DEFAULT false,
                salary_min NUMERIC,
                salary_max NUMERIC,
                salary_currency VARCHAR(3) DEFAULT 'USD',
                description TEXT,
                requirements JSONB DEFAULT '[]',
                responsibilities JSONB DEFAULT '[]',
                benefits JSONB DEFAULT '[]',
                skills_required JSONB DEFAULT '[]',
                experience_level VARCHAR(50),
                education_required VARCHAR(255),
                application_deadline DATE,
                posted_by UUID,
                status VARCHAR(50) DEFAULT 'draft',
                published_at TIMESTAMP,
                closed_at TIMESTAMP,
                views_count INTEGER DEFAULT 0,
                clicks_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ job_postings table ready');

        // Create departments table
        await client.query(`
            CREATE TABLE IF NOT EXISTS departments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,
                manager_id UUID,
                parent_department_id UUID,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ departments table ready');

        // Insert default departments if none exist
        const deptCheck = await client.query('SELECT COUNT(*) FROM departments');
        if (parseInt(deptCheck.rows[0].count) === 0) {
            await client.query(`
                INSERT INTO departments (id, name, description) VALUES
                    ('11111111-1111-1111-1111-111111111111', 'General', 'General department'),
                    ('22222222-2222-2222-2222-222222222222', 'Engineering', 'Software engineering department'),
                    ('33333333-3333-3333-3333-333333333333', 'Product', 'Product management'),
                    ('44444444-4444-4444-4444-444444444444', 'Design', 'UI/UX design'),
                    ('55555555-5555-5555-5555-555555555555', 'Marketing', 'Marketing and communications'),
                    ('66666666-6666-6666-6666-666666666666', 'Sales', 'Sales department'),
                    ('77777777-7777-7777-7777-777777777777', 'Human Resources', 'HR department'),
                    ('88888888-8888-8888-8888-888888888888', 'Finance', 'Finance department'),
                    ('99999999-9999-9999-9999-999999999999', 'Operations', 'Operations department');
            `);
            console.log('✅ Default departments inserted');
        }

        client.release();
        console.log('✅ All migrations completed successfully');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        console.error('Error code:', err.code);
    } finally {
        await pool.end();
    }
}

runMigrations();