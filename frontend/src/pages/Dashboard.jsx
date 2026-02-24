// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import ReviewList from '../components/reviews/ReviewList';
import Loading from '../components/common/Loading';

const Dashboard = () => {
    const { user } = useAuth();
    const [userReviews, setUserReviews] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [myCompanies, setMyCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('reviews');
    const [error, setError] = useState('');

    useEffect(() => {
        fetchDashboardData();
    }, [user]);

    const fetchDashboardData = async () => {
        setLoading(true);
        setError('');
        try {
            if (user?.role === 'employee') {
                const [reviewsRes, requestsRes] = await Promise.all([
                    api.get('/reviews/my-reviews'),
                    api.get('/messages/conversations/pending').catch(() => ({ data: [] }))
                ]);
                setUserReviews(reviewsRes.data || []);
                setPendingRequests(requestsRes.data || []);
            } else if (user?.role === 'business') {
                const companiesRes = await api.get('/companies/my-companies');
                setMyCompanies(companiesRes.data || []);
            } else if (user?.role === 'psychologist') {
                const conversationsRes = await api.get('/messages/conversations');
                setPendingRequests(conversationsRes.data?.filter(c => c.status === 'pending') || []);
            }
        } catch (error) {
            setError('Failed to load dashboard data');
            console.error('Failed to fetch dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptRequest = async (conversationId) => {
        try {
            await api.patch(`/messages/conversations/${conversationId}/status`, {
                status: 'accepted'
            });
            toast.success('Message request accepted!');
            fetchDashboardData();
        } catch (error) {
            toast.error('Failed to accept request');
        }
    };

    const handleRejectRequest = async (conversationId) => {
        try {
            await api.patch(`/messages/conversations/${conversationId}/status`, {
                status: 'rejected'
            });
            toast.success('Message request rejected');
            fetchDashboardData();
        } catch (error) {
            toast.error('Failed to reject request');
        }
    };

    if (loading) return <Loading />;

    return (
        <div className="dashboard-page">
            <div className="container">
                <h1 className="dashboard-title">Dashboard</h1>

                {error && <div className="alert alert-error">{error}</div>}

                <div className="user-info-card">
                    <div className="user-avatar">
                        {user?.avatar_url ? (
                            <img src={user.avatar_url} alt={user.display_name} />
                        ) : (
                            <div className="avatar-placeholder">
                                {user?.display_name?.charAt(0) || 'U'}
                            </div>
                        )}
                    </div>
                    <div className="user-details">
                        <h2>{user?.display_name || 'User'}</h2>
                        <p className="user-role">{user?.role || 'Unknown'}</p>
                        {user?.email && <p className="user-email">{user.email}</p>}
                    </div>
                </div>

                <div className="dashboard-tabs">
                    {user?.role === 'employee' && (
                        <>
                            <button
                                className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
                                onClick={() => setActiveTab('reviews')}
                            >
                                My Reviews ({userReviews.length})
                            </button>
                            <button
                                className={`tab-btn ${activeTab === 'messages' ? 'active' : ''}`}
                                onClick={() => setActiveTab('messages')}
                            >
                                Message Requests ({pendingRequests.length})
                            </button>
                        </>
                    )}

                    {user?.role === 'business' && (
                        <>
                            <button
                                className={`tab-btn ${activeTab === 'companies' ? 'active' : ''}`}
                                onClick={() => setActiveTab('companies')}
                            >
                                My Companies ({myCompanies.length})
                            </button>
                            <button
                                className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
                                onClick={() => setActiveTab('reviews')}
                            >
                                Company Reviews
                            </button>
                        </>
                    )}

                    {user?.role === 'psychologist' && (
                        <button
                            className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
                            onClick={() => setActiveTab('requests')}
                        >
                            Pending Requests ({pendingRequests.length})
                        </button>
                    )}
                </div>

                <div className="tab-content">
                    {user?.role === 'employee' && activeTab === 'reviews' && (
                        <div className="my-reviews-section">
                            <h3>My Reviews</h3>
                            {userReviews.length > 0 ? (
                                <ReviewList reviews={userReviews} />
                            ) : (
                                <p className="empty-message">You haven't written any reviews yet.</p>
                            )}
                        </div>
                    )}

                    {user?.role === 'employee' && activeTab === 'messages' && (
                        <div className="message-requests-section">
                            <h3>Message Requests from Psychologists</h3>
                            {pendingRequests.length > 0 ? (
                                <div className="requests-list">
                                    {pendingRequests.map(request => (
                                        <div key={request.id} className="request-card">
                                            <div className="request-info">
                                                <h4>{request.psychologist?.display_name || 'Unknown'}</h4>
                                                <p className="request-message">
                                                    {request.initial_message?.content}
                                                </p>
                                                <p className="request-date">
                                                    Received: {new Date(request.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="request-actions">
                                                <button
                                                    onClick={() => handleAcceptRequest(request.id)}
                                                    className="btn btn-primary btn-small"
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={() => handleRejectRequest(request.id)}
                                                    className="btn btn-secondary btn-small"
                                                >
                                                    Decline
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="empty-message">No pending message requests.</p>
                            )}
                        </div>
                    )}

                    {user?.role === 'business' && activeTab === 'companies' && (
                        <div className="my-companies-section">
                            <h3>My Companies</h3>
                            {myCompanies.length > 0 ? (
                                <div className="companies-list">
                                    {myCompanies.map(company => (
                                        <div key={company.id} className="company-dashboard-card">
                                            <div className="company-info">
                                                <h4>{company.name}</h4>
                                                <p>Total Reviews: {company.review_count || 0}</p>
                                                <p>Average Rating: {company.avg_rating || 'N/A'}</p>
                                            </div>
                                            <div className="company-actions">
                                                <button
                                                    onClick={() => window.location.href = `/companies/${company.id}`}
                                                    className="btn btn-secondary btn-small"
                                                >
                                                    View Page
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="empty-message">
                                    You haven't claimed any companies yet.{' '}
                                    <a href="/search">Search for your company</a> to claim it.
                                </p>
                            )}
                        </div>
                    )}

                    {user?.role === 'business' && activeTab === 'reviews' && (
                        <div className="company-reviews-section">
                            <h3>Reviews for Your Companies</h3>
                            <p className="coming-soon">Select a company to view its reviews</p>
                        </div>
                    )}

                    {user?.role === 'psychologist' && activeTab === 'requests' && (
                        <div className="pending-requests-section">
                            <h3>Pending Message Requests</h3>
                            {pendingRequests.length > 0 ? (
                                <div className="requests-list">
                                    {pendingRequests.map(request => (
                                        <div key={request.id} className="request-card">
                                            <div className="request-info">
                                                <h4>
                                                    {request.employee?.is_anonymous
                                                        ? 'Anonymous Employee'
                                                        : request.employee?.display_name || 'Unknown'}
                                                </h4>
                                                <p className="request-status">Status: {request.status}</p>
                                                <p className="request-date">
                                                    Sent: {new Date(request.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="request-actions">
                                                <button
                                                    onClick={() => window.location.href = `/messages?conversation=${request.id}`}
                                                    className="btn btn-primary btn-small"
                                                >
                                                    View Conversation
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="empty-message">No pending message requests.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;