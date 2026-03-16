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
const { sendSubscriptionCancellationEmail } = require('../utils/emailService');
const { hasPremiumException } = require('../utils/premiumAccess');
const { emitFlowEvent } = require('../services/flowEngine');

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

const LARGE_QUOTA = 1_000_000;

const buildPremiumSubscriptionPayload = (ownerType) => ({
    planCode: 'business_premium',
    tier: 'premium',
    plan_tier: 'premium',
    planTier: 'premium',
    displayName: 'Premium (Welp)',
    chatMinutes: LARGE_QUOTA,
    callMinutes: LARGE_QUOTA,
    apiLimit: LARGE_QUOTA,
    ads: { maxActive: null, analytics: 'advanced' },
    features: {
        chat: 'unlimited',
        video: 'enabled',
        ads: 'unlimited',
        analytics: 'full'
    },
    priceFormatted: '$0.00',
    metadata: { override: 'welp-premium' },
    status: 'active',
    limits: { ads: { maxActive: null, analytics: 'advanced' } },
    limitSnapshot: { chat: { minutesPerDay: LARGE_QUOTA }, video: { sessionsPerWeek: LARGE_QUOTA } },
    expiresAt: null,
    ownerType
});

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

        emitFlowEvent('subscription.changed', {
            userId: req.user.id,
            ownerType,
            planCode: plan.planCode,
            action: 'upgrade',
            amountMinor: plan.amountMinor,
            currency: currencyCode
        }).catch((eventError) => {
            console.warn('Flow event dispatch failed (subscription upgrade):', eventError.message);
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
        if (hasPremiumException(req.user)) {
            const premiumPayload = buildPremiumSubscriptionPayload(ownerType);
            return res.json({
                success: true,
                subscription: {
                    ...premiumPayload,
                    ownerType,
                    expiresAt: null
                }
            });
        }
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

        try {
            await sendSubscriptionCancellationEmail({
                email: req.user?.email,
                name: req.user?.full_name || req.user?.display_name || req.user?.first_name || req.user?.name,
                previousPlan: previous?.plan_code || null,
                ownerType
            });
        } catch (notifyErr) {
            console.warn('Subscription cancellation email failed:', notifyErr.message);
        }

        emitFlowEvent('subscription.changed', {
            userId: req.user.id,
            ownerType,
            planCode: previous?.plan_code || fallbackPayload.planCode,
            action: 'cancel',
            amountMinor: previous?.amount_minor || 0,
            currency: previous?.currency_code || DEFAULT_CURRENCY
        }).catch((eventError) => {
            console.warn('Flow event dispatch failed (subscription cancel):', eventError.message);
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
