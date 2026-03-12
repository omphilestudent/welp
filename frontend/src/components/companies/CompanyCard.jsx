import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaMapMarkerAlt } from 'react-icons/fa';
import { buildLogoUrls } from '../../utils/companyLogos';

// Color palette for initial-letter placeholders
const PLACEHOLDER_COLORS = [
    '#4f46e5', '#0891b2', '#059669', '#d97706',
    '#dc2626', '#7c3aed', '#db2777', '#0284c7',
    '#0f766e', '#b45309', '#4338ca', '#0369a1',
];

const getPlaceholderColor = (initial) =>
    PLACEHOLDER_COLORS[initial.charCodeAt(0) % PLACEHOLDER_COLORS.length];

const CompanyCard = ({ company, showClaimAction = false, onClaim }) => {
    const navigate  = useNavigate();
    const [urlIndex, setUrlIndex] = useState(0);

    if (!company) return null;

    const name        = company.name        || 'Unknown Company';
    const industry    = company.industry    || 'General';
    const location    = company.address     || company.location || '';
    const rating      = parseFloat(company.avg_rating  || company.rating      || 0);
    const reviewCount = parseInt(company.review_count  || company.reviewCount || 0, 10);
    const description = company.description || '';
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
        if (!company.id) return;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(String(company.id))) {
            navigate(`/companies/${company.id}`);
            return;
        }
        const fallbackName = encodeURIComponent(company.name || '');
        navigate(`/search?q=${fallbackName}`);
    }, [company.id, company.name, navigate]);

    const handleKeyPress = useCallback((e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
    }, [handleClick]);

    const handleClaimClick = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof onClaim === 'function') {
            onClaim(company);
        }
    }, [company, onClaim]);

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
                    <div className="company-card-name-row">
                        <h3 className="company-card-name">{name}</h3>
                    </div>
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
                        ? `${description.substring(0, 100)}...`
                        : description}
                </p>
            )}

            <div className="company-card-footer">
                {showClaimAction && (
                    <button
                        type="button"
                        className="company-claim-btn"
                        onClick={handleClaimClick}
                    >
                        Claim this business
                    </button>
                )}
            </div>
        </div>
    );
};

export default CompanyCard;
