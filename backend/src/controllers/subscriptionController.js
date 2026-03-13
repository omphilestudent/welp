const {
    getActiveSubscription,
    getPlanDetails,
    createSubscriptionRecord,
    updateUserSubscriptionTier,
    cancelSubscriptions,
    getPlanPayload,
    DEFAULT_CURRENCY,
    DEFAULT_PLAN_DURATION_DAYS,
    PLAN_LIMITS
} = require('../services/subscriptionService');
const { recordAuditLog } = require('../utils/auditLogger');

const ROLE_TO_OWNER = {
    employee: 'user',
    psychologist: 'psychologist',
    business: 'business'
};

const DEFAULT_PLAN_CODES = {
    user: 'user_premium',
    psychologist: 'psychologist_standard',
    business: 'business_base'
};

const subscribePlan = async (req, res) => {
    try {
        const role = (req.user?.role || 'employee').toLowerCase();
        const ownerType = ROLE_TO_OWNER[role] || 'user';
        const planCode = req.body.planCode || DEFAULT_PLAN_CODES[ownerType] || 'user_premium';
        const currencyCode = (req.body.currency || DEFAULT_CURRENCY).toUpperCase();
        const plan = await getPlanDetails(ownerType, planCode, currencyCode);

        if (!plan) {
            return res.status(404).json({ error: 'Pricing plan not found for selected currency' });
        }

        const previous = await getActiveSubscription(ownerType, req.user.id);
        await cancelSubscriptions(ownerType, req.user.id);

        const durationDays = Number(req.body.durationDays) || DEFAULT_PLAN_DURATION_DAYS;
        const { endsAt } = await createSubscriptionRecord({
            ownerType,
            ownerId: req.user.id,
            plan,
            currencyCode,
            amountMinor: plan.amountMinor,
            durationDays
        });

        if (ownerType === 'user') {
            await updateUserSubscriptionTier(req.user.id, plan.tier, plan.chatMinutes, endsAt);
        }

        const latestRecord = await getActiveSubscription(ownerType, req.user.id);
        const subscriptionPayload = await getPlanPayload(latestRecord, ownerType);

        await recordAuditLog({
            userId: req.user.id,
            actorRole: ownerType,
            action: 'subscription.upgrade',
            entityType: `${ownerType}_subscription`,
            entityId: latestRecord?.id || null,
            oldValues: previous ? { planCode: previous.plan_code, status: previous.status } : null,
            newValues: {
                planCode: plan.planCode,
                status: 'active',
                currency: currencyCode,
                amountMinor: plan.amountMinor
            },
            metadata: { audience: ownerType, durationDays },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.json({
            success: true,
            subscription: {
                ...subscriptionPayload,
                ownerType,
                expiresAt: latestRecord?.ends_at?.toISOString() || endsAt?.toISOString()
            }
        });
    } catch (error) {
        console.error('Subscribe plan error:', error);
        return res.status(500).json({ error: 'Failed to update subscription' });
    }
};

const getMySubscription = async (req, res) => {
    try {
        const role = (req.user?.role || 'employee').toLowerCase();
        const ownerType = ROLE_TO_OWNER[role] || 'user';
        const record = await getActiveSubscription(ownerType, req.user.id);
        const payload = await getPlanPayload(record, ownerType);

        return res.json({
            success: true,
            subscription: {
                ...payload,
                ownerType,
                expiresAt: record?.ends_at || null
            }
        });
    } catch (error) {
        console.error('Get subscription error:', error);
        return res.status(500).json({ error: 'Unable to retrieve subscription' });
    }
};

const cancelSubscription = async (req, res) => {
    try {
        const role = (req.user?.role || 'employee').toLowerCase();
        const ownerType = ROLE_TO_OWNER[role] || 'user';
        const previous = await getActiveSubscription(ownerType, req.user.id);

        await cancelSubscriptions(ownerType, req.user.id);

        if (ownerType === 'user') {
            const limits = PLAN_LIMITS.user_free ?? { chatMinutes: 30 };
            await updateUserSubscriptionTier(req.user.id, 'free', limits.chatMinutes);
        }

        const fallbackPayload = await getPlanPayload(null, ownerType);

        await recordAuditLog({
            userId: req.user.id,
            actorRole: ownerType,
            action: 'subscription.cancel',
            entityType: `${ownerType}_subscription`,
            entityId: previous?.id || null,
            oldValues: previous ? { planCode: previous.plan_code, status: previous.status } : null,
            newValues: { planCode: fallbackPayload.planCode, status: 'cancelled' },
            metadata: { audience: ownerType },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.json({
            success: true,
            message: 'Subscription cancelled and reverted to free tier',
            subscription: {
                ...fallbackPayload,
                ownerType,
                expiresAt: null
            }
        });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        return res.status(500).json({ error: 'Unable to cancel subscription' });
    }
};

module.exports = {
    subscribePlan,
    getMySubscription,
    cancelSubscription
};
