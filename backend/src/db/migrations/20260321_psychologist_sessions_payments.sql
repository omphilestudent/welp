-- Psychologist session booking + payments + statements

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'psychologist_plan') THEN
        CREATE TYPE psychologist_plan AS ENUM ('free', 'premium');
    ELSE
        BEGIN
            ALTER TYPE psychologist_plan ADD VALUE IF NOT EXISTS 'free';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            ALTER TYPE psychologist_plan ADD VALUE IF NOT EXISTS 'premium';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

ALTER TABLE psychologists
    ALTER COLUMN plan DROP DEFAULT;
ALTER TABLE psychologists
    ALTER COLUMN plan TYPE psychologist_plan
    USING COALESCE(NULLIF(plan::text, ''), 'free')::psychologist_plan;
ALTER TABLE psychologists
    ALTER COLUMN plan SET DEFAULT 'free';

CREATE TABLE IF NOT EXISTS psychologist_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(120),
    amount_minor BIGINT NOT NULL,
    currency_code VARCHAR(8) DEFAULT 'USD',
    duration_type VARCHAR(16) NOT NULL CHECK (duration_type IN ('per_hour', 'per_minute')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_psych_rates_owner ON psychologist_rates(psychologist_id);

CREATE TABLE IF NOT EXISTS psychologist_payout_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_number VARCHAR(64) NOT NULL,
    account_holder VARCHAR(120),
    bank_name VARCHAR(120),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(psychologist_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_psych_payout_account_number ON psychologist_payout_accounts(account_number);

CREATE TABLE IF NOT EXISTS psychologist_session_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rate_id UUID REFERENCES psychologist_rates(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 60,
    status VARCHAR(24) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_psych_bookings_psych ON psychologist_session_bookings(psychologist_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_psych_bookings_employee ON psychologist_session_bookings(employee_id, scheduled_at);

CREATE TABLE IF NOT EXISTS psychologist_session_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES psychologist_session_bookings(id) ON DELETE CASCADE,
    payer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    base_amount_minor BIGINT NOT NULL,
    welp_fee_minor BIGINT NOT NULL,
    total_amount_minor BIGINT NOT NULL,
    currency_code VARCHAR(8) DEFAULT 'USD',
    payment_status VARCHAR(24) NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    payout_status VARCHAR(24) NOT NULL DEFAULT 'unpaid' CHECK (payout_status IN ('unpaid', 'scheduled', 'paid')),
    paid_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    payout_processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_psych_payments_psych ON psychologist_session_payments(psychologist_id, paid_at);
CREATE INDEX IF NOT EXISTS idx_psych_payments_booking ON psychologist_session_payments(booking_id);

CREATE TABLE IF NOT EXISTS psychologist_statements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_gross_minor BIGINT NOT NULL,
    total_fee_minor BIGINT NOT NULL,
    total_net_minor BIGINT NOT NULL,
    currency_code VARCHAR(8) DEFAULT 'USD',
    statement_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(psychologist_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_psych_statements_psych ON psychologist_statements(psychologist_id, period_start);
