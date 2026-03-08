const { Pool } = require('pg');
require('dotenv').config();

// Create pool with better configuration
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
        require: true
    },
    connectionTimeoutMillis: 30000, // Increased to 30 seconds for Neon wake-up
    idleTimeoutMillis: 30000,
    max: 20
});

// Test connection with retry logic
const connectWithRetry = async (retries = 5) => {
    for (let i = 0; i < retries; i++) {
        try {
            const client = await pool.connect();
            console.log('✅ Successfully connected to Neon PostgreSQL database');
            client.release();
            return true;
        } catch (err) {
            console.log(`⚠️ Connection attempt ${i + 1}/${retries} failed: ${err.message}`);
            if (i < retries - 1) {
                console.log('⏳ Waiting 3 seconds before retry...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }
    console.error('❌ Failed to connect to database after multiple attempts');
    console.error('Please check:');
    console.error('1. Your DATABASE_URL in .env file');
    console.error('2. Your internet connection');
    console.error('3. Neon dashboard to ensure database is active');
    return false;
};

// Create tables in correct order with dependencies
const createTables = async () => {
    try {
        // First, test connection with a simple query
        await pool.query('SELECT NOW()');
        console.log('✅ Database connection test successful');

        // Create tables in correct order (companies first, then users)
        const queries = [
            // Enable UUID extension first
            `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`,

            // Companies table (created before users)
            `CREATE TABLE IF NOT EXISTS companies (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL UNIQUE,
                description TEXT,
                industry VARCHAR(100),
                website TEXT,
                email VARCHAR(255),
                phone VARCHAR(50),
                address TEXT,
                logo_url TEXT,
                is_claimed BOOLEAN DEFAULT false,
                created_by_user_id UUID,
                token_version INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,

            // Users table (references companies)
            `CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                email VARCHAR(255) UNIQUE,
                password_hash VARCHAR(255),
                role VARCHAR(50) NOT NULL CHECK (role IN ('employee', 'psychologist', 'business', 'admin')),
                is_anonymous BOOLEAN DEFAULT false,
                display_name VARCHAR(100),
                avatar_url TEXT,
                occupation VARCHAR(255),
                workplace_id UUID REFERENCES companies(id) ON DELETE SET NULL,
                is_verified BOOLEAN DEFAULT false,
                token_version INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,

            // Company owners (after both companies and users)
            `CREATE TABLE IF NOT EXISTS company_owners (
                company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                PRIMARY KEY (company_id, user_id)
            );`,

            // Reviews table
            `CREATE TABLE IF NOT EXISTS reviews (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
                content TEXT NOT NULL,
                is_public BOOLEAN DEFAULT true,
                token_version INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,

            // Replies table
            `CREATE TABLE IF NOT EXISTS replies (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
                author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                author_role VARCHAR(50) NOT NULL,
                content TEXT NOT NULL,
                token_version INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,

            // Conversations table
            `CREATE TABLE IF NOT EXISTS conversations (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked', 'ended')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP,
                rejected_reason TEXT,
                UNIQUE(employee_id, psychologist_id)
            );`,

            // Messages table
            `CREATE TABLE IF NOT EXISTS messages (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                is_read BOOLEAN DEFAULT false,
                is_system_message BOOLEAN DEFAULT false,
                read_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,

            // Claim requests table
            `CREATE TABLE IF NOT EXISTS claim_requests (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                business_email VARCHAR(255) NOT NULL,
                business_phone VARCHAR(50),
                position VARCHAR(100),
                message TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(company_id, user_id)
            );`,

            // Email verifications table
            `CREATE TABLE IF NOT EXISTS email_verifications (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                email VARCHAR(255) NOT NULL,
                code VARCHAR(6) NOT NULL,
                user_id UUID REFERENCES users(id),
                expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '10 minutes',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,

            // Review reports table
            `CREATE TABLE IF NOT EXISTS review_reports (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
                reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
                reason TEXT NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(review_id, reporter_id)
            );`,

            // Add psychologist-specific columns to users
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS specialization TEXT[];`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS years_of_experience INTEGER;`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS consultation_modes TEXT[];`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS languages TEXT[];`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS biography TEXT;`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2);`,

            // Create indexes for better performance
            `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);`,
            `CREATE INDEX IF NOT EXISTS idx_users_workplace ON users(workplace_id);`,
            `CREATE INDEX IF NOT EXISTS idx_users_occupation ON users(occupation);`,
            `CREATE INDEX IF NOT EXISTS idx_reviews_company_id ON reviews(company_id);`,
            `CREATE INDEX IF NOT EXISTS idx_reviews_author_id ON reviews(author_id);`,
            `CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);`,
            `CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);`,
            `CREATE INDEX IF NOT EXISTS idx_conversations_employee ON conversations(employee_id);`,
            `CREATE INDEX IF NOT EXISTS idx_conversations_psychologist ON conversations(psychologist_id);`,
            `CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);`,
            `CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);`,
            `CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(conversation_id, is_read, sender_id);`,
            `CREATE INDEX IF NOT EXISTS idx_claim_requests_status ON claim_requests(status);`,
            `CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);`,
            `CREATE INDEX IF NOT EXISTS idx_review_reports_status ON review_reports(status);`
        ];

        // Execute all queries in sequence
        for (const query of queries) {
            try {
                await pool.query(query);
            } catch (err) {
                // Log but don't stop for non-critical errors
                if (!err.message.includes('already exists')) {
                    console.log(`⚠️ Migration note: ${err.message}`);
                }
            }
        }

        console.log('✅ Database tables initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Error creating tables:', error.message);
        return false;
    }
};

// Run migrations
const runMigrations = async () => {
    try {
        const migrations = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS occupation VARCHAR(255);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS workplace_id UUID REFERENCES companies(id);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 0;",
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_system_message BOOLEAN DEFAULT false;",
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;",
            "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP;",
            "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS rejected_reason TEXT;"
        ];

        for (const migration of migrations) {
            try {
                await pool.query(migration);
                console.log(`✅ Migration applied: ${migration.substring(0, 50)}...`);
            } catch (err) {
                if (!err.message.includes('already exists')) {
                    console.log(`⚠️ Migration note: ${err.message}`);
                }
            }
        }
        console.log('✅ Database migrations completed');
    } catch (error) {
        console.error('❌ Error running migrations:', error.message);
    }
};

// Initialize database with proper sequencing
const initializeDatabase = async () => {
    const connected = await connectWithRetry();

    if (connected) {
        const tablesCreated = await createTables();
        if (tablesCreated) {
            await runMigrations();

            // Create a test user (optional - for development)
            try {
                const bcrypt = require('bcryptjs');
                const testEmail = 'zenzidube@welp.com';
                const testPassword = 'password123';

                // Check if user exists
                const userExists = await pool.query(
                    'SELECT id FROM users WHERE email = $1',
                    [testEmail]
                );

                if (userExists.rows.length === 0) {
                    const hashedPassword = await bcrypt.hash(testPassword, 12);
                    await pool.query(
                        `INSERT INTO users (email, password_hash, role, display_name, is_verified)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [testEmail, hashedPassword, 'user', 'Test User', true]
                    );
                    console.log('✅ Test user created successfully');
                    console.log('📧 Email:', testEmail);
                    console.log('🔑 Password:', testPassword);
                }
            } catch (userError) {
                console.log('⚠️ Test user creation skipped:', userError.message);
            }
        }
    } else {
        console.error('❌ Database initialization failed - server may not function correctly');
    }
};

// Run initialization
initializeDatabase();

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};