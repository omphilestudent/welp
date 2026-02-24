// frontend/src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
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

    useEffect(() => {
        fetchDashboardData();
    }, [user]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            if (user.role === 'employee') {
                // Fetch employee's reviews
                const reviewsRes = await api.get('/reviews/my-reviews');
                setUserReviews(reviewsRes.data);

                // Fetch pending message requests
                const requestsRes = await api.get('/messages/conversations/pending');
                setPendingRequests(requestsRes.data);
            } else if (user.role === 'business') {
                // Fetch business's companies
                const companiesRes = await api.get('/companies/my-companies');
                setMyCompanies(companiesRes.data);
            } else if (user.role === 'psychologist') {
                // Fetch psychologist's conversations
                const conversationsRes = await api.get('/messages/conversations');
                setPendingRequests(conversationsRes.data.filter(c => c.status === 'pending'));
            }
        } catch (error) {
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
            fetchDashboardData();
        } catch (error) {
            console.error('Failed to accept request:', error);
        }
    };

    const handleRejectRequest = async (conversationId) => {
        try {
            await api.patch(`/messages/conversations/${conversationId}/status`, {
                status: 'rejected'
            });
            fetchDashboardData();
        } catch (error) {
            console.error('Failed to reject request:', error);
        }
    };

    if (loading) return <Loading />;

    return (
        <div className="dashboard-page">
            <div className="container">
                <h1 className="dashboard-title">Dashboard</h1>

                {/* User Info */}
                <div className="user-info-card">
                    <div className="user-avatar">
                        {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.displayName} />
                        ) : (
                            <div className="avatar-placeholder">
                                {user.displayName?.charAt(0) || 'U'}
                            </div>
                        )}
                    </div>
                    <div className="user-details">
                        <h2>{user.displayName}</h2>
                        <p className="user-role">{user.role}</p>
                        {user.email && <p className="user-email">{user.email}</p>}
                    </div>
                </div>

                {/* Tabs */}
                <div className="dashboard-tabs">
                    {user.role === 'employee' && (
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

                    {user.role === 'business' && (
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

                    {user.role === 'psychologist' && (
                        <button
                            className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
                            onClick={() => setActiveTab('requests')}
                        >
                            Pending Requests ({pendingRequests.length})
                        </button>
                    )}
                </div>

                {/* Tab Content */}
                <div className="tab-content">
                    {/* Employee: My Reviews */}
                    {user.role === 'employee' && activeTab === 'reviews' && (
                        <div className="my-reviews-section">
                            <h3>My Reviews</h3>
                            {userReviews.length > 0 ? (
                                <ReviewList reviews={userReviews} />
                            ) : (
                                <p className="empty-message">You haven't written any reviews yet.</p>
                            )}
                        </div>
                    )}

                    {/* Employee: Message Requests */}
                    {user.role === 'employee' && activeTab === 'messages' && (
                        <div className="message-requests-section">
                            <h3>Message Requests from Psychologists</h3>
                            {pendingRequests.length > 0 ? (
                                <div className="requests-list">
                                    {pendingRequests.map(request => (
                                        <div key={request.id} className="request-card">
                                            <div className="request-info">
                                                <h4>{request.psychologist.displayName}</h4>
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

                    {/* Business: My Companies */}
                    {user.role === 'business' && activeTab === 'companies' && (
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
                                                <button
                                                    onClick={() => setActiveTab('reviews')}
                                                    className="btn btn-primary btn-small"
                                                >
                                                    View Reviews
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

                    {/* Business: Company Reviews */}
                    {user.role === 'business' && activeTab === 'reviews' && (
                        <div className="company-reviews-section">
                            <h3>Reviews for Your Companies</h3>
                            {/* This would fetch and display reviews for all companies owned by the business */}
                            <p className="coming-soon">Company reviews view coming soon...</p>
                        </div>
                    )}

                    {/* Psychologist: Pending Requests */}
                    {user.role === 'psychologist' && activeTab === 'requests' && (
                        <div className="pending-requests-section">
                            <h3>Pending Message Requests</h3>
                            {pendingRequests.length > 0 ? (
                                <div className="requests-list">
                                    {pendingRequests.map(request => (
                                        <div key={request.id} className="request-card">
                                            <div className="request-info">
                                                <h4>
                                                    {request.employee.is_anonymous
                                                        ? 'Anonymous Employee'
                                                        : request.employee.displayName}
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