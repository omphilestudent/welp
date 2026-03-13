const path = require('path');
const fs = require('fs');
const { query } = require('../utils/database');
const {
    getBusinessIdForUser,
    upsertPlacements,
    fetchPlacementCampaigns
} = require('../services/adsService');

const AD_ASSET_FOLDER = path.join(__dirname, '../../uploads/ads');
fs.mkdirSync(AD_ASSET_FOLDER, { recursive: true });

const VALID_STATUSES = ['draft', 'active', 'paused', 'completed'];
const VALID_BID_TYPES = ['cpc', 'cpm'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const VIDEO_EXTS = ['.mp4', '.webm', '.mov'];
const GIF_EXTS = ['.gif'];
const ALL_EXTS = [...IMAGE_EXTS, ...VIDEO_EXTS, ...GIF_EXTS];
const EXTENSION_TYPE_MAP = Object.fromEntries([
    ...IMAGE_EXTS.map((ext) => [ext, 'image']),
    ...VIDEO_EXTS.map((ext) => [ext, 'video']),
    ...GIF_EXTS.map((ext) => [ext, 'gif'])
]);

const parseList = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                const parsed = JSON.parse(trimmed);
                return parseList(parsed);
            } catch {
                // fall back to comma separated
            }
        }
        return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return [];
};

const buildAssetUrl = (req, filename) => {
    if (!filename) return null;
    const host = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    return `${host}/uploads/ads/${filename}`;
};

const parsePlacements = (raw = []) => {
    return parseList(raw).map((placement) => ({ placement, weight: 1 }));
};

const parseBehaviors = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parseBehaviors(parsed);
        } catch {
            return value.split(',').map((item) => item.trim()).filter(Boolean);
        }
    }
    return [];
};

const calculateBudgetMinor = (value) => {
    if (!value) return null;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return null;
    return Math.round(parsed * 100);
};

const createCampaign = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Media file is required' });
        }

        const businessId = await getBusinessIdForUser(req.user.id);
        if (!businessId) {
            return res.status(403).json({ error: 'Business profile owner not found' });
        }

        const ext = path.extname(req.file.originalname).toLowerCase();
        const inferredType = EXTENSION_TYPE_MAP[ext];
        const mediaType = req.body.mediaType || inferredType;

        if (!mediaType || !EXTENSION_TYPE_MAP[ext] || EXTENSION_TYPE_MAP[ext] !== mediaType) {
            return res.status(400).json({ error: 'Media type does not match file extension' });
        }

        if (!['image', 'video', 'gif'].includes(mediaType)) {
            return res.status(400).json({ error: 'Unsupported media type' });
        }

        const placements = parsePlacements(req.body.placements);
        if (!placements.length) {
            return res.status(400).json({ error: 'At least one placement is required' });
        }

        const targetLocations = parseList(req.body.targetLocations);
        const targetIndustries = parseList(req.body.targetIndustries);
        const behaviors = parseBehaviors(req.body.behaviors);

        const dailyBudget = calculateBudgetMinor(req.body.dailyBudget);
        const bidType = VALID_BID_TYPES.includes(req.body.bid_type) ? req.body.bid_type : 'cpc';
        const status = VALID_STATUSES.includes(req.body.status) ? req.body.status : 'draft';
        const name = String(req.body.name || 'Campaign').trim();

        const thumbnailUrl = req.body.thumbnailUrl || buildAssetUrl(req, req.file.filename);
        const assetUrl = buildAssetUrl(req, req.file.filename);

        const { rows } = await query(
            `INSERT INTO advertising_campaigns (
                business_id, name, media_type, asset_url, thumbnail_url,
                click_redirect_url, target_locations, target_industries,
                target_behaviors, daily_budget_minor, bid_type, status
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
            ) RETURNING *`,
            [
                businessId,
                name,
                mediaType,
                assetUrl,
                thumbnailUrl,
                req.body.clickRedirectUrl || null,
                targetLocations,
                targetIndustries,
                behaviors.length ? JSON.stringify(behaviors) : null,
                dailyBudget,
                bidType,
                status
            ]
        );

        const campaign = rows[0];
        await upsertPlacements(campaign.id, placements);

        campaign.placements = placements;
        return res.status(201).json({ campaign });
    } catch (error) {
        console.error('Create campaign error:', error);
        return res.status(500).json({ error: 'Unable to create campaign' });
    }
};

const buildCampaignsQuery = async (filters = [], params = []) => {
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
        ORDER BY c.created_at DESC
        `,
        params
    );

    return result.rows;
};

const listCampaigns = async (req, res) => {
    try {
        const filters = [];
        const params = [];

        if (req.query.businessId) {
            params.push(req.query.businessId);
            filters.push(`c.business_id = $${params.length}`);
        }
        if (req.query.status) {
            params.push(req.query.status);
            filters.push(`c.status = $${params.length}`);
        } else if (req.query.active === 'true') {
            filters.push(`c.status = 'active'`);
        }

        const campaigns = await buildCampaignsQuery(filters, params);
        return res.json({ campaigns });
    } catch (error) {
        console.error('List campaigns error:', error);
        return res.status(500).json({ error: 'Unable to list campaigns' });
    }
};

const listMyCampaigns = async (req, res) => {
    try {
        const businessId = await getBusinessIdForUser(req.user.id);
        if (!businessId) {
            return res.status(403).json({ error: 'Business profile owner not found' });
        }

        const campaigns = await buildCampaignsQuery([`c.business_id = $1`], [businessId]);
        return res.json({ campaigns });
    } catch (error) {
        console.error('List my campaigns error:', error);
        return res.status(500).json({ error: 'Unable to list your campaigns' });
    }
};

const updateCampaign = async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = await getBusinessIdForUser(req.user.id);
        if (!businessId) {
            return res.status(403).json({ error: 'Business profile owner not found' });
        }

        const existing = await query('SELECT * FROM advertising_campaigns WHERE id = $1', [id]);
        if (!existing.rows.length) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        if (existing.rows[0].business_id !== businessId) {
            return res.status(403).json({ error: 'Not authorized to edit this campaign' });
        }

        const updates = [];
        const params = [];

        const setField = (column, value) => {
            if (value === undefined) return;
            params.push(value);
            updates.push(`${column} = $${params.length}`);
        };

        if (req.file) {
            const ext = path.extname(req.file.originalname).toLowerCase();
            const inferred = EXTENSION_TYPE_MAP[ext];
            const mediaType = req.body.mediaType || inferred;
            if (!inferred || inferred !== mediaType) {
                return res.status(400).json({ error: 'Media type mismatch' });
            }
            setField('media_type', mediaType);
            const assetUrl = buildAssetUrl(req, req.file.filename);
            setField('asset_url', assetUrl);
            setField('thumbnail_url', req.body.thumbnailUrl || assetUrl);
        }

        if (req.body.name) setField('name', String(req.body.name).trim());
        if (req.body.clickRedirectUrl) setField('click_redirect_url', req.body.clickRedirectUrl);
        if (req.body.dailyBudget) setField('daily_budget_minor', calculateBudgetMinor(req.body.dailyBudget));
        if (req.body.bid_type && VALID_BID_TYPES.includes(req.body.bid_type)) setField('bid_type', req.body.bid_type);
        if (req.body.status && VALID_STATUSES.includes(req.body.status)) setField('status', req.body.status);

        const targetLocations = parseList(req.body.targetLocations);
        const targetIndustries = parseList(req.body.targetIndustries);
        const behaviors = parseBehaviors(req.body.behaviors);
        if (targetLocations.length) setField('target_locations', targetLocations);
        if (targetIndustries.length) setField('target_industries', targetIndustries);
        if (behaviors.length) setField('target_behaviors', JSON.stringify(behaviors));

        if (updates.length) {
            await query(`UPDATE advertising_campaigns SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${params.length + 1}`, [...params, id]);
        }

        const placements = parsePlacements(req.body.placements);
        if (placements.length) {
            await upsertPlacements(id, placements);
        }

        const refreshed = await buildCampaignsQuery(['c.id = $1'], [id]);
        return res.json({ campaign: refreshed[0] || null });
    } catch (error) {
        console.error('Update campaign error:', error);
        return res.status(500).json({ error: 'Unable to update campaign' });
    }
};

const deleteCampaign = async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = await getBusinessIdForUser(req.user.id);
        if (!businessId) {
            return res.status(403).json({ error: 'Business profile owner not found' });
        }

        const existing = await query('SELECT business_id FROM advertising_campaigns WHERE id = $1', [id]);
        if (!existing.rows.length) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        if (existing.rows[0].business_id !== businessId) {
            return res.status(403).json({ error: 'Not authorized to delete this campaign' });
        }

        await query('DELETE FROM advertising_campaigns WHERE id = $1', [id]);
        return res.json({ success: true });
    } catch (error) {
        console.error('Delete campaign error:', error);
        return res.status(500).json({ error: 'Unable to delete campaign' });
    }
};

const getPlacementAds = async (req, res) => {
    try {
        const placement = req.query.placement || 'recommended';
        const location = req.query.location;
        const industry = req.query.industry;
        const behaviors = parseList(req.query.behaviors);

        const campaigns = await fetchPlacementCampaigns({ placement, location, industry, behaviors });
        return res.json({ campaigns });
    } catch (error) {
        console.error('Fetch placement ads error:', error);
        return res.status(500).json({ error: 'Unable to load ads' });
    }
};

const recordImpression = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(
            `UPDATE advertising_campaigns
             SET impressions = impressions + 1
             WHERE id = $1
             RETURNING impressions`,
            [id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        return res.json({ impressions: result.rows[0].impressions });
    } catch (error) {
        console.error('Impression error:', error);
        return res.status(500).json({ error: 'Unable to track impression' });
    }
};

const recordClick = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(
            `UPDATE advertising_campaigns
             SET clicks = clicks + 1
             WHERE id = $1
             RETURNING clicks, click_redirect_url`,
            [id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        const campaign = result.rows[0];
        return res.json({ clicks: campaign.clicks, redirectUrl: campaign.click_redirect_url });
    } catch (error) {
        console.error('Click error:', error);
        return res.status(500).json({ error: 'Unable to track click' });
    }
};

module.exports = {
    createCampaign,
    listCampaigns,
    listMyCampaigns,
    updateCampaign,
    deleteCampaign,
    getPlacementAds,
    recordImpression,
    recordClick
};
