-- Salesforce-style Kodi runtime data model
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS kodi_object_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    object_name VARCHAR(120) NOT NULL,
    record JSONB NOT NULL DEFAULT '{}'::jsonb,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kodi_object_records_object
    ON kodi_object_records (object_name);
CREATE INDEX IF NOT EXISTS idx_kodi_object_records_owner
    ON kodi_object_records (owner_id);

CREATE TABLE IF NOT EXISTS kodi_record_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    object_name VARCHAR(120) NOT NULL,
    record_id UUID NOT NULL,
    activity_type VARCHAR(64) DEFAULT 'activity',
    title TEXT NOT NULL,
    meta TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kodi_record_activities_record
    ON kodi_record_activities (object_name, record_id);

CREATE TABLE IF NOT EXISTS kodi_record_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    object_name VARCHAR(120) NOT NULL,
    record_id UUID NOT NULL,
    body TEXT NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kodi_record_notes_record
    ON kodi_record_notes (object_name, record_id);

CREATE TABLE IF NOT EXISTS kodi_record_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    object_name VARCHAR(120) NOT NULL,
    record_id UUID NOT NULL,
    label VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kodi_record_links_record
    ON kodi_record_links (object_name, record_id);

CREATE TABLE IF NOT EXISTS kodi_recent_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    object_name VARCHAR(120) NOT NULL,
    record_id UUID NOT NULL,
    label VARCHAR(255),
    visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kodi_recent_items_user
    ON kodi_recent_items (user_id, visited_at DESC);

CREATE TABLE IF NOT EXISTS kodi_app_utilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id UUID NOT NULL REFERENCES kodi_apps(id) ON DELETE CASCADE,
    utility_key VARCHAR(64) NOT NULL,
    label VARCHAR(120) NOT NULL,
    icon VARCHAR(64),
    nav_order INT DEFAULT 0,
    is_enabled BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (app_id, utility_key)
);

CREATE INDEX IF NOT EXISTS idx_kodi_app_utilities_app
    ON kodi_app_utilities (app_id, nav_order);
