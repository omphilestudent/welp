import React, { useMemo } from 'react';
import { FaCheckCircle, FaCrown, FaChartLine, FaBolt } from 'react-icons/fa';
import { formatPlanPrice } from '../../utils/currency';

const formatLimitValue = (value) => {
    if (value === null || value === undefined) return '—';
    if (value === true) return 'Included';
    if (value === false) return 'Not included';
    if (value === 0) return '0';
    if (value === 'advanced' || value === 'standard' || value === 'limited') {
        return value.charAt(0).toUpperCase() + value.slice(1);
    }
    if (typeof value === 'number') {
        if (value < 0) return 'Unlimited';
        return value.toLocaleString();
    }
    return String(value);
};

const flattenLimits = (limits = {}) => {
    const entries = [];
    Object.entries(limits).forEach(([key, value]) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.entries(value).forEach(([childKey, childValue]) => {
                entries.push({
                    label: `${key}.${childKey}`
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/\./g, ' • ')
                        .replace(/^\w/, (char) => char.toUpperCase()),
                    value: childValue
                });
            });
        } else {
            entries.push({
                label: key.replace(/([A-Z])/g, ' $1')
                    .replace(/_/g, ' ')
                    .replace(/^\w/, (char) => char.toUpperCase()),
                value
            });
        }
    });
    return entries.slice(0, 6);
};

const PlanCard = ({
    plan,
    subscription,
    onSelect,
    audience,
    adCapabilities,
    highlighted = false
}) => {
    const isCurrent = subscription?.planCode === plan.planCode;
    const price = formatPlanPrice(plan);
    const limitEntries = useMemo(() => flattenLimits(plan.limits), [plan.limits]);

    const adsLimit = plan.limits?.ads;
    const adSummary = useMemo(() => {
        if (!adsLimit) return null;
        const maxActive = adsLimit.maxActive === null ? 'Unlimited' : formatLimitValue(adsLimit.maxActive);
        return `Ads: ${maxActive} active • Analytics ${formatLimitValue(adsLimit.analytics)}`;
    }, [adsLimit]);

    const userAdSummary = useMemo(() => {
        if (!adCapabilities || audience !== 'business' || !isCurrent) return null;
        const { maxActive, premiumException } = adCapabilities;
        const effective = premiumException || !Number.isFinite(maxActive) ? 'Unlimited' : maxActive;
        return `Your allowance: ${effective} active ads${premiumException ? ' (Welp premium)' : ''}`;
    }, [adCapabilities, audience, isCurrent]);

    return (
        <div className={`plan-card ${highlighted ? 'plan-card--highlighted' : ''}`}>
            <div className="plan-card__header">
                <div>
                    <p className="plan-card__eyebrow">{plan.planTier}</p>
                    <h3>{plan.metadata?.displayName || plan.planCode}</h3>
                </div>
                {plan.planTier === 'premium' && <FaCrown className="plan-card__badge" />}
            </div>

            <div className="plan-card__price">
                <span>{price}</span>
                <small>/ {plan.billingPeriod || 'monthly'}</small>
            </div>

            <ul className="plan-card__features">
                {plan.features?.map((feature) => (
                    <li key={feature}>
                        <FaCheckCircle /> {feature}
                    </li>
                ))}
            </ul>

            {limitEntries.length > 0 && (
                <div className="plan-card__limits">
                    {limitEntries.map((entry) => (
                        <div key={entry.label}>
                            <span>{entry.label}</span>
                            <strong>{formatLimitValue(entry.value)}</strong>
                        </div>
                    ))}
                </div>
            )}

            {adSummary && (
                <div className="plan-card__ads">
                    <FaChartLine />
                    <div>
                        <strong>Advertising toolkit</strong>
                        <p>{adSummary}</p>
                    </div>
                </div>
            )}

            {userAdSummary && (
                <div className="plan-card__ads plan-card__ads--current">
                    <FaBolt />
                    <div>
                        <strong>Current entitlement</strong>
                        <p>{userAdSummary}</p>
                    </div>
                </div>
            )}

            <button
                type="button"
                className={`plan-card__cta ${isCurrent ? 'plan-card__cta--muted' : 'plan-card__cta--primary'}`}
                disabled={isCurrent}
                onClick={() => onSelect?.(plan)}
            >
                {isCurrent ? 'Current Plan' : 'Upgrade'}
            </button>
        </div>
    );
};

export default PlanCard;
