ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;

UPDATE users
SET is_anonymous = COALESCE(is_anonymous, false);

ALTER TABLE users
    ALTER COLUMN is_anonymous SET DEFAULT false;

ALTER TABLE users
    ALTER COLUMN is_anonymous SET NOT NULL;
