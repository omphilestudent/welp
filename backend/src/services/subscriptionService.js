const { query } = require('../utils/database');

const DEFAULT_PLAN_DURATION_DAYS = Number(process.env.DEFAULT_PLAN_DURATION_DAYS || 30);
const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || 'USD';

const PLAN_LIMITS = {
    user_free: { tier: 'free', chatMinutes: 30, callMinutes: 0, displayName: 'Free', videoDiscount: 0 },
    user_premium: { tier: 'premium', chatMinutes: 120, callMinutes: 90, displayName: 'Premium', videoDiscount: 20 },
    psychologist_standard: { tier: 'premium', chatMinutes: 180, callMinutes: 120, displayName: 'Psychologist Partner' },
    business_base: { tier: 'base', apiLimit: 1000, displayName: 'Business Base' },
    business_enhanced: { tier: 'enhanced', apiLimit: 3000, displayName: 'Business Enhanced' },
    business_premium: { tier: 'premium', apiLimit: 10000, displayName: 'Business Premium' }
};

const parseMetadata = (raw) => {
    if (!raw) return {};
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        } catch {
            return {};
        }
    }
    return raw;
};

const getPlanDetails = async (audience, planCode, currencyCode = DEFAULT_CURRENCY) => {
    const result = await query(
        `SELECT pc.*, c.symbol
         FROM pricing_catalog pc
         JOIN currencies c ON c.code = pc.currency_code
         WHERE pc.audience = $1 AND pc.plan_code = $2 AND pc.currency_code = $3
         LIMIT 1`,
        [audience, planCode, currencyCode]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const plan = result.rows[0];
    const metadata = parseMetadata(plan.metadata);
    return {
        ...plan,
        displayName: metadata.displayName || plan.plan_code,
        chatMinutes: metadata.chatMinutes ?? (plan.plan_code === 'user_premium' ? 120 : 30),
        callMinutes: metadata.callMinutes ?? 0,
        videoDiscount: metadata.videoDiscount ?? 0,
        currencySymbol: plan.symbol,
        metadata
    };
};

const createSubscriptionRecord = async (
    ownerType,
    ownerId,
    planCode,
    currencyCode,
    amountMinor,
    durationDays = DEFAULT_PLAN_DURATION_DAYS,
    metadata = {}
) => {
    const now = new Date();
    const endsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    await query(
        `INSERT INTO subscription_records (
             owner_type, owner_id, plan_code, currency_code, amount_minor,
             billing_period, starts_at, ends_at, status, metadata
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
            ownerType,
            ownerId,
            planCode,
            currencyCode,
            amountMinor,
            'monthly',
            now,
            endsAt,
            'active',
            JSON.stringify(metadata)
        ]
    );

    return { startsAt: now, endsAt };
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

const getActiveSubscription = async (ownerType, ownerId) => {
    const result = await query(
        `SELECT * FROM subscription_records
         WHERE owner_type = $1 AND owner_id = $2 AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 1`,
        [ownerType, ownerId]
    );

    return result.rows[0] || null;
};

const cancelSubscriptions = async (ownerType, ownerId) => {
    await query(
        `UPDATE subscription_records
         SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE owner_type = $1 AND owner_id = $2 AND status = 'active'`,
        [ownerType, ownerId]
    );
};

const getPlanPayload = async (record, audience) => {
    if (!record) {
        const fallbackPlanCode = audience === 'psychologist'
            ? 'psychologist_standard'
            : audience === 'business'
                ? 'business_base'
                : `${audience}_free`;
        const limits = PLAN_LIMITS[fallbackPlanCode] || {};
        return {
            planCode: fallbackPlanCode,
            tier: limits.tier || 'free',
            chatMinutes: limits.chatMinutes ?? (audience === 'user' ? 30 : 0),
            callMinutes: limits.callMinutes ?? 0,
            currencySymbol: '$',
            nextBillingDate: null,
            status: 'free'
        };
    }

    const plan = await getPlanDetails(audience, record.plan_code, record.currency_code);
    if (!plan) {
        return {
            planCode: record.plan_code,
            tier: PLAN_LIMITS[record.plan_code]?.tier || 'premium',
            chatMinutes: PLAN_LIMITS[record.plan_code]?.chatMinutes ?? 0,
            callMinutes: PLAN_LIMITS[record.plan_code]?.callMinutes ?? 0,
            currencySymbol: '$',
            nextBillingDate: record.ends_at,
            status: record.status
        };
    }

    return {
        planCode: record.plan_code,
        tier: PLAN_LIMITS[record.plan_code]?.tier || 'premium',
        chatMinutes: plan.chatMinutes,
        callMinutes: plan.callMinutes,
        currencySymbol: plan.currencySymbol,
        priceFormatted: `${plan.currencySymbol}${(plan.amount_minor / 100).toFixed(2)}`,
        nextBillingDate: record.ends_at,
        status: record.status
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
