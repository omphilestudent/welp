BEGIN;

-- Unified account numbers
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_number VARCHAR(10);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS account_number VARCHAR(10);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_account_number ON users(account_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_account_number ON companies(account_number);

CREATE TABLE IF NOT EXISTS account_number_registry (
    account_number VARCHAR(10) PRIMARY KEY,
    owner_type VARCHAR(16) NOT NULL CHECK (owner_type IN ('user','company')),
    owner_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (owner_type, owner_id)
);

CREATE TABLE IF NOT EXISTS account_number_sequences (
    prefix VARCHAR(3) PRIMARY KEY,
    last_value INTEGER NOT NULL DEFAULT 0
);

INSERT INTO account_number_sequences (prefix, last_value)
VALUES ('100', 0), ('200', 0), ('300', 0)
ON CONFLICT (prefix) DO NOTHING;

-- Backfill account numbers for business accounts (companies + business users)
WITH business_entities AS (
    SELECT 'company' AS owner_type, id, created_at
    FROM companies
    WHERE account_number IS NULL
    UNION ALL
    SELECT 'user' AS owner_type, id, created_at
    FROM users
    WHERE role = 'business' AND account_number IS NULL
),
numbered AS (
    SELECT owner_type, id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
    FROM business_entities
)
UPDATE companies c
SET account_number = '100' || LPAD(numbered.rn::text, 7, '0')
FROM numbered
WHERE numbered.owner_type = 'company' AND c.id = numbered.id;

WITH business_entities AS (
    SELECT 'company' AS owner_type, id, created_at
    FROM companies
    WHERE account_number IS NULL
    UNION ALL
    SELECT 'user' AS owner_type, id, created_at
    FROM users
    WHERE role = 'business' AND account_number IS NULL
),
numbered AS (
    SELECT owner_type, id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
    FROM business_entities
)
UPDATE users u
SET account_number = '100' || LPAD(numbered.rn::text, 7, '0')
FROM numbered
WHERE numbered.owner_type = 'user' AND u.id = numbered.id;

-- Backfill account numbers for psychologist users
WITH psych_rows AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
    FROM users
    WHERE role = 'psychologist' AND account_number IS NULL
)
UPDATE users u
SET account_number = '200' || LPAD(psych_rows.rn::text, 7, '0')
FROM psych_rows
WHERE u.id = psych_rows.id;

-- Backfill account numbers for employee users
WITH employee_rows AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
    FROM users
    WHERE role = 'employee' AND account_number IS NULL
)
UPDATE users u
SET account_number = '300' || LPAD(employee_rows.rn::text, 7, '0')
FROM employee_rows
WHERE u.id = employee_rows.id;

-- Registry sync (companies)
INSERT INTO account_number_registry (account_number, owner_type, owner_id)
SELECT c.account_number, 'company', c.id
FROM companies c
LEFT JOIN account_number_registry r ON r.owner_type = 'company' AND r.owner_id = c.id
WHERE c.account_number IS NOT NULL AND r.owner_id IS NULL
ON CONFLICT (account_number) DO NOTHING;

-- Registry sync (users)
INSERT INTO account_number_registry (account_number, owner_type, owner_id)
SELECT u.account_number, 'user', u.id
FROM users u
LEFT JOIN account_number_registry r ON r.owner_type = 'user' AND r.owner_id = u.id
WHERE u.account_number IS NOT NULL AND r.owner_id IS NULL
ON CONFLICT (account_number) DO NOTHING;

-- Update sequence counters based on existing values
UPDATE account_number_sequences s
SET last_value = COALESCE((
    SELECT MAX(SUBSTRING(r.account_number FROM 4)::int)
    FROM account_number_registry r
    WHERE r.account_number LIKE s.prefix || '%'
), 0)
WHERE s.prefix IN ('100','200','300');

-- Psychologist events + invitees
CREATE TABLE IF NOT EXISTS psychologist_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    timezone VARCHAR(64) DEFAULT 'Africa/Johannesburg',
    event_type VARCHAR(32) DEFAULT 'meeting',
    is_video_call BOOLEAN DEFAULT false,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    status VARCHAR(24) DEFAULT 'scheduled' CHECK (status IN ('scheduled','ready','completed','cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_psych_events_psychologist ON psychologist_events(psychologist_id, starts_at);

CREATE TABLE IF NOT EXISTS psychologist_event_invitees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES psychologist_events(id) ON DELETE CASCADE,
    email CITEXT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    invite_status VARCHAR(24) DEFAULT 'pending' CHECK (invite_status IN ('pending','sent','accepted','declined')),
    invite_token VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, email),
    UNIQUE(invite_token)
);

CREATE INDEX IF NOT EXISTS idx_psych_event_invitees_event ON psychologist_event_invitees(event_id);

COMMIT;
