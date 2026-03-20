const { query } = require('../utils/database');

const STATUS = {
    submitted: 'submitted',
    pending: 'pending',
    skipped: 'skipped'
};

const getWeekStart = () => query(`SELECT date_trunc('week', NOW()) as week_start`);

const sanitizeText = (value) => {
    if (!value) return null;
    return String(value).trim().slice(0, 2000);
};

const getPendingRatingsForUser = async (userId) => {
    const result = await query(
        `SELECT
             c.id as conversation_id,
             c.ended_at,
             c.started_at,
             c.psychologist_id,
             json_build_object(
                 'id', u.id,
                 'display_name', u.display_name,
                 'avatar_url', u.avatar_url,
                 'specialization', u.specialization
             ) as psychologist
         FROM conversations c
         JOIN users u ON u.id = c.psychologist_id
         LEFT JOIN psychologist_session_ratings r
           ON r.conversation_id = c.id
          AND r.reviewer_id = $1
          AND r.status = 'submitted'
         LEFT JOIN psychologist_session_ratings p
           ON p.conversation_id = c.id
          AND p.reviewer_id = $1
          AND p.status IN ('pending', 'skipped')
         WHERE c.employee_id = $1
           AND c.status = 'ended'
           AND c.ended_at IS NOT NULL
           AND r.id IS NULL
           AND (p.reminded_at IS NULL OR p.reminded_at <= NOW())
         ORDER BY c.ended_at DESC`,
        [userId]
    );
    return result.rows;
};

const getRatingForConversation = async (conversationId, reviewerId) => {
    const result = await query(
        `SELECT *
         FROM psychologist_session_ratings
         WHERE conversation_id = $1 AND reviewer_id = $2
         LIMIT 1`,
        [conversationId, reviewerId]
    );
    return result.rows[0] || null;
};

const upsertRating = async ({ conversationId, psychologistId, reviewerId, ratingValue, reviewText }) => {
    const cleanText = sanitizeText(reviewText);
    const now = new Date();
    const existing = await getRatingForConversation(conversationId, reviewerId);
    if (existing && existing.status === STATUS.submitted) {
        return { rating: existing, isDuplicate: true };
    }

    const result = await query(
        `INSERT INTO psychologist_session_ratings
         (conversation_id, psychologist_id, reviewer_id, rating_value, review_text, status, submitted_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
         ON CONFLICT (conversation_id, reviewer_id)
         DO UPDATE SET
            rating_value = EXCLUDED.rating_value,
            review_text = EXCLUDED.review_text,
            status = EXCLUDED.status,
            submitted_at = EXCLUDED.submitted_at,
            updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [conversationId, psychologistId, reviewerId, ratingValue, cleanText, STATUS.submitted, now]
    );
    return { rating: result.rows[0], isDuplicate: false };
};

const deferRating = async ({ conversationId, psychologistId, reviewerId, remindAfterHours = 24 }) => {
    const remindAt = new Date(Date.now() + remindAfterHours * 60 * 60 * 1000);
    const result = await query(
        `INSERT INTO psychologist_session_ratings
         (conversation_id, psychologist_id, reviewer_id, status, reminded_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (conversation_id, reviewer_id)
         DO UPDATE SET
            status = EXCLUDED.status,
            reminded_at = EXCLUDED.reminded_at,
            updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [conversationId, psychologistId, reviewerId, STATUS.pending, remindAt]
    );
    return result.rows[0];
};

const getPsychologistRatingSummary = async (psychologistId) => {
    const result = await query(
        `WITH base AS (
            SELECT
                rating_value,
                created_at
            FROM psychologist_session_ratings
            WHERE psychologist_id = $1
              AND status = 'submitted'
              AND rating_value IS NOT NULL
        )
        SELECT
            COALESCE(AVG(rating_value)::numeric(10,2), 0) as overall_avg,
            COUNT(*)::int as overall_count,
            COALESCE(AVG(rating_value) FILTER (WHERE created_at >= date_trunc('week', NOW()))::numeric(10,2), 0) as weekly_avg,
            COUNT(*) FILTER (WHERE created_at >= date_trunc('week', NOW()))::int as weekly_count,
            COALESCE(AVG(rating_value) FILTER (WHERE created_at >= date_trunc('month', NOW()))::numeric(10,2), 0) as monthly_avg,
            COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW()))::int as monthly_count
        FROM base`,
        [psychologistId]
    );
    const summary = result.rows[0] || {};
    const comments = await query(
        `SELECT review_text, rating_value, created_at
         FROM psychologist_session_ratings
         WHERE psychologist_id = $1
           AND status = 'submitted'
           AND review_text IS NOT NULL
         ORDER BY created_at DESC
         LIMIT 4`,
        [psychologistId]
    );
    return {
        ...summary,
        recent_comments: comments.rows || []
    };
};

const getPsychologistRatingAggregates = async (psychologistIds = []) => {
    if (!psychologistIds.length) return new Map();
    try {
        const result = await query(
            `SELECT
                 psychologist_id,
                 COALESCE(AVG(rating_value), 0) as avg_rating,
                 COUNT(*)::int as rating_count,
                 COALESCE(AVG(rating_value) FILTER (WHERE created_at >= date_trunc('week', NOW())), 0) as weekly_avg,
                 COALESCE(AVG(rating_value) FILTER (WHERE created_at >= date_trunc('month', NOW())), 0) as monthly_avg
             FROM psychologist_session_ratings
             WHERE psychologist_id = ANY($1::uuid[])
               AND status = 'submitted'
               AND rating_value IS NOT NULL
             GROUP BY psychologist_id`,
            [psychologistIds]
        );
        const map = new Map();
        result.rows.forEach((row) => {
            map.set(row.psychologist_id, {
                avg: Number(row.avg_rating || 0),
                count: Number(row.rating_count || 0),
                weeklyAvg: Number(row.weekly_avg || 0),
                monthlyAvg: Number(row.monthly_avg || 0)
            });
        });
        return map;
    } catch (error) {
        console.warn('Rating aggregates unavailable:', error?.message || error);
        return new Map();
    }
};

const getRecommendationScore = ({ avg = 0, count = 0, weeklyAvg = 0, monthlyAvg = 0 }) => {
    const safeAvg = avg || 0;
    const volumeFactor = Math.min(count, 20) / 20;
    const recency = (weeklyAvg || safeAvg) * 0.6 + (monthlyAvg || safeAvg) * 0.4;
    const baseScore = safeAvg * 0.6 + recency * 0.4;
    const volumeBoost = 0.7 + volumeFactor * 0.3;
    const lowSamplePenalty = count > 0 && count < 3 ? 0.85 : 1;
    return baseScore * volumeBoost * lowSamplePenalty;
};

module.exports = {
    STATUS,
    getPendingRatingsForUser,
    upsertRating,
    deferRating,
    getPsychologistRatingSummary,
    getPsychologistRatingAggregates,
    getRecommendationScore
};
