// frontend/src/components/companies/CompanyCard.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaStar, FaMapMarkerAlt } from 'react-icons/fa';

const CompanyCard = ({ company }) => {
    const navigate = useNavigate();

    if (!company) return null;

    const handleClick = () => {
        navigate(`/companies/${company.id}`);
    };

    // Safely access properties with defaults
    const name = company.name || 'Unknown Company';
    const industry = company.industry || 'General';
    const location = company.address || company.location || 'Location not specified';
    const rating = parseFloat(company.avg_rating || company.rating || 0);
    const reviewCount = company.review_count || company.reviewCount || 0;
    const description = company.description || 'No description available';
    const isClaimed = company.is_claimed || false;

    return (
        <div className="company-card" onClick={handleClick}>
            <div className="company-card-header">
                {company.logo_url ? (
                    <img src={company.logo_url} alt={name} className="company-card-logo" />
                ) : (
                    <div className="company-card-logo-placeholder">
                        {name.charAt(0)}
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