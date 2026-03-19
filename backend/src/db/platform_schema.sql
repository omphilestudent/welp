-- Welp Platform Reference Schema (PostgreSQL + Redis caching layer)
-- Generated 2026-03-13 – aligns with subscription, marketplace, analytics, chat, and advertising specs.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Shared enum helpers
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
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_type') THEN
        CREATE TYPE media_type AS ENUM ('text', 'voice', 'video');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ad_review_status') THEN
        CREATE TYPE ad_review_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS currencies (
    code         VARCHAR(3) PRIMARY KEY,
    name         VARCHAR(64) NOT NULL,
    fx_rate_usd  NUMERIC(18,6) NOT NULL DEFAULT 1.0,
    purchasing_power_index NUMERIC(6,3) NOT NULL DEFAULT 1.0,
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pricing_catalog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audience           VARCHAR(32) NOT NULL,           -- user|psychologist|business
    plan_code          VARCHAR(32) NOT NULL,
    currency_code      VARCHAR(3) NOT NULL REFERENCES currencies(code),
    amount_minor       BIGINT NOT NULL,                -- cents (or smallest unit)
    is_default         BOOLEAN DEFAULT false,
    billing_period     VARCHAR(16) DEFAULT 'monthly',
    metadata           JSONB DEFAULT '{}'::jsonb,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at         TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (audience, plan_code, currency_code)
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email                CITEXT UNIQUE NOT NULL,
    password_hash        TEXT NOT NULL,
    role                 VARCHAR(32) NOT NULL CHECK (role IN ('user','psychologist','business','admin','super_admin','welp_employee')),
    is_anonymous         BOOLEAN DEFAULT false,
    subscription_tier    subscription_tier_user DEFAULT 'free',
    subscription_expires TIMESTAMP WITH TIME ZONE,
    daily_chat_quota_mins INT DEFAULT 30,
    used_chat_minutes    INT DEFAULT 0,
    last_chat_reset      DATE DEFAULT CURRENT_DATE,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT now()
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'users'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'users'
              AND column_name = 'id'
        ) THEN
            ALTER TABLE users
                ADD COLUMN id UUID DEFAULT uuid_generate_v4();
        END IF;

        UPDATE users SET id = uuid_generate_v4() WHERE id IS NULL;

        BEGIN
            ALTER TABLE users ALTER COLUMN id SET DEFAULT uuid_generate_v4();
        EXCEPTION
            WHEN undefined_column THEN NULL;
        END;

        BEGIN
            ALTER TABLE users ALTER COLUMN id SET NOT NULL;
        EXCEPTION
            WHEN undefined_column THEN NULL;
        END;

        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu
              ON tc.constraint_name = ccu.constraint_name
             AND tc.table_name = ccu.table_name
            WHERE tc.table_schema = 'public'
              AND tc.table_name = 'users'
              AND ccu.column_name = 'id'
              AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
        ) THEN
            BEGIN
                ALTER TABLE users
                    ADD CONSTRAINT users_id_unique UNIQUE (id);
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END;
        END IF;
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS psychologists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan                psychologist_plan DEFAULT 'standard',
    specialization_tags TEXT[] DEFAULT '{}',
    bio                 TEXT,
    license_number      VARCHAR(128),
    license_verified    BOOLEAN DEFAULT false,
    identity_verified   BOOLEAN DEFAULT false,
    background_check_status VARCHAR(32) DEFAULT 'pending',
    hourly_rate_minor   BIGINT,
    availability        JSONB DEFAULT '[]'::jsonb,
    calendar_provider   VARCHAR(64),
    calendar_external_id VARCHAR(128),
    average_rating      NUMERIC(3,2),
    total_reviews       INT DEFAULT 0,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS psychologist_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psychologist_id UUID NOT NULL REFERENCES psychologists(id) ON DELETE CASCADE,
    reviewer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    verified BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS psychologist_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psychologist_id UUID NOT NULL REFERENCES psychologists(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    lead_source VARCHAR(32) DEFAULT 'review',
    summary TEXT,
    status VARCHAR(32) DEFAULT 'new' CHECK (status IN ('new','contacted','scheduled','closed')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    industry VARCHAR(128),
    website TEXT,
    headquarters JSONB,
    status VARCHAR(32) DEFAULT 'active',
    subscription_tier subscription_tier_business DEFAULT 'base',
    subscription_expires TIMESTAMP WITH TIME ZONE,
    api_calls_used INT DEFAULT 0,
    api_call_limit INT DEFAULT 1000,
    analytics_snapshot JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_analytics_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    review_count INT DEFAULT 0,
    avg_rating NUMERIC(3,2),
    sentiment_score NUMERIC(4,3),
    ad_impressions INT DEFAULT 0,
    ad_clicks INT DEFAULT 0,
    UNIQUE (business_id, metric_date)
);

CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title VARCHAR(255),
    content TEXT NOT NULL,
    status VARCHAR(32) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    flagged BOOLEAN DEFAULT false,
    flagged_reason TEXT,
    moderated_by UUID REFERENCES users(id),
    moderated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote_type VARCHAR(16) NOT NULL CHECK (vote_type IN ('helpful','not_helpful')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (review_id, user_id)
);

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    psychologist_id UUID NOT NULL REFERENCES psychologists(id) ON DELETE CASCADE,
    status VARCHAR(32) DEFAULT 'active' CHECK (status IN ('active','ended','blocked')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    ended_at TIMESTAMP WITH TIME ZONE,
    daily_chat_limit_minutes INT DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    media JSONB,
    delivered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    read_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS call_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    initiator_id UUID NOT NULL REFERENCES users(id),
    receiver_id UUID NOT NULL REFERENCES users(id),
    media media_type NOT NULL DEFAULT 'video',
    scheduled_for TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INT DEFAULT 0,
    recording_url TEXT,
    encryption_key_id UUID,
    status VARCHAR(32) DEFAULT 'scheduled' CHECK (status IN ('scheduled','ringing','connected','ended','cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscription_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_type VARCHAR(32) NOT NULL CHECK (owner_type IN ('user','psychologist','business')),
    owner_id UUID NOT NULL,
    plan_code VARCHAR(32) NOT NULL,
    currency_code VARCHAR(3) NOT NULL,
    amount_minor BIGINT NOT NULL,
    billing_period VARCHAR(16) DEFAULT 'monthly',
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(32) DEFAULT 'active' CHECK (status IN ('active','past_due','cancelled','expired')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
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
    status VARCHAR(32) DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
    invoice_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS advertising_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
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
    bid_rate_minor BIGINT DEFAULT 0,
    spend_minor BIGINT DEFAULT 0,
    status VARCHAR(32) DEFAULT 'draft' CHECK (status IN ('draft','pending_review','active','paused','completed','rejected')),
    review_status ad_review_status DEFAULT 'pending',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id),
    review_notes TEXT,
    override_restrictions BOOLEAN DEFAULT false,
    impressions INT DEFAULT 0,
    clicks INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ad_placements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES advertising_campaigns(id) ON DELETE CASCADE,
    placement VARCHAR(32) NOT NULL CHECK (placement IN ('business_profile','search_results','category','recommended')),
    weight INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES users(id),
    actor_role VARCHAR(32),
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(32),
    entity_id UUID,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Redis usage (documented for ops)
--  * session:{token} -> serialized session payload (TTL: 24h)
--  * chat:quota:{userId}:{date} -> minutes consumed
--  * rate:api:{businessId} -> API call counters
--  * price:lookup:{currency} -> cached converted catalog
--  * call:offer:{conversationId} -> ephemeral SDP offers/ICE candidates
