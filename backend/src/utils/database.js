// backend/src/utils/database.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for Neon
    }
});

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to database:', err.stack);
    } else {
        console.log('Successfully connected to Neon PostgreSQL database');
        release();
    }
});

// Create tables if they don't exist
const createTables = async () => {
    const queries = `
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE,
      password_hash VARCHAR(255),
      role VARCHAR(50) NOT NULL CHECK (role IN ('employee', 'psychologist', 'business')),
      is_anonymous BOOLEAN DEFAULT false,
      display_name VARCHAR(100),
      avatar_url TEXT,
      is_verified BOOLEAN DEFAULT false,
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Conversations table (psychologist-employee messaging)
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_reviews_company_id ON reviews(company_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_author_id ON reviews(author_id);
    CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
    CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);
    CREATE INDEX IF NOT EXISTS idx_conversations_employee ON conversations(employee_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_psychologist ON conversations(psychologist_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
  `;

    try {
        await pool.query(queries);
        console.log('Database tables initialized successfully');
    } catch (error) {
        console.error('Error creating tables:', error);
    }
};

// Initialize tables
createTables();

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};