// frontend/src/components/companies/CompanyCard.jsx
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaMapMarkerAlt, FaBuilding } from 'react-icons/fa';

const COMPANY_DOMAIN_MAP = {
    google: 'google.com',
    'deepseek ai': 'deepseek.com',
    meta: 'meta.com',
    'capitec bank': 'capitecbank.co.za',
    'standard bank': 'standardbank.co.za',
    'apple inc.': 'apple.com',
    apple: 'apple.com',
    amazon: 'amazon.com',
    microsoft: 'microsoft.com',
    tesla: 'tesla.com',
    netflix: 'netflix.com',
    spotify: 'spotify.com',
    airbnb: 'airbnb.com',
    uber: 'uber.com',
    linkedin: 'linkedin.com',
    salesforce: 'salesforce.com',
    oracle: 'oracle.com',
    ibm: 'ibm.com',
    intel: 'intel.com',
    nvidia: 'nvidia.com',
    adobe: 'adobe.com'
};

const COMPANY_SIMPLE_ICON_MAP = {
    google: 'google',
    'deepseek ai': 'openai',
    meta: 'meta',
    'capitec bank': 'bankofamerica',
    'standard bank': 'bankofamerica',
    'apple inc.': 'apple',
    apple: 'apple',
    amazon: 'amazon',
    microsoft: 'microsoft',
    tesla: 'tesla',
    netflix: 'netflix',
    spotify: 'spotify',
    airbnb: 'airbnb',
    uber: 'uber',
    linkedin: 'linkedin',
    salesforce: 'salesforce',
    oracle: 'oracle',
    ibm: 'ibm',
    intel: 'intel',
    nvidia: 'nvidia',
    adobe: 'adobe'
};

const getDomainFromWebsite = (website) => {
    if (!website || typeof website !== 'string') {
        return null;
    }

    const normalizedWebsite = website.startsWith('http') ? website : `https://${website}`;

    try {
        const parsedUrl = new URL(normalizedWebsite);
        return parsedUrl.hostname.replace(/^www\./, '');
    } catch (error) {
        return null;
    }
};

const getPrimaryLogoUrl = (company, name) => {
    if (company.logo_url || company.logoUrl) {
        return company.logo_url || company.logoUrl;
    }

    const domainFromWebsite = getDomainFromWebsite(company.website);
    if (domainFromWebsite) {
        return `https://logo.clearbit.com/${domainFromWebsite}`;
    }

    const mappedDomain = COMPANY_DOMAIN_MAP[name.toLowerCase()];
    if (mappedDomain) {
        return `https://logo.clearbit.com/${mappedDomain}`;
    }

    return null;
};

const getSecondaryLogoUrl = (name) => {
    const iconSlug = COMPANY_SIMPLE_ICON_MAP[name.toLowerCase()];
    if (!iconSlug) {
        return null;
    }

    return `https://cdn.simpleicons.org/${iconSlug}`;
};

const CompanyCard = ({ company }) => {
    const navigate = useNavigate();

    if (!company) return null;

    const handleClick = () => {
        if (company.id) {
            navigate(`/companies/${company.id}`);
        } else {
            console.error('Company has no ID:', company);
        }
    };

    const name = company.name || 'Unknown Company';
    const industry = company.industry || 'General';
    const location = company.address || company.location || 'Location not specified';
    const rating = parseFloat(company.avg_rating || company.rating || 0);
    const reviewCount = company.review_count || company.reviewCount || 0;
    const description = company.description || 'No description available';
    const isClaimed = company.is_claimed || false;
    const [logoStage, setLogoStage] = useState(0);

    const primaryLogoUrl = useMemo(() => getPrimaryLogoUrl(company, name), [company, name]);
    const secondaryLogoUrl = useMemo(() => getSecondaryLogoUrl(name), [name]);
    const activeLogoUrl = logoStage === 0 ? primaryLogoUrl : (logoStage === 1 ? secondaryLogoUrl : null);

    const handleLogoError = () => {
        if (logoStage === 0 && secondaryLogoUrl) {
            setLogoStage(1);
            return;
        }

        setLogoStage(2);
    };

    return (
        <div className="company-card" onClick={handleClick}>
            <div className="company-card-header">
                {activeLogoUrl ? (
                    <img
                        src={activeLogoUrl}
                        alt={`${name} logo`}
                        className="company-card-logo"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={handleLogoError}
                    />
                ) : (
                    <div className="company-card-logo-placeholder" aria-label={`${name} logo placeholder`}>
                        <FaBuilding />
                    </div>
                )}
                <div className="company-card-info">
                    <h3 className="company-card-name">{name}</h3>
                    <span className="company-card-industry">{industry}</span>
                </div>
            </div>

            <div className="company-card-rating">
                <div className="star-rating">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <span
                            key={star}
                            className={star <= rating ? 'star-filled' : 'star-empty'}
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
                    <FaMapMarkerAlt /> {location}
                </p>
            )}

            <p className="company-card-description">
                {description.length > 100
                    ? `${description.substring(0, 100)}...`
                    : description}
            </p>

            {!isClaimed && (
                <span className="company-card-unclaimed">Unclaimed</span>
            )}
        </div>
    );
};

export default CompanyCard;
