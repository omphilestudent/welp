const {
    getBusinessPlanSnapshotByBusinessId,
    getBusinessPlanSnapshotByOwner,
    businessHasFeature
} = require('../utils/businessPlan');

const respondUpgradeRequired = (res, planSnapshot, featureKey) => {
    return res.status(403).json({
        error: 'Plan upgrade required',
        code: 'PLAN_UPGRADE_REQUIRED',
        feature: featureKey,
        plan: planSnapshot?.planCode || 'business_free_tier'
    });
};

const requireBusinessFeature = (featureKey, options = {}) => async (req, res, next) => {
    try {
        const businessId = options.businessIdResolver
            ? options.businessIdResolver(req)
            : req.params.companyId || req.params.businessId || null;
        const planSnapshot = businessId
            ? await getBusinessPlanSnapshotByBusinessId(businessId)
            : await getBusinessPlanSnapshotByOwner(req.user?.id);

        if (!businessHasFeature(planSnapshot, featureKey)) {
            return respondUpgradeRequired(res, planSnapshot, featureKey);
        }

        req.businessPlan = planSnapshot;
        return next();
    } catch (error) {
        console.error('Business plan check failed:', error);
        return res.status(500).json({ error: 'Unable to validate business plan' });
    }
};

module.exports = {
    requireBusinessFeature
};
