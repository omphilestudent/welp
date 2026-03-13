import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import Loading from '../common/Loading';
import PlanCard from './PlanCard';
import CurrencyToggle from './CurrencyToggle';
import UpgradeModal from './UpgradeModal';
import { fetchCountries, fetchPricingByAudience } from '../../services/pricingService';
import { fetchSubscription, upgradeSubscription } from '../../services/subscriptionService';
import { getMyCampaigns } from '../../services/adService';

const PREMIUM_EMAIL = 'omphilemohlala@welp.com';

const PricingPage = () => {
    const { user, isAuthenticated } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [countries, setCountries] = useState([]);
    const [audience, setAudience] = useState(() => searchParams.get('role') || 'employee');
    const [country, setCountry] = useState('US');
    const [currency, setCurrency] = useState('USD');
    const [pricing, setPricing] = useState(null);
    const [subscription, setSubscription] = useState(null);
    const [adsCapabilities, setAdsCapabilities] = useState(null);
    const [loading, setLoading] = useState(true);
    const [upgradePlan, setUpgradePlan] = useState(null);
    const [upgradePending, setUpgradePending] = useState(false);

    const isBusinessAudience = audience === 'business';
    const premiumExceptionActive = (user?.email || '').toLowerCase() === PREMIUM_EMAIL;

    useEffect(() => {
        const initCountries = async () => {
            try {
                const list = await fetchCountries();
                setCountries(list);
                if (list.length && country === 'US') {
                    setCountry(list[0].code);
                    setCurrency(list[0].currency || 'USD');
                }
            } catch (error) {
                console.error('Failed to fetch countries', error);
            }
        };
        initCountries();
    }, []);

    const loadSubscription = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const { data } = await fetchSubscription();
            if (data?.subscription) {
                setSubscription(data.subscription);
            }
        } catch (error) {
            console.error('Subscription fetch failed', error);
        }
    }, [isAuthenticated]);

    const loadAdCapabilities = useCallback(async () => {
        if (!isAuthenticated || user?.role !== 'business') {
            setAdsCapabilities(null);
            return;
        }
        try {
            const { data } = await getMyCampaigns();
            setAdsCapabilities(data?.capabilities || null);
        } catch (error) {
            console.warn('Unable to load ad capabilities', error);
        }
    }, [isAuthenticated, user]);

    useEffect(() => {
        loadSubscription();
    }, [loadSubscription]);

    useEffect(() => {
        loadAdCapabilities();
    }, [loadAdCapabilities]);

    useEffect(() => {
        setLoading(true);
        const fetchPricing = async () => {
            try {
                const payload = await fetchPricingByAudience(audience, { country, currency });
                setPricing(payload);
            } catch (error) {
                console.error('Pricing fetch failed', error);
                toast.error('Unable to load pricing right now.');
            } finally {
                setLoading(false);
            }
        };
        fetchPricing();
        setSearchParams({ role: audience });
    }, [audience, country, currency, setSearchParams]);

    const handleUpgrade = async (plan) => {
        if (!plan) return;
        setUpgradePending(true);
        try {
            await upgradeSubscription({
                planCode: plan.planCode,
                currency: plan.currencyCode || pricing?.currency?.code || 'USD'
            });
            toast.success(`Upgraded to ${plan.metadata?.displayName || plan.planCode}`);
            await loadSubscription();
            setUpgradePlan(null);
        } catch (error) {
            const message = error.response?.data?.error || 'Upgrade failed';
            toast.error(message);
        } finally {
            setUpgradePending(false);
        }
    };

    const heroCopy = useMemo(() => {
        if (premiumExceptionActive) {
            return 'Welp premium exception active — enjoy unlimited ads, analytics, and priority placements.';
        }
        if (adsCapabilities && isBusinessAudience) {
            const { maxActive, analyticsMode } = adsCapabilities;
            const adLimit = !Number.isFinite(maxActive) ? 'unlimited ads' : `${maxActive} active ads`;
            return `Your plan currently allows ${adLimit} with ${analyticsMode || 'limited'} analytics.`;
        }
        return 'Choose the plan that matches your growth stage.';
    }, [adsCapabilities, isBusinessAudience, premiumExceptionActive]);

    if (loading && !pricing) {
        return <Loading />;
    }

    const plans = pricing?.plans || [];
    const sortedPlans = [...plans].sort((a, b) => (a.amountMinor ?? 0) - (b.amountMinor ?? 0));

    return (
        <section className="pricing-page">
            <header className="pricing-page__hero">
                <div>
                    <p className="pricing-page__eyebrow">Pricing</p>
                    <h1>Simple, transparent plans</h1>
                    <p>{heroCopy}</p>
                </div>
                <CurrencyToggle
                    countries={countries}
                    selectedCountry={country}
                    onCountryChange={setCountry}
                    selectedCurrency={currency}
                    onCurrencyChange={setCurrency}
                />
            </header>

            <div className="pricing-page__controls">
                {['employee', 'psychologist', 'business'].map((role) => (
                    <button
                        key={role}
                        type="button"
                        className={`role-chip ${audience === role ? 'role-chip--active' : ''}`}
                        onClick={() => setAudience(role)}
                    >
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                    </button>
                ))}
            </div>

            <div className="pricing-page__grid">
                {sortedPlans.map((plan) => (
                    <PlanCard
                        key={plan.planCode}
                        plan={plan}
                        subscription={subscription}
                        onSelect={(selected) => setUpgradePlan(selected)}
                        audience={audience}
                        adCapabilities={adsCapabilities}
                        highlighted={plan.metadata?.badge === 'Best value' || plan.planTier === 'premium'}
                    />
                ))}
            </div>

            <UpgradeModal
                plan={upgradePlan}
                open={Boolean(upgradePlan)}
                onClose={() => setUpgradePlan(null)}
                onConfirm={handleUpgrade}
                submitting={upgradePending}
            />
        </section>
    );
};

export default PricingPage;
