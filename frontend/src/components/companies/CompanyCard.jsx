import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaMapMarkerAlt } from 'react-icons/fa';

// ── Known company logos using multiple working CDN sources ─────────────────────
// Each entry is an array of URLs tried in order until one loads successfully.
const KNOWN_COMPANY_LOGOS = {
    'google': [
        'https://cdn.simpleicons.org/google',
        'https://www.google.com/favicon.ico',
    ],
    'deepseek ai': [
        'https://cdn.simpleicons.org/deepseek',
    ],
    'meta': [
        'https://cdn.simpleicons.org/meta',
    ],
    'facebook': [
        'https://cdn.simpleicons.org/facebook',
    ],
    'capitec bank': [
        'https://img.logo.dev/capitecbank.co.za?token=pk_X9JGkMBBQQaXJjxCNg9EFQ',
    ],
    'standard bank': [
        'https://img.logo.dev/standardbank.co.za?token=pk_X9JGkMBBQQaXJjxCNg9EFQ',
    ],
    'fnb': [
        'https://img.logo.dev/fnb.co.za?token=pk_X9JGkMBBQQaXJjxCNg9EFQ',
    ],
    'nedbank': [
        'https://img.logo.dev/nedbank.co.za?token=pk_X9JGkMBBQQaXJjxCNg9EFQ',
    ],
    'absa': [
        'https://img.logo.dev/absa.co.za?token=pk_X9JGkMBBQQaXJjxCNg9EFQ',
    ],
    'apple inc.': [
        'https://cdn.simpleicons.org/apple',
        'https://www.apple.com/favicon.ico',
    ],
    'apple': [
        'https://cdn.simpleicons.org/apple',
        'https://www.apple.com/favicon.ico',
    ],
    'amazon': [
        'https://cdn.simpleicons.org/amazon',
        'https://www.amazon.com/favicon.ico',
    ],
    'microsoft': [
        'https://cdn.simpleicons.org/microsoft',
        'https://www.microsoft.com/favicon.ico',
    ],
    'tesla': [
        'https://cdn.simpleicons.org/tesla',
        'https://www.tesla.com/favicon.ico',
    ],
    'netflix': [
        'https://cdn.simpleicons.org/netflix',
    ],
    'spotify': [
        'https://cdn.simpleicons.org/spotify',
        'https://www.spotify.com/favicon.ico',
    ],
    'airbnb': [
        'https://cdn.simpleicons.org/airbnb',
        'https://www.airbnb.com/favicon.ico',
    ],
    'uber': [
        'https://cdn.simpleicons.org/uber',
        'https://www.uber.com/favicon.ico',
    ],
    'linkedin': [
        'https://cdn.simpleicons.org/linkedin',
    ],
    'salesforce': [
        'https://cdn.simpleicons.org/salesforce',
        'https://www.salesforce.com/favicon.ico',
    ],
    'oracle': [
        'https://cdn.simpleicons.org/oracle',
        'https://www.oracle.com/favicon.ico',
    ],
    'ibm': [
        'https://cdn.simpleicons.org/ibm',
        'https://www.ibm.com/favicon.ico',
    ],
    'intel': [
        'https://cdn.simpleicons.org/intel',
        'https://www.intel.com/favicon.ico',
    ],
    'nvidia': [
        'https://cdn.simpleicons.org/nvidia',
        'https://www.nvidia.com/favicon.ico',
    ],
    'adobe': [
        'https://cdn.simpleicons.org/adobe',
        'https://www.adobe.com/favicon.ico',
    ],
    'shopify': [
        'https://cdn.simpleicons.org/shopify',
    ],
    'slack': [
        'https://cdn.simpleicons.org/slack',
    ],
    'figma': [
        'https://cdn.simpleicons.org/figma',
    ],
    'github': [
        'https://cdn.simpleicons.org/github',
    ],
    'gitlab': [
        'https://cdn.simpleicons.org/gitlab',
    ],
    'notion': [
        'https://cdn.simpleicons.org/notion',
    ],
    'stripe': [
        'https://cdn.simpleicons.org/stripe',
    ],
    'twitter': [
        'https://cdn.simpleicons.org/twitter',
    ],
    'x': [
        'https://cdn.simpleicons.org/x',
    ],
    'openai': [
        'https://cdn.simpleicons.org/openai',
    ],
    'samsung': [
        'https://cdn.simpleicons.org/samsung',
    ],
    'sony': [
        'https://cdn.simpleicons.org/sony',
    ],
    'tiktok': [
        'https://cdn.simpleicons.org/tiktok',
    ],
    'youtube': [
        'https://cdn.simpleicons.org/youtube',
    ],
    'paypal': [
        'https://cdn.simpleicons.org/paypal',
    ],
    'visa': [
        'https://cdn.simpleicons.org/visa',
    ],
    'mastercard': [
        'https://cdn.simpleicons.org/mastercard',
    ],
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const extractDomain = (website) => {
    if (!website || typeof website !== 'string') return null;
    try {
        const url = new URL(website.startsWith('http') ? website : `https://${website}`);
        return url.hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
};

/**
 * Build an ordered array of logo URLs to attempt for a given company.
 *
 * Priority:
 *  1. Explicit logo_url stored in the DB
 *  2. Known logo list (SimpleIcons / direct favicon)
 *  3. logo.dev API  — free, no signup, great coverage
 *  4. Direct /favicon.ico from company website
 *  5. Google favicon service — last resort, almost always returns something
 *  → null triggers the initial-letter placeholder
 */
const buildLogoUrls = (company, nameLower) => {
    const urls = [];

    const push = (url) => { if (url && !urls.includes(url)) urls.push(url); };

    // 1 — stored logo from DB
    push(company.logo_url || company.logoUrl);

    // 2 — known brand list
    const knownUrls = KNOWN_COMPANY_LOGOS[nameLower];
    if (knownUrls) knownUrls.forEach(push);

    // 3-5 — domain-based sources
    const websiteDomain = extractDomain(company.website);
    if (websiteDomain) {
        push(`https://img.logo.dev/${websiteDomain}?token=pk_X9JGkMBBQQaXJjxCNg9EFQ&size=40`);
        push(`https://${websiteDomain}/favicon.ico`);
        push(`https://www.google.com/s2/favicons?domain=${websiteDomain}&sz=64`);
    }

    return urls;
};

// ── Colour palette for initial-letter placeholders ────────────────────────────
const PLACEHOLDER_COLORS = [
    '#4f46e5', '#0891b2', '#059669', '#d97706',
    '#dc2626', '#7c3aed', '#db2777', '#0284c7',
    '#0f766e', '#b45309', '#4338ca', '#0369a1',
];

const getPlaceholderColor = (initial) =>
    PLACEHOLDER_COLORS[initial.charCodeAt(0) % PLACEHOLDER_COLORS.length];

// ── Component ──────────────────────────────────────────────────────────────────
const CompanyCard = ({ company }) => {
    const navigate  = useNavigate();
    const [urlIndex, setUrlIndex] = useState(0);

    if (!company) return null;

    const name        = company.name        || 'Unknown Company';
    const industry    = company.industry    || 'General';
    const location    = company.address     || company.location || '';
    const rating      = parseFloat(company.avg_rating  || company.rating      || 0);
    const reviewCount = parseInt(company.review_count  || company.reviewCount || 0, 10);
    const description = company.description || '';
    const isClaimed   = company.is_claimed  || false;
    const nameLower   = name.toLowerCase().trim();
    const initial     = name.charAt(0).toUpperCase();

    const logoUrls = useMemo(
        () => buildLogoUrls(company, nameLower),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [company.id, company.logo_url, company.website, nameLower]
    );

    const currentUrl = urlIndex < logoUrls.length ? logoUrls[urlIndex] : null;

    const handleLogoError = useCallback(() => setUrlIndex(i => i + 1), []);

    const handleClick = useCallback(() => {
        if (company.id) navigate(`/companies/${company.id}`);
    }, [company.id, navigate]);

    const handleKeyPress = useCallback((e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
    }, [handleClick]);

    return (
        <div
            className="company-card"
            onClick={handleClick}
            role="button"
            tabIndex={0}
            onKeyPress={handleKeyPress}
            aria-label={`View ${name} profile`}
        >
            <div className="company-card-header">
                {currentUrl ? (
                    <img
                        key={currentUrl}
                        src={currentUrl}
                        alt={`${name} logo`}
                        className="company-card-logo"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={handleLogoError}
                    />
                ) : (
                    <div
                        className="company-card-logo-placeholder"
                        style={{ background: getPlaceholderColor(initial) }}
                        aria-label={`${name} initial`}
                    >
                        {initial}
                    </div>
                )}

                <div className="company-card-info">
                    <h3 className="company-card-name">{name}</h3>
                    <span className="company-card-industry">{industry}</span>
                </div>
            </div>

            <div className="company-card-rating">
                <div className="star-rating" aria-label={`Rated ${rating.toFixed(1)} out of 5`}>
                    {[1, 2, 3, 4, 5].map(star => (
                        <span
                            key={star}
                            className={star <= Math.round(rating) ? 'star-filled' : 'star-empty'}
                            aria-hidden="true"
                        >
                            ★
                        </span>
                    ))}
                </div>
                <span className="company-card-rating-value">
                    {rating.toFixed(1)} ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
                </span>
            </div>

            {location && (
                <p className="company-card-address">
                    <FaMapMarkerAlt aria-hidden="true" /> {location}
                </p>
            )}

            {description && (
                <p className="company-card-description">
                    {description.length > 100
                        ? `${description.substring(0, 100)}…`
                        : description}
                </p>
            )}

            {!isClaimed && (
                <span className="company-card-unclaimed">Unclaimed</span>
            )}
        </div>
    );
};

export default CompanyCard;