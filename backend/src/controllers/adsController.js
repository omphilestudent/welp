const path = require('path');
const fs = require('fs');
const { validationResult } = require('express-validator');
const { query } = require('../utils/database');
const {
    getBusinessIdForUser,
    upsertPlacements,
    fetchPlacementCampaigns,
    getBusinessAdCapabilities,
    countActiveCampaigns,
    formatAnalyticsForTier,
    adminListAds,
    adminGetAdDetails,
    adminGetAdAnalytics,
    adminApproveAd,
    adminRejectAd,
    adminBulkApproveAds,
    adminBulkRejectAds,
    adminPauseAd,
    adminResumeAd,
    adminGetAdStats,
    logAdminAction
} = require('../services/adsService');
const { recordAuditLog } = require('../utils/auditLogger');
const { hasPremiumException } = require('../utils/premiumAccess');

const AD_ASSET_FOLDER = path.join(__dirname, '../../uploads/ads');
fs.mkdirSync(AD_ASSET_FOLDER, { recursive: true });

const VALID_STATUSES = ['draft', 'active', 'paused', 'completed'];
const VALID_BID_TYPES = ['cpc', 'cpm'];
let adImpressionsTableReady = false;
let featureColumnReady = false;
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const VIDEO_EXTS = ['.mp4', '.webm', '.mov'];
const GIF_EXTS = ['.gif'];
const ALL_EXTS = [...IMAGE_EXTS, ...VIDEO_EXTS, ...GIF_EXTS];
const EXTENSION_TYPE_MAP = Object.fromEntries([
    ...IMAGE_EXTS.map((ext) => [ext, 'image']),
    ...VIDEO_EXTS.map((ext) => [ext, 'video']),
    ...GIF_EXTS.map((ext) => [ext, 'gif'])
]);
const VALID_PLACEMENTS = new Set(['business_profile', 'search_results', 'category', 'recommended']);
let adCampaignSchemaReady = false;

const ensureAdImpressionsTable = async () => {
    if (adImpressionsTableReady) return;
    await query(`
        CREATE TABLE IF NOT EXISTS ad_impressions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            campaign_id UUID NOT NULL REFERENCES advertising_campaigns(id) ON DELETE CASCADE,
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            session_id TEXT,
            clicked BOOLEAN DEFAULT false,
            ip_address TEXT,
            user_agent TEXT,
            spend_minor BIGINT DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    await query('CREATE INDEX IF NOT EXISTS idx_ad_impressions_campaign ON ad_impressions(campaign_id)');
    adImpressionsTableReady = true;
};

const ensureFeatureColumn = async () => {
    if (featureColumnReady) return;
    await query(
        'ALTER TABLE advertising_campaigns ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false'
    );
    featureColumnReady = true;
};

const ensureAdCampaignSchema = async () => {
    if (adCampaignSchemaReady) return;
    try {
        await query(
            "ALTER TABLE advertising_campaigns ADD COLUMN IF NOT EXISTS review_status VARCHAR(32) DEFAULT 'pending'"
        );
        await query("ALTER TABLE advertising_campaigns ADD COLUMN IF NOT EXISTS review_notes TEXT");
        await query("ALTER TABLE advertising_campaigns ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW()");
        await query("ALTER TABLE advertising_campaigns ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ");
        await query(
            "ALTER TABLE advertising_campaigns ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL"
        );
        await query(
            "ALTER TABLE advertising_campaigns ADD COLUMN IF NOT EXISTS spend_minor BIGINT DEFAULT 0"
        );
        await query(
            "ALTER TABLE advertising_campaigns ADD COLUMN IF NOT EXISTS bid_rate_minor BIGINT DEFAULT 0"
        );
        adCampaignSchemaReady = true;
    } catch (error) {
        console.warn('ensureAdCampaignSchema failed:', error.message);
    }
};

const isMissingRelationError = (error) => error?.code === '42P01';

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
    if (!raw) return [];
    if (Array.isArray(raw)) {
        return raw
            .map((entry) => {
                if (typeof entry === 'string') {
                    return { placement: entry, weight: 1 };
                }
                if (entry && typeof entry === 'object') {
                    return {
                        placement: entry.placement,
                        weight: Number(entry.weight ?? 1)
                    };
                }
                return null;
            })
            .filter((entry) => entry && entry.placement);
    }
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return parsePlacements(parsed);
        } catch {
            return parseList(raw).map((placement) => ({ placement, weight: 1 }));
        }
    }
    return [];
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
    let businessId = null;
    try {
        await ensureAdCampaignSchema();

        const validationIssues = [];
        const placements = parsePlacements(req.body.placements);
        const campaignName = String(req.body.name || req.body.campaignName || '').trim();
        const hasUploadedMedia = Boolean(req.file);
        const providedMediaUrl = req.body.asset_url || req.body.media_url || null;

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            validationIssues.push(
                ...errors.array().map((issue) => issue.msg || `Invalid value for ${issue.param}`)
            );
        }

        if (!campaignName) {
            validationIssues.push('Campaign name is required');
        }
        if (!placements.length) {
            validationIssues.push('At least one placement is required');
        }
        const invalidPlacements = placements.filter(
            (placement) => !VALID_PLACEMENTS.has(placement.placement)
        );
        if (invalidPlacements.length) {
            validationIssues.push(
                `Unsupported placements: ${invalidPlacements.map((entry) => entry.placement).join(', ')}`
            );
        }
        if (!hasUploadedMedia && !providedMediaUrl) {
            validationIssues.push('Upload a media file to submit your campaign');
        }

        const dailyBudgetMinor = resolveMinorAmount(req.body.dailyBudget, req.body.dailyBudgetMinor);
        if (!Number.isFinite(dailyBudgetMinor) || dailyBudgetMinor <= 0) {
            validationIssues.push('Daily budget must be greater than 0');
        }

        if (validationIssues.length) {
            return res.status(400).json({
                success: false,
                error: 'Invalid campaign payload',
                details: validationIssues
            });
        }

        const normalizedCampaignName = campaignName || 'Campaign';

        businessId = await getBusinessIdForUser(req.user.id);
        if (!businessId) {
            return res.status(403).json({ success: false, error: 'Business profile not found' });
        }

        const businessResult = await query(
            `SELECT id, status
             FROM companies
             WHERE id = $1`,
            [businessId]
        );
        if (!businessResult.rows.length) {
            return res.status(400).json({
                success: false,
                error: 'Business profile does not exist'
            });
        }
        if (businessResult.rows[0].status && businessResult.rows[0].status !== 'active') {
            return res.status(403).json({
                success: false,
                error: 'Business profile must be active to create campaigns'
            });
        }

        const capabilities = await getBusinessAdCapabilities({ userId: req.user.id, email: req.user.email });
        const existingActive = await countActiveCampaigns(businessId);
        if (Number.isFinite(capabilities.maxActive) && existingActive >= capabilities.maxActive) {
            return res.status(403).json({
                success: false,
                error: 'Ad limit reached for your plan',
                details: {
                    activeCampaigns: existingActive,
                    maxActive: capabilities.maxActive
                }
            });
        }

        let mediaType = req.body.media_type || req.body.mediaType;
        let assetUrl = providedMediaUrl;
        if (req.file) {
            const ext = path.extname(req.file.originalname).toLowerCase();
            const inferredType = EXTENSION_TYPE_MAP[ext];
            mediaType = mediaType || inferredType;
            if (!mediaType || EXTENSION_TYPE_MAP[ext] !== mediaType) {
                return res.status(400).json({ success: false, error: 'Media type does not match file extension' });
            }
            assetUrl = buildAssetUrl(req, req.file.filename);
        }

        const targetLocations = parseList(req.body.targetLocations);
        const targetIndustries = parseList(req.body.targetIndustries);
        const behaviors = parseBehaviors(req.body.behaviors);
        const bidRateMinor = resolveMinorAmount(req.body.bidRate, req.body.bidRateMinor) || 0;
        const bidType = VALID_BID_TYPES.includes(req.body.bid_type) ? req.body.bid_type : 'cpc';
        const thumbnailUrl = req.body.thumbnailUrl || assetUrl;
        const premiumOwner = hasPremiumException({ email: req.user.email });
        const statusValue = premiumOwner ? 'active' : 'pending_review';
        const reviewStatusValue = premiumOwner ? 'approved' : 'pending';
        const submittedAt = new Date();
        const sanitizedPlacements = placements.map((placement) => ({
            placement: placement.placement,
            weight:
                Number.isFinite(placement.weight) && placement.weight > 0
                    ? Math.round(placement.weight)
                    : 1
        }));

        console.info('Creating advertising campaign', {
            userId: req.user.id,
            businessId,
            hasUpload: hasUploadedMedia,
            placements: sanitizedPlacements.map((placement) => placement.placement)
        });

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
                normalizedCampaignName,
                mediaType || 'image',
                assetUrl,
                thumbnailUrl,
                req.body.clickRedirectUrl || null,
                targetLocations.length ? targetLocations : null,
                targetIndustries.length ? targetIndustries : null,
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
        await upsertPlacements(campaign.id, sanitizedPlacements);

        campaign.placements = sanitizedPlacements;

        await recordAuditLog({
            userId: req.user.id,
            actorRole: 'business',
            action: 'ad.created',
            entityType: 'advertising_campaign',
            entityId: campaign.id,
            newValues: { name: normalizedCampaignName, mediaType, businessId },
            metadata: { source: 'dashboard' },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.status(201).json({
            success: true,
            campaign,
            capabilities
        });
    } catch (error) {
        const dbErrorHints = {
            '22P02': 'Please double-check your numeric fields (budget/bid).',
            '23503': 'Linked business profile is invalid. Please refresh your business settings.',
            '42703': 'Database schema is missing required advertising columns. Please run migrations.'
        };
        const friendlyError = dbErrorHints[error?.code] || 'Unable to create campaign';
        const statusCode = error?.code === '22P02' || error?.code === '23503' ? 400 : 500;
        console.error('Create campaign error:', {
            userId: req.user?.id,
            businessId,
            code: error?.code,
            message: error?.message
        });
        return res.status(statusCode).json({ success: false, error: friendlyError });
    }
};

const buildCampaignsQuery = async (filters = [], params = [], options = {}) => {
    await ensureAdCampaignSchema();
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
        return res.json({ success: true, campaigns });
    } catch (error) {
        console.error('List campaigns error:', error);
        return res.status(500).json({ success: false, error: 'Unable to list campaigns' });
    }
};

const getCampaign = async (req, res) => {
    try {
        const { id } = req.params;
        const campaigns = await buildCampaignsQuery(['c.id = $1'], [id], { includeAllStatuses: true });
        if (!campaigns.length) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }
        const campaign = campaigns[0];
        let isOwner = false;
        const normalizedRole = String(req.user?.role || '').toLowerCase();
        const isAdmin = ['admin', 'super_admin'].includes(normalizedRole);
        if (req.user) {
            const businessId = await getBusinessIdForUser(req.user.id);
            isOwner = businessId && businessId === campaign.business_id;
        }
        if (!isOwner && !isAdmin && campaign.status !== 'active') {
            return res.status(403).json({ success: false, error: 'Not authorized to view this campaign' });
        }
        return res.json({ success: true, campaign });
    } catch (error) {
        console.error('Get campaign error:', error);
        return res.status(500).json({ success: false, error: 'Failed to get campaign' });
    }
};

const listMyCampaigns = async (req, res) => {
    try {
        const businessId = await getBusinessIdForUser(req.user.id);
        if (!businessId) {
            return res.status(403).json({ success: false, error: 'Business profile not found' });
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
        const activeCount = await countActiveCampaigns(businessId);
        const payload = {
            campaigns: formatted,
            capabilities,
            activeCount,
            maxActive: capabilities.maxActive
        };
        return res.json({ success: true, ...payload });
    } catch (error) {
        console.error('List my campaigns error:', error);
        return res.status(500).json({ success: false, error: 'Unable to list your campaigns' });
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

        return res.json({ success: true, campaign: refreshed[0] || null, requiresReview });
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

        await query('DELETE FROM ad_placements WHERE campaign_id = $1', [id]);
        try {
            await ensureAdImpressionsTable();
            await query('DELETE FROM ad_impressions WHERE campaign_id = $1', [id]);
        } catch (logError) {
            if (isMissingRelationError(logError)) {
                adImpressionsTableReady = false;
            }
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
        return res.json({ success: true, campaigns });
    } catch (error) {
        console.error('Fetch placement ads error:', error);
        return res.status(500).json({ success: false, error: 'Unable to load ads' });
    }
};

const recordImpression = async (req, res) => {
    try {
        const { id } = req.params;
        const sessionId = req.body?.sessionId || null;
        const userId = req.body?.userId || null;

        try {
            await ensureAdImpressionsTable();
            await query(
                `INSERT INTO ad_impressions (
                    campaign_id,
                    user_id,
                    session_id,
                    ip_address,
                    user_agent
                ) VALUES ($1, $2, $3, $4, $5)`,
                [id, userId, sessionId, req.ip, req.headers['user-agent'] || null]
            );
        } catch (logError) {
            if (isMissingRelationError(logError)) {
                adImpressionsTableReady = false;
            } else {
                console.warn('Failed to log impression:', logError.message);
            }
        }

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
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }
        return res.json({
            success: true,
            impressions: result.rows[0].impressions,
            spendMinor: Number(result.rows[0].spend_minor || 0)
        });
    } catch (error) {
        console.error('Impression error:', error);
        return res.status(500).json({ success: false, error: 'Unable to track impression' });
    }
};

const recordClick = async (req, res) => {
    try {
        const { id } = req.params;
        const sessionId = req.body?.sessionId || null;

        try {
            await ensureAdImpressionsTable();
            await query(
                `UPDATE ad_impressions
                 SET clicked = true
                 WHERE campaign_id = $1
                   AND session_id = $2
                   AND clicked = false
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [id, sessionId]
            );
        } catch (logError) {
            if (isMissingRelationError(logError)) {
                adImpressionsTableReady = false;
            } else {
                console.warn('Failed to log click:', logError.message);
            }
        }

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
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }
        const campaign = result.rows[0];
        return res.json({
            success: true,
            clicks: campaign.clicks,
            redirectUrl: campaign.click_redirect_url,
            spendMinor: Number(campaign.spend_minor || 0)
        });
    } catch (error) {
        console.error('Click error:', error);
        return res.status(500).json({ success: false, error: 'Unable to track click' });
    }
};

const adminListCampaigns = async (req, res) => {
    try {
        const filters = {
            reviewStatus: req.query.reviewStatus,
            status: req.query.status,
            tier: req.query.tier,
            search: req.query.search,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        const campaigns = await adminListAds(filters);
        await logAdminAction({
            adminId: req.user.id,
            action: 'LIST_CAMPAIGNS',
            details: { filters }
        });
        return res.json({ success: true, campaigns });
    } catch (error) {
        console.error('Error in adminListCampaigns:', error);
        return res.status(500).json({ success: false, error: 'Failed to list campaigns' });
    }
};

const adminGetStats = async (req, res) => {
    try {
        const days = Number(req.query.days || 30);
        const stats = await adminGetAdStats(days);
        return res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Error in adminGetStats:', error);
        return res.status(500).json({ success: false, error: 'Failed to get statistics' });
    }
};

const adminGetCampaignDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const campaign = await adminGetAdDetails(id);
        if (!campaign) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }

        let impressionHistory = [];
        try {
            await ensureAdImpressionsTable();
            const history = await query(
                `SELECT 
                    date_trunc('hour', created_at) as hour,
                    COUNT(*) as impressions,
                    SUM(CASE WHEN clicked THEN 1 ELSE 0 END) as clicks
                 FROM ad_impressions
                 WHERE campaign_id = $1
                   AND created_at >= NOW() - INTERVAL '7 days'
                 GROUP BY date_trunc('hour', created_at)
                 ORDER BY hour DESC`,
                [id]
            );
            impressionHistory = history.rows;
        } catch (logError) {
            if (isMissingRelationError(logError)) {
                adImpressionsTableReady = false;
            } else {
                console.warn('Failed to load impression history:', logError.message);
            }
        }
        campaign.impression_history = impressionHistory;

        return res.json({ success: true, campaign });
    } catch (error) {
        console.error('Error in adminGetCampaignDetails:', error);
        return res.status(500).json({ success: false, error: 'Failed to get campaign details' });
    }
};

const adminGetCampaignAnalytics = async (req, res) => {
    try {
        const { id } = req.params;
        const days = Number(req.query.days || 30);
        const analytics = await adminGetAdAnalytics(id, days);
        return res.json({ success: true, data: analytics });
    } catch (error) {
        console.error('Error in adminGetCampaignAnalytics:', error);
        return res.status(500).json({ success: false, error: 'Failed to get campaign analytics' });
    }
};

const adminApproveCampaign = async (req, res) => {
    try {
        const { adId, overrideRestrictions, notes } = req.body;
        if (!adId) {
            return res.status(400).json({ success: false, error: 'Campaign ID is required' });
        }
        const result = await adminApproveAd({
            adId,
            adminId: req.user.id,
            overrideRestrictions: Boolean(overrideRestrictions),
            notes
        });
        return res.json({ success: true, data: result, message: 'Campaign approved successfully' });
    } catch (error) {
        console.error('Error in adminApproveCampaign:', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to approve campaign' });
    }
};

const adminRejectCampaign = async (req, res) => {
    try {
        const { adId, reason, notes } = req.body;
        if (!adId) {
            return res.status(400).json({ success: false, error: 'Campaign ID is required' });
        }
        if (!reason) {
            return res.status(400).json({ success: false, error: 'Rejection reason is required' });
        }
        const result = await adminRejectAd({
            adId,
            adminId: req.user.id,
            reason,
            notes
        });
        return res.json({ success: true, data: result, message: 'Campaign rejected successfully' });
    } catch (error) {
        console.error('Error in adminRejectCampaign:', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to reject campaign' });
    }
};

const adminBulkApprove = async (req, res) => {
    try {
        const { adIds, overrideRestrictions } = req.body;
        if (!Array.isArray(adIds) || !adIds.length) {
            return res.status(400).json({ success: false, error: 'Valid campaign IDs array is required' });
        }
        const result = await adminBulkApproveAds({
            adIds,
            adminId: req.user.id,
            overrideRestrictions: Boolean(overrideRestrictions)
        });
        return res.json({
            success: true,
            data: result,
            message: `Bulk approval completed: ${result.approved} approved, ${result.failed} failed`
        });
    } catch (error) {
        console.error('Error in adminBulkApprove:', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to bulk approve campaigns' });
    }
};

const adminBulkReject = async (req, res) => {
    try {
        const { adIds, reason } = req.body;
        if (!Array.isArray(adIds) || !adIds.length) {
            return res.status(400).json({ success: false, error: 'Valid campaign IDs array is required' });
        }
        if (!reason) {
            return res.status(400).json({ success: false, error: 'Rejection reason is required' });
        }
        const result = await adminBulkRejectAds({
            adIds,
            adminId: req.user.id,
            reason
        });
        return res.json({
            success: true,
            data: result,
            message: `Bulk rejection completed: ${result.rejected} rejected, ${result.failed} failed`
        });
    } catch (error) {
        console.error('Error in adminBulkReject:', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to bulk reject campaigns' });
    }
};

const adminPauseCampaign = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await adminPauseAd(id, req.user.id);
        return res.json({ success: true, data: result, message: 'Campaign paused successfully' });
    } catch (error) {
        console.error('Error in adminPauseCampaign:', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to pause campaign' });
    }
};

const adminResumeCampaign = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await adminResumeAd(id, req.user.id);
        return res.json({ success: true, data: result, message: 'Campaign resumed successfully' });
    } catch (error) {
        console.error('Error in adminResumeCampaign:', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to resume campaign' });
    }
};

const adminFeatureCampaign = async (req, res) => {
    try {
        const { id } = req.params;
        const featured = req.body?.featured !== undefined ? Boolean(req.body.featured) : true;
        await ensureFeatureColumn();
        const result = await query(
            `UPDATE advertising_campaigns 
             SET is_featured = $1, updated_at = NOW() 
             WHERE id = $2 
             RETURNING *`,
            [featured, id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }
        await logAdminAction({
            adminId: req.user.id,
            action: featured ? 'FEATURE_CAMPAIGN' : 'UNFEATURE_CAMPAIGN',
            targetId: id,
            targetType: 'campaign'
        });
        return res.json({
            success: true,
            data: result.rows[0],
            message: featured ? 'Campaign featured successfully' : 'Campaign unfeatured successfully'
        });
    } catch (error) {
        console.error('Error in adminFeatureCampaign:', error);
        return res.status(500).json({ success: false, error: 'Failed to update campaign feature status' });
    }
};

const adminDeleteCampaign = async (req, res) => {
    try {
        const { id } = req.params;
        const campaign = await adminGetAdDetails(id);
        if (!campaign) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }
        await query('DELETE FROM ad_placements WHERE campaign_id = $1', [id]);
        try {
            await ensureAdImpressionsTable();
            await query('DELETE FROM ad_impressions WHERE campaign_id = $1', [id]);
        } catch (logError) {
            if (isMissingRelationError(logError)) {
                adImpressionsTableReady = false;
            }
        }
        await query('DELETE FROM advertising_campaigns WHERE id = $1', [id]);
        await logAdminAction({
            adminId: req.user.id,
            action: 'DELETE_CAMPAIGN',
            targetId: id,
            targetType: 'campaign',
            details: { campaignName: campaign.name }
        });
        return res.json({ success: true, message: 'Campaign deleted successfully' });
    } catch (error) {
        console.error('Error in adminDeleteCampaign:', error);
        return res.status(500).json({ success: false, error: 'Failed to delete campaign' });
    }
};

const adminExportCampaigns = async (req, res) => {
    try {
        const filters = {
            reviewStatus: req.query.reviewStatus,
            status: req.query.status,
            tier: req.query.tier,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        const campaigns = await adminListAds(filters);
        const headers = [
            'ID',
            'Business Name',
            'Campaign Name',
            'Status',
            'Review Status',
            'Tier',
            'Impressions',
            'Clicks',
            'CTR',
            'Spend',
            'Created At',
            'Reviewed At',
            'Reviewer'
        ];
        const rows = [headers.join(',')];
        campaigns.forEach((campaign) => {
            const ctr = campaign.impressions
                ? ((campaign.clicks / Math.max(1, campaign.impressions)) * 100).toFixed(2)
                : 0;
            rows.push([
                campaign.id,
                `"${campaign.business_name || ''}"`,
                `"${campaign.name || ''}"`,
                campaign.status,
                campaign.review_status,
                campaign.subscription_tier || campaign.tier || '',
                campaign.impressions || 0,
                campaign.clicks || 0,
                ctr,
                ((campaign.spend_minor || 0) / 100).toFixed(2),
                campaign.created_at ? new Date(campaign.created_at).toISOString() : '',
                campaign.reviewed_at ? new Date(campaign.reviewed_at).toISOString() : '',
                `"${campaign.reviewed_by_name || ''}"`
            ].join(','));
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=campaigns_export.csv');
        res.send(rows.join('\n'));
        await logAdminAction({
            adminId: req.user.id,
            action: 'EXPORT_CAMPAIGNS',
            details: { filters, count: campaigns.length }
        });
    } catch (error) {
        console.error('Error in adminExportCampaigns:', error);
        return res.status(500).json({ success: false, error: 'Failed to export campaigns' });
    }
};

const adminGenerateReport = async (req, res) => {
    try {
        const { startDate, endDate, format = 'json' } = req.query;
        const stats = await adminGetAdStats(Number(req.query.days || 30));
        const topByImpressions = await query(
            `SELECT c.name, b.name as business_name, c.impressions
             FROM advertising_campaigns c
             JOIN businesses b ON b.id = c.business_id
             WHERE ($1::timestamptz IS NULL OR c.created_at >= $1::timestamptz)
               AND ($2::timestamptz IS NULL OR c.created_at <= $2::timestamptz)
             ORDER BY c.impressions DESC
             LIMIT 10`,
            [startDate || null, endDate || null]
        );
        const topByClicks = await query(
            `SELECT c.name, b.name as business_name, c.clicks
             FROM advertising_campaigns c
             JOIN businesses b ON b.id = c.business_id
             WHERE ($1::timestamptz IS NULL OR c.created_at >= $1::timestamptz)
               AND ($2::timestamptz IS NULL OR c.created_at <= $2::timestamptz)
             ORDER BY c.clicks DESC
             LIMIT 10`,
            [startDate || null, endDate || null]
        );
        const topBySpend = await query(
            `SELECT c.name, b.name as business_name, c.spend_minor
             FROM advertising_campaigns c
             JOIN businesses b ON b.id = c.business_id
             WHERE ($1::timestamptz IS NULL OR c.created_at >= $1::timestamptz)
               AND ($2::timestamptz IS NULL OR c.created_at <= $2::timestamptz)
             ORDER BY c.spend_minor DESC
             LIMIT 10`,
            [startDate || null, endDate || null]
        );
        const pendingReview = await query(
            `SELECT COUNT(*) as count
             FROM advertising_campaigns
             WHERE review_status = 'pending'`
        );

        const report = {
            generated_at: new Date().toISOString(),
            generated_by: req.user.id,
            date_range: { startDate, endDate },
            summary: stats,
            top_performers: {
                by_impressions: topByImpressions.rows,
                by_clicks: topByClicks.rows,
                by_spend: topBySpend.rows
            },
            pending_review: Number(pendingReview.rows[0]?.count || 0)
        };

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=ads_report.csv');
            res.send(`metric,value\npending_review,${report.pending_review}`);
            return;
        }

        return res.json({ success: true, data: report });
    } catch (error) {
        console.error('Error in adminGenerateReport:', error);
        return res.status(500).json({ success: false, error: 'Failed to generate report' });
    }
};

const adminGetAuditLog = async (req, res) => {
    try {
        const { id } = req.params;
        const logs = await query(
            `SELECT al.*, u.display_name as admin_name
             FROM admin_audit_log al
             LEFT JOIN users u ON u.id = al.admin_id
             WHERE al.target_id = $1 AND al.target_type = 'campaign'
             ORDER BY al.created_at DESC
             LIMIT 100`,
            [id]
        );
        return res.json({ success: true, data: logs.rows });
    } catch (error) {
        console.error('Error in adminGetAuditLog:', error);
        return res.status(500).json({ success: false, error: 'Failed to get audit log' });
    }
};

module.exports = {
    createCampaign,
    listCampaigns,
    getCampaign,
    listMyCampaigns,
    updateCampaign,
    deleteCampaign,
    getPlacementAds,
    recordImpression,
    recordClick,
    adminListCampaigns,
    adminGetStats,
    adminGetCampaignDetails,
    adminGetCampaignAnalytics,
    adminApproveCampaign,
    adminRejectCampaign,
    adminBulkApprove,
    adminBulkReject,
    adminPauseCampaign,
    adminResumeCampaign,
    adminFeatureCampaign,
    adminDeleteCampaign,
    adminExportCampaigns,
    adminGenerateReport,
    adminGetAuditLog
};
