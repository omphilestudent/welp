CREATE TABLE IF NOT EXISTS psychologist_session_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating_value INT CHECK (rating_value IS NULL OR (rating_value >= 1 AND rating_value <= 5)),
    review_text TEXT,
    status VARCHAR(24) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'pending', 'skipped')),
    reminded_at TIMESTAMP,
    submitted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (conversation_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_psych_session_ratings_psych_created
    ON psychologist_session_ratings (psychologist_id, created_at);

CREATE INDEX IF NOT EXISTS idx_psych_session_ratings_conversation
    ON psychologist_session_ratings (conversation_id);

CREATE INDEX IF NOT EXISTS idx_psych_session_ratings_reviewer
    ON psychologist_session_ratings (reviewer_id);
