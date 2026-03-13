-- 20240313_pricing_catalog.sql
BEGIN;

DO 
BEGIN
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
END;

CREATE TABLE IF NOT EXISTS currencies (
    code VARCHAR(3) PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    symbol VARCHAR(8) NOT NULL DEFAULT '$',
    fx_rate_usd NUMERIC(18,6) NOT NULL DEFAULT 1.0,
    purchasing_power_index NUMERIC(6,3) NOT NULL DEFAULT 1.0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (audience, plan_code, currency_code)
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_records_owner ON subscription_records(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_subscription_records_plan ON subscription_records(plan_code, status);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_role VARCHAR(32),
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(64),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

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
    updated_at = now();

INSERT INTO pricing_catalog (
    audience, plan_code, plan_tier, currency_code, amount_minor,
    billing_period, is_default, features, limits, metadata
) VALUES
    ('user', 'user_free', 'free', 'USD', 0, 'monthly', true,
        '["Unlimited review browsing","Basic psychologist matching","Daily wellbeing tips","Community resource access"]'::jsonb,
        '{"chat":{"minutesPerDay":30},"video":{"sessionsPerWeek":1,"minutesPerSession":30,"discount":0},"api":{"callsPerDay":0}}'::jsonb,
        '{"displayName":"Free","tagline":"Start your wellbeing journey","badge":"Most popular free"}'::jsonb
    ),
    ('user', 'user_premium', 'premium', 'USD', 15000, 'monthly', false,
        '["Priority psychologist access","Unlimited chat support","Video/voice scheduling","Weekly wellbeing reports","Crisis escalation hotline"]'::jsonb,
        '{"chat":{"minutesPerDay":120},"video":{"sessionsPerWeek":3,"minutesPerSession":60,"discount":20},"api":{"callsPerDay":0}}'::jsonb,
        '{"displayName":"Premium","tagline":"Full access to therapists","badge":"Best value"}'::jsonb
    ),
    ('psychologist', 'psychologist_standard', 'premium', 'USD', 50000, 'monthly', true,
        '["Verified badge","Unlimited lead inbox","Analytics dashboard","Calendar sync & scheduling","Payment processing","Priority marketplace placement"]'::jsonb,
        '{"leads":{"perMonth":30},"clients":{"activeConversations":50}}'::jsonb,
        '{"displayName":"Psychologist Partner","tagline":"Grow your impact","badge":"Professional"}'::jsonb
    ),
    ('business', 'business_base', 'base', 'USD', 50000, 'monthly', true,
        '["Claimed profile","Respond to reviews","Basic analytics","3 seats included"]'::jsonb,
        '{"api":{"callsPerDay":1000},"seats":3,"ads":{"maxActive":1,"analytics":"limited"}}'::jsonb,
        '{"displayName":"Business Base","tagline":"Get started with insights"}'::jsonb
    ),
    ('business', 'business_enhanced', 'enhanced', 'USD', 150000, 'monthly', false,
        '["Advanced analytics","Competitor benchmarking","Sentiment timelines","Unlimited seats","Campaign benchmarks"]'::jsonb,
        '{"api":{"callsPerDay":3000},"seats":null,"ads":{"maxActive":5,"analytics":"standard"}}'::jsonb,
        '{"displayName":"Business Enhanced","tagline":"Scale your analytics"}'::jsonb
    ),
    ('business', 'business_premium', 'premium', 'USD', 300000, 'monthly', false,
        '["Executive dashboards","10k API calls/day","Advertising toolkit","Dedicated success manager","Custom branding"]'::jsonb,
        '{"api":{"callsPerDay":10000},"ads":{"maxActive":null,"analytics":"advanced","sponsoredPlacements":true}}'::jsonb,
        '{"displayName":"Business Premium","tagline":"Own your reputation","badge":"Enterprise"}'::jsonb
    )
ON CONFLICT (audience, plan_code, currency_code)
DO UPDATE SET
    plan_tier = EXCLUDED.plan_tier,
    amount_minor = EXCLUDED.amount_minor,
    features = EXCLUDED.features,
    limits = EXCLUDED.limits,
    metadata = EXCLUDED.metadata,
    updated_at = now();

COMMIT;
