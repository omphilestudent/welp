-- Add review taxonomy + daily review tracking
ALTER TABLE reviews
    ADD COLUMN IF NOT EXISTS review_type VARCHAR(32) DEFAULT 'company_review',
    ADD COLUMN IF NOT EXISTS review_stage VARCHAR(32),
    ADD COLUMN IF NOT EXISTS review_date DATE,
    ADD COLUMN IF NOT EXISTS review_week_start DATE;

ALTER TABLE reviews
    ALTER COLUMN review_type SET DEFAULT 'company_review';

UPDATE reviews
SET review_type = 'company_review'
WHERE review_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_company_type ON reviews(company_id, review_type);
CREATE INDEX IF NOT EXISTS idx_reviews_author_type ON reviews(author_id, review_type);
CREATE INDEX IF NOT EXISTS idx_reviews_type_date ON reviews(review_type, review_date);
CREATE INDEX IF NOT EXISTS idx_reviews_author_date ON reviews(author_id, review_date);

CREATE TABLE IF NOT EXISTS review_daily_reminder_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reminder_date DATE NOT NULL,
    status VARCHAR(24) DEFAULT 'sent',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, reminder_date)
);

CREATE INDEX IF NOT EXISTS idx_review_reminders_user_date ON review_daily_reminder_logs(user_id, reminder_date);
