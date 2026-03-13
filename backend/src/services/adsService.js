const path = require('path');
const { query } = require('../utils/database');
const { getActiveSubscription, PLAN_LIMITS } = require('./subscriptionService');
const { hasPremiumException } = require('../utils/premiumAccess');

const ACCEPTED_MEDIA_TYPES = ['image', 'video', 'gif'];

const getBusinessIdForUser = async (userId) => {
    const result = await query(
        'SELECT id FROM businesses WHERE owner_user_id = $1 LIMIT 1',
        [userId]
    );
    return result.rows[0]?.id || null;
};

const upsertPlacements = async (campaignId, placements = []) => {
    await query('DELETE FROM ad_placements WHERE campaign_id = $1', [campaignId]);
    if (!placements.length) return;

    const values = [];
    const params = [];
    placements.forEach((placement) => {
        const weight = Number(placement.weight ?? 1);
        params.push(campaignId, placement.placement, weight);
        values.push(`($${params.length - 2}, $${params.length - 1}, $${params.length})`);
    });

    if (values.length) {
        await query(
            `INSERT INTO ad_placements (campaign_id, placement, weight)
             VALUES ${values.join(', ')}`,
            params
        );
    }
};

const validateMediaType = (filename, mediaType) => {
    if (!mediaType || !ACCEPTED_MEDIA_TYPES.includes(mediaType)) {
        return false;
    }
    return true;
};

const buildPlacementFilter = (filters, params, placement) => {
    if (!placement) return;
    params.push(placement);
    filters.push(`EXISTS (
        SELECT 1 FROM ad_placements ap
        WHERE ap.campaign_id = c.id AND ap.placement = $${params.length}
    )`);
};

const buildArrayFilter = (filters, params, value, column) => {
    if (!value) return;
    params.push(value);
    filters.push(`(${column} IS NULL OR array_length(${column}, 1) = 0 OR $${params.length} = ANY(${column}))`);
};

const buildBehaviorFilter = (filters, params, behaviors = []) => {
    if (!behaviors.length) return;
    params.push(behaviors);
    filters.push(`(
        target_behaviors IS NULL OR
        jsonb_array_length(target_behaviors) = 0 OR
        target_behaviors ?| $${params.length}
    )`);
};

const fetchPlacementCampaigns = async ({ placement, location, industry, behaviors = [] }) => {
    const filters = ["c.status = 'active'", "c.review_status = 'approved'"];
    const params = [];

    buildPlacementFilter(filters, params, placement);
    buildArrayFilter(filters, params, location, 'c.target_locations');
    buildArrayFilter(filters, params, industry, 'c.target_industries');
    buildBehaviorFilter(filters, params, behaviors);

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await query(
        `
        SELECT
            c.*,
            (
                SELECT jsonb_agg(jsonb_build_object('placement', ap.placement, 'weight', ap.weight))
                FROM ad_placements ap
                WHERE ap.campaign_id = c.id
            ) AS placements
        FROM advertising_campaigns c
        ${whereClause}
        ORDER BY (SELECT COALESCE(MAX(ap.weight), 0) FROM ad_placements ap WHERE ap.campaign_id = c.id) DESC,
                 c.daily_budget_minor DESC,
                 c.impressions ASC
        LIMIT 10
        `,
        params
    );

    return result.rows;
};

const getBusinessOwner = async (businessId) => {
    const result = await query(
        `SELECT b.id,
                b.name,
                b.subscription_tier,
                b.subscription_expires,
                u.id   AS owner_user_id,
                u.email,
                u.display_name
         FROM businesses b
         LEFT JOIN users u ON u.id = b.owner_user_id
         WHERE b.id = $1`,
        [businessId]
    );
    return result.rows[0] || null;
};

const getBusinessAdCapabilities = async ({ userId, email }) => {
    if (!userId) {
        return { tier: 'base', maxActive: 0, analyticsMode: 'limited', premiumException: false };
    }

    const premiumOverride = hasPremiumException(email);
    if (premiumOverride) {
        return {
            tier: 'premium',
            maxActive: Infinity,
            analyticsMode: 'advanced',
            premiumException: true
        };
    }

    const record = await getActiveSubscription('business', userId);
    const planCode = record?.plan_code || 'business_base';
    const snapshot = record?.limit_snapshot?.ads || {};
    const planDefaults = (PLAN_LIMITS[planCode] || PLAN_LIMITS.business_base || {}).ads || {};
    const rawMax = snapshot.maxActive ?? planDefaults.maxActive;
    const analyticsMode = snapshot.analytics || planDefaults.analytics || 'limited';

    return {
        tier: PLAN_LIMITS[planCode]?.tier || 'base',
        maxActive: rawMax === null || rawMax === undefined ? Infinity : Number(rawMax),
        analyticsMode,
        premiumException: false
    };
};

const countActiveCampaigns = async (businessId) => {
    const result = await query(
        `SELECT COUNT(*)::int AS total
         FROM advertising_campaigns
         WHERE business_id = $1
           AND status IN ('pending_review','active')
           AND review_status IN ('pending','approved')
           AND override_restrictions = false`,
        [businessId]
    );
    return Number(result.rows[0]?.total || 0);
};

const formatAnalyticsForTier = (campaign, analyticsMode = 'limited') => {
    const ctr = campaign.impressions > 0
        ? Number(((campaign.clicks / campaign.impressions) * 100).toFixed(2))
        : 0;

    const base = {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        review_status: campaign.review_status,
        impressions: campaign.impressions,
        clicks: campaign.clicks,
        placements: campaign.placements,
        submitted_at: campaign.submitted_at,
        reviewed_at: campaign.reviewed_at,
        review_notes: campaign.review_notes,
        override_restrictions: campaign.override_restrictions,
        media_type: campaign.media_type
    };

    if (analyticsMode === 'limited') {
        return base;
    }

    const enriched = {
        ...base,
        ctr
    };

    if (analyticsMode === 'advanced') {
        enriched.daily_budget_minor = campaign.daily_budget_minor;
        enriched.bid_rate_minor = campaign.bid_rate_minor;
        enriched.spend_minor = campaign.spend_minor;
    }

    if (analyticsMode !== 'advanced') {
        return enriched;
    }

    return enriched;
};

module.exports = {
    getBusinessIdForUser,
    getBusinessOwner,
    upsertPlacements,
    validateMediaType,
    fetchPlacementCampaigns,
    getBusinessAdCapabilities,
    countActiveCampaigns,
    formatAnalyticsForTier
};
