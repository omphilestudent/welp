import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import {
    fetchSubscription,
    upgradeSubscription,
    cancelSubscription,
    fetchPricingForAudience
} from '../../services/subscriptionService';
import { getMyCampaigns } from '../../services/adService';
import './SubscriptionStatus.css';

const COUNTRY_NAME_TO_CODE = {
    'united states': 'US',
    usa: 'US',
    'south africa': 'ZA',
    canada: 'CA',
    'united kingdom': 'GB',
    england: 'GB',
    ireland: 'IE',
    germany: 'DE',
    france: 'FR',
    italy: 'IT',
    spain: 'ES',
    netherlands: 'NL',
    belgium: 'BE',
    switzerland: 'CH',
    sweden: 'SE',
    norway: 'NO',
    denmark: 'DK',
    finland: 'FI',
    portugal: 'PT',
    greece: 'GR',
    australia: 'AU',
    'new zealand': 'NZ',
    japan: 'JP',
    'south korea': 'KR',
    singapore: 'SG',
    china: 'CN',
    india: 'IN',
    indonesia: 'ID',
    malaysia: 'MY',
    thailand: 'TH',
    vietnam: 'VN',
    philippines: 'PH',
    nigeria: 'NG',
    kenya: 'KE',
    egypt: 'EG',
    morocco: 'MA',
    ghana: 'GH',
    tanzania: 'TZ',
    uganda: 'UG',
    brazil: 'BR',
    argentina: 'AR',
    chile: 'CL',
    colombia: 'CO',
    peru: 'PE',
    mexico: 'MX',
    'united arab emirates': 'AE',
    'saudi arabia': 'SA',
    israel: 'IL',
    turkey: 'TR',
    qatar: 'QA',
    kuwait: 'KW'
};

const CURRENCY_BY_COUNTRY = {
    US: { code: 'USD', symbol: '$' },
    ZA: { code: 'ZAR', symbol: 'R' },
    CA: { code: 'CAD', symbol: '$' },
    GB: { code: 'GBP', symbol: '£' },
    IE: { code: 'EUR', symbol: '€' },
    DE: { code: 'EUR', symbol: '€' },
    FR: { code: 'EUR', symbol: '€' },
    IT: { code: 'EUR', symbol: '€' },
    ES: { code: 'EUR', symbol: '€' },
    NL: { code: 'EUR', symbol: '€' },
    BE: { code: 'EUR', symbol: '€' },
    CH: { code: 'CHF', symbol: 'CHF' },
    SE: { code: 'SEK', symbol: 'kr' },
    NO: { code: 'NOK', symbol: 'kr' },
    DK: { code: 'DKK', symbol: 'kr' },
    FI: { code: 'EUR', symbol: '€' },
    PT: { code: 'EUR', symbol: '€' },
    GR: { code: 'EUR', symbol: '€' },
    AU: { code: 'AUD', symbol: '$' },
    NZ: { code: 'NZD', symbol: '$' },
    JP: { code: 'JPY', symbol: '¥' },
    KR: { code: 'KRW', symbol: '₩' },
    SG: { code: 'SGD', symbol: '$' },
    CN: { code: 'CNY', symbol: '¥' },
    IN: { code: 'INR', symbol: '₹' },
    ID: { code: 'IDR', symbol: 'Rp' },
    MY: { code: 'MYR', symbol: 'RM' },
    TH: { code: 'THB', symbol: '฿' },
    VN: { code: 'VND', symbol: '₫' },
    PH: { code: 'PHP', symbol: '₱' },
    NG: { code: 'NGN', symbol: '₦' },
    KE: { code: 'KES', symbol: 'KSh' },
    EG: { code: 'EGP', symbol: '£' },
    MA: { code: 'MAD', symbol: 'د.م.' },
    GH: { code: 'GHS', symbol: '₵' },
    TZ: { code: 'TZS', symbol: 'TSh' },
    UG: { code: 'UGX', symbol: 'USh' },
    BR: { code: 'BRL', symbol: 'R$' },
    AR: { code: 'ARS', symbol: '$' },
    CL: { code: 'CLP', symbol: '$' },
    CO: { code: 'COP', symbol: '$' },
    PE: { code: 'PEN', symbol: 'S/' },
    MX: { code: 'MXN', symbol: '$' },
    AE: { code: 'AED', symbol: 'د.إ' },
    SA: { code: 'SAR', symbol: '﷼' },
    IL: { code: 'ILS', symbol: '₪' },
    TR: { code: 'TRY', symbol: '₺' },
    QA: { code: 'QAR', symbol: 'ر.ق' },
    KW: { code: 'KWD', symbol: 'د.ك' }
};

const normalizePlanIdentifier = (value) => (value ? String(value).trim() : '');
const toLowerSafe = (value) => normalizePlanIdentifier(value).toLowerCase();
const toTitle = (value) => {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1);
};

const guessCurrencySymbol = (currencyCode = 'USD') => {
    try {
        const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode });
        const parts = formatter.formatToParts(0);
        const currencyPart = parts.find((part) => part.type === 'currency');
        return currencyPart?.value || '$';
    } catch {
        return '$';
    }
};

const formatAmountMinor = (amountMinor, currencyCode = 'USD', currencySymbol = '$') => {
    if (!Number.isFinite(amountMinor)) return null;
    const major = amountMinor / 100;
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: currencyCode
        }).format(major);
    } catch {
        return `${currencySymbol}${major.toFixed(2)}`;
    }
};

const currencyFallbackForCountry = (countryCode) => {
    if (!countryCode) return { code: 'USD', symbol: '$' };
    return CURRENCY_BY_COUNTRY[countryCode] || { code: 'USD', symbol: '$' };
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
    currencyCode: 'USD',
    currencySymbol: '$',
    priceFormatted: '$0.00',
    amountMinor: 0,
    cancellable: false
};

const deriveAudienceKey = (role) => {
    const normalized = toLowerSafe(role || '');
    if (normalized === 'business') return 'business';
    if (normalized === 'psychologist') return 'psychologist';
    return 'user';
};

const deriveCountryCode = (user) => {
    const candidates = [
        user?.country_code,
        user?.countryCode,
        user?.country,
        user?.location?.countryCode,
        user?.location?.country,
        user?.profile?.countryCode,
        user?.profile?.country
    ];
    for (const value of candidates) {
        if (!value) continue;
        if (/^[a-z]{2}$/i.test(value)) {
            return value.toUpperCase();
        }
        const normalized = value.trim().toLowerCase();
        if (COUNTRY_NAME_TO_CODE[normalized]) {
            return COUNTRY_NAME_TO_CODE[normalized];
        }
    }
    try {
        const locale = (Intl.DateTimeFormat().resolvedOptions().locale || navigator.language || '').replace('_', '-');
        const parts = locale.split('-');
        if (parts.length > 1 && /^[a-z]{2}$/i.test(parts[1])) {
            return parts[1].toUpperCase();
        }
    } catch {
        /* noop */
    }
    return 'US';
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
    const userId = user?.id ?? null;
    const userRole = user?.role ?? '';
    const normalizedUserRole = useMemo(() => toLowerSafe(userRole), [userRole]);
    const audienceKey = useMemo(() => deriveAudienceKey(userRole), [userRole]);
    const countryCode = useMemo(
        () => deriveCountryCode(user || {}),
        [
            user?.country_code,
            user?.countryCode,
            user?.country,
            user?.location?.countryCode,
            user?.location?.country,
            user?.profile?.countryCode,
            user?.profile?.country
        ]
    );
    const preferredCurrency = useMemo(() => currencyFallbackForCountry(countryCode), [countryCode]);

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
            const campaigns = await getMyCampaigns();
            setAdsCapability(campaigns.data?.capabilities || null);
        } catch (error) {
            const authError = resolveAdsAuthMessage(error);
            if (authError) {
                toast.error(authError);
            }
            setAdsCapability(null);
        }
    }, [normalizedUserRole]);

    const loadLocalizedPlan = useCallback(async (planCode, requestedAudience) => {
        if (!planCode) {
            setLocalizedPlan(null);
            return;
        }
        const normalizedPlanCode = toLowerSafe(planCode);
        const country = countryCode;
        const currency = preferredCurrency.code;
        const audience = requestedAudience || 'user';
        const cacheKey = `${normalizedPlanCode}:${audience}:${country}:${currency}`;
        if (pricingKeyRef.current === cacheKey) return;
        pricingKeyRef.current = cacheKey;
        try {
            const { data } = await fetchPricingForAudience({ audience, country, currency });
            const plans = Array.isArray(data?.plans) ? data.plans : [];
            const match = plans.find((plan) => {
                const identifier = toLowerSafe(plan.planCode || plan.plan_code || plan.code);
                if (identifier && identifier === normalizedPlanCode) return true;
                const tierId = toLowerSafe(plan.planTier || plan.plan_tier || plan.tier);
                return tierId && tierId === normalizedPlanCode;
            });
            if (!match) {
                setLocalizedPlan(null);
                return;
            }
            setLocalizedPlan({
                priceFormatted: match.priceFormatted
                    || match.price_formatted
                    || (match.amountMinor != null
                        ? formatAmountMinor(match.amountMinor, match.currencyCode || match.currency_code || currency, match.currencySymbol || match.currency_symbol || preferredCurrency.symbol)
                        : null),
                currencySymbol: match.currencySymbol || match.currency_symbol || data?.currency?.symbol || preferredCurrency.symbol,
                currencyCode: match.currencyCode || match.currency_code || data?.currency?.code || currency,
                amountMinor: match.amountMinor ?? match.amount_minor ?? null
            });
        } catch (error) {
            console.warn('Localized pricing unavailable:', error?.message || error);
            setLocalizedPlan(null);
        }
    }, [countryCode, preferredCurrency]);

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
            await loadLocalizedPlan(normalized?.planCode || normalized?.planCodeNormalized, audienceKey);
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

    const planIdentifier = subscription?.planCode || subscription?.planCodeNormalized;

    useEffect(() => {
        if (!planIdentifier) {
            setLocalizedPlan(null);
            return;
        }
        loadLocalizedPlan(planIdentifier, audienceKey);
    }, [planIdentifier, audienceKey, loadLocalizedPlan]);

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
    const nextBillingSource = effectiveSubscription.nextBillingDate || effectiveSubscription.next_billing_date;
    const nextBilling = nextBillingSource
        ? new Date(nextBillingSource).toLocaleDateString()
        : '—';
    const statusText = effectiveSubscription.statusLabel || toTitle(statusNormalized) || 'Free';
    const paidStatus = ['active', 'trialing', 'past_due'].includes(statusNormalized);
    const isPremiumPlan = planTierNormalized === 'premium' || planCodeNormalized?.includes('premium');
    const canCancel = paidStatus && isPremiumPlan && effectiveSubscription.cancellable !== false;
    const showUpgrade = !canCancel;

    const adsSummary = adsCapability
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
                    <strong>
                        {priceText}
                        {currencyCode ? ` (${currencyCode})` : ''}
                    </strong>
                </div>
            </div>

            {adsSummary && (
                <div className="subscription-card__ads">
                    <span>Ad entitlements</span>
                    <strong>{adsSummary}</strong>
                </div>
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
