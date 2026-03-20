-- Voice note support for messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(24) DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_mime TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_duration INT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_meta JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);

-- Ensure auto-approved companies become visible
UPDATE companies
SET status = 'active',
    updated_at = CURRENT_TIMESTAMP
WHERE (status IS NULL OR status IN ('pending', 'pending_review', 'review'))
  AND is_verified = true;
