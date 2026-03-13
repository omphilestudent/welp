const path = require('path');
const { query } = require('../utils/database');

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
    const filters = ["c.status = 'active'"];
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

module.exports = {
    getBusinessIdForUser,
    upsertPlacements,
    validateMediaType,
    fetchPlacementCampaigns
};
