const { query } = require('../utils/database');
const { getPlanByCode, DEFAULT_CURRENCY: PRICING_DEFAULT_CURRENCY } = require('./pricingService');

const DEFAULT_PLAN_DURATION_DAYS = Number(process.env.DEFAULT_PLAN_DURATION_DAYS || 30);
const DEFAULT_CURRENCY = (PRICING_DEFAULT_CURRENCY || process.env.DEFAULT_CURRENCY || 'USD').toUpperCase();

const PLAN_LIMITS = {
    user_free: { tier: 'free', chatMinutes: 30, callMinutes: 0, displayName: 'Free', videoDiscount: 0, videoSessionsPerWeek: 1 },
    user_premium: { tier: 'premium', chatMinutes: 120, callMinutes: 90, displayName: 'Premium', videoDiscount: 20, videoSessionsPerWeek: 3 },
    psychologist_standard: { tier: 'premium', chatMinutes: 180, callMinutes: 120, displayName: 'Psychologist Partner' },
    business_base: { tier: 'base', apiLimit: 1000, displayName: 'Business Base', ads: { maxActive: 3, analytics: 'limited' } },
    business_enhanced: { tier: 'enhanced', apiLimit: 3000, displayName: 'Business Enhanced', ads: { maxActive: 5, analytics: 'standard' } },
    business_premium: { tier: 'premium', apiLimit: 10000, displayName: 'Business Premium', ads: { maxActive: null, analytics: 'advanced' } }
};

const DEFAULT_PRICING_FALLBACK = {
    user_free: { amountMinor: 0, currencySymbol: '$' },
    user_premium: { amountMinor: 0, currencySymbol: '$' },
    psychologist_standard: { amountMinor: 0, currencySymbol: '$' },
    business_base: { amountMinor: 0, currencySymbol: '$' },
    business_enhanced: { amountMinor: 0, currencySymbol: '$' },
    business_premium: { amountMinor: 0, currencySymbol: '$' }
};

const buildPlanFromLimits = (planCode, currencyCode = DEFAULT_CURRENCY) => {
    const limits = PLAN_LIMITS[planCode];
    if (!limits) return null;
    const fallbackPrice = DEFAULT_PRICING_FALLBACK[planCode] || DEFAULT_PRICING_FALLBACK.user_free;
    const normalizedLimits = {};
    if (limits.chatMinutes != null) {
        normalizedLimits.chat = { minutesPerDay: limits.chatMinutes };
    }
    if (limits.callMinutes != null) {
        normalizedLimits.video = { minutesPerSession: limits.callMinutes };
    }
    if (limits.apiLimit != null) {
        normalizedLimits.api = { callsPerDay: limits.apiLimit };
    }
    if (limits.ads) {
        normalizedLimits.ads = limits.ads;
    }

    return {
        planCode,
        planTier: limits.tier || 'free',
        plan_tier: limits.tier || 'free',
        tier: limits.tier || 'free',
        displayName: limits.displayName || planCode,
        metadata: { displayName: limits.displayName || planCode },
        amountMinor: fallbackPrice.amountMinor ?? 0,
        currencySymbol: fallbackPrice.currencySymbol || '$',
        currencyCode,
        billingPeriod: 'monthly',
        priceFormatted: formatPrice(fallbackPrice.amountMinor ?? 0, fallbackPrice.currencySymbol || '$'),
        limits: normalizedLimits,
        features: []
    };
};

const parseJson = (raw, fallback) => {
    if (raw === null || raw === undefined) return fallback;
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        } catch {
            return fallback;
        }
    }
    if (Array.isArray(fallback) && Array.isArray(raw)) return raw;
    if (!Array.isArray(fallback) && typeof raw === 'object') return raw;
    return fallback;
};

const formatPrice = (amountMinor, symbol = '$') => {
    const amount = Number(amountMinor || 0) / 100;
    return `${symbol}${amount.toFixed(2)}`;
};

const getPlanDetails = async (audience, planCode, currencyCode = DEFAULT_CURRENCY, options = {}) => {
    let plan = await getPlanByCode(audience, planCode, currencyCode, options);
    if (!plan) {
        plan = buildPlanFromLimits(planCode, currencyCode);
        if (!plan) {
            return null;
        }
    }

    const metadata = plan.metadata || {};
    const planLimits = PLAN_LIMITS[planCode] || {};
    const chatMinutes = plan.limits?.chat?.minutesPerDay ?? planLimits.chatMinutes ?? (audience === 'user' ? 30 : 0);
    const callMinutes = plan.limits?.video?.minutesPerSession ?? planLimits.callMinutes ?? 0;
    const apiLimit = plan.limits?.api?.callsPerDay ?? planLimits.apiLimit ?? null;

    return {
        ...plan,
        tier: plan.planTier || planLimits.tier || 'free',
        displayName: metadata.displayName || planLimits.displayName || plan.planCode,
        chatMinutes,
        callMinutes,
        apiLimit,
        ads: plan.limits?.ads || planLimits.ads || {}
    };
};

const createSubscriptionRecord = async ({
    ownerType,
    ownerId,
    plan,
    currencyCode = DEFAULT_CURRENCY,
    amountMinor,
    durationDays = DEFAULT_PLAN_DURATION_DAYS,
    metadata = {}
}) => {
    if (!plan) {
        throw new Error('Plan details are required to create a subscription record');
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const amount = amountMinor ?? plan.amountMinor ?? 0;
    const mergedMetadata = {
        ...(plan.metadata || {}),
        ...metadata,
        displayName: plan.displayName || plan.planCode,
        currencySymbol: plan.currencySymbol || metadata.currencySymbol || '$'
    };

    const insertResult = await query(
        `INSERT INTO subscription_records (
             owner_type,
             owner_id,
             plan_code,
             currency_code,
             amount_minor,
             billing_period,
             starts_at,
             ends_at,
             status,
             metadata,
             feature_snapshot,
             limit_snapshot,
             trial_days
         ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,'active',$9::jsonb,$10::jsonb,$11::jsonb,$12
         )
         RETURNING *`,
        [
            ownerType,
            ownerId,
            plan.planCode,
            currencyCode,
            amount,
            plan.billingPeriod || 'monthly',
            now,
            endsAt,
            JSON.stringify(mergedMetadata),
            JSON.stringify(plan.features || []),
            JSON.stringify(plan.limits || {}),
            Number(plan.trialDays || 0)
        ]
    );

    return {
        record: insertResult.rows[0],
        startsAt: now,
        endsAt
    };
};

const updateUserSubscriptionTier = async (userId, tier, chatMinutes, expiresAt) => {
    const expiry = expiresAt || new Date(Date.now() + DEFAULT_PLAN_DURATION_DAYS * 24 * 60 * 60 * 1000);
    await query(
        `UPDATE users
         SET subscription_tier = $1,
             subscription_expires = $2,
             daily_chat_quota_mins = $3,
             used_chat_minutes = 0,
             last_chat_reset = CURRENT_DATE,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [tier, expiry, chatMinutes, userId]
    );
};

const serializeRecord = (row) => {
    if (!row) return null;
    return {
        ...row,
        metadata: parseJson(row.metadata, {}),
        feature_snapshot: parseJson(row.feature_snapshot, []),
        limit_snapshot: parseJson(row.limit_snapshot, {})
    };
};

const getActiveSubscription = async (ownerType, ownerId) => {
    const result = await query(
        `SELECT *
         FROM subscription_records
         WHERE owner_type = $1
           AND owner_id = $2
           AND status = 'active'
         ORDER BY ends_at DESC
         LIMIT 1`,
        [ownerType, ownerId]
    );

    return serializeRecord(result.rows[0]) || null;
};

const cancelSubscriptions = async (ownerType, ownerId) => {
    await query(
        `UPDATE subscription_records
         SET status = 'cancelled',
             cancelled_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE owner_type = $1
           AND owner_id = $2
           AND status = 'active'`,
        [ownerType, ownerId]
    );
};

const FALLBACK_PLAN_MAPPING = {
    user: { planCode: 'user_free' },
    psychologist: { planCode: 'user_free', tier: 'free' },
    business: { planCode: 'business_base' }
};

const buildFallbackPayload = (audience = 'user') => {
    const mapping = FALLBACK_PLAN_MAPPING[audience] || FALLBACK_PLAN_MAPPING.user;
    const fallbackPlanCode = mapping.planCode;
    const limits = PLAN_LIMITS[fallbackPlanCode] || PLAN_LIMITS.user_free || {};
    const tier = mapping.tier || limits.tier || 'free';
    const chatMinutes = limits.chatMinutes ?? (audience === 'user' ? 30 : 0);
    const callMinutes = limits.callMinutes ?? 0;
    const apiLimit = limits.apiLimit ?? null;
    const symbol = '$';

    return {
        planCode: fallbackPlanCode,
        tier,
        chatMinutes,
        callMinutes,
        apiLimit,
        ads: limits.ads || {},
        displayName: limits.displayName || fallbackPlanCode,
        currencyCode: DEFAULT_CURRENCY,
        currencySymbol: symbol,
        amountMinor: 0,
        priceFormatted: `${symbol}0.00`,
        nextBillingDate: null,
        status: 'free'
    };
};

const getPlanPayload = async (record, audience) => {
    if (!record) {
        return buildFallbackPayload(audience);
    }

    const plan = await getPlanDetails(audience, record.plan_code, record.currency_code);
    const limits = record.limit_snapshot || {};
    const planLimits = PLAN_LIMITS[record.plan_code] || {};
    const chatMinutes = limits.chat?.minutesPerDay ?? plan?.chatMinutes ?? planLimits.chatMinutes ?? 0;
    const callMinutes = limits.video?.minutesPerSession ?? plan?.callMinutes ?? planLimits.callMinutes ?? 0;
    const apiLimit = limits.api?.callsPerDay ?? plan?.apiLimit ?? planLimits.apiLimit ?? null;
    const adsLimits = limits.ads || plan?.ads || planLimits.ads || {};
    const currencySymbol = plan?.currencySymbol || record.metadata?.currencySymbol || '$';
    const currencyCode = plan?.currencyCode || record.currency_code || DEFAULT_CURRENCY;
    const amountMinor = Number(record.amount_minor ?? plan?.amountMinor ?? 0);
    const planTier = plan?.tier || planLimits.tier || 'free';
    const displayName = plan?.displayName || planLimits.displayName || plan?.metadata?.displayName || record.plan_code;

    return {
        planCode: record.plan_code,
        tier: planTier,
        plan_tier: planTier,
        planTier,
        chatMinutes,
        callMinutes,
        apiLimit,
        ads: adsLimits,
        displayName,
        currencyCode,
        currencySymbol,
        amountMinor,
        priceFormatted: plan?.priceFormatted || formatPrice(amountMinor, currencySymbol),
        nextBillingDate: record.ends_at,
        status: record.status,
        metadata: record.metadata,
        limits
    };
};

module.exports = {
    getPlanDetails,
    createSubscriptionRecord,
    updateUserSubscriptionTier,
    getActiveSubscription,
    cancelSubscriptions,
    getPlanPayload,
    PLAN_LIMITS,
    DEFAULT_PLAN_DURATION_DAYS,
    DEFAULT_CURRENCY
};
