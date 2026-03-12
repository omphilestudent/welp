const { query } = require('../utils/database');
const { analyzeSentiment } = require('./mlServices');
const { createAdminNotification } = require('../utils/adminNotifications');

const clampRating = (value) => Math.max(1, Math.min(5, value));

const deriveRatingFromScore = (score) => {
    const normalized = Math.max(0, Math.min(1, score ?? 0.5));
    return clampRating(Math.round(normalized * 4 + 1));
};

const formatReviewContent = (text, fallback) => {
    const source = text?.trim() || fallback;
    if (!source) return fallback;
    return source.length > 500 ? `${source.slice(0, 400)}…` : source;
};

const generateAutoReview = async ({ companyId, userId, companyName, description }) => {
    const reviewSource = formatReviewContent(
        description,
        `Auto-generated review for ${companyName || 'the company'} submission.`
    );

    let sentiment = { sentiment: 'neutral', score: 0.5 };
    try {
        const sentimentResult = await analyzeSentiment(reviewSource);
        if (sentimentResult && typeof sentimentResult === 'object') {
            sentiment = sentimentResult;
        }
    } catch (err) {
        console.warn('Auto review sentiment call failed:', err.message);
    }

    const rating = deriveRatingFromScore(sentiment.score);

    const result = await query(
        `INSERT INTO reviews (
            company_id,
            author_id,
            rating,
            content,
            is_public,
            sentiment_label,
            sentiment_score,
            moderation_status,
            moderation_reason,
            is_flagged,
            flag_reason
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [
            companyId,
            userId,
            rating,
            reviewSource,
            false,
            sentiment.sentiment,
            sentiment.score,
            'pending_auto_review',
            'ML generated auto-review for new company',
            false,
            null
        ]
    );

    const reviewId = result.rows[0]?.id;
    if (reviewId) {
        await createAdminNotification({
            type: 'auto_review',
            message: `ML auto review created for ${companyName || 'a new company'}`,
            entityType: 'review',
            entityId: reviewId
        });
    }
};

module.exports = {
    generateAutoReview,
    deriveRatingFromScore,
    formatReviewContent
};
