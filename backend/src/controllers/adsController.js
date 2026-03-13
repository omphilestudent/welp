const path = require('path');
const fs = require('fs');
const { query } = require('../utils/database');
const {
    getBusinessIdForUser,
    getBusinessOwner,
    upsertPlacements,
    fetchPlacementCampaigns,
    getBusinessAdCapabilities,
    countActiveCampaigns,
    formatAnalyticsForTier
} = require('../services/adsService');
const { recordAuditLog } = require('../utils/auditLogger');
const { hasPremiumException } = require('../utils/premiumAccess');

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

const resolveMinorAmount = (majorValue, minorValue) => {
    if (minorValue !== undefined && minorValue !== null) {
        const parsedMinor = Number(minorValue);
        if (!Number.isNaN(parsedMinor)) {
            return Math.max(0, Math.round(parsedMinor));
        }
    }
    return calculateBudgetMinor(majorValue);
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

        const capabilities = await getBusinessAdCapabilities({ userId: req.user.id, email: req.user.email });
        const existingActive = await countActiveCampaigns(businessId);
        if (Number.isFinite(capabilities.maxActive) && existingActive >= capabilities.maxActive) {
            return res.status(403).json({
                error: `Ad limit reached for your plan (${capabilities.maxActive} active ads).`
            });
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

        const dailyBudgetMinor = resolveMinorAmount(req.body.dailyBudget, req.body.dailyBudgetMinor);
        const bidRateMinor = resolveMinorAmount(req.body.bidRate, req.body.bidRateMinor) || 0;
        const bidType = VALID_BID_TYPES.includes(req.body.bid_type) ? req.body.bid_type : 'cpc';
        const name = String(req.body.name || 'Campaign').trim();

        const thumbnailUrl = req.body.thumbnailUrl || buildAssetUrl(req, req.file.filename);
        const assetUrl = buildAssetUrl(req, req.file.filename);
        const premiumOwner = hasPremiumException({ email: req.user.email });
        const statusValue = premiumOwner ? 'active' : 'pending_review';
        const reviewStatusValue = premiumOwner ? 'approved' : 'pending';
        const submittedAt = new Date();

        const { rows } = await query(
            `INSERT INTO advertising_campaigns (
                business_id,
                name,
                media_type,
                asset_url,
                thumbnail_url,
                click_redirect_url,
                target_locations,
                target_industries,
                target_behaviors,
                daily_budget_minor,
                bid_type,
                bid_rate_minor,
                status,
                review_status,
                submitted_at
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
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
                dailyBudgetMinor,
                bidType,
                bidRateMinor,
                statusValue,
                reviewStatusValue,
                submittedAt
            ]
        );

        const campaign = rows[0];
        await upsertPlacements(campaign.id, placements);

        campaign.placements = placements;

        await recordAuditLog({
            userId: req.user.id,
            actorRole: 'business',
            action: 'ad.created',
            entityType: 'advertising_campaign',
            entityId: campaign.id,
            newValues: { name, mediaType, businessId },
            metadata: { source: 'dashboard' },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.status(201).json({ campaign, capabilities });
    } catch (error) {
        console.error('Create campaign error:', error);
        return res.status(500).json({ error: 'Unable to create campaign' });
    }
};

const buildCampaignsQuery = async (filters = [], params = [], options = {}) => {
    if (!options.includeAllStatuses) {
        filters.push(`c.review_status = 'approved'`);
    }
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
        let includeAllStatuses = false;

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
        if (req.query.reviewStatus && ['pending', 'approved', 'rejected'].includes(req.query.reviewStatus)) {
            params.push(req.query.reviewStatus);
            filters.push(`c.review_status = $${params.length}`);
            includeAllStatuses = true;
        }

        const campaigns = await buildCampaignsQuery(filters, params, { includeAllStatuses });
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

        const capabilities = await getBusinessAdCapabilities({ userId: req.user.id, email: req.user.email });
        const campaigns = await buildCampaignsQuery(
            [`c.business_id = $1`],
            [businessId],
            { includeAllStatuses: true }
        );
        const formatted = campaigns.map((campaign) =>
            formatAnalyticsForTier(campaign, capabilities.analyticsMode)
        );
        return res.json({ campaigns: formatted, capabilities });
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
        let requiresReview = false;
        const changedFields = new Set();

        const setField = (column, value, trackReview = false) => {
            if (value === undefined) return;
            params.push(value);
            updates.push(`${column} = $${params.length}`);
            changedFields.add(column);
            if (trackReview) {
                requiresReview = true;
            }
        };

        if (req.file) {
            const ext = path.extname(req.file.originalname).toLowerCase();
            const inferred = EXTENSION_TYPE_MAP[ext];
            const mediaType = req.body.mediaType || inferred;
            if (!inferred || inferred !== mediaType) {
                return res.status(400).json({ error: 'Media type mismatch' });
            }
            const assetUrl = buildAssetUrl(req, req.file.filename);
            setField('media_type', mediaType, true);
            setField('asset_url', assetUrl, true);
            setField('thumbnail_url', req.body.thumbnailUrl || assetUrl, true);
        }

        if (req.body.name) setField('name', String(req.body.name).trim(), true);
        if (req.body.clickRedirectUrl) setField('click_redirect_url', req.body.clickRedirectUrl, true);

        if (req.body.dailyBudget || req.body.dailyBudgetMinor) {
            setField('daily_budget_minor', resolveMinorAmount(req.body.dailyBudget, req.body.dailyBudgetMinor), true);
        }

        if (req.body.bidRate || req.body.bidRateMinor) {
            setField('bid_rate_minor', resolveMinorAmount(req.body.bidRate, req.body.bidRateMinor), true);
        }

        if (req.body.bid_type && VALID_BID_TYPES.includes(req.body.bid_type)) {
            setField('bid_type', req.body.bid_type, true);
        }

        if (req.body.status && ['draft', 'paused', 'pending_review'].includes(req.body.status)) {
            setField('status', req.body.status);
        }

        const targetLocations = parseList(req.body.targetLocations);
        const targetIndustries = parseList(req.body.targetIndustries);
        const behaviors = parseBehaviors(req.body.behaviors);
        const premiumOwner = hasPremiumException({ email: req.user.email });
        if (targetLocations.length) setField('target_locations', targetLocations, true);
        if (targetIndustries.length) setField('target_industries', targetIndustries, true);
        if (behaviors.length) setField('target_behaviors', JSON.stringify(behaviors), true);

        if (updates.length) {
            await query(
                `UPDATE advertising_campaigns
                 SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $${params.length + 1}`,
                [...params, id]
            );
        }

        const placements = parsePlacements(req.body.placements);
        if (placements.length) {
            await upsertPlacements(id, placements);
            requiresReview = true;
            changedFields.add('placements');
        }

        if (premiumOwner) {
            requiresReview = false;
        }

        if (requiresReview) {
            await query(
                `UPDATE advertising_campaigns
                 SET review_status = 'pending',
                     status = 'pending_review',
                     submitted_at = CURRENT_TIMESTAMP,
                     reviewed_at = NULL,
                     reviewed_by = NULL
                 WHERE id = $1`,
                [id]
            );
        }

        const refreshed = await buildCampaignsQuery(['c.id = $1'], [id], { includeAllStatuses: true });

        await recordAuditLog({
            userId: req.user.id,
            actorRole: 'business',
            action: 'ad.updated',
            entityType: 'advertising_campaign',
            entityId: id,
            newValues: { updatedFields: Array.from(changedFields) },
            metadata: { requiresReview },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.json({ campaign: refreshed[0] || null, requiresReview });
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
        await recordAuditLog({
            userId: req.user.id,
            actorRole: 'business',
            action: 'ad.deleted',
            entityType: 'advertising_campaign',
            entityId: id,
            metadata: { businessId },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
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
             SET impressions = impressions + 1,
                 spend_minor = spend_minor + CASE
                     WHEN bid_type = 'cpm' AND bid_rate_minor > 0
                         THEN GREATEST(1, CEIL(bid_rate_minor::numeric / 1000))
                     ELSE 0
                 END
             WHERE id = $1
               AND review_status = 'approved'
               AND status = 'active'
             RETURNING impressions, spend_minor`,
            [id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        return res.json({
            impressions: result.rows[0].impressions,
            spendMinor: Number(result.rows[0].spend_minor || 0)
        });
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
             SET clicks = clicks + 1,
                 spend_minor = spend_minor + CASE
                     WHEN bid_type = 'cpc' AND bid_rate_minor > 0
                         THEN GREATEST(1, bid_rate_minor)
                     ELSE 0
                 END
             WHERE id = $1
               AND review_status = 'approved'
               AND status = 'active'
             RETURNING clicks, click_redirect_url, spend_minor`,
            [id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        const campaign = result.rows[0];
        return res.json({
            clicks: campaign.clicks,
            redirectUrl: campaign.click_redirect_url,
            spendMinor: Number(campaign.spend_minor || 0)
        });
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
