const crypto = require('crypto');
const { query } = require('../utils/database');
const { getBusinessPlanSnapshotByBusinessId, getBusinessDailyApiLimit } = require('../utils/businessPlan');
const { incrementUsage } = require('../services/businessApiUsageService');

const hashKey = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

const authenticateBusinessApiKey = async (req, res, next) => {
    try {
        const rawKey = req.headers['x-api-key'] || req.headers['x-api-key'.toLowerCase()];
        if (!rawKey) {
            return res.status(401).json({ error: 'API key is required' });
        }

        const keyHash = hashKey(String(rawKey).trim());
        const result = await query(
            `SELECT id, company_id, revoked_at
             FROM business_api_keys
             WHERE key_hash = $1
             LIMIT 1`,
            [keyHash]
        );

        if (result.rows.length === 0 || result.rows[0].revoked_at) {
            return res.status(401).json({ error: 'Invalid API key' });
        }

        const apiKey = result.rows[0];
        await query(
            `UPDATE business_api_keys
             SET last_used_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [apiKey.id]
        );

        req.businessApiKey = apiKey;
        return next();
    } catch (error) {
        console.error('API key authentication failed:', error);
        return res.status(500).json({ error: 'Unable to authenticate API key' });
    }
};

const enforceBusinessApiLimit = async (req, res, next) => {
    try {
        const apiKey = req.businessApiKey;
        if (!apiKey?.company_id) {
            return res.status(400).json({ error: 'API key is not linked to a business' });
        }

        const planSnapshot = await getBusinessPlanSnapshotByBusinessId(apiKey.company_id);
        const dailyLimit = getBusinessDailyApiLimit(planSnapshot);
        if (!Number.isFinite(dailyLimit) || dailyLimit <= 0) {
            return res.status(403).json({
                error: 'API access is not enabled for this plan',
                code: 'PLAN_UPGRADE_REQUIRED',
                plan: planSnapshot?.planCode || 'business_free_tier'
            });
        }

        const usage = await incrementUsage({
            companyId: apiKey.company_id,
            apiKeyId: apiKey.id,
            dailyLimit
        });

        const remaining = Math.max(dailyLimit - usage.requestCount, 0);
        res.setHeader('X-RateLimit-Limit', dailyLimit);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', new Date(new Date().setHours(24, 0, 0, 0)).toISOString());

        if (usage.exceeded) {
            return res.status(429).json({
                error: 'Daily API quota reached',
                code: 'DAILY_API_LIMIT_REACHED',
                limit: dailyLimit
            });
        }

        req.businessPlan = planSnapshot;
        return next();
    } catch (error) {
        console.error('API quota enforcement failed:', error);
        return res.status(500).json({ error: 'Unable to enforce API usage limit' });
    }
};

module.exports = {
    authenticateBusinessApiKey,
    enforceBusinessApiLimit
};
