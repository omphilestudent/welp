
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import ReviewCard from '../components/reviews/ReviewCard';
import ReviewForm from '../components/reviews/ReviewForm';
import StarRating from '../components/reviews/StarRating';
import Loading from '../components/common/Loading';
import toast from 'react-hot-toast';
import { buildLogoUrls } from '../utils/companyLogos';
import { REVIEW_TYPES, REVIEW_TYPE_LABELS } from '../utils/reviewTypes';

const CompanyPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [company, setCompany] = useState(null);
    const [reviewBuckets, setReviewBuckets] = useState({
        [REVIEW_TYPES.COMPANY]: { list: [], total: 0, loading: false },
        [REVIEW_TYPES.ONBOARDING]: { list: [], total: 0, loading: false },
        [REVIEW_TYPES.DAILY]: { list: [], total: 0, loading: false }
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [showClaimButton, setShowClaimButton] = useState(false);
    const [logoIndex, setLogoIndex] = useState(0);
    const [activeReviewTab, setActiveReviewTab] = useState(REVIEW_TYPES.COMPANY);

    useEffect(() => {
        if (id) {
            fetchCompanyData();
        }
    }, [id]);

    useEffect(() => {
        if (id) {
            fetchReviewsByType(activeReviewTab);
        }
    }, [id, activeReviewTab]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tabParam = params.get('reviewTab');
        if (tabParam && Object.values(REVIEW_TYPES).includes(tabParam)) {
            setActiveReviewTab(tabParam);
            setShowReviewForm(true);
        }
    }, [location.search]);

    useEffect(() => {
        setLogoIndex(0);
    }, [company?.id]);

    useEffect(() => {

        if (user && user.role === 'business' && company && !company.is_claimed) {
            setShowClaimButton(true);
        } else {
            setShowClaimButton(false);
        }
        console.log('User role:', user?.role);
        console.log('Company claimed:', company?.is_claimed);
        console.log('Show claim button:', showClaimButton);
    }, [user, company]);

    const logoUrls = useMemo(() => {
        if (!company) return [];
        const nameLower = (company.name || '').toLowerCase().trim();
        return buildLogoUrls(company, nameLower);
    }, [company]);

    const currentLogoUrl = logoIndex < logoUrls.length ? logoUrls[logoIndex] : null;
    const handleLogoError = useCallback(() => setLogoIndex(i => i + 1), []);

    const fetchCompanyData = async () => {
        setLoading(true);
        setError('');
        try {
            console.log('Fetching company with ID:', id);

            const companyRes = await api.get(`/companies/${id}`).catch(err => {
                console.error('Company fetch error:', err);
                throw err;
            });

            console.log('Company data:', companyRes.data);

            setCompany(companyRes.data);
            await fetchReviewsByType(activeReviewTab);
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

    const fetchReviewsByType = async (reviewType) => {
        if (!id) return;
        setReviewBuckets((prev) => ({
            ...prev,
            [reviewType]: { ...prev[reviewType], loading: true }
        }));
        try {
            const { data } = await api.get(`/reviews/company/${id}`, {
                params: { type: reviewType }
            });
            const normalized = Array.isArray(data)
                ? data
                : Array.isArray(data?.reviews)
                    ? data.reviews
                    : Array.isArray(data?.data)
                        ? data.data
                        : [];
            const total = data?.pagination?.total ?? normalized.length;
            setReviewBuckets((prev) => ({
                ...prev,
                [reviewType]: { list: normalized, total, loading: false }
            }));
        } catch (error) {
            console.error('Failed to load reviews', error);
            setReviewBuckets((prev) => ({
                ...prev,
                [reviewType]: { ...prev[reviewType], loading: false }
            }));
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
            await fetchCompanyData();
            await fetchReviewsByType(reviewData.reviewType || activeReviewTab);
        } catch (error) {
            console.error('Failed to post review:', error);
            toast.error(error.response?.data?.error || 'Failed to post review');
        }
    };

    const activeBucket = reviewBuckets[activeReviewTab] || { list: [], total: 0, loading: false };

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
                        {currentLogoUrl ? (
                            <img
                                key={currentLogoUrl}
                                src={currentLogoUrl}
                                alt={company.name}
                                className="company-logo"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onError={handleLogoError}
                            />
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
                                {company.registration_number && (
                                    <span className="company-registration">Reg No: {company.registration_number}</span>
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

                        <div className="company-actions">
                            {user?.role === 'employee' && (
                                <button
                                    onClick={() => setShowReviewForm(!showReviewForm)}
                                    className="btn btn-primary"
                                >
                                    {showReviewForm ? 'Cancel' : 'Write a Review'}
                                </button>
                            )}

                            {showClaimButton && (
                                <button
                                    onClick={() => navigate(`/claim/${company.id}`)}
                                    className="btn btn-primary"
                                    style={{ marginLeft: user?.role === 'employee' ? '1rem' : '0' }}
                                >
                                    🏢 Claim This Business
                                </button>
                            )}

                            {company.is_verified && (
                                <span className="verified-badge-large">
                                    Verified Business
                                </span>
                            )}
                            {!company.is_verified && company.is_claimed && (
                                <span className="verified-badge-large">
                                    Claimed Business
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="container">
                <div className="company-content">
                    {showReviewForm && (
                        <div className="review-form-section">
                            <div className="review-tab-header">
                                {Object.values(REVIEW_TYPES).map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        className={`tab-btn ${activeReviewTab === type ? 'active' : ''}`}
                                        onClick={() => {
                                            setActiveReviewTab(type);
                                            fetchReviewsByType(type);
                                        }}
                                    >
                                        {REVIEW_TYPE_LABELS[type]}
                                    </button>
                                ))}
                            </div>
                            <ReviewForm
                                onSubmit={handleReviewSubmit}
                                onCancel={() => setShowReviewForm(false)}
                                companyId={id}
                                reviewType={activeReviewTab}
                            />
                        </div>
                    )}

                    {company.description && (
                        <div className="company-description">
                            <h2>About {company.name}</h2>
                            <p>{company.description}</p>
                        </div>
                    )}

                    <div className="reviews-section">
                        <div className="review-tab-header">
                            {Object.values(REVIEW_TYPES).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    className={`tab-btn ${activeReviewTab === type ? 'active' : ''}`}
                                    onClick={() => {
                                        setActiveReviewTab(type);
                                        fetchReviewsByType(type);
                                    }}
                                >
                                    {REVIEW_TYPE_LABELS[type]} ({reviewBuckets[type]?.total || 0})
                                </button>
                            ))}
                        </div>
                        {activeBucket.loading ? (
                            <Loading />
                        ) : activeBucket.list.length > 0 ? (
                            activeBucket.list.map(review => (
                                <ReviewCard
                                    key={review.id}
                                    review={review}
                                    onReplyAdded={() => fetchReviewsByType(activeReviewTab)}
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
