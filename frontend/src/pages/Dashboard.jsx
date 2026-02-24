// frontend/src/pages/Dashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import ReviewList from '../components/reviews/ReviewList';
import Loading from '../components/common/Loading';
import ProfileSettings from '../components/settings/ProfileSettings';
import { FaCamera, FaUpload, FaBriefcase, FaBuilding, FaEdit } from 'react-icons/fa';

// Profile Section Component
const ProfileSection = ({ user, onUpdate }) => {
    const [uploading, setUploading] = useState(false);
    const [editing, setEditing] = useState(false);
    const [occupation, setOccupation] = useState(user?.occupation || '');
    const [workplace, setWorkplace] = useState(user?.workplace || null);
    const [workplaceSearch, setWorkplaceSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.match(/image.*/)) {
            toast.error('Please select an image file');
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            toast.error('File size must be less than 2MB');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('avatar', file);

            const { data } = await api.post('/users/upload-avatar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            await api.patch('/users/profile', { avatarUrl: data.avatarUrl });

            toast.success('Profile picture updated!');
            onUpdate?.();
        } catch (error) {
            toast.error('Failed to upload image');
        } finally {
            setUploading(false);
        }
    };

    const searchWorkplaces = async (query) => {
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const { data } = await api.get(`/companies/search?q=${encodeURIComponent(query)}&limit=5`);
            setSearchResults(data.companies || []);
        } catch (error) {
            console.error('Workplace search error:', error);
        } finally {
            setSearching(false);
        }
    };

    const handleSaveProfile = async () => {
        try {
            await api.patch('/users/profile', {
                occupation,
                workplaceId: workplace?.id || null
            });
            toast.success('Profile updated successfully');
            setEditing(false);
            onUpdate?.();
        } catch (error) {
            toast.error('Failed to update profile');
        }
    };

    return (
        <div className="profile-section">
            <div className="profile-avatar-container">
                <div className="profile-avatar">
                    {user?.avatar_url ? (
                        <img src={user.avatar_url} alt={user.display_name} />
                    ) : (
                        <div className="avatar-placeholder-large">
                            {user?.display_name?.charAt(0) || 'U'}
                        </div>
                    )}

                    <button
                        className="avatar-upload-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                    >
                        {uploading ? <FaUpload className="spinning" /> : <FaCamera />}
                    </button>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*"
                        style={{ display: 'none' }}
                    />
                </div>

                <div className="profile-info">
                    <h3>{user?.display_name}</h3>
                    <p className="user-role">{user?.role}</p>

                    {!editing ? (
                        <>
                            {user?.occupation && (
                                <p className="user-occupation">
                                    <FaBriefcase /> {user.occupation}
                                </p>
                            )}
                            {user?.workplace && (
                                <p className="user-workplace">
                                    <FaBuilding /> {user.workplace.name}
                                </p>
                            )}
                            {(user?.role === 'employee' || user?.role === 'psychologist') && (
                                <button
                                    className="edit-profile-btn"
                                    onClick={() => setEditing(true)}
                                >
                                    <FaEdit /> Add Work Info
                                </button>
                            )}
                        </>
                    ) : (
                        <div className="profile-edit-form">
                            <div className="form-group">
                                <label>Occupation</label>
                                <input
                                    type="text"
                                    value={occupation}
                                    onChange={(e) => setOccupation(e.target.value)}
                                    placeholder="e.g., Software Engineer"
                                />
                            </div>

                            <div className="form-group">
                                <label>Workplace</label>
                                <input
                                    type="text"
                                    value={workplaceSearch}
                                    onChange={(e) => {
                                        setWorkplaceSearch(e.target.value);
                                        searchWorkplaces(e.target.value);
                                    }}
                                    placeholder="Search for your company"
                                />
                                {searching && <div className="searching">Searching...</div>}
                                {searchResults.length > 0 && (
                                    <div className="search-results">
                                        {searchResults.map(company => (
                                            <div
                                                key={company.id}
                                                className="search-result-item"
                                                onClick={() => {
                                                    setWorkplace(company);
                                                    setWorkplaceSearch(company.name);
                                                    setSearchResults([]);
                                                }}
                                            >
                                                {company.logo_url && (
                                                    <img src={company.logo_url} alt={company.name} className="company-logo-small" />
                                                )}
                                                <div>
                                                    <div className="company-name">{company.name}</div>
                                                    <div className="company-industry">{company.industry}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="form-actions">
                                <button onClick={handleSaveProfile} className="btn btn-primary btn-small">
                                    Save
                                </button>
                                <button
                                    onClick={() => {
                                        setEditing(false);
                                        setOccupation(user?.occupation || '');
                                        setWorkplace(user?.workplace || null);
                                        setWorkplaceSearch('');
                                    }}
                                    className="btn btn-secondary btn-small"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const Dashboard = () => {
    const { user, refreshUser } = useAuth();
    const [userReviews, setUserReviews] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [myCompanies, setMyCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('reviews');
    const [error, setError] = useState('');
    const [refreshing, setRefreshing] = useState(false);

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
                setUserReviews(reviewsRes.data?.reviews || []);
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

    const handleRefresh = async () => {
        setRefreshing(true);
        await refreshUser();
        await fetchDashboardData();
        setRefreshing(false);
        toast.success('Dashboard refreshed!');
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
                <div className="dashboard-header">
                    <h1 className="dashboard-title">Dashboard</h1>
                    <button
                        onClick={handleRefresh}
                        className="refresh-btn"
                        disabled={refreshing}
                    >
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                {/* Updated Profile Section */}
                <ProfileSection user={user} onUpdate={fetchDashboardData} />

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
                            <button
                                className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                                onClick={() => setActiveTab('profile')}
                            >
                                Profile Settings
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
                        <>
                            <button
                                className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
                                onClick={() => setActiveTab('requests')}
                            >
                                Pending Requests ({pendingRequests.length})
                            </button>
                            <button
                                className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                                onClick={() => setActiveTab('profile')}
                            >
                                Profile Settings
                            </button>
                        </>
                    )}
                </div>

                <div className="tab-content">
                    {user?.role === 'employee' && activeTab === 'reviews' && (
                        <div className="my-reviews-section">
                            <h3>My Reviews</h3>
                            {userReviews.length > 0 ? (
                                <ReviewList reviews={userReviews} />
                            ) : (
                                <p className="empty-message">
                                    You haven't written any reviews yet.{' '}
                                    <a href="/search">Search for companies</a> to review.
                                </p>
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

                    {user?.role === 'employee' && activeTab === 'profile' && (
                        <div className="profile-tab">
                            <ProfileSettings onUpdate={fetchDashboardData} />
                        </div>
                    )}

                    {user?.role === 'business' && activeTab === 'companies' && (
                        <div className="my-companies-section">
                            <h3>My Companies</h3>
                            {myCompanies.length > 0 ? (
                                <div className="companies-list">
                                    {myCompanies.map(company => (
                                        <div key={company.id} className="company-dashboard-card">
                                            <div className="company-logo">
                                                {company.logo_url ? (
                                                    <img src={company.logo_url} alt={company.name} />
                                                ) : (
                                                    <div className="logo-placeholder">
                                                        {company.name.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="company-info">
                                                <h4>{company.name}</h4>
                                                <p>Industry: {company.industry || 'Not specified'}</p>
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
                                                    onClick={() => window.location.href = `/business/reviews/${company.id}`}
                                                    className="btn btn-primary btn-small"
                                                >
                                                    Manage Reviews
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
                            {myCompanies.length > 0 ? (
                                <div className="company-selector">
                                    <p>Select a company to view its reviews:</p>
                                    <div className="company-buttons">
                                        {myCompanies.map(company => (
                                            <button
                                                key={company.id}
                                                onClick={() => window.location.href = `/business/reviews/${company.id}`}
                                                className="btn btn-outline"
                                            >
                                                {company.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="empty-message">You don't have any companies yet.</p>
                            )}
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
                                                {request.employee?.occupation && (
                                                    <p className="user-occupation-small">
                                                        <FaBriefcase /> {request.employee.occupation}
                                                    </p>
                                                )}
                                                {request.employee?.workplace && (
                                                    <p className="user-workplace-small">
                                                        <FaBuilding /> {request.employee.workplace.name}
                                                    </p>
                                                )}
                                                <p className="request-status">Status: {request.status}</p>
                                                <p className="request-date">
                                                    Sent: {new Date(request.created_at).toLocaleDateString()}
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
                                                <button
                                                    onClick={() => window.location.href = `/messages?conversation=${request.id}`}
                                                    className="btn btn-outline btn-small"
                                                >
                                                    View Details
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

                    {user?.role === 'psychologist' && activeTab === 'profile' && (
                        <div className="profile-tab">
                            <ProfileSettings onUpdate={fetchDashboardData} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;