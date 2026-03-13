const { query } = require('../utils/database');
const { PLAN_LIMITS } = require('./subscriptionService');

const getLimitForTier = (tier = 'free') => {
    if (tier === 'premium') {
        return PLAN_LIMITS.user_premium?.chatMinutes ?? 120;
    }
    return PLAN_LIMITS.user_free?.chatMinutes ?? 30;
};

const getTodayKey = () => {
    return new Date().toISOString().split('T')[0];
};

const fetchUsage = async (userId, quotaDate) => {
    const result = await query(
        'SELECT used_minutes FROM chat_quota_usage WHERE user_id = $1 AND quota_date = $2',
        [userId, quotaDate]
    );
    return result.rows[0]?.used_minutes ?? 0;
};

const incrementUsage = async (userId, minutes = 1, maxMinutes) => {
    const quotaDate = getTodayKey();
    await query(
        `INSERT INTO chat_quota_usage (user_id, quota_date, used_minutes, max_minutes)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, quota_date)
             DO UPDATE
             SET used_minutes = chat_quota_usage.used_minutes + EXCLUDED.used_minutes,
                 updated_at = CURRENT_TIMESTAMP`,
        [userId, quotaDate, minutes, maxMinutes]
    );
};

const ensureChatQuota = async (user, minutes = 1) => {
    const quotaDate = getTodayKey();
    const limit = getLimitForTier(user.subscription_tier);
    const used = await fetchUsage(user.id, quotaDate);

    if (used + minutes > limit) {
        const error = new Error('Daily chat quota exceeded');
        error.statusCode = 403;
        throw error;
    }

    await incrementUsage(user.id, minutes, limit);
    return {
        used: used + minutes,
        limit
    };
};

module.exports = {
    getLimitForTier,
    ensureChatQuota
};
