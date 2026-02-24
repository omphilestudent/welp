// frontend/src/pages/CompanyPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import ReviewCard from '../components/reviews/ReviewCard';
import ReviewForm from '../components/reviews/ReviewForm';
import StarRating from '../components/reviews/StarRating';
import Loading from '../components/common/Loading';

const CompanyPage = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const [company, setCompany] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showReviewForm, setShowReviewForm] = useState(false);

    useEffect(() => {
        fetchCompanyData();
    }, [id]);

    const fetchCompanyData = async () => {
        try {
            const [companyRes, reviewsRes] = await Promise.all([
                api.get(`/companies/${id}`),
                api.get(`/reviews/company/${id}`)
            ]);
            setCompany(companyRes.data);
            setReviews(reviewsRes.data.reviews);
        } catch (error) {
            console.error('Failed to fetch company data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleReviewSubmit = async (reviewData) => {
        try {
            await api.post('/reviews', {
                ...reviewData,
                companyId: id
            });
            setShowReviewForm(false);
            fetchCompanyData(); // Refresh data
        } catch (error) {
            console.error('Failed to post review:', error);
        }
    };

    if (loading) return <Loading />;
    if (!company) return <div>Company not found</div>;

    return (
        <div className="company-page">
            {/* Company Header */}
            <div className="company-header">
                <div className="container">
                    <div className="company-info">
                        {company.logo_url ? (
                            <img src={company.logo_url} alt={company.name} className="company-logo" />
                        ) : (
                            <div className="company-logo-placeholder">
                                {company.name.charAt(0)}
                            </div>
                        )}

                        <div className="company-details">
                            <h1 className="company-name">{company.name}</h1>

                            <div className="company-rating">
                                <StarRating rating={company.avg_rating} readonly />
                                <span className="rating-value">{company.avg_rating}</span>
                                <span className="review-count">({company.review_count} reviews)</span>
                            </div>

                            {company.industry && (
                                <p className="company-industry">{company.industry}</p>
                            )}

                            <div className="company-meta">
                                {company.address && (
                                    <span className="company-address">📍 {company.address}</span>
                                )}
                                {company.phone && (
                                    <span className="company-phone">📞 {company.phone}</span>
                                )}
                                {company.website && (
                                    <a
                                        href={company.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="company-website"
                                    >
                                        🌐 {company.website}
                                    </a>
                                )}
                            </div>
                        </div>

                        {user?.role === 'employee' && (
                            <button
                                onClick={() => setShowReviewForm(!showReviewForm)}
                                className="btn btn-primary"
                            >
                                {showReviewForm ? 'Cancel' : 'Write a Review'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="container">
                <div className="company-content">
                    {/* Review Form */}
                    {showReviewForm && (
                        <div className="review-form-section">
                            <ReviewForm onSubmit={handleReviewSubmit} />
                        </div>
                    )}

                    {/* Company Description */}
                    {company.description && (
                        <div className="company-description">
                            <h2>About {company.name}</h2>
                            <p>{company.description}</p>
                        </div>
                    )}

                    {/* Reviews Section */}
                    <div className="reviews-section">
                        <h2>Employee Reviews</h2>
                        {reviews.length > 0 ? (
                            reviews.map(review => (
                                <ReviewCard
                                    key={review.id}
                                    review={review}
                                    onReplyAdded={fetchCompanyData}
                                />
                            ))
                        ) : (
                            <p className="no-reviews">
                                No reviews yet. Be the first to share your experience!
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompanyPage;