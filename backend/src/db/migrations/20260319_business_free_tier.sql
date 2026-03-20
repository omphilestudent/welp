DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'subscription_tier_business'
          AND e.enumlabel = 'free_tier'
    ) THEN
        ALTER TYPE subscription_tier_business ADD VALUE 'free_tier';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'businesses'
    ) THEN
        ALTER TABLE businesses
            ALTER COLUMN subscription_tier SET DEFAULT 'free_tier';

        UPDATE businesses
        SET subscription_tier = 'free_tier'
        WHERE subscription_tier IS NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS business_api_usage_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES business_api_keys(id) ON DELETE SET NULL,
    usage_date DATE NOT NULL,
    request_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_business_api_usage_daily_company_date
    ON business_api_usage_daily (company_id, usage_date);

INSERT INTO pricing_catalog (audience, plan_code, plan_tier, currency_code, amount_minor, billing_period, is_default, features, limits, metadata)
VALUES (
    'business',
    'business_free_tier',
    'free_tier',
    'ZAR',
    0,
    'monthly',
    true,
    '["Business profile access","Respond to reviews","API keys included","100 API calls per day"]'::jsonb,
    '{"api":{"callsPerDay":100},"ads":{"maxActive":0,"analytics":"none","placement":"Business profile only"},"analytics":{"level":"none"}}'::jsonb,
    '{"displayName":"Business Free Tier","tagline":"Start for free"}'::jsonb
)
ON CONFLICT (audience, plan_code, currency_code)
DO UPDATE SET
    plan_tier = EXCLUDED.plan_tier,
    amount_minor = EXCLUDED.amount_minor,
    is_default = EXCLUDED.is_default,
    features = EXCLUDED.features,
    limits = EXCLUDED.limits,
    metadata = EXCLUDED.metadata,
    updated_at = CURRENT_TIMESTAMP;

UPDATE pricing_catalog
SET is_default = false
WHERE audience = 'business' AND plan_code = 'business_base';
