-- Kodi Portal schema updates
ALTER TABLE kodi_apps ADD COLUMN IF NOT EXISTS label VARCHAR(255);
ALTER TABLE kodi_apps ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft';
ALTER TABLE kodi_apps ADD COLUMN IF NOT EXISTS icon VARCHAR(255);
ALTER TABLE kodi_apps ADD COLUMN IF NOT EXISTS theme_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE kodi_apps ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE kodi_apps ADD COLUMN IF NOT EXISTS navigation_mode VARCHAR(50) DEFAULT 'sidebar';
ALTER TABLE kodi_apps ADD COLUMN IF NOT EXISTS landing_behavior VARCHAR(50) DEFAULT 'default_page';
ALTER TABLE kodi_apps ADD COLUMN IF NOT EXISTS default_page_id UUID;
DO $$
BEGIN
    ALTER TABLE kodi_apps
        ADD CONSTRAINT kodi_apps_default_page_fk
        FOREIGN KEY (default_page_id) REFERENCES kodi_pages(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;
ALTER TABLE kodi_apps ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE kodi_apps
SET status = CASE
    WHEN status IS NULL AND is_active = true THEN 'active'
    WHEN status IS NULL AND is_active = false THEN 'inactive'
    ELSE status
END;

ALTER TABLE app_page_mapping ADD COLUMN IF NOT EXISTS nav_label VARCHAR(255);
ALTER TABLE app_page_mapping ADD COLUMN IF NOT EXISTS nav_order INTEGER DEFAULT 0;
ALTER TABLE app_page_mapping ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
ALTER TABLE app_page_mapping ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true;
ALTER TABLE app_page_mapping ADD COLUMN IF NOT EXISTS role_visibility JSONB DEFAULT '{}'::jsonb;
ALTER TABLE app_page_mapping ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE kodi_app_users ADD COLUMN IF NOT EXISTS role_key VARCHAR(50);
ALTER TABLE kodi_app_users ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE kodi_app_users ADD COLUMN IF NOT EXISTS invite_token VARCHAR(64);
ALTER TABLE kodi_app_users ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP;
ALTER TABLE kodi_app_users ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP;
ALTER TABLE kodi_app_users ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_kodi_app_users_status ON kodi_app_users(status);
CREATE INDEX IF NOT EXISTS idx_kodi_app_users_invite ON kodi_app_users(invite_token);
CREATE INDEX IF NOT EXISTS idx_app_page_mapping_page ON app_page_mapping(page_id);

CREATE TABLE IF NOT EXISTS kodi_portal_identities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(80) UNIQUE NOT NULL,
    password_hash TEXT,
    otp_hash TEXT,
    otp_expires_at TIMESTAMP,
    first_login_required BOOLEAN DEFAULT true,
    first_login_token VARCHAR(80),
    first_login_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_kodi_portal_identities_username ON kodi_portal_identities(username);
