const { Pool } = require('pg');
require('dotenv').config();

// ── Connection pool ────────────────────────────────────────────────────────────
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
        require: true
    },
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis:       30000,
    max:                     20,
    min:                     0,   // don't hold idle connections (Neon suspends on inactivity)
});

pool.on('error', (err) => {
    console.error('❌ Unexpected database pool error:', err.message);
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Error connecting to database:', err.message);
        console.error('   → Check your DATABASE_URL in .env');
        console.error('   → Make sure your Neon project is not suspended');
        console.error('   → Verify you are using the POOLED connection string from Neon console');
    } else {
        console.log('✅ Successfully connected to Neon PostgreSQL database');
        release();
    }
});

// ── Table creation ─────────────────────────────────────────────────────────────
const createTables = async () => {
    try {
        await pool.query('SELECT NOW()');
        console.log('✅ Database connection test successful');

        const queries = `
            -- Enable UUID & CITEXT extensions
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
            CREATE EXTENSION IF NOT EXISTS "citext";

            -- Enum helpers for subscriptions
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_tier_user') THEN
                    CREATE TYPE subscription_tier_user AS ENUM ('free', 'premium');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_tier_business') THEN
                    CREATE TYPE subscription_tier_business AS ENUM ('base', 'enhanced', 'premium');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'psychologist_plan') THEN
                    CREATE TYPE psychologist_plan AS ENUM ('standard');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pricing_audience') THEN
                    CREATE TYPE pricing_audience AS ENUM ('user', 'psychologist', 'business');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_owner_type') THEN
                    CREATE TYPE subscription_owner_type AS ENUM ('user', 'psychologist', 'business');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
                    CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'cancelled', 'expired');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_period') THEN
                    CREATE TYPE billing_period AS ENUM ('monthly', 'quarterly', 'annual');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_type') THEN
                    CREATE TYPE media_type AS ENUM ('text', 'voice', 'video', 'image', 'gif');
                END IF;
            END$$;

            -- Companies table (created before users since users reference it)
            CREATE TABLE IF NOT EXISTS companies (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL UNIQUE,
                description TEXT,
                industry VARCHAR(100),
                website TEXT,
                email VARCHAR(255),
                phone VARCHAR(50),
                address TEXT,
                city VARCHAR(100),
                country VARCHAR(100),
                registration_number VARCHAR(100),
                logo_url TEXT,
                is_claimed BOOLEAN DEFAULT false,
                is_verified BOOLEAN DEFAULT false,
                verified_by UUID,
                verified_at TIMESTAMP,
                claimed_by UUID,
                status VARCHAR(50) DEFAULT 'active',
                needs_enrichment BOOLEAN DEFAULT false,
                enrichment_data JSONB,
                created_by_user_id UUID,
                token_version INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Users table
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                public_id VARCHAR(20) UNIQUE DEFAULT ('USR-' || substring(replace(uuid_generate_v4()::text, '-', ''), 1, 12)),
                email VARCHAR(255) UNIQUE,
                password_hash VARCHAR(255),
                role VARCHAR(50) NOT NULL CHECK (role IN ('employee', 'psychologist', 'business', 'admin', 'super_admin', 'hr_admin')),
                is_anonymous BOOLEAN DEFAULT false,
                is_active BOOLEAN DEFAULT true,
                is_verified BOOLEAN DEFAULT false,
                status VARCHAR(50) DEFAULT 'active',
                display_name VARCHAR(100),
                avatar_url TEXT,
                occupation VARCHAR(255),
                workplace_id UUID REFERENCES companies(id) ON DELETE SET NULL,
                token_version INT DEFAULT 0,
                last_login TIMESTAMP,
                last_active TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Pricing & subscription helpers
            CREATE TABLE IF NOT EXISTS currencies (
                code VARCHAR(3) PRIMARY KEY,
                name VARCHAR(64) NOT NULL,
                symbol VARCHAR(8) NOT NULL DEFAULT '$',
                fx_rate_usd NUMERIC(18,6) NOT NULL DEFAULT 1.0,
                purchasing_power_index NUMERIC(6,3) NOT NULL DEFAULT 1.0,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS pricing_catalog (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                audience pricing_audience NOT NULL,
                plan_code VARCHAR(32) NOT NULL,
                plan_tier VARCHAR(24) NOT NULL DEFAULT 'free',
                currency_code VARCHAR(3) NOT NULL REFERENCES currencies(code),
                amount_minor BIGINT NOT NULL,
                billing_period billing_period DEFAULT 'monthly',
                trial_days INT DEFAULT 0,
                is_default BOOLEAN DEFAULT false,
                is_addon BOOLEAN DEFAULT false,
                features JSONB DEFAULT '[]'::jsonb,
                limits JSONB DEFAULT '{}'::jsonb,
                metadata JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (audience, plan_code, currency_code)
            );

            CREATE TABLE IF NOT EXISTS country_pricing (
                country_code CHAR(2) PRIMARY KEY,
                country_name VARCHAR(128) NOT NULL,
                multiplier NUMERIC(6,3) NOT NULL DEFAULT 1.000,
                currency VARCHAR(3) NOT NULL,
                currency_symbol VARCHAR(8) DEFAULT '$',
                is_active BOOLEAN NOT NULL DEFAULT true,
                updated_by UUID,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS subscription_records (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                owner_type subscription_owner_type NOT NULL,
                owner_id UUID NOT NULL,
                plan_code VARCHAR(32) NOT NULL,
                currency_code VARCHAR(3) NOT NULL REFERENCES currencies(code),
                amount_minor BIGINT NOT NULL,
                billing_period billing_period DEFAULT 'monthly',
                status subscription_status DEFAULT 'active',
                trial_days INT DEFAULT 0,
                starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
                ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
                cancelled_at TIMESTAMP WITH TIME ZONE,
                metadata JSONB DEFAULT '{}'::jsonb,
                feature_snapshot JSONB DEFAULT '[]'::jsonb,
                limit_snapshot JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS payment_records (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                subscription_id UUID REFERENCES subscription_records(id) ON DELETE SET NULL,
                owner_type VARCHAR(32) NOT NULL,
                owner_id UUID NOT NULL,
                gateway VARCHAR(32) DEFAULT 'stripe',
                gateway_reference VARCHAR(128),
                currency_code VARCHAR(3) NOT NULL,
                amount_minor BIGINT NOT NULL,
                status VARCHAR(32) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
                invoice_url TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS chat_quota_usage (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                quota_date DATE NOT NULL,
                used_minutes INT DEFAULT 0,
                max_minutes INT DEFAULT 30,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (user_id, quota_date)
            );

            -- Departments table (for HR module)
            CREATE TABLE IF NOT EXISTS departments (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,
                manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
                parent_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Job Postings table
            -- status includes both 'open' and 'published' so the frontend filter
            -- and resolveJobStatus() helper always have a valid value to insert.
            CREATE TABLE IF NOT EXISTS job_postings (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                title VARCHAR(255) NOT NULL,
                department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
                employment_type VARCHAR(50) CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'internship', 'remote')),
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
                posted_by UUID REFERENCES users(id) ON DELETE SET NULL,
                status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'published', 'closed')),
                published_at TIMESTAMP,
                closed_at TIMESTAMP,
                views_count INTEGER DEFAULT 0,
                clicks_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Job Applications table
            CREATE TABLE IF NOT EXISTS job_applications (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                job_id UUID REFERENCES job_postings(id) ON DELETE CASCADE,
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                email VARCHAR(255),
                phone VARCHAR(50),
                resume_url TEXT,
                cover_letter TEXT,
                linkedin_url TEXT,
                github_url TEXT,
                portfolio_url TEXT,
                years_experience INTEGER,
                current_company VARCHAR(255),
                current_position VARCHAR(255),
                skills JSONB DEFAULT '[]',
                salary_expectation VARCHAR(100),
                available_start_date DATE,
                work_authorization VARCHAR(100),
                remote_preference VARCHAR(50),
                status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'shortlisted', 'interviewed', 'hired', 'rejected')),
                notes TEXT,
                reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
                reviewed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Interviews table
            CREATE TABLE IF NOT EXISTS interviews (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                application_id UUID REFERENCES job_applications(id) ON DELETE CASCADE,
                interviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
                interview_type VARCHAR(50) CHECK (interview_type IN ('phone', 'video', 'in-person', 'technical', 'hr')),
                scheduled_at TIMESTAMP,
                duration_minutes INTEGER,
                location TEXT,
                meeting_link TEXT,
                feedback TEXT,
                rating INTEGER CHECK (rating >= 1 AND rating <= 5),
                recommended_for_next BOOLEAN,
                status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Employee Relations table
            CREATE TABLE IF NOT EXISTS employee_relations (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                employee_id UUID REFERENCES users(id) ON DELETE CASCADE,
                hr_representative_id UUID REFERENCES users(id) ON DELETE SET NULL,
                issue_type VARCHAR(100),
                priority VARCHAR(50) CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
                subject TEXT,
                description TEXT,
                status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'resolved', 'closed')),
                resolution TEXT,
                resolved_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Employee Documents table
            CREATE TABLE IF NOT EXISTS employee_documents (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                employee_id UUID REFERENCES users(id) ON DELETE CASCADE,
                document_type VARCHAR(100),
                title TEXT,
                description TEXT,
                file_url TEXT,
                is_confidential BOOLEAN DEFAULT false,
                uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Performance Reviews table
            CREATE TABLE IF NOT EXISTS performance_reviews (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                employee_id UUID REFERENCES users(id) ON DELETE CASCADE,
                reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
                review_period VARCHAR(50),
                review_date DATE,
                goals JSONB,
                strengths JSONB,
                areas_for_improvement JSONB,
                overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
                comments TEXT,
                employee_acknowledged BOOLEAN DEFAULT false,
                employee_acknowledged_at TIMESTAMP,
                status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'acknowledged')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Company owners
            CREATE TABLE IF NOT EXISTS company_owners (
                company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                PRIMARY KEY (company_id, user_id)
            );

            -- Reviews table
            CREATE TABLE IF NOT EXISTS reviews (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
                content TEXT NOT NULL,
                is_public BOOLEAN DEFAULT true,
                is_anonymous BOOLEAN DEFAULT false,
                moderated_by UUID REFERENCES users(id),
                moderated_at TIMESTAMP,
                moderation_reason TEXT,
                is_flagged BOOLEAN DEFAULT false,
                flagged_by UUID REFERENCES users(id),
                flagged_at TIMESTAMP,
                flag_reason TEXT,
                notification_status VARCHAR(32) DEFAULT 'pending',
                notification_notes TEXT,
                notification_last_sent_at TIMESTAMP,
                token_version INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS review_notification_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
                company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                email_to TEXT NOT NULL,
                cc JSONB DEFAULT '[]'::jsonb,
                subject TEXT NOT NULL,
                status VARCHAR(32) NOT NULL DEFAULT 'pending',
                error TEXT,
                metadata JSONB DEFAULT '{}'::jsonb,
                triggered_by UUID REFERENCES users(id),
                trigger_source VARCHAR(32) DEFAULT 'system',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- Replies table
            CREATE TABLE IF NOT EXISTS replies (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
                author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                author_role VARCHAR(50) NOT NULL,
                content TEXT NOT NULL,
                token_version INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Conversations table
            CREATE TABLE IF NOT EXISTS conversations (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                time_limit_minutes INT DEFAULT 120,
                started_at TIMESTAMP,
                expires_at TIMESTAMP,
                status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked', 'ended')),
                ended_at TIMESTAMP,
                rejected_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(employee_id, psychologist_id)
            );

            -- Messages table
            CREATE TABLE IF NOT EXISTS messages (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                is_read BOOLEAN DEFAULT false,
                is_system_message BOOLEAN DEFAULT false,
                read_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Psychologist schedule items
            CREATE TABLE IF NOT EXISTS psychologist_schedule_items (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                scheduled_for TIMESTAMP NOT NULL,
                type VARCHAR(50) DEFAULT 'meeting',
                status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
                location TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Business API keys for CRM integrations
            CREATE TABLE IF NOT EXISTS business_api_keys (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
                created_by UUID REFERENCES users(id) ON DELETE SET NULL,
                name VARCHAR(100),
                key_prefix VARCHAR(12) NOT NULL,
                key_hash TEXT NOT NULL,
                last_used_at TIMESTAMP,
                revoked_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Psychologist leads
            CREATE TABLE IF NOT EXISTS psychologist_leads (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
                display_name VARCHAR(120) NOT NULL,
                risk_level VARCHAR(20) DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
                summary TEXT,
                company VARCHAR(255),
                source_review_id UUID REFERENCES reviews(id),
                status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'review', 'contacted', 'archived')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Psychologist lead messages
            CREATE TABLE IF NOT EXISTS psychologist_lead_messages (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                lead_id UUID NOT NULL REFERENCES psychologist_leads(id) ON DELETE CASCADE,
                psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Psychologist favorites
            CREATE TABLE IF NOT EXISTS psychologist_favorites (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
                display_name VARCHAR(120) NOT NULL,
                notes TEXT,
                last_session TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(psychologist_id, employee_id)
            );

            -- Employee saved psychologists
            CREATE TABLE IF NOT EXISTS employee_psychologist_favorites (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(employee_id, psychologist_id)
            );

            -- Claim requests table
            CREATE TABLE IF NOT EXISTS claim_requests (
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
            );

            -- Ticketing system
            CREATE TABLE IF NOT EXISTS tickets (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                ticket_number VARCHAR(40) UNIQUE NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
                priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
                category VARCHAR(120),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS ticket_history (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
                action VARCHAR(32) NOT NULL CHECK (action IN ('created','updated','assigned','status_changed','comment_added','email_failed')),
                performed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS ticket_access (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(ticket_id, user_id)
            );

            -- KP/KC Kodi core tables
            CREATE TABLE IF NOT EXISTS kodi_client_applications (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                client_name VARCHAR(255) NOT NULL,
                submitted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                documents JSONB DEFAULT '[]'::jsonb,
                approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS kodi_cases (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                client_application_id UUID REFERENCES kodi_client_applications(id) ON DELETE SET NULL,
                status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open','escalated','resolved')),
                priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS kodi_ads (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                submitted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','reviewed','approved','rejected')),
                content JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS kodi_components (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                component_name VARCHAR(120) UNIQUE NOT NULL,
                component_type VARCHAR(20) NOT NULL CHECK (component_type IN ('custom_page','custom_widget','custom_email')),
                code TEXT NOT NULL,
                created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                version INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS kodi_audit_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                entity_type VARCHAR(50) NOT NULL,
                entity_id UUID,
                action VARCHAR(50) NOT NULL,
                performed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Email verifications table
            CREATE TABLE IF NOT EXISTS email_verifications (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                email VARCHAR(255) NOT NULL,
                code VARCHAR(6) NOT NULL,
                user_id UUID REFERENCES users(id),
                expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '10 minutes',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Review reports table
            CREATE TABLE IF NOT EXISTS review_reports (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
                reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
                reason TEXT NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(review_id, reporter_id)
            );

            -- Admin roles table
            CREATE TABLE IF NOT EXISTS admin_roles (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(50) UNIQUE NOT NULL,
                description TEXT,
                permissions JSONB DEFAULT '[]',
                is_system_role BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Admin users table
            CREATE TABLE IF NOT EXISTS admin_users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                role_id UUID REFERENCES admin_roles(id),
                permissions JSONB DEFAULT '{}',
                is_active BOOLEAN DEFAULT true,
                employee_id VARCHAR(50),
                department VARCHAR(100),
                start_date DATE,
                employment_type VARCHAR(50),
                contact_number VARCHAR(50),
                emergency_contact JSONB,
                salary NUMERIC,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- User roles (RBAC)
            CREATE TABLE IF NOT EXISTS user_roles (
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                role_id UUID REFERENCES admin_roles(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, role_id)
            );

            -- Psychologist applications
            CREATE TABLE IF NOT EXISTS psychologist_applications (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(50) DEFAULT 'pending',
                license_number VARCHAR(100),
                license_body VARCHAR(255),
                license_expiry DATE,
                years_experience INTEGER,
                qualifications TEXT,
                specialisations JSONB,
                therapy_types JSONB,
                session_formats JSONB,
                languages TEXT,
                practice_location TEXT,
                bio TEXT,
                website TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Business applications
            CREATE TABLE IF NOT EXISTS business_applications (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(50) DEFAULT 'pending',
                company_name VARCHAR(255),
                job_title VARCHAR(100),
                company_website TEXT,
                industry VARCHAR(100),
                company_size VARCHAR(50),
                country VARCHAR(100),
                company_description TEXT,
                linkedin_url TEXT,
                registration_number VARCHAR(100),
                claim_existing_profile BOOLEAN DEFAULT false,
                claim_company_id UUID REFERENCES companies(id),
                contact_information JSONB,
                how_did_you_hear TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Psychologist-specific user columns
            ALTER TABLE users ADD COLUMN IF NOT EXISTS specialization TEXT[];
            ALTER TABLE users ADD COLUMN IF NOT EXISTS years_of_experience INTEGER;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS consultation_modes TEXT[];
            ALTER TABLE users ADD COLUMN IF NOT EXISTS languages TEXT[];
            ALTER TABLE users ADD COLUMN IF NOT EXISTS biography TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(32) DEFAULT 'not_submitted';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS documents_submitted BOOLEAN DEFAULT false;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS can_use_profile BOOLEAN DEFAULT true;

            -- HR MVP tables
            CREATE TABLE IF NOT EXISTS employees (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                department VARCHAR(100),
                job_title VARCHAR(100),
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS leaves (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
                type VARCHAR(20) DEFAULT 'other',
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS documents (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                file_url TEXT NOT NULL,
                type VARCHAR(20) DEFAULT 'other',
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS onboarding_tasks (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
                task_name VARCHAR(255) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                due_date DATE
            );

            CREATE TABLE IF NOT EXISTS hr_settings (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                leave_types JSONB DEFAULT '["annual","sick","other"]'::jsonb,
                approval_rules JSONB DEFAULT '{}'::jsonb,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE business_applications ADD COLUMN IF NOT EXISTS claim_company_id UUID REFERENCES companies(id);

            ALTER TABLE psychologist_applications
                ADD COLUMN IF NOT EXISTS email VARCHAR(255),
                ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
                ADD COLUMN IF NOT EXISTS license_issuing_body VARCHAR(255),
                ADD COLUMN IF NOT EXISTS years_of_experience INTEGER,
                ADD COLUMN IF NOT EXISTS specialization TEXT[],
                ADD COLUMN IF NOT EXISTS biography TEXT,
                ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50),
                ADD COLUMN IF NOT EXISTS address TEXT,
                ADD COLUMN IF NOT EXISTS linkedin VARCHAR(255),
                ADD COLUMN IF NOT EXISTS consultation_modes TEXT[],
                ADD COLUMN IF NOT EXISTS accepted_age_groups TEXT[],
                ADD COLUMN IF NOT EXISTS emergency_contact JSONB,
                ADD COLUMN IF NOT EXISTS avatar_url TEXT,
                ADD COLUMN IF NOT EXISTS documents JSONB,
                ADD COLUMN IF NOT EXISTS document_verified BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS document_verified_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS document_verified_by UUID REFERENCES users(id),
                ADD COLUMN IF NOT EXISTS document_notes TEXT,
                ADD COLUMN IF NOT EXISTS ownership_verified BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS ownership_verified_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS ownership_verified_by UUID REFERENCES users(id),
                ADD COLUMN IF NOT EXISTS ownership_notes TEXT,
                ADD COLUMN IF NOT EXISTS experience_verified BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS experience_verified_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS experience_verified_by UUID REFERENCES users(id),
                ADD COLUMN IF NOT EXISTS experience_notes TEXT,
                ADD COLUMN IF NOT EXISTS experience_details JSONB,
                ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(32) DEFAULT 'not_submitted',
                ADD COLUMN IF NOT EXISTS documents_submitted BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS can_use_profile BOOLEAN DEFAULT false,
                ALTER COLUMN status SET DEFAULT 'pending_review';

            ALTER TABLE business_applications
                ADD COLUMN IF NOT EXISTS documents JSONB,
                ADD COLUMN IF NOT EXISTS document_verified BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS document_verified_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS document_verified_by UUID REFERENCES users(id),
                ADD COLUMN IF NOT EXISTS document_notes TEXT,
                ADD COLUMN IF NOT EXISTS ownership_verified BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS ownership_verified_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS ownership_verified_by UUID REFERENCES users(id),
                ADD COLUMN IF NOT EXISTS ownership_notes TEXT,
                ADD COLUMN IF NOT EXISTS contact_information JSONB,
                ADD COLUMN IF NOT EXISTS ownership_evidence JSONB,
                ALTER COLUMN status SET DEFAULT 'pending_review';

            ALTER TABLE claim_requests
                ADD COLUMN IF NOT EXISTS documents JSONB,
                ADD COLUMN IF NOT EXISTS document_verified BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS document_verified_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS document_verified_by UUID REFERENCES users(id),
                ADD COLUMN IF NOT EXISTS document_notes TEXT,
                ADD COLUMN IF NOT EXISTS ownership_verified BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS ownership_verified_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS ownership_verified_by UUID REFERENCES users(id),
                ADD COLUMN IF NOT EXISTS ownership_notes TEXT,
                ALTER COLUMN status SET DEFAULT 'pending_review';

            -- Indexes
            CREATE INDEX IF NOT EXISTS idx_users_role                       ON users(role);
            CREATE INDEX IF NOT EXISTS idx_users_email                      ON users(email);
            CREATE INDEX IF NOT EXISTS idx_users_workplace                  ON users(workplace_id);
            CREATE INDEX IF NOT EXISTS idx_reviews_company_id               ON reviews(company_id);
            CREATE INDEX IF NOT EXISTS idx_reviews_author_id                ON reviews(author_id);
            CREATE INDEX IF NOT EXISTS idx_companies_name                   ON companies(name);
            CREATE INDEX IF NOT EXISTS idx_companies_industry               ON companies(industry);
            CREATE INDEX IF NOT EXISTS idx_conversations_employee           ON conversations(employee_id);
            CREATE INDEX IF NOT EXISTS idx_conversations_psychologist       ON conversations(psychologist_id);
            CREATE INDEX IF NOT EXISTS idx_conversations_status             ON conversations(status);
            CREATE INDEX IF NOT EXISTS idx_messages_conversation            ON messages(conversation_id);
            CREATE INDEX IF NOT EXISTS idx_messages_read                    ON messages(conversation_id, is_read, sender_id);
            CREATE INDEX IF NOT EXISTS idx_claim_requests_status            ON claim_requests(status);
            CREATE INDEX IF NOT EXISTS idx_email_verifications_email        ON email_verifications(email);
            CREATE INDEX IF NOT EXISTS idx_review_reports_status            ON review_reports(status);
            CREATE INDEX IF NOT EXISTS idx_job_postings_department          ON job_postings(department_id);
            CREATE INDEX IF NOT EXISTS idx_job_postings_status              ON job_postings(status);
            CREATE INDEX IF NOT EXISTS idx_job_postings_posted_by           ON job_postings(posted_by);
            CREATE INDEX IF NOT EXISTS idx_job_applications_job_id          ON job_applications(job_id);
            CREATE INDEX IF NOT EXISTS idx_job_applications_status          ON job_applications(status);
            CREATE INDEX IF NOT EXISTS idx_interviews_application_id        ON interviews(application_id);
            CREATE INDEX IF NOT EXISTS idx_interviews_scheduled_at          ON interviews(scheduled_at);
            CREATE INDEX IF NOT EXISTS idx_employees_user_id                ON employees(user_id);
            CREATE INDEX IF NOT EXISTS idx_employees_status                 ON employees(status);
            CREATE INDEX IF NOT EXISTS idx_leaves_employee_id               ON leaves(employee_id);
            CREATE INDEX IF NOT EXISTS idx_leaves_status                    ON leaves(status);
            CREATE INDEX IF NOT EXISTS idx_documents_employee_id            ON documents(employee_id);
            CREATE INDEX IF NOT EXISTS idx_onboarding_employee_id           ON onboarding_tasks(employee_id);
            CREATE INDEX IF NOT EXISTS idx_employee_relations_employee_id   ON employee_relations(employee_id);
            CREATE INDEX IF NOT EXISTS idx_employee_relations_status        ON employee_relations(status);
            CREATE INDEX IF NOT EXISTS idx_employee_documents_employee_id   ON employee_documents(employee_id);
            CREATE INDEX IF NOT EXISTS idx_performance_reviews_employee_id  ON performance_reviews(employee_id);
            CREATE INDEX IF NOT EXISTS idx_conversations_expires_at        ON conversations(expires_at);
            CREATE INDEX IF NOT EXISTS idx_conversations_started_at        ON conversations(started_at);
            CREATE INDEX IF NOT EXISTS idx_psych_schedule_psychologist      ON psychologist_schedule_items(psychologist_id);
            CREATE INDEX IF NOT EXISTS idx_psych_leads_psychologist         ON psychologist_leads(psychologist_id);
            CREATE INDEX IF NOT EXISTS idx_psych_leads_status               ON psychologist_leads(status);
            CREATE UNIQUE INDEX IF NOT EXISTS ux_psych_leads_source_review ON psychologist_leads(psychologist_id, source_review_id) WHERE source_review_id IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_psych_favorites_psychologist     ON psychologist_favorites(psychologist_id);
            CREATE INDEX IF NOT EXISTS idx_employee_favorites_employee     ON employee_psychologist_favorites(employee_id);
            CREATE INDEX IF NOT EXISTS idx_employee_favorites_psychologist ON employee_psychologist_favorites(psychologist_id);
            CREATE INDEX IF NOT EXISTS idx_tickets_status                  ON tickets(status);
            CREATE INDEX IF NOT EXISTS idx_tickets_priority                ON tickets(priority);
            CREATE INDEX IF NOT EXISTS idx_tickets_created_by              ON tickets(created_by_user_id);
            CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to             ON tickets(assigned_to_user_id);
            CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket           ON ticket_history(ticket_id);
            CREATE INDEX IF NOT EXISTS idx_kodi_apps_status                ON kodi_client_applications(approval_status);
            CREATE INDEX IF NOT EXISTS idx_kodi_cases_status               ON kodi_cases(status);
            CREATE INDEX IF NOT EXISTS idx_kodi_cases_priority             ON kodi_cases(priority);
            CREATE INDEX IF NOT EXISTS idx_kodi_ads_status                 ON kodi_ads(status);
            CREATE INDEX IF NOT EXISTS idx_kodi_components_type            ON kodi_components(component_type);
            CREATE INDEX IF NOT EXISTS idx_kodi_audit_entity               ON kodi_audit_logs(entity_type, entity_id);
        `;

        await pool.query(queries);
        console.log('✅ Database tables initialized successfully');
    } catch (error) {
        console.error('❌ Error creating tables:', error.message);
        console.error('   Check your database connection and permissions');
    }
};

// ── Default seed data ──────────────────────────────────────────────────────────
const insertDefaultData = async () => {
        try {
            await pool.query(`
            INSERT INTO admin_roles (name, description, is_system_role, permissions)
            VALUES
                ('super_admin', 'Full system access',     true, '{"all": true}'::jsonb),
                ('admin',       'Administrative access',  true, '{"users": true, "companies": true, "reviews": true}'::jsonb),
                ('hr_admin',    'HR access',               true, '{"jobs": true, "applications": true, "employees": true}'::jsonb)
            ON CONFLICT (name) DO NOTHING;
        `);

        await pool.query(`
            INSERT INTO currencies (code, name, symbol, fx_rate_usd, purchasing_power_index)
            VALUES
                ('USD', 'US Dollar', '$', 1.0, 1.0),
                ('EUR', 'Euro', '€', 1.086957, 0.95),
                ('GBP', 'British Pound', '£', 1.265823, 0.95),
                ('CAD', 'Canadian Dollar', 'C$', 0.740741, 0.95),
                ('AUD', 'Australian Dollar', 'A$', 0.657895, 0.9),
                ('NZD', 'New Zealand Dollar', 'NZ$', 0.609756, 0.85),
                ('CHF', 'Swiss Franc', 'Fr', 1.123596, 1.05),
                ('JPY', 'Japanese Yen', '¥', 0.006667, 0.95),
                ('INR', 'Indian Rupee', '₹', 0.012048, 0.4),
                ('ZAR', 'South African Rand', 'R', 0.054054, 0.78),
                ('CNY', 'Chinese Yuan', '¥', 0.138889, 0.6),
                ('NGN', 'Nigerian Naira', '₦', 0.000667, 0.35),
                ('KES', 'Kenyan Shilling', 'KSh', 0.006897, 0.35),
                ('BRL', 'Brazilian Real', 'R$', 0.19802, 0.6),
                ('MXN', 'Mexican Peso', '$', 0.058824, 0.7),
                ('SGD', 'Singapore Dollar', 'S$', 0.740741, 0.9),
                ('SEK', 'Swedish Krona', 'kr', 0.095238, 0.95),
                ('NOK', 'Norwegian Krone', 'kr', 0.093458, 0.95),
                ('DKK', 'Danish Krone', 'kr', 0.144928, 0.95),
                ('PLN', 'Polish Zloty', 'zł', 0.25, 0.9),
                ('CZK', 'Czech Koruna', 'Kč', 0.043478, 0.9),
                ('HUF', 'Hungarian Forint', 'Ft', 0.002778, 0.8),
                ('ILS', 'Israeli Shekel', '₪', 0.27027, 0.95),
                ('AED', 'UAE Dirham', 'د.إ', 0.27248, 0.9),
                ('SAR', 'Saudi Riyal', '﷼', 0.266667, 0.9),
                ('TRY', 'Turkish Lira', '₺', 0.03125, 0.6),
                ('KRW', 'South Korean Won', '₩', 0.000741, 0.9),
                ('IDR', 'Indonesian Rupiah', 'Rp', 0.000064, 0.4),
                ('MYR', 'Malaysian Ringgit', 'RM', 0.210526, 0.5),
                ('THB', 'Thai Baht', '฿', 0.027778, 0.5),
                ('VND', 'Vietnamese Dong', '₫', 0.00004, 0.35),
                ('PHP', 'Philippine Peso', '₱', 0.017857, 0.4),
                ('EGP', 'Egyptian Pound', 'E£', 0.021277, 0.4),
                ('MAD', 'Moroccan Dirham', 'MAD', 0.09901, 0.5),
                ('GHS', 'Ghanaian Cedi', 'GH₵', 0.074074, 0.35),
                ('TZS', 'Tanzanian Shilling', 'TSh', 0.000392, 0.35),
                ('UGX', 'Ugandan Shilling', 'USh', 0.00026, 0.35),
                ('ARS', 'Argentine Peso', '$', 0.001176, 0.35),
                ('CLP', 'Chilean Peso', '$', 0.001053, 0.6),
                ('COP', 'Colombian Peso', '$', 0.000256, 0.45),
                ('PEN', 'Peruvian Sol', 'S/', 0.266667, 0.5),
                ('QAR', 'Qatari Riyal', 'ر.ق', 0.274725, 0.95),
                ('KWD', 'Kuwaiti Dinar', 'د.ك', 3.225806, 1.05)
            ON CONFLICT (code) DO UPDATE
            SET name = EXCLUDED.name,
                symbol = EXCLUDED.symbol,
                fx_rate_usd = EXCLUDED.fx_rate_usd,
                purchasing_power_index = EXCLUDED.purchasing_power_index,
                updated_at = CURRENT_TIMESTAMP;
        `);

        await pool.query(`
            INSERT INTO pricing_catalog (audience, plan_code, plan_tier, currency_code, amount_minor, billing_period, is_default, features, limits, metadata)
            VALUES
                ('user', 'user_free', 'free', 'ZAR', 0, 'monthly', true,
                    '["30 minutes psychologist chat per day","Unlimited business reviews","Random psychologist assignment","No video call discounts"]'::jsonb,
                    '{"chat":{"minutesPerDay":30},"perks":{"choosePsychologist":false}}'::jsonb,
                    '{"displayName":"Free","tagline":"Start your wellbeing journey","badge":"Most popular free"}'::jsonb
                ),
                ('user', 'user_premium', 'premium', 'ZAR', 15000, 'monthly', false,
                    '["Priority psychologist access","Unlimited chat support","Video/voice scheduling","Weekly wellbeing reports","Crisis escalation hotline"]'::jsonb,
                    '{"chat":{"minutesPerDay":120},"call":{"minutesPerDay":120},"video":{"sessionsPerWeek":3,"minutesPerSession":60,"discount":20}}'::jsonb,
                    '{"displayName":"Premium","tagline":"Full access to therapists","badge":"Best value"}'::jsonb
                ),
                ('psychologist', 'psychologist_standard', 'premium', 'ZAR', 50000, 'monthly', true,
                    '["Verified badge","Unlimited lead inbox","Analytics dashboard","Calendar sync & scheduling","Payment processing","Priority marketplace placement"]'::jsonb,
                    '{"leads":{"perMonth":30},"clients":{"activeConversations":50}}'::jsonb,
                    '{"displayName":"Psychologist Partner","tagline":"Grow your impact","badge":"Professional"}'::jsonb
                ),
                ('business', 'business_base', 'base', 'ZAR', 100000, 'monthly', true,
                    '["Business profile access","Respond to reviews","Basic analytics","1,000 API calls per day"]'::jsonb,
                    '{"api":{"callsPerDay":1000},"ads":{"maxActive":1,"analytics":"limited","placement":"Business profile placements"},"analytics":{"level":"basic"}}'::jsonb,
                    '{"displayName":"Business Base","tagline":"Get started with insights"}'::jsonb
                ),
                ('business', 'business_enhanced', 'enhanced', 'ZAR', 200000, 'monthly', false,
                    '["Expanded analytics","Marketing insights","3,000 API calls per day","Upload promotional media"]'::jsonb,
                    '{"api":{"callsPerDay":3000},"ads":{"maxActive":5,"analytics":"standard","placement":"Expanded placements"},"analytics":{"level":"expanded"}}'::jsonb,
                    '{"displayName":"Business Enhanced","tagline":"Scale your analytics"}'::jsonb
                ),
                ('business', 'business_premium', 'premium', 'ZAR', 300000, 'monthly', false,
                    '["Advanced analytics","Email insights on user behavior","10,000 API calls per day","Advertisement capabilities","Ability to advertise on other business pages"]'::jsonb,
                    '{"api":{"callsPerDay":10000},"ads":{"maxActive":null,"analytics":"advanced","placement":"Competitor profiles","sponsoredPlacements":true},"email":{"insights":true}}'::jsonb,
                    '{"displayName":"Business Premium","tagline":"Own your reputation","badge":"Enterprise"}'::jsonb
                )
            ON CONFLICT (audience, plan_code, currency_code)
            DO UPDATE SET
                plan_tier = EXCLUDED.plan_tier,
                amount_minor = EXCLUDED.amount_minor,
                features = EXCLUDED.features::jsonb,
                limits = EXCLUDED.limits::jsonb,
                metadata = EXCLUDED.metadata::jsonb,
                updated_at = CURRENT_TIMESTAMP;
        `);

        await pool.query(`
            INSERT INTO departments (id, name, description) VALUES
                ('11111111-1111-1111-1111-111111111111', 'General',          'General department'),
                ('22222222-2222-2222-2222-222222222222', 'Engineering',      'Software engineering department'),
                ('33333333-3333-3333-3333-333333333333', 'Product',          'Product management'),
                ('44444444-4444-4444-4444-444444444444', 'Design',           'UI/UX design'),
                ('55555555-5555-5555-5555-555555555555', 'Marketing',        'Marketing and communications'),
                ('66666666-6666-6666-6666-666666666666', 'Sales',            'Sales department'),
                ('77777777-7777-7777-7777-777777777777', 'Human Resources',  'HR department'),
                ('88888888-8888-8888-8888-888888888888', 'Finance',          'Finance department'),
                ('99999999-9999-9999-9999-999999999999', 'Operations',       'Operations department')
            ON CONFLICT (name) DO NOTHING;
        `);

        console.log('✅ Default data inserted successfully');
    } catch (error) {
        console.error('❌ Error inserting default data:', error.message);
    }
};

// ── Migrations ─────────────────────────────────────────────────────────────────
const runMigrations = async () => {
    try {
        const migrations = [
            `CREATE TABLE IF NOT EXISTS system_settings (
                key VARCHAR(120) PRIMARY KEY,
                value JSONB,
                updated_by UUID,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            // Currency table hardening (backfill legacy columns)
            "ALTER TABLE currencies ADD COLUMN IF NOT EXISTS symbol VARCHAR(8) NOT NULL DEFAULT '$';",
            "ALTER TABLE currencies ALTER COLUMN symbol SET DEFAULT '$';",
            "ALTER TABLE currencies ADD COLUMN IF NOT EXISTS fx_rate_usd NUMERIC(18,6) NOT NULL DEFAULT 1.0;",
            "ALTER TABLE currencies ADD COLUMN IF NOT EXISTS purchasing_power_index NUMERIC(6,3) NOT NULL DEFAULT 1.0;",
            "ALTER TABLE currencies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;",

            // Ensure pricing_catalog includes plan metadata
            "ALTER TABLE pricing_catalog ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(24) NOT NULL DEFAULT 'free';",
            "ALTER TABLE pricing_catalog ALTER COLUMN plan_tier SET DEFAULT 'free';",
            "ALTER TABLE pricing_catalog ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '[]'::jsonb;",
            "ALTER TABLE pricing_catalog ALTER COLUMN features SET DEFAULT '[]'::jsonb;",
            "ALTER TABLE pricing_catalog ADD COLUMN IF NOT EXISTS limits JSONB NOT NULL DEFAULT '{}'::jsonb;",
            "ALTER TABLE pricing_catalog ALTER COLUMN limits SET DEFAULT '{}'::jsonb;",
            // Subscription record compatibility columns
            "ALTER TABLE subscription_records ADD COLUMN IF NOT EXISTS trial_days INT DEFAULT 0;",
            "ALTER TABLE subscription_records ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;",
            "ALTER TABLE subscription_records ADD COLUMN IF NOT EXISTS feature_snapshot JSONB DEFAULT '[]'::jsonb;",
            "ALTER TABLE subscription_records ALTER COLUMN feature_snapshot SET DEFAULT '[]'::jsonb;",
            "ALTER TABLE subscription_records ADD COLUMN IF NOT EXISTS limit_snapshot JSONB DEFAULT '{}'::jsonb;",
            "ALTER TABLE subscription_records ALTER COLUMN limit_snapshot SET DEFAULT '{}'::jsonb;",
            "ALTER TABLE subscription_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;",
            "ALTER TABLE subscription_records ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;",

            // Audit log enrichment columns
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES users(id) ON DELETE SET NULL;",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_role VARCHAR(32);",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type VARCHAR(64);",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id UUID;",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_values JSONB;",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_values JSONB;",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;",
            "ALTER TABLE audit_logs ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(64);",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;",
            "ALTER TABLE audit_logs ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;",

            // Companies
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS country VARCHAR(100);",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS city VARCHAR(100);",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100);",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS needs_enrichment BOOLEAN DEFAULT false;",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS enrichment_data JSONB;",
            "UPDATE companies SET needs_enrichment = false WHERE needs_enrichment IS NULL;",

            // Users
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS occupation VARCHAR(255);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS workplace_id UUID REFERENCES companies(id);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 0;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMP;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';",
            `DO $$
             DECLARE
                 con_name text;
                 con_def  text;
             BEGIN
                 SELECT conname, pg_get_constraintdef(oid)
                 INTO   con_name, con_def
                 FROM   pg_constraint
                 WHERE  conrelid = 'users'::regclass
                   AND  contype  = 'c'
                   AND  pg_get_constraintdef(oid) LIKE '%status%'
                 LIMIT 1;

                 IF con_name IS NOT NULL AND con_def NOT LIKE '%pending_review%' THEN
                     EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || quote_ident(con_name);
                     ALTER TABLE users
                         ADD CONSTRAINT users_status_check
                         CHECK (status IN ('active','inactive','pending','pending_review','under_verification','awaiting_information','rejected'));
                     RAISE NOTICE 'users status constraint updated';
                 END IF;
             END $$;`,
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS public_id VARCHAR(20);",
            "ALTER TABLE users ALTER COLUMN public_id SET DEFAULT ('USR-' || substring(replace(uuid_generate_v4()::text, '-', ''), 1, 12));",
            "UPDATE users SET public_id = ('USR-' || substring(replace(uuid_generate_v4()::text, '-', ''), 1, 12)) WHERE public_id IS NULL;",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_id ON users(public_id);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier subscription_tier_user DEFAULT 'free';",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires TIMESTAMP WITH TIME ZONE;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_chat_quota_mins INT DEFAULT 30;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS used_chat_minutes INT DEFAULT 0;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_chat_reset DATE DEFAULT CURRENT_DATE;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_psychologist_id UUID;",
            "ALTER TABLE subscription_pricing_by_country ADD COLUMN IF NOT EXISTS multiplier NUMERIC(6,3) DEFAULT 1.0;",
            "UPDATE subscription_pricing_by_country SET multiplier = 1.0 WHERE multiplier IS NULL;",
            "UPDATE pricing_catalog SET currency_code = 'ZAR' WHERE audience IN ('user','psychologist','business');",
            "UPDATE pricing_catalog SET amount_minor = 15000 WHERE audience = 'user' AND plan_code = 'user_premium';",
            "UPDATE pricing_catalog SET amount_minor = 0 WHERE audience = 'user' AND plan_code = 'user_free';",
            "UPDATE pricing_catalog SET amount_minor = 50000 WHERE audience = 'psychologist' AND plan_code = 'psychologist_standard';",
            "UPDATE pricing_catalog SET amount_minor = 100000 WHERE audience = 'business' AND plan_code = 'business_base';",
            "UPDATE pricing_catalog SET amount_minor = 200000 WHERE audience = 'business' AND plan_code = 'business_enhanced';",
            "UPDATE pricing_catalog SET amount_minor = 300000 WHERE audience = 'business' AND plan_code = 'business_premium';",
            "UPDATE pricing_catalog SET features = '[\"30 minutes psychologist chat per day\",\"Unlimited business reviews\",\"Random psychologist assignment\",\"No video call discounts\"]'::jsonb, limits = '{\"chat\":{\"minutesPerDay\":30},\"perks\":{\"choosePsychologist\":false}}'::jsonb WHERE audience = 'user' AND plan_code = 'user_free';",
            "UPDATE pricing_catalog SET features = '[\"Priority psychologist access\",\"Unlimited chat support\",\"Video/voice scheduling\",\"Weekly wellbeing reports\",\"Crisis escalation hotline\"]'::jsonb, limits = '{\"chat\":{\"minutesPerDay\":120},\"call\":{\"minutesPerDay\":120},\"video\":{\"sessionsPerWeek\":3,\"minutesPerSession\":60,\"discount\":20}}'::jsonb WHERE audience = 'user' AND plan_code = 'user_premium';",
            "UPDATE pricing_catalog SET features = '[\"Business profile access\",\"Respond to reviews\",\"Basic analytics\",\"1,000 API calls per day\"]'::jsonb, limits = '{\"api\":{\"callsPerDay\":1000},\"ads\":{\"maxActive\":1,\"analytics\":\"limited\",\"placement\":\"Business profile placements\"},\"analytics\":{\"level\":\"basic\"}}'::jsonb WHERE audience = 'business' AND plan_code = 'business_base';",
            "UPDATE pricing_catalog SET features = '[\"Expanded analytics\",\"Marketing insights\",\"3,000 API calls per day\",\"Upload promotional media\"]'::jsonb, limits = '{\"api\":{\"callsPerDay\":3000},\"ads\":{\"maxActive\":5,\"analytics\":\"standard\",\"placement\":\"Expanded placements\"},\"analytics\":{\"level\":\"expanded\"}}'::jsonb WHERE audience = 'business' AND plan_code = 'business_enhanced';",
            "UPDATE pricing_catalog SET features = '[\"Advanced analytics\",\"Email insights on user behavior\",\"10,000 API calls per day\",\"Advertisement capabilities\",\"Ability to advertise on other business pages\"]'::jsonb, limits = '{\"api\":{\"callsPerDay\":10000},\"ads\":{\"maxActive\":null,\"analytics\":\"advanced\",\"placement\":\"Competitor profiles\",\"sponsoredPlacements\":true},\"email\":{\"insights\":true}}'::jsonb WHERE audience = 'business' AND plan_code = 'business_premium';",
            `CREATE TABLE IF NOT EXISTS user_settings (
                user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                theme VARCHAR(10) DEFAULT 'light',
                email_notifications BOOLEAN DEFAULT true,
                message_notifications BOOLEAN DEFAULT true,
                review_notifications BOOLEAN DEFAULT true,
                marketing_notifications BOOLEAN DEFAULT false,
                product_updates BOOLEAN DEFAULT true,
                security_alerts BOOLEAN DEFAULT true,
                profile_visibility VARCHAR(20) DEFAULT 'public',
                data_sharing BOOLEAN DEFAULT false,
                language VARCHAR(10) DEFAULT 'en',
                timezone VARCHAR(50) DEFAULT 'UTC',
                two_factor_enabled BOOLEAN DEFAULT false,
                login_alerts BOOLEAN DEFAULT true,
                system_notification_state VARCHAR(16) DEFAULT 'default',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,

            // Messages
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_system_message BOOLEAN DEFAULT false;",
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;",

            // Conversations
            "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP;",
            "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS rejected_reason TEXT;",
            `DO $$
             DECLARE
                 con_name text;
             BEGIN
                 SELECT conname INTO con_name
                 FROM pg_constraint
                 WHERE conrelid = 'conversations'::regclass
                   AND contype  = 'c'
                   AND pg_get_constraintdef(oid) LIKE '%status%'
                 LIMIT 1;

                 IF con_name IS NOT NULL THEN
                     EXECUTE 'ALTER TABLE conversations DROP CONSTRAINT ' || quote_ident(con_name);
                 END IF;

                 ALTER TABLE conversations
                     ADD CONSTRAINT conversations_status_check
                     CHECK (status IN ('pending','accepted','rejected','blocked','ended'));
             END $$;`,

            // Companies
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS verified_by UUID;",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS claimed_by UUID;",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';",

            // Reviews
            "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS moderated_by UUID;",
            "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP;",
            "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS moderation_reason TEXT;",
            "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false;",
            "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS flagged_by UUID;",
            "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMP;",
            "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS flag_reason TEXT;",
            "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;",
            "ALTER TABLE reviews ALTER COLUMN is_anonymous SET DEFAULT false;",
            "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS notification_status VARCHAR(32) DEFAULT 'pending';",
            "ALTER TABLE reviews ALTER COLUMN notification_status SET DEFAULT 'pending';",
            "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS notification_notes TEXT;",
            "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS notification_last_sent_at TIMESTAMP;",
            "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS time_limit_minutes INTEGER DEFAULT 120;",
            "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;",
            "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;",
            "CREATE INDEX IF NOT EXISTS idx_conversations_started_at ON conversations(started_at);",
            "CREATE INDEX IF NOT EXISTS idx_conversations_expires_at ON conversations(expires_at);",
            "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;",
            "ALTER TABLE admin_roles ADD COLUMN IF NOT EXISTS is_system_role BOOLEAN DEFAULT false;",

            // Job Applications — extra columns for public apply form
            "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS linkedin_url TEXT;",
            "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS github_url TEXT;",
            "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS portfolio_url TEXT;",
            "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS years_experience INTEGER;",
            "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS current_company VARCHAR(255);",
            "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS current_position VARCHAR(255);",
            "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]';",
            "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS salary_expectation VARCHAR(100);",
            "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS available_start_date DATE;",
            "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS work_authorization VARCHAR(100);",
            "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS remote_preference VARCHAR(50);",

            // ── KEY FIX: add 'published' to the job_postings status constraint ──
            // The old constraint only had ('draft','open','closed').
            // hrController.resolveJobStatus() can emit 'published', causing a
            // CHECK violation that exhausts the connection pool → ETIMEDOUT.
            // This block drops the old constraint and recreates it with all 4 values.
            `DO $$
             DECLARE
                 con_name text;
                 con_def  text;
             BEGIN
                 SELECT conname, pg_get_constraintdef(oid)
                 INTO   con_name, con_def
                 FROM   pg_constraint
                 WHERE  conrelid = 'job_postings'::regclass
                   AND  contype  = 'c'
                   AND  pg_get_constraintdef(oid) LIKE '%status%'
                 LIMIT 1;

                 IF con_name IS NOT NULL AND con_def NOT LIKE '%published%' THEN
                     EXECUTE 'ALTER TABLE job_postings DROP CONSTRAINT ' || quote_ident(con_name);
                     ALTER TABLE job_postings
                         ADD CONSTRAINT job_postings_status_check
                         CHECK (status IN ('draft', 'open', 'published', 'closed'));
                     RAISE NOTICE 'job_postings status constraint updated to include published';
                 END IF;
             END $$;`
            ,
            // Psychologist dashboard tables
            `CREATE TABLE IF NOT EXISTS psychologist_schedule_items (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                scheduled_for TIMESTAMP NOT NULL,
                type VARCHAR(50) DEFAULT 'meeting',
                status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
                location TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS employee_psychologist_favorites (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(employee_id, psychologist_id)
            );`,
            "CREATE INDEX IF NOT EXISTS idx_employee_favorites_employee ON employee_psychologist_favorites(employee_id);",
            "CREATE INDEX IF NOT EXISTS idx_employee_favorites_psychologist ON employee_psychologist_favorites(psychologist_id);",
            `CREATE TABLE IF NOT EXISTS tickets (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                ticket_number VARCHAR(40) UNIQUE NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
                priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
                category VARCHAR(120),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS ticket_history (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
                action VARCHAR(32) NOT NULL CHECK (action IN ('created','updated','assigned','status_changed','comment_added','email_failed')),
                performed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS ticket_access (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(ticket_id, user_id)
            );`,
            "CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);",
            "CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);",
            "CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by_user_id);",
            "CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to_user_id);",
            "CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket ON ticket_history(ticket_id);",
            `CREATE TABLE IF NOT EXISTS kodi_client_applications (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                client_name VARCHAR(255) NOT NULL,
                submitted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                documents JSONB DEFAULT '[]'::jsonb,
                approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS kodi_cases (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                client_application_id UUID REFERENCES kodi_client_applications(id) ON DELETE SET NULL,
                status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open','escalated','resolved')),
                priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS kodi_ads (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                submitted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','reviewed','approved','rejected')),
                content JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS kodi_components (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                component_name VARCHAR(120) UNIQUE NOT NULL,
                component_type VARCHAR(20) NOT NULL CHECK (component_type IN ('custom_page','custom_widget','custom_email')),
                code TEXT NOT NULL,
                created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                version INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS kodi_audit_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                entity_type VARCHAR(50) NOT NULL,
                entity_id UUID,
                action VARCHAR(50) NOT NULL,
                performed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            "CREATE INDEX IF NOT EXISTS idx_kodi_apps_status ON kodi_client_applications(approval_status);",
            "CREATE INDEX IF NOT EXISTS idx_kodi_cases_status ON kodi_cases(status);",
            "CREATE INDEX IF NOT EXISTS idx_kodi_cases_priority ON kodi_cases(priority);",
            "CREATE INDEX IF NOT EXISTS idx_kodi_ads_status ON kodi_ads(status);",
            "CREATE INDEX IF NOT EXISTS idx_kodi_components_type ON kodi_components(component_type);",
            "CREATE INDEX IF NOT EXISTS idx_kodi_audit_entity ON kodi_audit_logs(entity_type, entity_id);",
            `CREATE TABLE IF NOT EXISTS psychologist_leads (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
                display_name VARCHAR(120) NOT NULL,
                risk_level VARCHAR(20) DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
                summary TEXT,
                company VARCHAR(255),
                source_review_id UUID REFERENCES reviews(id),
                status VARCHAR(20) DEFAULT 'ml-services' CHECK (status IN ('ml-services', 'review', 'contacted', 'archived')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS psychologist_lead_messages (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                lead_id UUID NOT NULL REFERENCES psychologist_leads(id) ON DELETE CASCADE,
                psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS psychologist_favorites (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
                display_name VARCHAR(120) NOT NULL,
                notes TEXT,
                last_session TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(psychologist_id, employee_id)
            );`,
            `CREATE TABLE IF NOT EXISTS psychologist_profile_views (
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                PRIMARY KEY(user_id, psychologist_id)
            );`,
            "CREATE INDEX IF NOT EXISTS idx_psych_profile_views_expiry ON psychologist_profile_views(expires_at);",
            "ALTER TABLE psychologist_leads ADD COLUMN IF NOT EXISTS source_review_id UUID REFERENCES reviews(id);",
            "CREATE INDEX IF NOT EXISTS idx_psych_schedule_psychologist ON psychologist_schedule_items(psychologist_id);",
            "CREATE INDEX IF NOT EXISTS idx_psych_leads_psychologist ON psychologist_leads(psychologist_id);",
            "CREATE INDEX IF NOT EXISTS idx_psych_leads_status ON psychologist_leads(status);",
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_psych_leads_source_review ON psychologist_leads(psychologist_id, source_review_id) WHERE source_review_id IS NOT NULL;",
            "CREATE INDEX IF NOT EXISTS idx_psych_favorites_psychologist ON psychologist_favorites(psychologist_id);",
            `CREATE TABLE IF NOT EXISTS user_notifications (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                message TEXT NOT NULL,
                entity_type VARCHAR(50),
                entity_id UUID,
                metadata JSONB DEFAULT '{}'::jsonb,
                is_read BOOLEAN DEFAULT false,
                read_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS system_notification_state VARCHAR(16) DEFAULT 'default';",
            "ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;",
            "CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON user_notifications(user_id);",
            "CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON user_notifications(user_id, is_read) WHERE is_read = false;",
            `CREATE TABLE IF NOT EXISTS mental_health_resources (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                title TEXT NOT NULL,
                description TEXT,
                category VARCHAR(100),
                audience VARCHAR(100),
                resource_type VARCHAR(50),
                url TEXT,
                phone VARCHAR(50),
                email VARCHAR(255),
                is_emergency BOOLEAN DEFAULT false,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`
            ,
            `CREATE TABLE IF NOT EXISTS psychologist_calendar_integrations (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                provider VARCHAR(50) NOT NULL,
                name VARCHAR(100),
                ical_url TEXT NOT NULL,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS psychologist_external_events (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                integration_id UUID NOT NULL REFERENCES psychologist_calendar_integrations(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                starts_at TIMESTAMP NOT NULL,
                ends_at TIMESTAMP,
                location TEXT,
                source_uid TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`
            ,
            `CREATE TABLE IF NOT EXISTS call_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
                psychologist_id UUID REFERENCES users(id) ON DELETE SET NULL,
                employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
                media_type VARCHAR(20) DEFAULT 'video',
                started_at TIMESTAMP NOT NULL,
                ended_at TIMESTAMP NOT NULL,
                duration_seconds INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`
            ,
            `CREATE TABLE IF NOT EXISTS advertising_campaigns (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                business_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                media_type media_type NOT NULL DEFAULT 'image',
                asset_url TEXT NOT NULL,
                thumbnail_url TEXT,
                click_redirect_url TEXT,
                target_locations TEXT[] DEFAULT '{}',
                target_industries TEXT[] DEFAULT '{}',
                target_behaviors JSONB,
                daily_budget_minor BIGINT,
                bid_type VARCHAR(16) DEFAULT 'cpc',
                status VARCHAR(32) DEFAULT 'pending_review' CHECK (status IN ('draft', 'pending_review', 'active', 'paused', 'completed', 'rejected')),
                impressions INT DEFAULT 0,
                clicks INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`
            ,
            `CREATE TABLE IF NOT EXISTS ad_placements (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                campaign_id UUID NOT NULL REFERENCES advertising_campaigns(id) ON DELETE CASCADE,
                placement VARCHAR(32) NOT NULL CHECK (placement IN ('business_profile', 'search_results', 'category', 'recommended')),
                weight INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`
            ,
            `CREATE TABLE IF NOT EXISTS ad_campaign_failures (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                business_id UUID REFERENCES companies(id) ON DELETE SET NULL,
                error_message TEXT NOT NULL,
                details JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );`
            ,
            "CREATE INDEX IF NOT EXISTS idx_ad_campaign_failures_business ON ad_campaign_failures(business_id);",
            "CREATE INDEX IF NOT EXISTS idx_ad_campaign_failures_created_at ON ad_campaign_failures(created_at);",
            "ALTER TABLE advertising_campaigns ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;",
            "ALTER TABLE advertising_campaigns ADD COLUMN IF NOT EXISTS click_redirect_url TEXT;",
            "ALTER TYPE media_type ADD VALUE IF NOT EXISTS 'image';",
            "ALTER TYPE media_type ADD VALUE IF NOT EXISTS 'gif';",
            "ALTER TABLE advertising_campaigns DROP CONSTRAINT IF EXISTS advertising_campaigns_status_check;",
            "ALTER TABLE advertising_campaigns ADD CONSTRAINT advertising_campaigns_status_check CHECK (status IN ('draft','pending_review','active','paused','completed','rejected'));",
            "ALTER TABLE advertising_campaigns ALTER COLUMN status SET DEFAULT 'pending_review';",
            `DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_type') THEN
                    ALTER TABLE advertising_campaigns
                    ALTER COLUMN media_type TYPE media_type
                    USING media_type::media_type;
                END IF;
            END $$;`,
            `CREATE TABLE IF NOT EXISTS flows (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(150) NOT NULL,
                description TEXT,
                type VARCHAR(20) NOT NULL CHECK (type IN ('screen','trigger','automation','scheduled','event')),
                definition JSONB NOT NULL DEFAULT '{}'::jsonb,
                is_active BOOLEAN DEFAULT true,
                created_by UUID REFERENCES users(id) ON DELETE SET NULL,
                updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );`,
            "ALTER TABLE flows DROP CONSTRAINT IF EXISTS flows_type_check;",
            "ALTER TABLE flows ADD CONSTRAINT flows_type_check CHECK (type IN ('screen','trigger','automation','scheduled','event'));",
            "CREATE INDEX IF NOT EXISTS idx_flows_type ON flows(type);",
            "CREATE INDEX IF NOT EXISTS idx_flows_active ON flows(is_active);",
            `CREATE TABLE IF NOT EXISTS flow_triggers (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
                event_name VARCHAR(100) NOT NULL,
                conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );`,
            "CREATE INDEX IF NOT EXISTS idx_flow_triggers_event ON flow_triggers(event_name);",
            "CREATE INDEX IF NOT EXISTS idx_flow_triggers_active ON flow_triggers(is_active);",
            `CREATE TABLE IF NOT EXISTS flow_versions (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
                version_number INT NOT NULL,
                definition JSONB NOT NULL,
                created_by UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(flow_id, version_number)
            );`,
            "CREATE INDEX IF NOT EXISTS idx_flow_versions_flow ON flow_versions(flow_id);",
            `CREATE TABLE IF NOT EXISTS flow_components (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(150) NOT NULL,
                description TEXT,
                component_type VARCHAR(32) NOT NULL CHECK (component_type IN ('screen','action','decision')),
                config JSONB NOT NULL,
                is_shared BOOLEAN DEFAULT true,
                created_by UUID REFERENCES users(id) ON DELETE SET NULL,
                updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );`,
            "CREATE INDEX IF NOT EXISTS idx_flow_components_type ON flow_components(component_type);",
            `CREATE TABLE IF NOT EXISTS flow_execution_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                flow_type VARCHAR(20),
                status VARCHAR(32) DEFAULT 'in_progress',
                started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMPTZ,
                metadata JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );`,
            "CREATE INDEX IF NOT EXISTS idx_flow_logs_flow_id ON flow_execution_logs(flow_id);",
            "CREATE INDEX IF NOT EXISTS idx_flow_logs_status ON flow_execution_logs(status);",
            `CREATE TABLE IF NOT EXISTS flow_sessions (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                status VARCHAR(24) DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','aborted')),
                current_node_id VARCHAR(128),
                context JSONB NOT NULL DEFAULT '{}'::jsonb,
                preview_mode BOOLEAN DEFAULT false,
                execution_log_id UUID REFERENCES flow_execution_logs(id) ON DELETE SET NULL,
                last_submitted_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );`,
            "CREATE INDEX IF NOT EXISTS idx_flow_sessions_flow ON flow_sessions(flow_id);",
            "CREATE INDEX IF NOT EXISTS idx_flow_sessions_user ON flow_sessions(user_id);",
            `CREATE TABLE IF NOT EXISTS flow_metrics (
                flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
                window_date DATE NOT NULL,
                executions INT DEFAULT 0,
                success_count INT DEFAULT 0,
                failure_count INT DEFAULT 0,
                avg_duration_seconds NUMERIC(12,3) DEFAULT 0,
                PRIMARY KEY(flow_id, window_date)
            );`,
            `CREATE TABLE IF NOT EXISTS flow_permissions (
                flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
                role VARCHAR(64) NOT NULL,
                can_view BOOLEAN DEFAULT true,
                can_edit BOOLEAN DEFAULT false,
                can_execute BOOLEAN DEFAULT false,
                PRIMARY KEY(flow_id, role)
            );`,
        ];

        for (const migration of migrations) {
            try {
                await pool.query(migration);
                if (migration.length < 80) {
                    console.log(`✅ Migration: ${migration.substring(0, 70)}`);
                }
            } catch (err) {
                if (!err.message.includes('already exists')) {
                    console.log(`⚠️  Migration note: ${err.message.substring(0, 120)}`);
                }
            }
        }

        console.log('✅ Database migrations completed');
    } catch (error) {
        console.error('❌ Error running migrations:', error.message);
    }
};

// ── Run setup then migrations ──────────────────────────────────────────────────
const setupDatabase = async () => {
    await createTables();
    await runMigrations();
    await insertDefaultData();
};

setupDatabase();

// ── Exports ────────────────────────────────────────────────────────────────────
module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};
