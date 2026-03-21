-- Add duration-based psychologist rate options (15/30/60)

ALTER TABLE psychologist_rates
    ADD COLUMN IF NOT EXISTS duration_minutes INT NOT NULL DEFAULT 60;

UPDATE psychologist_rates
SET duration_minutes = 60
WHERE duration_minutes IS NULL;

ALTER TABLE psychologist_rates
    DROP CONSTRAINT IF EXISTS psychologist_rates_duration_type_check;

ALTER TABLE psychologist_rates
    ADD CONSTRAINT psychologist_rates_duration_type_check
        CHECK (duration_type IN ('per_hour', 'per_minute', 'per_session'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_psych_rates_duration
    ON psychologist_rates(psychologist_id, duration_minutes);
