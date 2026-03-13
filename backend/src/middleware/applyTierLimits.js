const { ensureChatQuota } = require('../services/chatQuotaService');
const { getActiveSubscription, PLAN_LIMITS } = require('../services/subscriptionService');
const { query } = require('../utils/database');
const { hasPremiumException } = require('../utils/premiumAccess');

const ROLE_TO_OWNER = {
    employee: 'user',
    psychologist: 'psychologist',
    business: 'business'
};

const applyTierLimits = (options = {}) => {
    const feature = options.feature || 'chat';
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            if (feature === 'chat') {
                await ensureChatQuota(req.user, options.minutes || 1);
            } else if (feature === 'video') {
                await enforceVideoQuota(req.user);
            } else if (feature === 'api') {
                await enforceApiQuota(req.user);
            }

            next();
        } catch (error) {
            const statusCode = error.statusCode || 429;
            res.status(statusCode).json({ error: error.message || 'Quota exceeded' });
        }
    };
};

const enforceVideoQuota = async (user) => {
    const role = (user.role || '').toLowerCase();
    if (role !== 'employee') {
        return;
    }

    const subscription = await getActiveSubscription('user', user.id);
    const limitSnapshot = subscription?.limit_snapshot?.video || {};
    const planLimits = PLAN_LIMITS[subscription?.plan_code || 'user_free'] || PLAN_LIMITS.user_free;
    const allowedSessions = Number(
        limitSnapshot.sessionsPerWeek
        ?? planLimits?.videoSessionsPerWeek
        ?? PLAN_LIMITS.user_free?.videoSessionsPerWeek
        ?? 1
    );

    if (!allowedSessions || allowedSessions <= 0) {
        return;
    }

    const result = await query(
        `SELECT COUNT(*)::int AS sessions
         FROM call_logs
         WHERE employee_id = $1
           AND media_type = 'video'
           AND started_at >= NOW() - INTERVAL '7 days'`,
        [user.id]
    );

    const sessions = Number(result.rows[0]?.sessions || 0);
    if (sessions >= allowedSessions) {
        const error = new Error('Weekly video session quota reached');
        error.statusCode = 429;
        throw error;
    }
};

const enforceApiQuota = async (user) => {
    const role = (user.role || '').toLowerCase();
    if (role !== 'business' || hasPremiumException(user)) {
        return;
    }

    const result = await query(
        `SELECT id, api_call_limit, api_calls_used
         FROM businesses
         WHERE owner_user_id = $1
         LIMIT 1`,
        [user.id]
    );

    if (result.rows.length === 0) {
        return;
    }

    const business = result.rows[0];
    const limit = Number(business.api_call_limit || 0);
    const used = Number(business.api_calls_used || 0);

    if (limit > 0 && used >= limit) {
        const error = new Error('Daily API quota reached');
        error.statusCode = 429;
        throw error;
    }

    await query(
        `UPDATE businesses
         SET api_calls_used = api_calls_used + 1
         WHERE id = $1`,
        [business.id]
    );
};

module.exports = {
    applyTierLimits,
    ROLE_TO_OWNER
};
