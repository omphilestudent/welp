const { query } = require('../utils/database');

const normalizeDate = (date) => {
    if (!date) return new Date();
    return new Date(date);
};

const getUsageRecord = async (companyId, usageDate = new Date()) => {
    if (!companyId) return null;
    const date = normalizeDate(usageDate);
    const result = await query(
        `SELECT company_id, usage_date, request_count, updated_at
         FROM business_api_usage_daily
         WHERE company_id = $1 AND usage_date = $2::date
         LIMIT 1`,
        [companyId, date]
    );
    return result.rows[0] || null;
};

const incrementUsage = async ({ companyId, apiKeyId = null, dailyLimit }) => {
    if (!companyId) {
        const error = new Error('Company ID is required');
        error.statusCode = 400;
        throw error;
    }

    if (!Number.isFinite(dailyLimit) || dailyLimit <= 0) {
        return { requestCount: 0, exceeded: false };
    }

    const result = await query(
        `INSERT INTO business_api_usage_daily (company_id, api_key_id, usage_date, request_count)
         VALUES ($1, $2, CURRENT_DATE, 1)
         ON CONFLICT (company_id, usage_date)
         DO UPDATE SET request_count = business_api_usage_daily.request_count + 1,
                       updated_at = CURRENT_TIMESTAMP
         WHERE business_api_usage_daily.request_count < $3
         RETURNING request_count`,
        [companyId, apiKeyId, dailyLimit]
    );

    if (result.rows.length === 0) {
        const existing = await getUsageRecord(companyId, new Date());
        return { requestCount: existing?.request_count ?? dailyLimit, exceeded: true };
    }

    return { requestCount: Number(result.rows[0].request_count || 0), exceeded: false };
};

module.exports = {
    getUsageRecord,
    incrementUsage
};
