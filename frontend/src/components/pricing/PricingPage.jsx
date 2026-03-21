import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import Loading from '../common/Loading';
import PlanCard from './PlanCard';
import CurrencyToggle from './CurrencyToggle';
import CheckoutModal from './CheckoutModal';
import { fetchCountries, fetchPricingByAudience } from '../../services/pricingService';
import { fetchSubscription, upgradeSubscription } from '../../services/subscriptionService';
import { getMyCampaigns } from '../../services/adService';
import { currencyForCountry, deriveCountryCode } from '../../utils/currency';

const PREMIUM_EMAIL = 'omphilemohlala@welp.com';

const PricingPage = () => {
    const { user, isAuthenticated, refreshUser, updateUser } = useAuth();
    const navigate = useNavigate();
    const derivedCountry = useMemo(() => deriveCountryCode(user || {}), [user]);
    const derivedCurrency = useMemo(() => currencyForCountry(derivedCountry), [derivedCountry]);
    const [searchParams, setSearchParams] = useSearchParams();
    const [countries, setCountries] = useState([]);
    const [audience, setAudience] = useState(() => searchParams.get('role') || 'employee');
    const [country, setCountry] = useState(derivedCountry);
    const [currency, setCurrency] = useState(derivedCurrency.code);
    const [pricing, setPricing] = useState(null);
    const [subscription, setSubscription] = useState(null);
    const [adsCapabilities, setAdsCapabilities] = useState(null);
    const [loading, setLoading] = useState(true);
    const [upgradePlan, setUpgradePlan] = useState(null);
    const [upgradePending, setUpgradePending] = useState(false);
    const userAdjustedRef = useRef(false);

    const isBusinessAudience = audience === 'business';
    const premiumExceptionActive = (user?.email || '').toLowerCase() === PREMIUM_EMAIL;

    useEffect(() => {
        const initCountries = async () => {
            try {
                const list = await fetchCountries();
                setCountries(list);
                if (list.length && !userAdjustedRef.current) {
                    const preferred = list.find((row) => row.code === derivedCountry) || list[0];
                    if (preferred) {
                        setCountry(preferred.code);
                        setCurrency(preferred.currency || derivedCurrency.code);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch countries', error);
            }
        };
        initCountries();
    }, [derivedCountry, derivedCurrency.code]);

    useEffect(() => {
        const entry = countries.find((row) => row.code === country);
        if (entry?.currency && entry.currency !== currency) {
            setCurrency(entry.currency);
        }
    }, [country, countries]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (country) {
            window.localStorage.setItem('welp_country_preference', country);
        }
    }, [country]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (currency) {
            window.localStorage.setItem('welp_currency_preference', currency);
        }
    }, [currency]);

    useEffect(() => {
        if (userAdjustedRef.current) return;
        setCountry(derivedCountry);
        setCurrency(derivedCurrency.code);
    }, [derivedCountry, derivedCurrency.code]);

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
        setSearchParams({ role: audience, country });
    }, [audience, country, currency, setSearchParams]);

    const handleUpgrade = async (plan) => {
        if (!plan) return;
        setUpgradePending(true);
        try {
            const { data } = await upgradeSubscription({
                planCode: plan.planCode,
                currency: plan.currencyCode || pricing?.currency?.code || currency || derivedCurrency.code
            });
            if (data?.user) {
                updateUser?.(data.user);
            } else if (refreshUser) {
                await refreshUser();
            }
            toast.success(`Upgraded to ${plan.metadata?.displayName || plan.planCode}`);
            await loadSubscription();
            setUpgradePlan(null);
            window.localStorage.removeItem('welp_upgrade_intent');
        } catch (error) {
            const message = error.response?.data?.error || 'Upgrade failed';
            toast.error(message);
        } finally {
            setUpgradePending(false);
        }
    };

    const handleCheckout = async (plan) => {
        if (!plan) return;
        if (!isAuthenticated) {
            const intent = {
                planCode: plan.planCode,
                audience,
                country,
                currency: plan.currencyCode || pricing?.currency?.code || currency || derivedCurrency.code
            };
            window.localStorage.setItem('welp_upgrade_intent', JSON.stringify(intent));
            navigate(`/register?redirect=/pricing?role=${audience}&country=${country}`);
            return;
        }
        setUpgradePlan(plan);
    };

    useEffect(() => {
        if (!isAuthenticated || !pricing) return;
        const raw = window.localStorage.getItem('welp_upgrade_intent');
        if (!raw) return;
        try {
            const intent = JSON.parse(raw);
            if (!intent?.planCode) return;
            const plans = pricing?.plans || [];
            const match = plans.find((plan) => plan.planCode === intent.planCode);
            if (match) {
                setUpgradePlan(match);
            }
        } catch {
            // ignore
        }
    }, [isAuthenticated, pricing]);

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

    const plans = useMemo(() => pricing?.plans || [], [pricing]);
    const sortedPlans = useMemo(
        () => [...plans].sort((a, b) => (a.amountMinor ?? 0) - (b.amountMinor ?? 0)),
        [plans]
    );
    const filteredPlans = useMemo(() => {
        if (audience === 'employee') {
            return sortedPlans.filter((plan) => ['user_free', 'user_premium'].includes(plan.planCode));
        }
        if (audience === 'psychologist') {
            const allowed = sortedPlans.filter((plan) =>
                ['psychologist_free', 'psychologist_standard', 'psychologist_premium'].includes(plan.planCode)
            );
            if (allowed.length) {
                const free = allowed.find((plan) => plan.planTier === 'free');
                const premium = allowed.find((plan) => plan.planTier === 'premium') || allowed[allowed.length - 1];
                return [free, premium].filter(Boolean);
            }
            const freeTier = sortedPlans.filter((plan) => plan.planTier === 'free');
            const premiumTier = sortedPlans.filter((plan) => plan.planTier === 'premium');
            return [freeTier[0], premiumTier[premiumTier.length - 1]].filter(Boolean);
        }
        return sortedPlans;
    }, [audience, sortedPlans]);

    if (loading && !pricing) {
        return <Loading />;
    }

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
                    onCountryChange={(value) => {
                        userAdjustedRef.current = true;
                        setCountry(value);
                    }}
                    selectedCurrency={currency}
                    onCurrencyChange={(value) => {
                        userAdjustedRef.current = true;
                        setCurrency(value);
                    }}
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
                {filteredPlans.map((plan) => (
                    <PlanCard
                        key={plan.planCode}
                        plan={plan}
                        subscription={subscription}
                        onSelect={(selected) => handleCheckout(selected)}
                        audience={audience}
                        adCapabilities={adsCapabilities}
                        highlighted={plan.metadata?.badge === 'Best value' || plan.planTier === 'premium'}
                    />
                ))}
            </div>

            <CheckoutModal
                plan={upgradePlan}
                open={Boolean(upgradePlan)}
                onClose={() => {
                    setUpgradePlan(null);
                    window.localStorage.removeItem('welp_upgrade_intent');
                }}
                onConfirm={handleUpgrade}
                submitting={upgradePending}
            />
        </section>
    );
};

export default PricingPage;
