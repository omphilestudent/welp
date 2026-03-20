const { ensureChatQuota } = require('../services/chatQuotaService');
const { getActiveSubscription, PLAN_LIMITS } = require('../services/subscriptionService');
const { query } = require('../utils/database');
const { getBusinessPlanSnapshotByOwner, getBusinessDailyApiLimit } = require('../utils/businessPlan');
const { incrementUsage } = require('../services/businessApiUsageService');
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

            if (hasPremiumException(req.user)) {
                return next();
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
    if (hasPremiumException(user)) {
        return;
    }

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

    const businessPlan = await getBusinessPlanSnapshotByOwner(user.id);
    const dailyLimit = getBusinessDailyApiLimit(businessPlan);
    if (!Number.isFinite(dailyLimit) || dailyLimit <= 0) {
        const error = new Error('API access is not enabled for this plan');
        error.statusCode = 403;
        throw error;
    }

    const businessRecord = await query(
        `SELECT id
         FROM companies
         WHERE COALESCE(claimed_by, created_by_user_id) = $1
         LIMIT 1`,
        [user.id]
    );
    if (!businessRecord.rows.length) {
        return;
    }

    const usage = await incrementUsage({
        companyId: businessRecord.rows[0].id,
        dailyLimit
    });

    if (usage.exceeded) {
        const error = new Error('Daily API quota reached');
        error.statusCode = 429;
        throw error;
    }
};

module.exports = {
    applyTierLimits,
    ROLE_TO_OWNER
};
