// frontend/src/pages/CompanyPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import ReviewCard from '../components/reviews/ReviewCard';
import ReviewForm from '../components/reviews/ReviewForm';
import StarRating from '../components/reviews/StarRating';
import Loading from '../components/common/Loading';

const CompanyPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [company, setCompany] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showReviewForm, setShowReviewForm] = useState(false);

    useEffect(() => {
        if (id) {
            fetchCompanyData();
        }
    }, [id]);

    const fetchCompanyData = async () => {
        setLoading(true);
        setError('');
        try {
            console.log('Fetching company with ID:', id); // Debug log

            const [companyRes, reviewsRes] = await Promise.all([
                api.get(`/companies/${id}`).catch(err => {
                    console.error('Company fetch error:', err);
                    throw err;
                }),
                api.get(`/reviews/company/${id}`).catch(err => {
                    console.error('Reviews fetch error:', err);
                    throw err;
                })
            ]);

            console.log('Company data:', companyRes.data);
            console.log('Reviews data:', reviewsRes.data);

            setCompany(companyRes.data);
            setReviews(reviewsRes.data.reviews || []);
        } catch (error) {
            console.error('Failed to fetch company data:', error);
            if (error.response?.status === 404) {
                setError('Company not found');
            } else {
                setError('Failed to load company data');
            }
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
            toast.success('Review posted successfully!');
            fetchCompanyData();
        } catch (error) {
            console.error('Failed to post review:', error);
            toast.error(error.response?.data?.error || 'Failed to post review');
        }
    };

    if (loading) return <Loading />;

    if (error) {
        return (
            <div className="error-container">
                <h2>{error}</h2>
                <button onClick={() => navigate('/search')} className="btn btn-primary">
                    Back to Search
                </button>
            </div>
        );
    }

    if (!company) return <div className="empty-state">Company not found</div>;

    return (
        <div className="company-page">
            <div className="company-header">
                <div className="container">
                    <div className="company-info">
                        {company.logo_url ? (
                            <img src={company.logo_url} alt={company.name} className="company-logo" />
                        ) : (
                            <div className="company-logo-placeholder">
                                {company.name?.charAt(0).toUpperCase()}
                            </div>
                        )}

                        <div className="company-details">
                            <h1 className="company-name">{company.name}</h1>

                            <div className="company-rating">
                                <StarRating rating={parseFloat(company.avg_rating || 0)} readonly />
                                <span className="rating-value">{company.avg_rating || '0.0'}</span>
                                <span className="review-count">({company.review_count || 0} reviews)</span>
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

            <div className="container">
                <div className="company-content">
                    {showReviewForm && (
                        <div className="review-form-section">
                            <ReviewForm onSubmit={handleReviewSubmit} onCancel={() => setShowReviewForm(false)} />
                        </div>
                    )}

                    {company.description && (
                        <div className="company-description">
                            <h2>About {company.name}</h2>
                            <p>{company.description}</p>
                        </div>
                    )}

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