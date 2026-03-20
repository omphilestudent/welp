-- Ads platform expansion: time windows, priority, images, invoices

ALTER TABLE advertising_campaigns
    ADD COLUMN IF NOT EXISTS campaign_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS ad_option VARCHAR(32) DEFAULT 'standard',
    ADD COLUMN IF NOT EXISTS placement_type VARCHAR(32),
    ADD COLUMN IF NOT EXISTS priority_level INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS priority_multiplier NUMERIC(6,2) DEFAULT 1.0,
    ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS removal_reason TEXT,
    ADD COLUMN IF NOT EXISTS billing_cycle_anchor TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS last_invoiced_at TIMESTAMPTZ;

ALTER TABLE advertising_campaigns
    DROP CONSTRAINT IF EXISTS advertising_campaigns_status_check;

ALTER TABLE advertising_campaigns
    ADD CONSTRAINT advertising_campaigns_status_check
    CHECK (status IN ('draft','pending_review','active','paused','completed','rejected','expired','removed'));

CREATE TABLE IF NOT EXISTS ad_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES advertising_campaigns(id) ON DELETE CASCADE,
    asset_url TEXT NOT NULL,
    media_type media_type NOT NULL DEFAULT 'image',
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    alt_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_images_campaign ON ad_images(campaign_id);

CREATE TABLE IF NOT EXISTS ad_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_number VARCHAR(64) NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    status VARCHAR(24) DEFAULT 'issued',
    subtotal_minor BIGINT DEFAULT 0,
    total_minor BIGINT DEFAULT 0,
    invoice_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_invoices_business ON ad_invoices(business_id);

CREATE TABLE IF NOT EXISTS ad_invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES ad_invoices(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES advertising_campaigns(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    placement VARCHAR(32),
    base_price_minor BIGINT DEFAULT 0,
    priority_surcharge_minor BIGINT DEFAULT 0,
    total_minor BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_invoice_items_invoice ON ad_invoice_items(invoice_id);
