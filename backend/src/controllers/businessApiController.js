const { query } = require('../utils/database');
const { businessHasFeature } = require('../utils/businessPlan');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getBusinessApiAnalytics = async (req, res) => {
    try {
        const companyId = req.businessApiKey?.company_id;
        if (!companyId || !UUID_REGEX.test(companyId)) {
            return res.status(400).json({ error: 'Invalid business reference' });
        }

        if (!businessHasFeature(req.businessPlan, 'analytics')) {
            return res.status(403).json({
                error: 'Plan upgrade required',
                code: 'PLAN_UPGRADE_REQUIRED',
                feature: 'analytics',
                plan: req.businessPlan?.planCode || 'business_free_tier'
            });
        }

        const metricsResult = await query(
            `SELECT
                 ROUND(COALESCE(AVG(r.rating), 0)::numeric, 2) as avg_rating,
                 COUNT(r.id) as total_reviews,
                 COUNT(CASE WHEN COALESCE(r.is_anonymous, u.is_anonymous, false) THEN 1 END) as anonymous_reviews,
                 COUNT(CASE WHEN NOT COALESCE(r.is_anonymous, u.is_anonymous, false) THEN 1 END) as employee_reviews
             FROM reviews r
                      LEFT JOIN users u ON r.author_id = u.id
             WHERE r.company_id = $1`,
            [companyId]
        );

        const distributionResult = await query(
            `SELECT rating, COUNT(*) as count
             FROM reviews
             WHERE company_id = $1
             GROUP BY rating`,
            [companyId]
        );

        const metrics = metricsResult.rows[0] || {};
        const totalReviews = Number(metrics.total_reviews || 0);
        const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        distributionResult.rows.forEach((row) => {
            const rating = Number(row.rating);
            if (ratingDistribution[rating] !== undefined) {
                ratingDistribution[rating] = Number(row.count || 0);
            }
        });

        return res.json({
            averageRating: Number(metrics.avg_rating || 0).toFixed(2),
            totalReviews,
            ratingDistribution,
            employeeVsAnonymous: {
                employee: Number(metrics.employee_reviews || 0),
                anonymous: Number(metrics.anonymous_reviews || 0)
            }
        });
    } catch (error) {
        console.error('Business API analytics error:', error);
        return res.status(500).json({ error: 'Failed to fetch analytics' });
    }
};

const getBusinessApiReviews = async (req, res) => {
    try {
        const companyId = req.businessApiKey?.company_id;
        if (!companyId || !UUID_REGEX.test(companyId)) {
            return res.status(400).json({ error: 'Invalid business reference' });
        }

        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const offset = (page - 1) * limit;

        const result = await query(
            `SELECT r.*, u.display_name as author_name
             FROM reviews r
                      LEFT JOIN users u ON r.author_id = u.id
             WHERE r.company_id = $1
               AND r.is_public = true
             ORDER BY r.created_at DESC
             LIMIT $2 OFFSET $3`,
            [companyId, limit, offset]
        );

        res.json({ reviews: result.rows, page, limit });
    } catch (error) {
        console.error('Business API reviews error:', error);
        return res.status(500).json({ error: 'Failed to fetch reviews' });
    }
};

module.exports = {
    getBusinessApiAnalytics,
    getBusinessApiReviews
};
