const PLAN_PERMISSIONS = {
    free: {
        chatLimit: 30,
        videoCall: false,
        choosePsychologist: false,
        dashboardAccess: false,
        analytics: false,
        apiLimit: 0,
        adsEnabled: false
    },
    client_paid: {
        chatLimit: 120,
        videoCall: true,
        choosePsychologist: true,
        dashboardAccess: false,
        analytics: false,
        apiLimit: 0,
        adsEnabled: false
    },
    psychologist: {
        chatLimit: 180,
        videoCall: true,
        choosePsychologist: false,
        dashboardAccess: true,
        analytics: true,
        apiLimit: 0,
        adsEnabled: false
    },
    business_base: {
        chatLimit: 0,
        videoCall: false,
        choosePsychologist: false,
        dashboardAccess: true,
        analytics: true,
        apiLimit: 1000,
        adsEnabled: false
    },
    business_enhanced: {
        chatLimit: 0,
        videoCall: false,
        choosePsychologist: false,
        dashboardAccess: true,
        analytics: true,
        apiLimit: 3000,
        adsEnabled: false
    },
    business_premium: {
        chatLimit: 0,
        videoCall: false,
        choosePsychologist: false,
        dashboardAccess: true,
        analytics: true,
        apiLimit: 10000,
        adsEnabled: true
    }
};

const PLAN_ALIASES = {
    free: 'free',
    user_free: 'free',
    client_paid: 'client_paid',
    paid: 'client_paid',
    premium: 'client_paid',
    user_premium: 'client_paid',
    psychologist: 'psychologist',
    psychologist_standard: 'psychologist',
    psychologist_premium: 'psychologist',
    business_base: 'business_base',
    base: 'business_base',
    business_enhanced: 'business_enhanced',
    enhanced: 'business_enhanced',
    business_premium: 'business_premium',
    business: 'business_base'
};

const normalizeValue = (value) => (value ? String(value).trim().toLowerCase() : '');

const resolvePlanKeyFromSubscription = (subscription, role) => {
    const roleKey = normalizeValue(role);
    const planCode = normalizeValue(subscription?.planCode || subscription?.plan_code || subscription?.code);
    const planTier = normalizeValue(subscription?.planTier || subscription?.plan_tier || subscription?.tier);

    if (PLAN_ALIASES[planCode]) return PLAN_ALIASES[planCode];

    if (roleKey === 'business') {
        if (['base', 'enhanced', 'premium'].includes(planTier)) {
            return `business_${planTier}`;
        }
        return 'business_base';
    }

    if (roleKey === 'psychologist') {
        return 'psychologist';
    }

    if (PLAN_ALIASES[planTier]) return PLAN_ALIASES[planTier];
    return 'free';
};

export const getPlanKey = (user) => resolvePlanKeyFromSubscription(user?.subscription || {}, user?.role);

export const getPlanPermissions = (user) => {
    const key = getPlanKey(user);
    return PLAN_PERMISSIONS[key] || PLAN_PERMISSIONS.free;
};

export const hasAccess = (user, feature) => {
    if (!feature) return false;
    const permissions = getPlanPermissions(user);
    return Boolean(permissions?.[feature]);
};

export const getPlanPermissionValue = (user, feature, fallback = null) => {
    if (!feature) return fallback;
    const permissions = getPlanPermissions(user);
    const value = permissions?.[feature];
    return value === undefined ? fallback : value;
};

export const isBusinessPlan = (user) => {
    const key = getPlanKey(user);
    return key.startsWith('business_');
};

export { PLAN_PERMISSIONS };
