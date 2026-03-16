import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import {
    fetchSubscription,
    upgradeSubscription,
    cancelSubscription,
    fetchPricingForAudience
} from '../../services/subscriptionService';
import { fetchCountries } from '../../services/pricingService';
import { getMyCampaigns } from '../../services/adService';
import {
    currencyForCountry,
    DEFAULT_CURRENCY,
    deriveCountryCode,
    formatAmountMinor,
    guessCurrencySymbol
} from '../../utils/currency';
import './SubscriptionStatus.css';

const normalizePlanIdentifier = (value) => (value ? String(value).trim() : '');
const toLowerSafe = (value) => normalizePlanIdentifier(value).toLowerCase();
const toTitle = (value) => {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1);
};

const normalizeSubscriptionPayload = (payload) => {
    if (!payload) return null;
    const planCode = normalizePlanIdentifier(payload.planCode || payload.plan_code || payload.code);
    const planTier = normalizePlanIdentifier(payload.planTier || payload.plan_tier || payload.tier);
    const statusRaw = normalizePlanIdentifier(payload.status || payload.state || 'free') || 'free';
    const currencyCode = normalizePlanIdentifier(payload.currencyCode || payload.currency_code || payload.currency) || 'USD';
    const currencySymbol = payload.currencySymbol
        || payload.currency_symbol
        || payload.currencySign
        || guessCurrencySymbol(currencyCode);
    const amountMinor = Number.isFinite(payload.amountMinor)
        ? payload.amountMinor
        : Number.isFinite(payload.amount_minor)
            ? payload.amount_minor
            : null;
    const priceFormatted = payload.priceFormatted
        || payload.price_formatted
        || (amountMinor != null ? formatAmountMinor(amountMinor, currencyCode, currencySymbol) : null);

    return {
        ...payload,
        planCode: planCode || payload.planCode,
        planCodeNormalized: toLowerSafe(planCode),
        planTier: planTier || payload.planTier || payload.tier,
        planTierNormalized: toLowerSafe(planTier),
        tier: payload.tier || planTier || undefined,
        status: payload.status || statusRaw,
        statusNormalized: toLowerSafe(statusRaw),
        statusLabel: toTitle(statusRaw),
        currencyCode,
        currencySymbol,
        amountMinor,
        priceFormatted
    };
};

const FREE_PLAN_SNAPSHOT = {
    planCode: 'free',
    planCodeNormalized: 'free',
    planTier: 'free',
    planTierNormalized: 'free',
    tier: 'free',
    displayName: 'Free plan',
    status: 'free',
    statusNormalized: 'free',
    statusLabel: 'Free',
    chatMinutes: '—',
    callMinutes: '—',
    currencyCode: DEFAULT_CURRENCY.code,
    currencySymbol: DEFAULT_CURRENCY.symbol,
    priceFormatted: `${DEFAULT_CURRENCY.symbol}0.00`,
    amountMinor: 0,
    cancellable: false
};

const deriveAudienceKey = (role) => {
    const normalized = toLowerSafe(role || '');
    if (normalized === 'business') return 'business';
    if (normalized === 'psychologist') return 'psychologist';
    return 'user';
};

const defaultPlanCodeByRole = {
    psychologist: 'psychologist_premium',
    business: 'business_premium',
    employee: 'user_premium'
};

const formatPlanDisplayName = (value) => {
    if (!value) return '';
    return value
        .split(/[_\s]/)
        .filter(Boolean)
        .map(toTitle)
        .join(' ');
};

const BUSINESS_PLAN_ENTITLEMENTS = {
    base: {
        label: 'Base Plan',
        apiLimit: 1000,
        analyticsLevel: 'Basic analytics',
        analyticsFeatures: ['Basic profile analytics', 'Basic traffic insights'],
        advertising: {
            maxAds: 1,
            placement: 'Business profile placements & recommendations',
            mediaSupport: 'Image, video & GIF creative support',
            features: ['Basic profile visibility', 'No advanced ad placements']
        }
    },
    enhanced: {
        label: 'Enhanced Plan',
        apiLimit: 3000,
        analyticsLevel: 'Expanded analytics',
        analyticsFeatures: ['Expanded business analytics', 'Marketing performance data', 'Audience interest tracking'],
        advertising: {
            maxAds: 5,
            placement: 'Priority placements with marketing highlights',
            mediaSupport: 'Image, video & GIF creative support',
            features: ['Marketing insights', 'Expanded analytics', 'Ability to upload promotional media']
        }
    },
    premium: {
        label: 'Premium Plan',
        apiLimit: 10000,
        analyticsLevel: 'Advanced analytics',
        analyticsFeatures: ['Advanced behavioral analytics', 'Email engagement insights', 'Campaign performance analytics'],
        advertising: {
            maxAds: null,
            placement: 'Premium spots including competitor profiles',
            mediaSupport: 'Image, video & GIF creative support',
            features: ['Unlimited active ads', 'Advertise on other business pages', 'Advanced campaign analytics', 'Email insights on user engagement']
        }
    }
};

const LOCALIZED_PRICING_FALLBACKS = {
    ZA: {
        user: {
            user_premium: { amountMinor: 15000, currencyCode: 'ZAR', currencySymbol: 'R' },
            premium: { amountMinor: 15000, currencyCode: 'ZAR', currencySymbol: 'R' }
        },
        psychologist: {
            psychologist_standard: { amountMinor: 50000, currencyCode: 'ZAR', currencySymbol: 'R' },
            standard: { amountMinor: 50000, currencyCode: 'ZAR', currencySymbol: 'R' }
        },
        business: {
            business_base: { amountMinor: 100000, currencyCode: 'ZAR', currencySymbol: 'R' },
            base: { amountMinor: 100000, currencyCode: 'ZAR', currencySymbol: 'R' },
            business_enhanced: { amountMinor: 200000, currencyCode: 'ZAR', currencySymbol: 'R' },
            enhanced: { amountMinor: 200000, currencyCode: 'ZAR', currencySymbol: 'R' },
            business_premium: { amountMinor: 300000, currencyCode: 'ZAR', currencySymbol: 'R' },
            premium: { amountMinor: 300000, currencyCode: 'ZAR', currencySymbol: 'R' }
        }
    }
};

const formatMetricValue = (value, { unlimitedLabel = 'Unlimited', fallback = '—' } = {}) => {
    if (value === null || value === undefined) return fallback;
    if (value === Infinity || value === -1) return unlimitedLabel;
    if (!Number.isFinite(value)) return unlimitedLabel;
    return Number(value).toLocaleString();
};

const resolveFallbackLocalizedPlan = ({ audience, planCode, planTier, countryCode }) => {
    if (!countryCode) return null;
    const normalizedCountry = countryCode.toUpperCase();
    const audienceKey = toLowerSafe(audience) || 'user';
    const fallbackByCountry = LOCALIZED_PRICING_FALLBACKS[normalizedCountry];
    if (!fallbackByCountry) return null;
    const audienceFallback = fallbackByCountry[audienceKey];
    if (!audienceFallback) return null;
    const normalizedPlanCode = toLowerSafe(planCode);
    const normalizedPlanTier = toLowerSafe(planTier);
    const entry =
        audienceFallback[normalizedPlanCode] ||
        audienceFallback[normalizedPlanTier] ||
        audienceFallback.default;
    if (!entry || !Number.isFinite(entry.amountMinor)) return null;
    const currencyCode = entry.currencyCode || 'ZAR';
    const currencySymbol = entry.currencySymbol || 'R';
    return {
        amountMinor: entry.amountMinor,
        currencyCode,
        currencySymbol,
        priceFormatted: formatAmountMinor(entry.amountMinor, currencyCode, currencySymbol)
    };
};

const resolveAdsAuthMessage = (error) => {
    if (error?.response?.status !== 403) {
        return null;
    }
    const payload = error.response.data;
    const detail =
        (typeof payload?.error === 'string' && payload.error.trim()) ||
        (typeof payload?.message === 'string' && payload.message.trim());
    return detail || 'Unauthorized access';
};

const SubscriptionStatus = () => {
    const { user, updateUser, isAuthenticated } = useAuth();
    const [subscription, setSubscription] = useState(() => normalizeSubscriptionPayload(user?.subscription) ?? null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [adsCapability, setAdsCapability] = useState(null);
    const subscriptionLoadKeyRef = useRef(null);
    const pricingKeyRef = useRef('');
    const lastSubscriptionFetchRef = useRef(0);
    const lastAdsFetchRef = useRef(0);
    const [localizedPlan, setLocalizedPlan] = useState(null);
    const [availableCountries, setAvailableCountries] = useState([]);
    const [countryPreference, setCountryPreference] = useState(null);
    const userId = user?.id ?? null;
    const userRole = user?.role ?? '';
    const normalizedUserRole = useMemo(() => toLowerSafe(userRole), [userRole]);
    const isBusinessUser = normalizedUserRole === 'business';
    const audienceKey = useMemo(() => deriveAudienceKey(userRole), [userRole]);
    const countryCode = useMemo(() => deriveCountryCode(user || {}), [user]);
    const fallbackCurrency = useMemo(() => currencyForCountry(countryCode), [countryCode]);
    const preferredCurrency = useMemo(() => {
        if (countryPreference) {
            const code = countryPreference.currency || fallbackCurrency.code;
            return {
                code,
                symbol: countryPreference.currencySymbol || guessCurrencySymbol(code)
            };
        }
        return fallbackCurrency;
    }, [countryPreference, fallbackCurrency]);

    const applySubscriptionSnapshot = useCallback((snapshot) => {
        const normalized = normalizeSubscriptionPayload(snapshot) ?? { ...FREE_PLAN_SNAPSHOT };
        setSubscription(normalized);
        updateUser?.({ subscription: normalized });
        return normalized;
    }, [updateUser]);

    const loadAdsCapability = useCallback(async ({ force = false } = {}) => {
        if (normalizedUserRole !== 'business') {
            setAdsCapability(null);
            return;
        }
        const now = Date.now();
        if (!force && now - lastAdsFetchRef.current < 20000) {
            return;
        }
        lastAdsFetchRef.current = now;
        try {
            const response = await getMyCampaigns();
            const payload = response.data?.data || response.data || {};
            const campaigns = Array.isArray(payload.campaigns) ? payload.campaigns : [];
            const activeCount = payload.activeCount ?? campaigns.filter((campaign) => campaign.status === 'active').length;
            const capability = payload.capabilities
                ? {
                      ...payload.capabilities,
                      activeCount,
                      maxActive: payload.maxActive ?? payload.capabilities?.maxActive ?? null
                  }
                : null;
            setAdsCapability(capability);
        } catch (error) {
            const authError = resolveAdsAuthMessage(error);
            if (authError) {
                toast.error(authError);
            }
            setAdsCapability(null);
        }
    }, [normalizedUserRole]);

    useEffect(() => {
        let mounted = true;
        const loadCountries = async () => {
            try {
                const list = await fetchCountries();
                if (mounted) {
                    setAvailableCountries(list);
                }
            } catch (error) {
                console.warn('Unable to load country pricing reference:', error?.message || error);
                if (mounted) {
                    setAvailableCountries([]);
                }
            }
        };
        loadCountries();
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!countryCode || !availableCountries.length) {
            setCountryPreference(null);
            return;
        }
        const match = availableCountries.find((entry) => entry.code === countryCode);
        setCountryPreference(match || null);
    }, [availableCountries, countryCode]);

    const loadLocalizedPlan = useCallback(async (planCode, requestedAudience, planTierHint) => {
        if (!planCode) {
            setLocalizedPlan(null);
            return;
        }
        const normalizedPlanCode = toLowerSafe(planCode);
        const country = countryCode;
        const audience = requestedAudience || 'user';
        const normalizedAudience = toLowerSafe(audience) || 'user';
        const tryFallback = () => {
            const fallbackPlan = resolveFallbackLocalizedPlan({
                audience: normalizedAudience,
                planCode,
                planTier: planTierHint,
                countryCode: country
            });
            if (fallbackPlan) {
                setLocalizedPlan(fallbackPlan);
                return true;
            }
            return false;
        };
        const currencyOverride = countryPreference?.currency || null;
        const cacheCurrency = currencyOverride || preferredCurrency.code;
        const cacheCountry = country || 'default';
        const cacheKey = `${normalizedPlanCode}:${audience}:${cacheCountry}:${cacheCurrency}`;
        if (pricingKeyRef.current === cacheKey) return;
        pricingKeyRef.current = cacheKey;
        try {
            const requestParams = { audience, country };
            if (currencyOverride) {
                requestParams.currency = currencyOverride;
            }
            const { data } = await fetchPricingForAudience(requestParams);
            const plans = Array.isArray(data?.plans) ? data.plans : [];
            const match = plans.find((plan) => {
                const identifier = toLowerSafe(plan.planCode || plan.plan_code || plan.code);
                if (identifier && identifier === normalizedPlanCode) return true;
                const tierId = toLowerSafe(plan.planTier || plan.plan_tier || plan.tier);
                return tierId && tierId === normalizedPlanCode;
            });
            if (!match) {
                if (!tryFallback()) {
                    setLocalizedPlan(null);
                }
                return;
            }
            const resolvedCurrencyCode =
                match.currencyCode || match.currency_code || data?.currency?.code || cacheCurrency;
            const resolvedCurrencySymbol =
                match.currencySymbol ||
                match.currency_symbol ||
                data?.currency?.symbol ||
                preferredCurrency.symbol;
            setLocalizedPlan({
                priceFormatted: match.priceFormatted
                    || match.price_formatted
                    || (match.amountMinor != null
                        ? formatAmountMinor(match.amountMinor, resolvedCurrencyCode, resolvedCurrencySymbol)
                        : null),
                currencySymbol: resolvedCurrencySymbol,
                currencyCode: resolvedCurrencyCode,
                amountMinor: match.amountMinor ?? match.amount_minor ?? null
            });
        } catch (error) {
            console.warn('Localized pricing unavailable:', error?.message || error);
            if (!tryFallback()) {
                setLocalizedPlan(null);
            }
        }
    }, [countryCode, countryPreference, preferredCurrency]);

    const loadSubscription = useCallback(async ({ force = false } = {}) => {
        if (!isAuthenticated || !userId) {
            subscriptionLoadKeyRef.current = null;
            setSubscription(null);
            setAdsCapability(null);
            return;
        }
        const now = Date.now();
        if (!force && now - lastSubscriptionFetchRef.current < 15000) {
            return;
        }
        lastSubscriptionFetchRef.current = now;
        setLoading(true);
        try {
            const { data } = await fetchSubscription();
            const normalized = applySubscriptionSnapshot(data?.subscription);
            await loadLocalizedPlan(
                normalized?.planCode || normalized?.planCodeNormalized,
                audienceKey,
                normalized?.planTier || normalized?.plan_tier
            );
            if (normalizedUserRole === 'business') {
                await loadAdsCapability({ force: true });
            } else {
                setAdsCapability(null);
            }
        } catch (error) {
            console.error('Failed to load subscription', error);
            const authError = resolveAdsAuthMessage(error);
            toast.error(authError ?? 'Unable to load subscription status');
            if (error.response?.status === 401) {
                applySubscriptionSnapshot(null);
            }
            setAdsCapability(null);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, userId, audienceKey, normalizedUserRole, applySubscriptionSnapshot, loadLocalizedPlan, loadAdsCapability]);

    const authIdentityKey = isAuthenticated && userId ? `${userId}:${normalizedUserRole || 'user'}` : null;

    useEffect(() => {
        if (!authIdentityKey) {
            subscriptionLoadKeyRef.current = null;
            setSubscription(null);
            setAdsCapability(null);
            return;
        }
        if (subscriptionLoadKeyRef.current === authIdentityKey) return;
        subscriptionLoadKeyRef.current = authIdentityKey;
        loadSubscription({ force: true });
    }, [authIdentityKey, loadSubscription]);

    useEffect(() => {
        if (!user?.subscription) return;
        applySubscriptionSnapshot(user.subscription);
    }, [user?.subscription, applySubscriptionSnapshot]);

    const subscriptionTierNormalized = toLowerSafe(
        subscription?.planTier || subscription?.plan_tier || subscription?.planTierNormalized
    );
    const planIdentifier = subscription?.planCode || subscription?.planCodeNormalized;
    const planTierHint = subscription?.planTier || subscription?.plan_tier || subscriptionTierNormalized;

    useEffect(() => {
        if (!planIdentifier) {
            setLocalizedPlan(null);
            return;
        }
        loadLocalizedPlan(planIdentifier, audienceKey, planTierHint);
    }, [planIdentifier, audienceKey, planTierHint, loadLocalizedPlan]);

    const handleUpgrade = async () => {
        if (actionLoading) return;
        setActionLoading(true);
        const fallbackPlanCode = subscription?.upgradePlanCode
            || subscription?.recommendedPlanCode
            || defaultPlanCodeByRole[normalizedUserRole]
            || 'user_premium';
        const upgradeCurrency = localizedPlan?.currencyCode || subscription?.currencyCode || preferredCurrency.code;
        try {
            const { data } = await upgradeSubscription({
                planCode: fallbackPlanCode,
                currency: upgradeCurrency
            });
            applySubscriptionSnapshot(data.subscription);
            toast.success('Upgraded successfully');
            await loadSubscription({ force: true });
        } catch (error) {
            const message = error.response?.data?.error || 'Upgrade failed';
            toast.error(message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleCancel = async () => {
        if (actionLoading) return;
        setActionLoading(true);
        try {
            const { data } = await cancelSubscription();
            applySubscriptionSnapshot(data.subscription);
            toast.success('Reverted to Free tier');
            await loadSubscription({ force: true });
        } catch (error) {
            const message = error.response?.data?.error || 'Failed to cancel subscription';
            toast.error(message);
        } finally {
            setActionLoading(false);
        }
    };

    const effectiveSubscription = subscription ?? FREE_PLAN_SNAPSHOT;
    const statusNormalized = effectiveSubscription.statusNormalized || toLowerSafe(effectiveSubscription.status);
    const planTierNormalized = effectiveSubscription.planTierNormalized || toLowerSafe(effectiveSubscription.planTier);
    const planCodeNormalized = effectiveSubscription.planCodeNormalized || toLowerSafe(effectiveSubscription.planCode);
    const planLabel = statusNormalized === 'free'
        ? 'Free plan'
        : effectiveSubscription.displayName
            || formatPlanDisplayName(effectiveSubscription.planCode)
            || 'Current plan';
    const tierLabel = planTierNormalized ? planTierNormalized.toUpperCase() : 'FREE';
    const chatMinutes = effectiveSubscription.chatMinutes ?? '—';
    const callMinutes = effectiveSubscription.callMinutes ?? '—';
    const currencySymbol = localizedPlan?.currencySymbol || effectiveSubscription.currencySymbol || preferredCurrency.symbol;
    const currencyCode = localizedPlan?.currencyCode || effectiveSubscription.currencyCode || preferredCurrency.code;
    const priceText = localizedPlan?.priceFormatted
        || effectiveSubscription.priceFormatted
        || (typeof effectiveSubscription.amountMinor === 'number'
            ? formatAmountMinor(effectiveSubscription.amountMinor, currencyCode, currencySymbol)
            : `${currencySymbol}0.00`);
    const priceDisplay = currencyCode ? `${priceText} (${currencyCode})` : priceText;
    const nextBillingSource = effectiveSubscription.nextBillingDate || effectiveSubscription.next_billing_date;
    const nextBilling = nextBillingSource
        ? new Date(nextBillingSource).toLocaleDateString()
        : '—';
    const statusText = effectiveSubscription.statusLabel || toTitle(statusNormalized) || 'Free';
    const paidStatus = ['active', 'trialing', 'past_due'].includes(statusNormalized);
    const isPremiumPlan = planTierNormalized === 'premium' || planCodeNormalized?.includes('premium');
    const canCancel = paidStatus && isPremiumPlan && effectiveSubscription.cancellable !== false;
    const showUpgrade = !canCancel;

    const businessPlanProfile = isBusinessUser
        ? BUSINESS_PLAN_ENTITLEMENTS[planTierNormalized] || BUSINESS_PLAN_ENTITLEMENTS.base
        : null;
    const businessApiLimit = isBusinessUser
        ? (effectiveSubscription.limits?.api?.callsPerDay ?? businessPlanProfile?.apiLimit ?? null)
        : null;
    const apiUsageToday = isBusinessUser
        ? (
            effectiveSubscription.metadata?.apiUsageToday
            ?? effectiveSubscription.metadata?.apiUsage?.today
            ?? effectiveSubscription.limits?.api?.usageToday
            ?? 0
        )
        : null;
    const apiRemaining = isBusinessUser
        ? (Number.isFinite(businessApiLimit)
            ? Math.max(businessApiLimit - Number(apiUsageToday || 0), 0)
            : businessApiLimit)
        : null;
    const activeAdsCount = isBusinessUser ? (adsCapability?.activeCount ?? 0) : null;
    const maxAdsAllowed = isBusinessUser
        ? (() => {
            const capabilityMax = adsCapability?.maxActive;
            const planMax = businessPlanProfile?.advertising?.maxAds;
            if (capabilityMax === null || capabilityMax === undefined) {
                if (planMax === null || planMax === undefined) {
                    return Infinity;
                }
                return planMax;
            }
            return capabilityMax === null ? Infinity : capabilityMax;
        })()
        : null;
    const adPlacementPermissions = isBusinessUser
        ? (businessPlanProfile?.advertising?.placement || 'Standard business placements')
        : null;
    const analyticsModeLabel = isBusinessUser
        ? (adsCapability?.analyticsMode
            ? toTitle(adsCapability.analyticsMode)
            : businessPlanProfile?.analyticsLevel || 'Limited analytics')
        : null;
    const mediaSupportLabel = isBusinessUser
        ? (businessPlanProfile?.advertising?.mediaSupport || 'Image, video & GIF creative support')
        : null;
    const advertisingFeaturesList = isBusinessUser ? (businessPlanProfile?.advertising?.features || []) : [];
    const analyticsFeaturesList = isBusinessUser ? (businessPlanProfile?.analyticsFeatures || []) : [];

    const businessOverviewItems = isBusinessUser
        ? [
            { label: 'Plan', value: businessPlanProfile?.label || planLabel },
            { label: 'Status', value: statusText },
            { label: 'Price', value: priceDisplay },
            { label: 'Next billing', value: nextBilling }
        ]
        : [];
    const usageItems = isBusinessUser
        ? [
            { label: 'API calls per day', value: formatMetricValue(businessApiLimit) },
            { label: 'API usage today', value: formatMetricValue(apiUsageToday ?? 0, { fallback: '0' }) },
            { label: 'Remaining API calls', value: formatMetricValue(apiRemaining) }
        ]
        : [];
    const advertisingItems = isBusinessUser
        ? [
            { label: 'Active ads', value: formatMetricValue(activeAdsCount, { fallback: '0' }) },
            { label: 'Max ads allowed', value: formatMetricValue(maxAdsAllowed) },
            { label: 'Ad placement permissions', value: adPlacementPermissions || '—' },
            { label: 'Campaign analytics access', value: analyticsModeLabel || 'Limited analytics' },
            { label: 'Media support', value: mediaSupportLabel || 'Image, video & GIF creative support' }
        ]
        : [];

    const adsSummary = !isBusinessUser && adsCapability
        ? (!Number.isFinite(adsCapability.maxActive) ? 'Unlimited active ads' : `${adsCapability.maxActive} active ads`) +
        ` • ${adsCapability.analyticsMode || 'limited'} analytics`
        : null;

    return (
        <section className="subscription-card">
            <div className="subscription-card__header">
                <div>
                    <p className="subscription-card__eyebrow">Subscription level</p>
                    <h2 className="subscription-card__title">{planLabel}</h2>
                    <span className="subscription-card__tier">{tierLabel}</span>
                </div>
                <button
                    type="button"
                    className="subscription-card__refresh"
                    onClick={() => loadSubscription({ force: true })}
                    disabled={loading}
                >
                    Refresh
                </button>
            </div>

            {isBusinessUser ? (
                <>
                    <div className="subscription-card__section">
                        <p className="subscription-card__section-title">Subscription Overview</p>
                        <div className="subscription-card__section-grid">
                            {businessOverviewItems.map((item) => (
                                <div key={item.label}>
                                    <span>{item.label}</span>
                                    <strong>{item.value}</strong>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="subscription-card__section">
                        <p className="subscription-card__section-title">Usage Limits</p>
                        <div className="subscription-card__section-grid">
                            {usageItems.map((item) => (
                                <div key={item.label}>
                                    <span>{item.label}</span>
                                    <strong>{item.value}</strong>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="subscription-card__section">
                        <p className="subscription-card__section-title">Advertising Services</p>
                        <div className="subscription-card__section-grid">
                            {advertisingItems.map((item) => (
                                <div key={item.label}>
                                    <span>{item.label}</span>
                                    <strong>{item.value}</strong>
                                </div>
                            ))}
                        </div>
                        {advertisingFeaturesList.length > 0 && (
                            <ul className="subscription-card__list">
                                {advertisingFeaturesList.map((feature) => (
                                    <li key={feature}>{feature}</li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="subscription-card__section">
                        <p className="subscription-card__section-title">Analytics Access</p>
                        {analyticsFeaturesList.length > 0 ? (
                            <ul className="subscription-card__list">
                                {analyticsFeaturesList.map((feature) => (
                                    <li key={feature}>{feature}</li>
                                ))}
                            </ul>
                        ) : (
                            <div className="subscription-card__section-grid">
                                <div>
                                    <span>Analytics</span>
                                    <strong>{analyticsModeLabel || 'Analytics access available'}</strong>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <>
                    <div className="subscription-card__details">
                        <div>
                            <span>Chat minutes / day</span>
                            <strong>{chatMinutes}</strong>
                        </div>
                        <div>
                            <span>Call minutes</span>
                            <strong>{callMinutes}</strong>
                        </div>
                        <div>
                            <span>Next billing</span>
                            <strong>{nextBilling}</strong>
                        </div>
                        <div>
                            <span>Status</span>
                            <strong>{statusText}</strong>
                        </div>
                        <div>
                            <span>Price</span>
                            <strong>{priceDisplay}</strong>
                        </div>
                    </div>

                    {adsSummary && (
                        <div className="subscription-card__ads">
                            <span>Ad entitlements</span>
                            <strong>{adsSummary}</strong>
                        </div>
                    )}
                </>
            )}

            <div className="subscription-card__actions">
                {showUpgrade && (
                    <button
                        type="button"
                        className="subscription-card__primary"
                        onClick={handleUpgrade}
                        disabled={actionLoading}
                    >
                        Upgrade to Premium
                    </button>
                )}
                {canCancel && (
                    <button
                        type="button"
                        className="subscription-card__secondary"
                        onClick={handleCancel}
                        disabled={actionLoading}
                    >
                        Cancel & Use Free Plan
                    </button>
                )}
            </div>

            {loading && <p className="subscription-card__loading">Fetching latest status…</p>}
        </section>
    );
};

export default SubscriptionStatus;
