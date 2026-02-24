import React from 'react';
import { useNavigate } from 'react-router-dom';
import StarRating from '../reviews/StarRating';

const CompanyCard = ({ company }) => {
  const navigate = useNavigate();

  return (
    <div 
      className="company-card"
      onClick={() => navigate(`/companies/${company.id}`)}
    >
      <div className="company-card-header">
        {company.logo_url ? (
          <img src={company.logo_url} alt={company.name} className="company-card-logo" />
        ) : (
          <div className="company-card-logo-placeholder">
            {company.name.charAt(0)}
          </div>
        )}
        <div className="company-card-info">
          <h3 className="company-card-name">{company.name}</h3>
          {company.industry && (
            <span className="company-card-industry">{company.industry}</span>
          )}
        </div>
      </div>

      <div className="company-card-rating">
        <StarRating rating={parseFloat(company.avg_rating)} readonly />
        <span className="company-card-rating-value">
          {company.avg_rating} ({company.review_count} reviews)
        </span>
      </div>

      {company.address && (
        <p className="company-card-address">
          📍 {company.address}
        </p>
      )}

      {company.description && (
        <p className="company-card-description">
          {company.description.length > 100 
            ? `${company.description.substring(0, 100)}...` 
            : company.description}
        </p>
      )}

      {!company.is_claimed && (
        <span className="company-card-unclaimed">Unclaimed</span>
      )}
    </div>
  );
};

export default CompanyCard;