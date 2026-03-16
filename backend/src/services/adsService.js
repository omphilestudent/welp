const path = require('path');
const { query } = require('../utils/database');
const { getActiveSubscription, PLAN_LIMITS } = require('./subscriptionService');
const { hasPremiumException } = require('../utils/premiumAccess');

const ACCEPTED_MEDIA_TYPES = ['image', 'video', 'gif'];
const AD_SCHEMA_TTL_MS = 5 * 60 * 1000;
let businessTableAvailable = true;

let cachedAdSchema = null;
let adTableMetadata = {
    checked: false,
    businesses: false,
    companies: false,
    placements: false,
    businessCols: {
        name: false,
        ownerUserId: false,
        subscriptionTier: false,
        subscriptionExpires: false
    },
    companyCols: {
        name: false,
        claimedBy: false,
        createdByUserId: false
    }
};

const ensureAdSchema = async () => {
    if (cachedAdSchema && cachedAdSchema.expiresAt > Date.now()) {
        return cachedAdSchema;
    }
    try {
        const { rows } = await query(
            `SELECT column_name
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'advertising_campaigns'`
        );
        const columns = rows.map((row) => row.column_name);
        cachedAdSchema = {
            hasReviewStatus: columns.includes('review_status'),
            hasSpendMinor: columns.includes('spend_minor'),
            hasBidRateMinor: columns.includes('bid_rate_minor'),
            hasImpressions: columns.includes('impressions'),
            hasClicks: columns.includes('clicks'),
            hasPlacementsColumn: columns.includes('placements'),
            hasOverride: columns.includes('override_restrictions'),
            hasRejectionReason: columns.includes('rejection_reason'),
            hasReviewedBy: columns.includes('reviewed_by'),
            hasReviewedAt: columns.includes('reviewed_at'),
            hasReviewNotes: columns.includes('review_notes'),
            expiresAt: Date.now() + AD_SCHEMA_TTL_MS
        };
    } catch (error) {
        console.warn('Ad schema introspection failed:', error.message);
        cachedAdSchema = {
            hasReviewStatus: false,
            hasSpendMinor: false,
            hasBidRateMinor: false,
            hasImpressions: false,
            hasClicks: false,
            hasPlacementsColumn: false,
            hasOverride: false,
            hasRejectionReason: false,
            hasReviewedBy: false,
            hasReviewedAt: false,
            hasReviewNotes: false,
            expiresAt: Date.now() + AD_SCHEMA_TTL_MS
        };
    }
    return cachedAdSchema;
};

const buildAdQueryContext = (tables) => {
    const joins = [];
    if (tables.businesses) {
        joins.push('LEFT JOIN businesses b ON b.id = c.business_id');
    }
    if (tables.companies) {
        joins.push('LEFT JOIN companies comp ON comp.id = c.business_id');
    }

    const ownerSources = [];
    if (tables.businesses && tables.businessCols?.ownerUserId) {
        ownerSources.push('b.owner_user_id');
    }
    if (tables.companies) {
        if (tables.companyCols?.claimedBy) ownerSources.push('comp.claimed_by');
        if (tables.companyCols?.createdByUserId) ownerSources.push('comp.created_by_user_id');
    }
    const ownerExpr = ownerSources.length ? `COALESCE(${ownerSources.join(', ')})` : null;
    if (ownerExpr) {
        joins.push(`LEFT JOIN users owner ON owner.id = ${ownerExpr}`);
    }

    const businessNames = [];
    if (tables.businesses && tables.businessCols?.name) businessNames.push('b.name');
    if (tables.companies && tables.companyCols?.name) businessNames.push('comp.name');
    const businessNameExpr = businessNames.length
        ? `COALESCE(${businessNames.join(', ')})`
        : `'Unknown Business'`;

    const tierExpr =
        tables.businesses && tables.businessCols?.subscriptionTier
            ? `COALESCE(b.subscription_tier, 'base')`
            : `'base'`;
    const subscriptionExpiresExpr =
        tables.businesses && tables.businessCols?.subscriptionExpires
            ? 'b.subscription_expires'
            : 'NULL';
    const ownerEmailExpr = ownerExpr ? 'owner.email' : 'NULL';
    const ownerNameExpr = ownerExpr ? 'owner.display_name' : 'NULL';
    const ownerPhoneExpr = ownerExpr ? 'owner.phone' : 'NULL';

    return {
        joins: joins.join('\n'),
        businessNameExpr,
        tierExpr,
        subscriptionExpiresExpr,
        ownerEmailExpr,
        ownerNameExpr,
        ownerPhoneExpr,
        hasOwner: Boolean(ownerExpr)
    };
};

const ensureAdTableMetadata = async (forceRefresh = false) => {
    if (!forceRefresh && adTableMetadata.checked) {
        return adTableMetadata;
    }
    try {
        const { rows } = await query(
            `SELECT 
                to_regclass('public.businesses') IS NOT NULL AS has_businesses,
                to_regclass('public.companies') IS NOT NULL AS has_companies,
                to_regclass('public.ad_placements') IS NOT NULL AS has_ad_placements,
                EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'name'
                ) AS businesses_has_name,
                EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'owner_user_id'
                ) AS businesses_has_owner_user_id,
                EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'subscription_tier'
                ) AS businesses_has_subscription_tier,
                EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'subscription_expires'
                ) AS businesses_has_subscription_expires,
                EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'name'
                ) AS companies_has_name,
                EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'claimed_by'
                ) AS companies_has_claimed_by,
                EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'created_by_user_id'
                ) AS companies_has_created_by_user_id`
        );
        adTableMetadata = {
            checked: true,
            businesses: rows[0]?.has_businesses === true,
            companies: rows[0]?.has_companies === true,
            placements: rows[0]?.has_ad_placements === true,
            businessCols: {
                name: rows[0]?.businesses_has_name === true,
                ownerUserId: rows[0]?.businesses_has_owner_user_id === true,
                subscriptionTier: rows[0]?.businesses_has_subscription_tier === true,
                subscriptionExpires: rows[0]?.businesses_has_subscription_expires === true
            },
            companyCols: {
                name: rows[0]?.companies_has_name === true,
                claimedBy: rows[0]?.companies_has_claimed_by === true,
                createdByUserId: rows[0]?.companies_has_created_by_user_id === true
            }
        };
    } catch (error) {
        console.warn('Ad table metadata detection failed:', error.message);
        adTableMetadata = {
            checked: true,
            businesses: false,
            companies: false,
            placements: false,
            businessCols: {
                name: false,
                ownerUserId: false,
                subscriptionTier: false,
                subscriptionExpires: false
            },
            companyCols: {
                name: false,
                claimedBy: false,
                createdByUserId: false
            }
        };
    }
    return adTableMetadata;
};


const getBusinessIdForUser = async (userId) => {
    if (!userId) return null;
    const companyResult = await query(
        `SELECT id
         FROM companies
         WHERE claimed_by = $1
            OR created_by_user_id = $1
         ORDER BY updated_at DESC
         LIMIT 1`,
        [userId]
    );
    if (companyResult.rows[0]?.id) {
        return companyResult.rows[0].id;
    }
    return bootstrapBusinessProfile(userId);
};

const bootstrapBusinessProfile = async (userId) => {
    if (!userId) return null;
    try {
        const [ownerResult, workspaceResult] = await Promise.all([
            query(
                `SELECT display_name, email
                 FROM users
                 WHERE id = $1`,
                [userId]
            ),
            query(
                `SELECT name, industry, website
                 FROM businesses
                 WHERE owner_user_id = $1
                 ORDER BY updated_at DESC
                 LIMIT 1`,
                [userId]
            )
        ]);

        const baseName =
            workspaceResult.rows[0]?.name ||
            (ownerResult.rows[0]?.display_name
                ? `${ownerResult.rows[0].display_name}'s Workspace`
                : 'My Business Workspace');
        const slug = String(userId).replace(/[^a-z0-9]/gi, '').slice(0, 6) || Date.now().toString(36);
        const uniqueName = `${baseName} ${slug}`.trim().slice(0, 240);

        const insertResult = await query(
            `INSERT INTO companies (
                 name,
                 industry,
                 website,
                 created_by_user_id,
                 claimed_by,
                 is_claimed,
                 status
             ) VALUES ($1, $2, $3, $4, $4, true, 'active')
             ON CONFLICT (name) DO UPDATE
                 SET claimed_by = EXCLUDED.claimed_by,
                     created_by_user_id = EXCLUDED.created_by_user_id,
                     updated_at = CURRENT_TIMESTAMP
             RETURNING id`,
            [
                uniqueName,
                workspaceResult.rows[0]?.industry || null,
                workspaceResult.rows[0]?.website || null,
                userId
            ]
        );

        return insertResult.rows[0]?.id || null;
    } catch (error) {
        console.warn('Bootstrap business profile failed:', error.message);
        return null;
    }
};

const upsertPlacements = async (campaignId, placements = []) => {
    const tables = await ensureAdTableMetadata();
    if (!tables.placements) return;

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
    const schema = await ensureAdSchema();
    const tables = await ensureAdTableMetadata();
    const filters = ["c.status = 'active'"];
    if (schema.hasReviewStatus) {
        filters.push("c.review_status = 'approved'");
    }
    const params = [];

    buildPlacementFilter(filters, params, placement);
    buildArrayFilter(filters, params, location, 'c.target_locations');
    buildArrayFilter(filters, params, industry, 'c.target_industries');
    buildBehaviorFilter(filters, params, behaviors);

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const reviewColumn = schema.hasReviewStatus ? '' : ", 'approved'::text AS review_status";
    const spendColumn = schema.hasSpendMinor ? '' : ', 0::bigint AS spend_minor';
    const bidRateColumn = schema.hasBidRateMinor ? '' : ', 0::bigint AS bid_rate_minor';
    const overrideColumn = schema.hasOverride ? '' : ', false AS override_restrictions';
    const placementsAlias = schema.hasPlacementsColumn ? 'placements_agg' : 'placements';
    const placementsColumn = tables.placements
        ? `,
            (
                SELECT jsonb_agg(jsonb_build_object('placement', ap.placement, 'weight', ap.weight))
                FROM ad_placements ap
                WHERE ap.campaign_id = c.id
            ) AS ${placementsAlias}`
        : `, '[]'::jsonb AS ${placementsAlias}`;
    const placementsOrderBy = tables.placements
        ? `(SELECT COALESCE(MAX(ap.weight), 0) FROM ad_placements ap WHERE ap.campaign_id = c.id) DESC,`
        : '';

    const result = await query(
        `
        SELECT
            c.*${reviewColumn}${spendColumn}${bidRateColumn}${overrideColumn}${placementsColumn}
        FROM advertising_campaigns c
        ${whereClause}
        ORDER BY ${placementsOrderBy}
                 c.daily_budget_minor DESC,
                 c.impressions ASC
        LIMIT 10
        `,
        params
    );

    return result.rows.map((row) => ({
        ...row,
        placements: row.placements ?? row.placements_agg ?? []
    }));
};

const getBusinessOwner = async (businessId) => {
    const tables = await ensureAdTableMetadata();
    if (tables.businesses) {
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
        if (result.rows[0]) {
            return result.rows[0];
        }
    }

    if (tables.companies) {
        const legacy = await query(
            `SELECT c.id,
                    c.name,
                    'base' AS subscription_tier,
                    NULL::timestamptz               AS subscription_expires,
                    owner.id                        AS owner_user_id,
                    owner.email,
                    owner.display_name
             FROM companies c
             LEFT JOIN users owner ON owner.id = COALESCE(c.claimed_by, c.created_by_user_id)
             WHERE c.id = $1`,
            [businessId]
        );
        if (legacy.rows[0]) {
            return legacy.rows[0];
        }
    }

    return null;
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

// ==================== ADMIN FUNCTIONS ====================

/**
 * Get all ads with filtering for admin panel
 */
const adminListAds = async (filters = {}, options = {}) => {
    const schema = await ensureAdSchema();
    const tables = await ensureAdTableMetadata(options.forceRefresh === true);
    const context = buildAdQueryContext(tables);

    const placementsSelect = tables.placements
        ? `(
                SELECT jsonb_agg(jsonb_build_object('placement', ap.placement, 'weight', ap.weight))
                FROM ad_placements ap
                WHERE ap.campaign_id = c.id
            )`
        : `'[]'::jsonb`;

    let queryStr = `
        SELECT 
            c.*,
            ${context.businessNameExpr} AS business_name,
            ${context.tierExpr} AS subscription_tier,
            ${context.ownerEmailExpr} AS owner_email,
            ${context.ownerNameExpr} AS owner_name,
            ${placementsSelect} AS ${schema.hasPlacementsColumn ? 'placements_agg' : 'placements'}
        FROM advertising_campaigns c
        ${context.joins}
        WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Apply filters
    if (filters.reviewStatus) {
        if (schema.hasReviewStatus) {
            if (filters.reviewStatus === 'pending') {
                queryStr += ` AND (
                    c.review_status = $${paramIndex}
                    OR c.review_status IS NULL
                    OR c.review_status = 'pending_review'
                    OR c.status = 'pending_review'
                )`;
            } else {
                queryStr += ` AND c.review_status = $${paramIndex}`;
            }
            params.push(filters.reviewStatus);
            paramIndex++;
        } else if (filters.reviewStatus === 'pending') {
            queryStr += ` AND c.status IN ('pending_review','pending')`;
        } else if (filters.reviewStatus === 'rejected') {
            queryStr += ` AND c.status IN ('rejected')`;
        }
    }

    if (filters.status) {
        queryStr += ` AND c.status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
    }

    if (filters.tier) {
        queryStr += ` AND ${context.tierExpr} = $${paramIndex}`;
        params.push(filters.tier);
        paramIndex++;
    }

    if (filters.search) {
        const ownerField = context.ownerEmailExpr !== 'NULL' ? context.ownerEmailExpr : `' '`;
        queryStr += ` AND (${context.businessNameExpr} ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex} OR ${ownerField} ILIKE $${paramIndex})`;
        params.push(`%${filters.search}%`);
        paramIndex++;
    }

    if (filters.startDate) {
        queryStr += ` AND c.created_at >= $${paramIndex}`;
        params.push(filters.startDate);
        paramIndex++;
    }

    if (filters.endDate) {
        queryStr += ` AND c.created_at <= $${paramIndex}`;
        params.push(filters.endDate);
        paramIndex++;
    }

    // Add ordering
    queryStr += ` ORDER BY c.created_at DESC`;

    try {
        const result = await query(queryStr, params);
        return result.rows.map((row) => {
            const derivedReviewStatus = (() => {
                if (schema.hasReviewStatus && row.review_status !== undefined) return row.review_status;
                if (row.status === 'rejected') return 'rejected';
                if (row.status === 'pending_review' || row.status === 'pending') return 'pending';
                return 'approved';
            })();

            return {
                ...row,
                review_status: derivedReviewStatus,
                impressions: schema.hasImpressions ? Number(row.impressions || 0) : 0,
                clicks: schema.hasClicks ? Number(row.clicks || 0) : 0,
                spend_minor: schema.hasSpendMinor ? Number(row.spend_minor || 0) : 0,
                bid_rate_minor: schema.hasBidRateMinor ? Number(row.bid_rate_minor || 0) : 0,
                override_restrictions: schema.hasOverride ? Boolean(row.override_restrictions) : false,
                rejection_reason: schema.hasRejectionReason ? row.rejection_reason ?? null : null,
                reviewed_by: schema.hasReviewedBy ? row.reviewed_by ?? null : null,
                reviewed_at: schema.hasReviewedAt ? row.reviewed_at ?? null : null,
                review_notes: schema.hasReviewNotes ? row.review_notes ?? null : null,
                placements: Array.isArray(row.placements ?? row.placements_agg)
                    ? (row.placements ?? row.placements_agg)
                    : ((row.placements ?? row.placements_agg) ?? [])
            };
        });
    } catch (error) {
        if (error?.code === '42P01' && !options.forceRefresh) {
            await ensureAdTableMetadata(true);
            return adminListAds(filters, { forceRefresh: true });
        }
        console.error('[adminListAds] query failed', {
            error: error?.message,
            code: error?.code,
            filters,
            sql: queryStr
        });
        throw error;
    }
};

/**
 * Get single ad details with analytics
 */
const adminGetAdDetails = async (adId, options = {}) => {
    const schema = await ensureAdSchema();
    const tables = await ensureAdTableMetadata(options.forceRefresh === true);
    const context = buildAdQueryContext(tables);

    try {
        const placementsAlias = schema.hasPlacementsColumn ? 'placements_agg' : 'placements';
        const result = await query(
            `
            SELECT 
                c.*,
                ${context.businessNameExpr} AS business_name,
                ${context.tierExpr} AS subscription_tier,
                ${context.subscriptionExpiresExpr} AS subscription_expires,
                ${context.hasOwner ? 'owner.id' : 'NULL'} AS owner_user_id,
                ${context.ownerEmailExpr} AS owner_email,
                ${context.ownerNameExpr} AS owner_name,
                ${context.ownerPhoneExpr} AS owner_phone,
                (
                    SELECT jsonb_agg(jsonb_build_object('placement', ap.placement, 'weight', ap.weight))
                    FROM ad_placements ap
                    WHERE ap.campaign_id = c.id
                ) AS ${placementsAlias},
                COALESCE(c.impressions, 0) AS impressions,
                COALESCE(c.clicks, 0) AS clicks,
                COALESCE(c.spend_minor, 0) AS spend_minor,
                CASE 
                    WHEN c.reviewed_by IS NOT NULL THEN (
                        SELECT display_name FROM users WHERE id = c.reviewed_by
                    )
                    ELSE NULL
                END AS reviewed_by_name
            FROM advertising_campaigns c
            ${context.joins}
            WHERE c.id = $1
            `,
            [adId]
        );

        const row = result.rows[0];
        if (!row) return null;
        return {
            ...row,
            placements: row.placements ?? row.placements_agg ?? []
        };
    } catch (error) {
        if (error?.code === '42P01' && !options.forceRefresh) {
            await ensureAdTableMetadata(true);
            return adminGetAdDetails(adId, { forceRefresh: true });
        }
        throw error;
    }
};

/**
 * Get ad analytics over time
 */
const adminGetAdAnalytics = async (adId, days = 30) => {
    const result = await query(
        `
        WITH daily_stats AS (
            SELECT 
                date_trunc('day', created_at) as date,
                COUNT(*) as impressions,
                SUM(CASE WHEN clicked THEN 1 ELSE 0 END) as clicks,
                SUM(spend_minor) as daily_spend
            FROM ad_impressions
            WHERE campaign_id = $1
                AND created_at >= NOW() - ($2 || ' days')::interval
            GROUP BY date_trunc('day', created_at)
            ORDER BY date DESC
        )
        SELECT 
            COALESCE(SUM(impressions), 0)::int as total_impressions,
            COALESCE(SUM(clicks), 0)::int as total_clicks,
            COALESCE(SUM(daily_spend), 0)::bigint as total_spend_minor,
            CASE 
                WHEN SUM(impressions) > 0 
                THEN ROUND((SUM(clicks)::numeric / SUM(impressions)::numeric * 100), 2)
                ELSE 0 
            END as ctr,
            jsonb_agg(
                jsonb_build_object(
                    'date', date,
                    'impressions', impressions,
                    'clicks', clicks,
                    'spend', daily_spend
                ) ORDER BY date DESC
            ) as daily_stats
        FROM daily_stats
        `,
        [adId, days]
    );

    return result.rows[0] || {
        total_impressions: 0,
        total_clicks: 0,
        total_spend_minor: 0,
        ctr: 0,
        daily_stats: []
    };
};

/**
 * Approve an ad
 */
const adminApproveAd = async ({ adId, adminId, overrideRestrictions = false, notes = null }) => {
    const schema = await ensureAdSchema();

    // Check if ad exists
    const ad = await adminGetAdDetails(adId);
    if (!ad) {
        throw new Error('Ad not found');
    }

    // Update the ad
    const result = await query(
        `
        UPDATE advertising_campaigns
        SET 
            review_status = 'approved',
            status = CASE 
                WHEN status = 'pending_review' THEN 'active'
                ELSE status
            END,
            reviewed_at = NOW(),
            reviewed_by = $2,
            review_notes = $3,
            override_restrictions = $4,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [adId, adminId, notes, overrideRestrictions]
    );

    // Log the action
    await logAdminAction({
        adminId,
        action: 'APPROVE_AD',
        targetId: adId,
        targetType: 'ad',
        details: { overrideRestrictions, notes }
    });

    // Notify the business owner
    await notifyBusinessOwner(ad.business_id, 'ad_approved', {
        adName: ad.name,
        notes
    });

    return result.rows[0];
};

/**
 * Reject an ad
 */
const adminRejectAd = async ({ adId, adminId, reason, notes = null }) => {
    const schema = await ensureAdSchema();

    // Check if ad exists
    const ad = await adminGetAdDetails(adId);
    if (!ad) {
        throw new Error('Ad not found');
    }

    // Update the ad
    let updateQuery = `
        UPDATE advertising_campaigns
        SET 
            review_status = 'rejected',
            status = 'rejected',
            reviewed_at = NOW(),
            reviewed_by = $2,
            review_notes = $3,
            rejection_reason = $4,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
    `;

    const result = await query(updateQuery, [adId, adminId, notes || reason, reason]);

    // Log the action
    await logAdminAction({
        adminId,
        action: 'REJECT_AD',
        targetId: adId,
        targetType: 'ad',
        details: { reason, notes }
    });

    // Notify the business owner
    await notifyBusinessOwner(ad.business_id, 'ad_rejected', {
        adName: ad.name,
        reason,
        notes
    });

    return result.rows[0];
};

/**
 * Bulk approve multiple ads
 */
const adminBulkApproveAds = async ({ adIds, adminId, overrideRestrictions = false }) => {
    const results = [];
    const errors = [];

    for (const adId of adIds) {
        try {
            const result = await adminApproveAd({
                adId,
                adminId,
                overrideRestrictions,
                notes: 'Bulk approved'
            });
            results.push(result);
        } catch (error) {
            errors.push({ adId, error: error.message });
        }
    }

    return {
        approved: results.length,
        failed: errors.length,
        results,
        errors
    };
};

/**
 * Bulk reject multiple ads
 */
const adminBulkRejectAds = async ({ adIds, adminId, reason }) => {
    const results = [];
    const errors = [];

    for (const adId of adIds) {
        try {
            const result = await adminRejectAd({
                adId,
                adminId,
                reason,
                notes: `Bulk reject: ${reason}`
            });
            results.push(result);
        } catch (error) {
            errors.push({ adId, error: error.message });
        }
    }

    return {
        rejected: results.length,
        failed: errors.length,
        results,
        errors
    };
};

/**
 * Pause an active ad
 */
const adminPauseAd = async (adId, adminId) => {
    const ad = await adminGetAdDetails(adId);
    if (!ad) {
        throw new Error('Ad not found');
    }

    if (ad.status !== 'active') {
        throw new Error('Can only pause active ads');
    }

    const result = await query(
        `
        UPDATE advertising_campaigns
        SET 
            status = 'paused',
            updated_at = NOW(),
            paused_by = $2,
            paused_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [adId, adminId]
    );

    // Log the action
    await logAdminAction({
        adminId,
        action: 'PAUSE_AD',
        targetId: adId,
        targetType: 'ad'
    });

    return result.rows[0];
};

/**
 * Resume a paused ad
 */
const adminResumeAd = async (adId, adminId) => {
    const ad = await adminGetAdDetails(adId);
    if (!ad) {
        throw new Error('Ad not found');
    }

    if (ad.status !== 'paused') {
        throw new Error('Can only resume paused ads');
    }

    const result = await query(
        `
        UPDATE advertising_campaigns
        SET 
            status = 'active',
            updated_at = NOW(),
            resumed_by = $2,
            resumed_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [adId, adminId]
    );

    // Log the action
    await logAdminAction({
        adminId,
        action: 'RESUME_AD',
        targetId: adId,
        targetType: 'ad'
    });

    return result.rows[0];
};

/**
 * Get ad review statistics
 */
const adminGetAdStats = async (days = 30) => {
    const result = await query(
        `
        SELECT 
            COUNT(*) as total_ads,
            COUNT(CASE WHEN review_status = 'pending' THEN 1 END) as pending_review,
            COUNT(CASE WHEN review_status = 'approved' THEN 1 END) as approved,
            COUNT(CASE WHEN review_status = 'rejected' THEN 1 END) as rejected,
            COALESCE(SUM(spend_minor), 0) as total_spend_minor,
            COALESCE(SUM(impressions), 0) as total_impressions,
            COALESCE(SUM(clicks), 0) as total_clicks,
            AVG(CASE WHEN impressions > 0 THEN clicks::float / impressions ELSE 0 END) * 100 as avg_ctr,
            COUNT(DISTINCT business_id) as unique_businesses
        FROM advertising_campaigns
        WHERE created_at >= NOW() - ($1 || ' days')::interval
        `,
        [days]
    );

    // Get daily trend
    const dailyTrend = await query(
        `
        SELECT 
            date_trunc('day', created_at) as date,
            COUNT(*) as submissions,
            COUNT(CASE WHEN review_status = 'approved' THEN 1 END) as approved,
            COUNT(CASE WHEN review_status = 'rejected' THEN 1 END) as rejected,
            AVG(CASE 
                WHEN reviewed_at IS NOT NULL 
                THEN EXTRACT(EPOCH FROM (reviewed_at - created_at))/3600
                ELSE NULL 
            END)::numeric(10,2) as avg_review_hours
        FROM advertising_campaigns
        WHERE created_at >= NOW() - ($1 || ' days')::interval
        GROUP BY date_trunc('day', created_at)
        ORDER BY date DESC
        `,
        [days]
    );

    return {
        summary: result.rows[0] || {},
        dailyTrend: dailyTrend.rows
    };
};

/**
 * Log admin actions for audit trail
 */
const logAdminAction = async ({ adminId, action, targetId, targetType, details = {} }) => {
    try {
        await query(
            `
            INSERT INTO admin_audit_log (
                admin_id,
                action,
                target_id,
                target_type,
                details,
                ip_address,
                user_agent,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            `,
            [
                adminId,
                action,
                targetId,
                targetType,
                JSON.stringify(details),
                null, // IP address would come from request
                null  // User agent would come from request
            ]
        );
    } catch (error) {
        console.error('Failed to log admin action:', error);
        // Don't throw - logging should not break the main operation
    }
};

/**
 * Notify business owner about ad status changes
 */
const notifyBusinessOwner = async (businessId, notificationType, data = {}) => {
    try {
        // Get business owner's email
        const business = await getBusinessOwner(businessId);
        if (!business || !business.email) {
            console.warn(`No email found for business ${businessId}`);
            return;
        }

        // Create notification in database
        await query(
            `
            INSERT INTO notifications (
                user_id,
                type,
                title,
                message,
                data,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())
            `,
            [
                business.owner_user_id,
                notificationType,
                getNotificationTitle(notificationType),
                getNotificationMessage(notificationType, data),
                JSON.stringify(data)
            ]
        );

        // TODO: Send email notification
        // await sendEmail(business.email, notificationType, data);
    } catch (error) {
        console.error('Failed to notify business owner:', error);
    }
};

const getNotificationTitle = (type) => {
    const titles = {
        ad_approved: 'Your Ad Has Been Approved',
        ad_rejected: 'Your Ad Was Rejected',
        ad_paused: 'Your Ad Has Been Paused',
        ad_resumed: 'Your Ad Has Been Resumed'
    };
    return titles[type] || 'Ad Status Update';
};

const getNotificationMessage = (type, data) => {
    const messages = {
        ad_approved: `Your ad "${data.adName}" has been approved and is now live.`,
        ad_rejected: `Your ad "${data.adName}" was rejected. Reason: ${data.reason}`,
        ad_paused: `Your ad "${data.adName}" has been paused by an administrator.`,
        ad_resumed: `Your ad "${data.adName}" has been resumed.`
    };
    return messages[type] || 'Your ad status has been updated.';
};

const logAdFailure = async ({ userId, businessId, errorMessage, details = {} }) => {
    try {
        await query(
            `INSERT INTO ad_campaign_failures (
                user_id,
                business_id,
                error_message,
                details,
                created_at
            ) VALUES ($1, $2, $3, $4::jsonb, NOW())`,
            [userId || null, businessId || null, errorMessage || 'Unknown error', JSON.stringify(details || {})]
        );
    } catch (error) {
        console.error('Failed to log ad failure:', error.message);
    }
};

const listAdFailures = async ({ limit = 50 } = {}) => {
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const result = await query(
        `SELECT f.*,
                c.name AS business_name,
                u.email AS user_email
         FROM ad_campaign_failures f
         LEFT JOIN companies c ON c.id = f.business_id
         LEFT JOIN users u ON u.id = f.user_id
         ORDER BY f.created_at DESC
         LIMIT $1`,
        [safeLimit]
    );
    return result.rows;
};

module.exports = {
    // Original exports
    getBusinessIdForUser,
    getBusinessOwner,
    upsertPlacements,
    validateMediaType,
    fetchPlacementCampaigns,
    getBusinessAdCapabilities,
    countActiveCampaigns,
    formatAnalyticsForTier,
    logAdFailure,
    listAdFailures,

    // New admin exports
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
};
