// backend/test-connection.js
const { Pool } = require('pg');
require('dotenv').config();

async function testConnection() {
    console.log('🔍 Testing database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Not set');

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false,
            require: true
        },
        connectionTimeoutMillis: 10000
    });

    try {
        const client = await pool.connect();
        console.log('✅ Connected to database successfully');

        // Test basic query
        const result = await client.query('SELECT NOW() as time');
        console.log('✅ Server time:', result.rows[0].time);

        // Check if job_postings table exists
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'job_postings'
            );
        `);

        console.log('✅ job_postings table exists:', tableCheck.rows[0].exists);

        // If table doesn't exist, create it
        if (!tableCheck.rows[0].exists) {
            console.log('📝 Creating job_postings table...');

            await client.query(`
                CREATE TABLE job_postings (
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
                    requirements JSONB,
                    responsibilities JSONB,
                    benefits JSONB,
                    skills_required JSONB,
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

            console.log('✅ job_postings table created');
        }

        client.release();
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
        console.error('Error code:', err.code);
        if (err.code === '28P01') {
            console.error('❌ Authentication failed - check username/password');
        } else if (err.code === 'ECONNREFUSED') {
            console.error('❌ Connection refused - database may be offline');
        } else if (err.code === 'ETIMEDOUT') {
            console.error('❌ Connection timeout - database may be waking up');
        }
    } finally {
        await pool.end();
    }
}

testConnection();