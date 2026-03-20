const { query } = require('./database');
const { getActiveSubscription, PLAN_LIMITS } = require('../services/subscriptionService');

const BUSINESS_PLAN_BY_TIER = {
    free_tier: 'business_free_tier',
    base: 'business_base',
    enhanced: 'business_enhanced',
    premium: 'business_premium'
};

const BUSINESS_FEATURES = {
    business_free_tier: {
        analytics: false,
        ads: false,
        apiKeys: true,
        apiAccess: true,
        profile: true
    },
    business_base: {
        analytics: true,
        ads: true,
        apiKeys: true,
        apiAccess: true,
        profile: true
    },
    business_enhanced: {
        analytics: true,
        ads: true,
        apiKeys: true,
        apiAccess: true,
        profile: true
    },
    business_premium: {
        analytics: true,
        ads: true,
        apiKeys: true,
        apiAccess: true,
        profile: true
    }
};

const normalizeTier = (tier) => (tier ? String(tier).toLowerCase() : '');

const resolvePlanCodeFromTier = (tier) => BUSINESS_PLAN_BY_TIER[normalizeTier(tier)] || 'business_free_tier';

const getBusinessRecordById = async (businessId) => {
    if (!businessId) return null;
    const companyResult = await query(
        `SELECT id,
                COALESCE(claimed_by, created_by_user_id) AS owner_user_id
         FROM companies
         WHERE id = $1
         LIMIT 1`,
        [businessId]
    );
    if (companyResult.rows[0]) {
        return companyResult.rows[0];
    }

    const businessResult = await query(
        `SELECT id, owner_user_id, subscription_tier
         FROM businesses
         WHERE id = $1
         LIMIT 1`,
        [businessId]
    );
    return businessResult.rows[0] || null;
};

const getBusinessRecordByOwner = async (ownerUserId) => {
    if (!ownerUserId) return null;
    const companyResult = await query(
        `SELECT id,
                COALESCE(claimed_by, created_by_user_id) AS owner_user_id
         FROM companies
         WHERE COALESCE(claimed_by, created_by_user_id) = $1
         ORDER BY created_at ASC
         LIMIT 1`,
        [ownerUserId]
    );
    if (companyResult.rows[0]) {
        return companyResult.rows[0];
    }

    const businessResult = await query(
        `SELECT id, owner_user_id, subscription_tier
         FROM businesses
         WHERE owner_user_id = $1
         ORDER BY created_at ASC
         LIMIT 1`,
        [ownerUserId]
    );
    return businessResult.rows[0] || null;
};

const resolvePlanCodeForBusiness = async (businessRecord) => {
    if (!businessRecord?.owner_user_id) {
        return resolvePlanCodeFromTier(businessRecord?.subscription_tier);
    }
    const activeRecord = await getActiveSubscription('business', businessRecord.owner_user_id);
    if (activeRecord?.plan_code) {
        return activeRecord.plan_code;
    }
    return resolvePlanCodeFromTier(businessRecord?.subscription_tier);
};

const buildBusinessPlanSnapshot = (planCode) => {
    const normalizedCode = planCode || 'business_free_tier';
    const limits = PLAN_LIMITS[normalizedCode] || PLAN_LIMITS.business_free_tier || {};
    const planTier = limits.tier || (normalizedCode.includes('free') ? 'free_tier' : 'base');
    const featureMap = BUSINESS_FEATURES[normalizedCode] || BUSINESS_FEATURES.business_free_tier;

    return {
        planCode: normalizedCode,
        planTier,
        displayName: limits.displayName || normalizedCode,
        apiLimit: limits.apiLimit ?? null,
        ads: limits.ads || {},
        isFreeTier: planTier === 'free_tier' || normalizedCode === 'business_free_tier',
        isPaid: normalizedCode !== 'business_free_tier',
        features: featureMap
    };
};

const getBusinessPlanSnapshotByBusinessId = async (businessId) => {
    const business = await getBusinessRecordById(businessId);
    if (!business) {
        return buildBusinessPlanSnapshot('business_free_tier');
    }
    const planCode = await resolvePlanCodeForBusiness(business);
    return buildBusinessPlanSnapshot(planCode);
};

const getBusinessPlanSnapshotByOwner = async (ownerUserId) => {
    const business = await getBusinessRecordByOwner(ownerUserId);
    if (!business) {
        return buildBusinessPlanSnapshot('business_free_tier');
    }
    const planCode = await resolvePlanCodeForBusiness(business);
    return buildBusinessPlanSnapshot(planCode);
};

const businessHasFeature = (planSnapshot, featureKey) => {
    if (!planSnapshot || !featureKey) return false;
    const featureMap = planSnapshot.features || BUSINESS_FEATURES[planSnapshot.planCode] || {};
    return Boolean(featureMap[featureKey]);
};

const getBusinessDailyApiLimit = (planSnapshot) => {
    if (!planSnapshot) return null;
    if (planSnapshot.apiLimit != null) return Number(planSnapshot.apiLimit);
    const limits = PLAN_LIMITS[planSnapshot.planCode || 'business_free_tier'] || PLAN_LIMITS.business_free_tier;
    return limits.apiLimit ?? null;
};

module.exports = {
    getBusinessRecordById,
    getBusinessRecordByOwner,
    getBusinessPlanSnapshotByBusinessId,
    getBusinessPlanSnapshotByOwner,
    businessHasFeature,
    getBusinessDailyApiLimit,
    resolvePlanCodeFromTier,
    buildBusinessPlanSnapshot
};
