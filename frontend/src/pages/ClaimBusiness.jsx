
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { motion } from 'framer-motion';
import { FaBuilding, FaArrowRight } from 'react-icons/fa';
import Loading from '../components/common/Loading';

const ClaimBusiness = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [recentReviews, setRecentReviews] = useState([]);

    useEffect(() => {
        console.log('ClaimBusiness mounted with ID:', id);
        if (id) {
            fetchCompany();
        }
    }, [id]);

    const fetchCompany = async () => {
        try {
            console.log('Fetching company with ID:', id);
            const { data } = await api.get(`/business/${id}`, {
                params: { reviewLimit: 3 }
            });
            console.log('Company data:', data);
            setCompany(data);
            setRecentReviews(data.recentReviews || []);
        } catch (error) {
            console.error('Failed to fetch company:', error);
            setError('Failed to load company details');
        } finally {
            setLoading(false);
        }
    };

    const handleStartClaim = () => {
        navigate(`/kyc/${id}`);
    };

    if (loading) {
        return <Loading />;
    }

    if (error || !company) {
        return (
            <div className="error-container">
                <h2>{error || 'Company not found'}</h2>
                <button onClick={() => navigate('/search')} className="btn btn-primary">
                    Back to Search
                </button>
            </div>
        );
    }

    return (
        <div className="claim-business-page">
            <div className="container">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="claim-business-content"
                >
                    <h1>Claim Your Business</h1>

                    <div className="company-card">
                        <div className="company-info">
                            {company.logo_url ? (
                                <img src={company.logo_url} alt={company.name} />
                            ) : (
                                <div className="company-icon">
                                    <FaBuilding />
                                </div>
                            )}
                            <div>
                                <h2>{company.name}</h2>
                                <p>{company.industry || 'Business'}</p>
                            </div>
                        </div>
                    </div>

                    {recentReviews.length > 0 && (
                        <div className="claim-reviews-preview">
                            <h3>Recent employee feedback</h3>
                            <ul>
                                {recentReviews.map((review) => (
                                    <li key={review.id}>
                                        <div className="claim-review-rating">
                                            <span>Rating: {review.rating}/5</span>
                                            <span>{new Date(review.created_at || review.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <p>{review.content}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="claim-steps">
                        <h2>Verification Process</h2>
                        <div className="steps">
                            <div className="step">
                                <div className="step-number">1</div>
                                <div className="step-content">
                                    <h3>Business Information</h3>
                                    <p>Provide your company registration details</p>
                                </div>
                            </div>
                            <div className="step">
                                <div className="step-number">2</div>
                                <div className="step-content">
                                    <h3>Legal Representative</h3>
                                    <p>Verify the person authorized to represent the business</p>
                                </div>
                            </div>
                            <div className="step">
                                <div className="step-number">3</div>
                                <div className="step-content">
                                    <h3>Document Upload</h3>
                                    <p>Upload required KYC documents</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleStartClaim}
                        className="btn btn-primary btn-large"
                    >
                        Start Verification <FaArrowRight />
                    </button>
                </motion.div>
            </div>
        </div>
    );
};

export default ClaimBusiness;
