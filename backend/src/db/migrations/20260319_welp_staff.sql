-- Welp staff model + role update
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'users'
          AND constraint_type = 'CHECK'
          AND constraint_name = 'users_role_check'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_role_check;
    END IF;
EXCEPTION WHEN undefined_table THEN
    NULL;
END$$;

ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('employee','psychologist','business','admin','super_admin','hr_admin','welp_employee'));

CREATE TABLE IF NOT EXISTS welp_staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    staff_role_key VARCHAR(50) NOT NULL,
    department VARCHAR(120),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_welp_staff_user_id ON welp_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_welp_staff_role ON welp_staff(staff_role_key);
