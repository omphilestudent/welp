import React, { useCallback, useEffect, useRef, useState } from 'react';
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
    const [subscription, setSubscription] = useState(user?.subscription ?? null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [adsCapability, setAdsCapability] = useState(null);
    const subscriptionLoadKeyRef = useRef(null);
    const pricingKeyRef = useRef('');
    const [localizedPlan, setLocalizedPlan] = useState(null);

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

    const resolveAudience = useCallback((role) => {
        const normalized = String(role || '').toLowerCase();
        if (normalized === 'business') return 'business';
        if (normalized === 'psychologist') return 'psychologist';
        return 'user';
    }, []);

    const resolveCountryCode = useCallback(() => {
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
            /* ignore */
        }
        return 'US';
    }, [user]);

    const loadLocalizedPlan = useCallback(async (planCode, audienceKey) => {
        if (!planCode) {
            setLocalizedPlan(null);
            return;
        }
        const country = resolveCountryCode();
        const cacheKey = `${planCode}:${audienceKey}:${country}`;
        if (pricingKeyRef.current === cacheKey) return;
        pricingKeyRef.current = cacheKey;
        try {
            const { data } = await fetchPricingForAudience({ audience: audienceKey, country });
            const plans = Array.isArray(data?.plans) ? data.plans : [];
            const match = plans.find((plan) => plan.planCode === planCode);
            if (!match) {
                setLocalizedPlan(null);
                return;
            }
            setLocalizedPlan({
                priceFormatted: match.priceFormatted,
                currencySymbol: match.currencySymbol || data?.currency?.symbol || '$',
                currencyCode: match.currencyCode || data?.currency?.code || country,
                amountMinor: match.amountMinor ?? null
            });
        } catch (error) {
            console.warn('Localized pricing unavailable:', error?.message || error);
            setLocalizedPlan(null);
        }
    }, [resolveCountryCode]);

    const loadSubscription = useCallback(async () => {
        if (!isAuthenticated) {
            setSubscription(null);
            setAdsCapability(null);
            return;
        }
        setLoading(true);
        try {
            const { data } = await fetchSubscription();
            const payload = data.subscription;
            if (payload) {
                setSubscription(payload);
                updateUser?.({ subscription: payload });
                const audienceKey = resolveAudience(user?.role);
                loadLocalizedPlan(payload.planCode, audienceKey);
            }
            if (user?.role === 'business') {
                const campaigns = await getMyCampaigns();
                setAdsCapability(campaigns.data?.capabilities || null);
            } else {
                setAdsCapability(null);
            }
        } catch (error) {
            console.error('Failed to load subscription', error);
            const authError = resolveAdsAuthMessage(error);
            toast.error(authError ?? 'Unable to load subscription status');
            setAdsCapability(null);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, updateUser, user?.role, loadLocalizedPlan, resolveAudience]);

    useEffect(() => {
        if (!isAuthenticated) {
            subscriptionLoadKeyRef.current = null;
            return;
        }
        if (!user?.id) return;
        const key = `${user.id}:${user?.role || 'user'}`;
        if (subscriptionLoadKeyRef.current === key) return;
        subscriptionLoadKeyRef.current = key;
        loadSubscription();
    }, [isAuthenticated, user?.id, user?.role, loadSubscription]);

    useEffect(() => {
        setSubscription(user?.subscription ?? null);
    }, [user?.subscription]);

    useEffect(() => {
        if (!subscription?.planCode) {
            setLocalizedPlan(null);
            return;
        }
        const audienceKey = resolveAudience(user?.role);
        loadLocalizedPlan(subscription.planCode, audienceKey);
    }, [subscription?.planCode, user?.role, loadLocalizedPlan, resolveAudience]);

    const handleUpgrade = async () => {
        setActionLoading(true);
        try {
            const { data } = await upgradeSubscription({ planCode: 'user_premium', currency: 'USD' });
            const payload = data.subscription;
            if (payload) {
                setSubscription(payload);
                updateUser?.({ subscription: payload });
                toast.success('Upgraded to Premium');
                await loadSubscription();
            }
        } catch (error) {
            const message = error.response?.data?.error || 'Upgrade failed';
            toast.error(message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleCancel = async () => {
        setActionLoading(true);
        try {
            const { data } = await cancelSubscription();
            const payload = data.subscription;
            if (payload) {
                setSubscription(payload);
                updateUser?.({ subscription: payload });
                toast.success('Reverted to Free tier');
                await loadSubscription();
            }
        } catch (error) {
            const message = error.response?.data?.error || 'Failed to cancel subscription';
            toast.error(message);
        } finally {
            setActionLoading(false);
        }
    };

    if (!subscription && !loading) {
        return null;
    }

    const planLabel = subscription?.displayName || subscription?.planCode || 'Free';
    const tierLabel = (subscription?.tier || 'free').toUpperCase();
    const chatMinutes = subscription?.chatMinutes ?? '—';
    const callMinutes = subscription?.callMinutes ?? '—';
    const priceText = localizedPlan?.priceFormatted
        || subscription?.priceFormatted
        || `${subscription?.currencySymbol || '$'}0.00`;
    const nextBilling = subscription?.nextBillingDate
        ? new Date(subscription.nextBillingDate).toLocaleDateString()
        : '—';
    const statusText = subscription?.status || 'free';
    const isPremium = subscription?.status === 'active' && (
        subscription?.tier === 'premium' || subscription?.planCode === 'user_premium'
    );

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
                    onClick={loadSubscription}
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
                        {localizedPlan?.currencyCode ? ` (${localizedPlan.currencyCode})` : ''}
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
                {!isPremium && (
                    <button
                        type="button"
                        className="subscription-card__primary"
                        onClick={handleUpgrade}
                        disabled={actionLoading}
                    >
                        Upgrade to Premium
                    </button>
                )}
                {isPremium && (
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
