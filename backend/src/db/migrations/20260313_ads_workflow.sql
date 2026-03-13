-- 20260313_ads_workflow.sql
BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ad_review_status') THEN
        CREATE TYPE ad_review_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
END$$;

ALTER TABLE advertising_campaigns
    ADD COLUMN IF NOT EXISTS review_status ad_review_status DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS review_notes TEXT,
    ADD COLUMN IF NOT EXISTS spend_minor BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bid_rate_minor BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS override_restrictions BOOLEAN DEFAULT false;

DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname
    INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'advertising_campaigns'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE advertising_campaigns DROP CONSTRAINT %I', constraint_name);
    END IF;
END$$;

ALTER TABLE advertising_campaigns
    ADD CONSTRAINT advertising_campaigns_status_check
    CHECK (status IN ('draft','pending_review','active','paused','completed','rejected'));

UPDATE advertising_campaigns
SET status = 'pending_review'
WHERE status = 'draft'
  AND review_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_ads_review_status ON advertising_campaigns(review_status);
CREATE INDEX IF NOT EXISTS idx_ads_status ON advertising_campaigns(status);

-- business plan ad limits
UPDATE pricing_catalog
SET limits = jsonb_set(
        COALESCE(limits, '{}'::jsonb),
        '{ads}',
        CASE plan_code
            WHEN 'business_base' THEN jsonb_build_object('maxActive', 1, 'analytics', 'limited')
            WHEN 'business_enhanced' THEN jsonb_build_object('maxActive', 5, 'analytics', 'standard')
            WHEN 'business_premium' THEN jsonb_build_object('maxActive', NULL, 'analytics', 'advanced')
            ELSE COALESCE(limits->'ads', '{}'::jsonb)
        END,
        true
    )
WHERE audience = 'business'
  AND plan_code IN ('business_base','business_enhanced','business_premium');

COMMIT;
