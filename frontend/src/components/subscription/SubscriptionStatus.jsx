import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import {
    fetchSubscription,
    upgradeSubscription,
    cancelSubscription
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

    const loadSubscription = async () => {
        if (!isAuthenticated) return;
        setLoading(true);
        try {
            const { data } = await fetchSubscription();
            const payload = data.subscription;
            if (payload) {
                setSubscription(payload);
                updateUser?.({ subscription: payload });
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
    };

    useEffect(() => {
        loadSubscription();
    }, [isAuthenticated, user]);

    const handleUpgrade = async () => {
        setActionLoading(true);
        try {
            const { data } = await upgradeSubscription({ planCode: 'user_premium', currency: 'USD' });
            const payload = data.subscription;
            if (payload) {
                setSubscription(payload);
                updateUser?.({ subscription: payload });
                toast.success('Upgraded to Premium');
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
    const priceText = subscription?.priceFormatted || `${subscription?.currencySymbol || '$'}0.00`;
    const nextBilling = subscription?.nextBillingDate
        ? new Date(subscription.nextBillingDate).toLocaleDateString()
        : '—';
    const statusText = subscription?.status || 'free';
    const isPremium = subscription?.tier === 'premium' || subscription?.planCode === 'user_premium';

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
                    <strong>{priceText}</strong>
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
