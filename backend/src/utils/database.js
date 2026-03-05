
const { Pool } = require('pg');
require('dotenv').config();


const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
        require: true
    },

    connectionTimeoutMillis: 10000,
});


pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
        console.error('Please check your DATABASE_URL in .env file');
        console.error('Make sure you are connected to the internet');
    } else {
        console.log(' Successfully connected to Neon PostgreSQL database');
        release();
    }
});


const createTables = async () => {
    try {

        await pool.query('SELECT NOW()');
        console.log('Database connection test successful');

        const queries = `
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255),
        role VARCHAR(50) NOT NULL CHECK (role IN ('employee', 'psychologist', 'business', 'admin')),
        is_anonymous BOOLEAN DEFAULT false,
        display_name VARCHAR(100),
        avatar_url TEXT,
        occupation VARCHAR(255),
        workplace_id UUID REFERENCES companies(id),
        is_verified BOOLEAN DEFAULT false,
        token_version INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Companies table
      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        industry VARCHAR(100),
        website TEXT,
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        logo_url TEXT,
        is_claimed BOOLEAN DEFAULT false,
        created_by_user_id UUID REFERENCES users(id),
        token_version INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Company owners (business users who own/claim companies)
      CREATE TABLE IF NOT EXISTS company_owners (
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (company_id, user_id)
      );

      -- Reviews table
      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        content TEXT NOT NULL,
        is_public BOOLEAN DEFAULT true,
        token_version INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Replies table (comments and business replies)
      CREATE TABLE IF NOT EXISTS replies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
        author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        author_role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        token_version INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Conversations table (psychologist-employee messaging)
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked', 'ended')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(employee_id, psychologist_id)
      );

      -- Messages table
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        is_system_message BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Claim requests table
      CREATE TABLE IF NOT EXISTS claim_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
      );

      -- Email verifications table
      CREATE TABLE IF NOT EXISTS email_verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        code VARCHAR(6) NOT NULL,
        user_id UUID REFERENCES users(id),
        expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '10 minutes',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Review reports table
      CREATE TABLE IF NOT EXISTS review_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
        reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(review_id, reporter_id)
      );

      -- Psychologist specific fields (if role = 'psychologist')
      ALTER TABLE users ADD COLUMN IF NOT EXISTS specialization TEXT[];
      ALTER TABLE users ADD COLUMN IF NOT EXISTS years_of_experience INTEGER;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS consultation_modes TEXT[];
      ALTER TABLE users ADD COLUMN IF NOT EXISTS languages TEXT[];
      ALTER TABLE users ADD COLUMN IF NOT EXISTS biography TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2);

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_workplace ON users(workplace_id);
      CREATE INDEX IF NOT EXISTS idx_users_occupation ON users(occupation);
      CREATE INDEX IF NOT EXISTS idx_reviews_company_id ON reviews(company_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_author_id ON reviews(author_id);
      CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
      CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);
      CREATE INDEX IF NOT EXISTS idx_conversations_employee ON conversations(employee_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_psychologist ON conversations(psychologist_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(conversation_id, is_read, sender_id);
      CREATE INDEX IF NOT EXISTS idx_claim_requests_status ON claim_requests(status);
      CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
      CREATE INDEX IF NOT EXISTS idx_review_reports_status ON review_reports(status);
    `;

        await pool.query(queries);
        console.log(' Database tables initialized successfully');
    } catch (error) {
        console.error(' Error creating tables:', error.message);
        console.error('Please check your database connection and permissions');
    }
};


createTables();


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
            } catch (err) {

                console.log(`Migration note: ${err.message}`);
            }
        }
        console.log(' Database migrations completed');
    } catch (error) {
        console.error(' Error running migrations:', error.message);
    }
};


setTimeout(() => {
    runMigrations();
}, 1000);

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};