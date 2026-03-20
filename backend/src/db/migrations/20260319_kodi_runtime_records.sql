-- Kodi runtime record storage for editable record pages
DO $$
DECLARE
    page_id_type TEXT;
BEGIN
    SELECT udt_name
    INTO page_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kodi_pages'
      AND column_name = 'id';

    IF page_id_type = 'uuid' THEN
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS kodi_runtime_records (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                kodi_page_id UUID NOT NULL REFERENCES kodi_pages(id) ON DELETE CASCADE,
                record JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (kodi_page_id)
            );
        $sql$;
    ELSIF page_id_type IS NOT NULL THEN
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS kodi_runtime_records (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                kodi_page_id %s NOT NULL,
                record JSONB NOT NULL DEFAULT ''{}''::jsonb,
                updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (kodi_page_id)
            )',
            page_id_type
        );
    ELSE
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS kodi_runtime_records (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                kodi_page_id UUID NOT NULL,
                record JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (kodi_page_id)
            );
        $sql$;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kodi_runtime_records_page
    ON kodi_runtime_records (kodi_page_id);
