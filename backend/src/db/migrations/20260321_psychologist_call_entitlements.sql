-- Psychologist per-client call entitlements + payouts

CREATE TABLE IF NOT EXISTS psychologist_client_call_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_tier VARCHAR(16) NOT NULL DEFAULT 'free',
    minute_allowance INT DEFAULT 0,
    minutes_used INT DEFAULT 0,
    minutes_remaining INT DEFAULT 0,
    last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(psychologist_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_psych_call_accounts_psych ON psychologist_client_call_accounts(psychologist_id);
CREATE INDEX IF NOT EXISTS idx_psych_call_accounts_employee ON psychologist_client_call_accounts(employee_id);

CREATE TABLE IF NOT EXISTS psychologist_call_fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fee_minor BIGINT NOT NULL DEFAULT 0,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'due' CHECK (status IN ('due', 'paid', 'waived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(psychologist_id, employee_id)
);

CREATE TABLE IF NOT EXISTS psychologist_hourly_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    hour SMALLINT NOT NULL CHECK (hour BETWEEN 0 AND 23),
    is_available BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(psychologist_id, day_of_week, hour)
);

CREATE INDEX IF NOT EXISTS idx_psych_availability_psych ON psychologist_hourly_availability(psychologist_id);

CREATE TABLE IF NOT EXISTS user_payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(32) DEFAULT 'stripe',
    card_brand VARCHAR(32),
    last4 VARCHAR(4),
    exp_month INT,
    exp_year INT,
    is_default BOOLEAN DEFAULT true,
    status VARCHAR(16) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'removed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_payment_methods_user ON user_payment_methods(user_id);

ALTER TABLE psychologist_payout_accounts
    ADD COLUMN IF NOT EXISTS country_code VARCHAR(2),
    ADD COLUMN IF NOT EXISTS branch_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS routing_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS swift_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS proof_document_url TEXT,
    ADD COLUMN IF NOT EXISTS proof_document_type VARCHAR(32),
    ADD COLUMN IF NOT EXISTS proof_verified BOOLEAN DEFAULT false;

ALTER TABLE call_logs
    ADD COLUMN IF NOT EXISTS requested_duration_minutes INT,
    ADD COLUMN IF NOT EXISTS psychologist_plan_tier VARCHAR(16),
    ADD COLUMN IF NOT EXISTS call_fee_minor BIGINT,
    ADD COLUMN IF NOT EXISTS client_minutes_before INT,
    ADD COLUMN IF NOT EXISTS client_minutes_after INT;
