-- Kodi Record Pages + Access + KC Kodi Components (v2)
-- Keep existing kodi_* tables intact; these are additive.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS kodi_record_pages (
                                                 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(160) UNIQUE NOT NULL,
    description TEXT,
    layout JSONB DEFAULT '{}'::jsonb,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX IF NOT EXISTS idx_kodi_record_pages_active ON kodi_record_pages(is_active);
CREATE INDEX IF NOT EXISTS idx_kodi_record_pages_slug ON kodi_record_pages(slug);

CREATE TABLE IF NOT EXISTS kodi_page_access (
                                                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kodi_page_id UUID NOT NULL REFERENCES kodi_record_pages(id) ON DELETE CASCADE,
    username VARCHAR(120) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('sales','customer_service','hr','admin')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(kodi_page_id, username)
    );

CREATE INDEX IF NOT EXISTS idx_kodi_page_access_page ON kodi_page_access(kodi_page_id);
CREATE INDEX IF NOT EXISTS idx_kodi_page_access_active ON kodi_page_access(is_active);

CREATE TABLE IF NOT EXISTS kc_kodi_components (
                                                  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_name VARCHAR(160) UNIQUE NOT NULL,
    component_type VARCHAR(24) NOT NULL CHECK (component_type IN ('widget','page_block','email','logic')),
    code TEXT NOT NULL,
    config JSONB DEFAULT '{}'::jsonb,
    version INTEGER DEFAULT 1,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX IF NOT EXISTS idx_kc_kodi_components_type ON kc_kodi_components(component_type);

CREATE TABLE IF NOT EXISTS kodi_page_component_mapping (
                                                           id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kodi_page_id UUID NOT NULL REFERENCES kodi_record_pages(id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES kc_kodi_components(id) ON DELETE CASCADE,
    position JSONB DEFAULT '{}'::jsonb,
    props JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX IF NOT EXISTS idx_kodi_page_component_page ON kodi_page_component_mapping(kodi_page_id);
CREATE INDEX IF NOT EXISTS idx_kodi_page_component_component ON kodi_page_component_mapping(component_id);

