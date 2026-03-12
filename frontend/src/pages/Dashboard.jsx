
import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import ReviewList from '../components/reviews/ReviewList';
import Loading from '../components/common/Loading';
import ProfileSettings from '../components/settings/ProfileSettings';
import { FaCamera, FaUpload, FaBriefcase, FaBuilding, FaEdit, FaCalendarAlt, FaEnvelopeOpenText, FaPhoneAlt, FaVideo, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import {
    addDays,
    addMonths,
    addWeeks,
    endOfMonth,
    endOfWeek,
    format,
    isSameDay,
    isSameMonth,
    startOfMonth,
    startOfWeek,
    subMonths,
    subWeeks
} from 'date-fns';

const resolveMediaUrl = (url) => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

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


        if (!file.type.match(/image.*/)) {
            toast.error('Please select an image file');
            return;
        }


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
                        <img src={resolveMediaUrl(user.avatar_url)} alt={user.display_name} />
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
    const [psychLeads, setPsychLeads] = useState([]);
    const [psychSchedule, setPsychSchedule] = useState([]);
    const [psychPermissions, setPsychPermissions] = useState(null);
    const [calendarIntegrations, setCalendarIntegrations] = useState([]);
    const [externalEvents, setExternalEvents] = useState([]);
    const [calendarIntegrationDraft, setCalendarIntegrationDraft] = useState({
        provider: 'google',
        name: '',
        icalUrl: ''
    });
    const [scheduleDraft, setScheduleDraft] = useState({
        title: '',
        date: '',
        time: '',
        type: 'meeting',
        location: ''
    });
    const [calendarView, setCalendarView] = useState('month');
    const [calendarDate, setCalendarDate] = useState(new Date());
    const [psychCardCollapse, setPsychCardCollapse] = useState({
        schedule: false,
        leads: false,
        calls: false
    });

    useEffect(() => {
        if (user?.role === 'psychologist') {
            setActiveTab('overview');
        } else if (user?.role === 'business') {
            setActiveTab('companies');
        } else {
            setActiveTab('reviews');
        }
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
                const [pendingRes, leadsRes, scheduleRes, permissionsRes] = await Promise.all([
                    api.get('/messages/conversations/pending').catch(() => ({ data: [] })),
                    api.get('/psychologists/dashboard/leads').catch(() => ({ data: [] })),
                    api.get('/psychologists/dashboard/schedule').catch(() => ({ data: [] })),
                    api.get('/psychologists/dashboard/permissions').catch(() => ({ data: null }))
                ]);
                setPendingRequests(pendingRes.data || []);
                setPsychLeads(leadsRes.data || []);
                setPsychSchedule(scheduleRes.data || []);
                setPsychPermissions(permissionsRes.data || null);
                const integrationsRes = await api.get('/psychologists/dashboard/calendar-integrations').catch(() => ({ data: [] }));
                setCalendarIntegrations(integrationsRes.data || []);
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

    const handleScheduleSubmit = async (e) => {
        e.preventDefault();
        if (!scheduleDraft.title || !scheduleDraft.date || !scheduleDraft.time) {
            toast.error('Please complete title, date, and time.');
            return;
        }

        const scheduledDate = new Date(`${scheduleDraft.date}T${scheduleDraft.time}`);
        const scheduledFor = scheduledDate.toISOString();
        try {
            const { data } = await api.post('/psychologists/dashboard/schedule', {
                title: scheduleDraft.title,
                scheduledFor,
                type: scheduleDraft.type,
                location: scheduleDraft.location
            });
            setPsychSchedule((prev) => [data, ...prev]);
            setScheduleDraft({ title: '', date: '', time: '', type: 'meeting', location: '' });
            setCalendarDate(scheduledDate);
            toast.success('Schedule updated');
        } catch (error) {
            toast.error('Failed to add schedule item');
        }
    };

    const handleScheduleRemove = async (itemId) => {
        try {
            await api.delete(`/psychologists/dashboard/schedule/${itemId}`);
            setPsychSchedule((prev) => prev.filter((item) => item.id !== itemId));
            toast.success('Schedule item removed');
        } catch (error) {
            toast.error('Failed to remove schedule item');
        }
    };

    const handleLeadMessage = async (leadId) => {
        try {
            await api.post(`/psychologists/dashboard/leads/${leadId}/message`, {
                message: 'Hello, I am here to support you whenever you are ready to talk.'
            });
            toast.success('Message queued');
        } catch (error) {
            toast.error('Failed to send lead message');
        }
    };

    const handleLeadArchive = async (leadId) => {
        try {
            await api.patch(`/psychologists/dashboard/leads/${leadId}/archive`);
            setPsychLeads((prev) => prev.filter((lead) => lead.id !== leadId));
            toast.success('Lead removed');
        } catch (error) {
            toast.error('Failed to remove lead');
        }
    };

    const handleAddCalendarIntegration = async (e) => {
        e.preventDefault();
        if (!calendarIntegrationDraft.icalUrl) {
            toast.error('Please add an iCal URL');
            return;
        }
        try {
            const { data } = await api.post('/psychologists/dashboard/calendar-integrations', {
                provider: calendarIntegrationDraft.provider,
                name: calendarIntegrationDraft.name || calendarIntegrationDraft.provider,
                icalUrl: calendarIntegrationDraft.icalUrl
            });
            setCalendarIntegrations((prev) => [data, ...prev]);
            setCalendarIntegrationDraft({ provider: 'google', name: '', icalUrl: '' });
            toast.success('Calendar connected');
            await handleSyncCalendarIntegration(data.id);
        } catch (error) {
            toast.error('Failed to connect calendar');
        }
    };

    const handleRemoveCalendarIntegration = async (integrationId) => {
        try {
            await api.delete(`/psychologists/dashboard/calendar-integrations/${integrationId}`);
            setCalendarIntegrations((prev) => prev.filter((item) => item.id !== integrationId));
            setExternalEvents((prev) => prev.filter((item) => item.integration_id !== integrationId));
            toast.success('Calendar removed');
        } catch (error) {
            toast.error('Failed to remove calendar');
        }
    };

    const handleSyncCalendarIntegration = async (integrationId) => {
        try {
            const { data } = await api.post(`/psychologists/dashboard/calendar-integrations/${integrationId}/sync`);
            const events = (data.events || []).map((event) => ({
                ...event,
                integration_id: integrationId
            }));
            setExternalEvents((prev) => [
                ...prev.filter((item) => item.integration_id !== integrationId),
                ...events
            ]);
            toast.success(`Synced ${data.count || events.length} events`);
        } catch (error) {
            toast.error('Failed to sync calendar');
        }
    };

    const handleDownloadIcs = () => {
        const base = api.defaults.baseURL || '';
        const url = `${base}/psychologists/dashboard/schedule.ics`;
        window.open(url, '_blank');
    };

    const handleCallAction = (type) => {
        if (!(psychPermissions?.roleFlags?.voice_video_calls)) {
            toast.error('Call features are not enabled for your plan.');
            return;
        }
        toast(`${type === 'voice' ? 'Voice' : 'Video'} call setup is in progress — a link will be emailed shortly.`);
    };

    const scheduleItems = psychSchedule
        .map((item) => {
            const raw = item.scheduled_for || item.scheduledFor || item.scheduled_at;
            const date = raw ? new Date(raw) : null;
            return date && !Number.isNaN(date.getTime())
                ? { ...item, scheduledDate: date }
                : null;
        })
        .filter(Boolean);

    const itemsByDate = scheduleItems.reduce((acc, item) => {
        const key = format(item.scheduledDate, 'yyyy-MM-dd');
        acc[key] = acc[key] || [];
        acc[key].push(item);
        return acc;
    }, {});
    const selectedDateKey = format(calendarDate, 'yyyy-MM-dd');
    const selectedDateItems = itemsByDate[selectedDateKey] || [];
    const externalItemsByDate = externalEvents.reduce((acc, item) => {
        const raw = item.starts_at || item.startsAt;
        const date = raw ? new Date(raw) : null;
        if (!date || Number.isNaN(date.getTime())) return acc;
        const key = format(date, 'yyyy-MM-dd');
        acc[key] = acc[key] || [];
        acc[key].push({ ...item, scheduledDate: date });
        return acc;
    }, {});
    const selectedExternalItems = externalItemsByDate[selectedDateKey] || [];

    const weekStartsOn = 1;
    const calendarStart = calendarView === 'month'
        ? startOfWeek(startOfMonth(calendarDate), { weekStartsOn })
        : startOfWeek(calendarDate, { weekStartsOn });
    const calendarEnd = calendarView === 'month'
        ? endOfWeek(endOfMonth(calendarDate), { weekStartsOn })
        : endOfWeek(calendarDate, { weekStartsOn });

    const calendarDays = [];
    for (let day = calendarStart; day <= calendarEnd; day = addDays(day, 1)) {
        calendarDays.push(day);
    }

    const handleCalendarPrev = () => {
        setCalendarDate((prev) => (calendarView === 'month' ? subMonths(prev, 1) : subWeeks(prev, 1)));
    };

    const handleCalendarNext = () => {
        setCalendarDate((prev) => (calendarView === 'month' ? addMonths(prev, 1) : addWeeks(prev, 1)));
    };

    const handleCalendarToday = () => {
        setCalendarDate(new Date());
    };

    const togglePsychCard = (key) => {
        setPsychCardCollapse((prev) => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    if (loading) return <Loading />;

    const outgoingRequests = pendingRequests.filter((request) => request.initial_message?.senderId === user?.id);
    const incomingRequests = pendingRequests.filter((request) => request.initial_message?.senderId && request.initial_message?.senderId !== user?.id);

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

                {}
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
                                className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                                onClick={() => setActiveTab('overview')}
                            >
                                Dashboard
                            </button>
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
                            <h3>Message Requests</h3>

                            {outgoingRequests.length > 0 && (
                                <>
                                    <p className="section-subtitle">Requests you sent</p>
                                    <div className="requests-list">
                                        {outgoingRequests.map(request => (
                                            <div key={request.id} className="request-card">
                                                <div className="request-avatar">
                                                    {request.psychologist?.display_name?.charAt(0) || 'P'}
                                                </div>
                                                <div className="request-info">
                                                    <h4>{request.psychologist?.display_name || 'Unknown'}</h4>
                                                    <p className="request-message">
                                                        {request.initial_message?.content || 'No message provided.'}
                                                    </p>
                                                    <p className="request-status">Status: {request.status}</p>
                                                    <p className="request-date">
                                                        Sent: {new Date(request.created_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div className="request-actions">
                                                    <button
                                                        onClick={() => window.location.href = `/messages?conversation=${request.id}`}
                                                        className="btn btn-outline btn-small"
                                                    >
                                                        Open Chat
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {incomingRequests.length > 0 && (
                                <>
                                    <p className="section-subtitle">Requests sent to you</p>
                                    <div className="requests-list">
                                        {incomingRequests.map(request => (
                                            <div key={request.id} className="request-card">
                                                <div className="request-avatar">
                                                    {request.psychologist?.display_name?.charAt(0) || 'P'}
                                                </div>
                                                <div className="request-info">
                                                    <h4>{request.psychologist?.display_name || 'Unknown'}</h4>
                                                    <p className="request-message">
                                                        {request.initial_message?.content || 'No message provided.'}
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
                                </>
                            )}

                            {pendingRequests.length === 0 && (
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
                                                {request.initial_message?.content && (
                                                    <p className="request-message">
                                                        {request.initial_message.content}
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

                    {user?.role === 'psychologist' && activeTab === 'overview' && (
                        <div className="psych-dashboard-grid">
                            <section className="psych-card">
                                <header className="psych-card__header">
                                    <div>
                                        <h3><FaCalendarAlt /> Schedule</h3>
                                        <p>Plan meetings and activities with a live calendar view.</p>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-outline btn-small psych-card__toggle"
                                        onClick={() => togglePsychCard('schedule')}
                                        aria-label={psychCardCollapse.schedule ? 'Maximize schedule card' : 'Minimize schedule card'}
                                    >
                                        {psychCardCollapse.schedule ? <FaChevronDown /> : <FaChevronUp />}
                                        {psychCardCollapse.schedule ? 'Maximize' : 'Minimize'}
                                    </button>
                                </header>
                                {!psychCardCollapse.schedule && (
                                    <div className="psych-card__body">
                                        <div className="psych-calendar-controls">
                                            <div className="psych-calendar-nav">
                                                <button type="button" className="btn btn-secondary btn-small" onClick={handleCalendarPrev}>
                                                    Prev
                                                </button>
                                                <button type="button" className="btn btn-outline btn-small" onClick={handleCalendarToday}>
                                                    Today
                                                </button>
                                                <button type="button" className="btn btn-secondary btn-small" onClick={handleCalendarNext}>
                                                    Next
                                                </button>
                                            </div>
                                            <div className="psych-calendar-title">
                                                {calendarView === 'month'
                                                    ? format(calendarDate, 'MMMM yyyy')
                                                    : `${format(calendarStart, 'MMM d')} - ${format(calendarEnd, 'MMM d')}`}
                                            </div>
                                            <div className="psych-calendar-view">
                                                <button
                                                    type="button"
                                                    className={`btn btn-small ${calendarView === 'month' ? 'btn-primary' : 'btn-outline'}`}
                                                    onClick={() => setCalendarView('month')}
                                                >
                                                    Month
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`btn btn-small ${calendarView === 'week' ? 'btn-primary' : 'btn-outline'}`}
                                                    onClick={() => setCalendarView('week')}
                                                >
                                                    Week
                                                </button>
                                            </div>
                                        </div>
                                        <form className="psych-schedule-form" onSubmit={handleScheduleSubmit}>
                                            <input
                                                type="text"
                                                placeholder="Title"
                                                value={scheduleDraft.title}
                                                onChange={(e) => setScheduleDraft({ ...scheduleDraft, title: e.target.value })}
                                            />
                                            <input
                                                type="date"
                                                value={scheduleDraft.date}
                                                onChange={(e) => setScheduleDraft({ ...scheduleDraft, date: e.target.value })}
                                            />
                                            <input
                                                type="time"
                                                value={scheduleDraft.time}
                                                onChange={(e) => setScheduleDraft({ ...scheduleDraft, time: e.target.value })}
                                            />
                                            <select
                                                value={scheduleDraft.type}
                                                onChange={(e) => setScheduleDraft({ ...scheduleDraft, type: e.target.value })}
                                            >
                                                <option value="meeting">Meeting</option>
                                                <option value="video">Video</option>
                                                <option value="voice">Voice</option>
                                                <option value="note">Note</option>
                                            </select>
                                            <input
                                                type="text"
                                                placeholder="Location / link"
                                                value={scheduleDraft.location}
                                                onChange={(e) => setScheduleDraft({ ...scheduleDraft, location: e.target.value })}
                                            />
                                            <button type="submit" className="btn btn-primary btn-small">Add</button>
                                        </form>
                                        <div className={`psych-calendar psych-calendar--${calendarView}`}>
                                            <div className="psych-calendar-weekdays">
                                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
                                                    <span key={label}>{label}</span>
                                                ))}
                                            </div>
                                            <div className="psych-calendar-grid">
                                                {calendarDays.map((day) => {
                                                    const key = format(day, 'yyyy-MM-dd');
                                                    const items = itemsByDate[key] || [];
                                                    const isMuted = calendarView === 'month' && !isSameMonth(day, calendarDate);
                                                    const isToday = isSameDay(day, new Date());
                                                    return (
                                                        <button
                                                            type="button"
                                                            key={key}
                                                            className={`psych-calendar-day ${isMuted ? 'is-muted' : ''} ${isToday ? 'is-today' : ''}`}
                                                            onClick={() => setScheduleDraft((prev) => ({
                                                                ...prev,
                                                                date: format(day, 'yyyy-MM-dd')
                                                            }))}
                                                        >
                                                            <div className="psych-calendar-day-header">
                                                                <span>{format(day, 'd')}</span>
                                                                {items.length > 0 && <span className="psych-calendar-count">{items.length}</span>}
                                                            </div>
                                                            <div className="psych-calendar-items">
                                                                {items.slice(0, 2).map((item) => (
                                                                    <div key={item.id} className={`psych-calendar-item psych-calendar-item--${item.type}`}>
                                                                        <strong>{item.title}</strong>
                                                                        <span>{format(item.scheduledDate, 'p')}</span>
                                                                    </div>
                                                                ))}
                                                                {items.length > 2 && (
                                                                    <div className="psych-calendar-more">+{items.length - 2} more</div>
                                                                )}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {psychSchedule.length === 0 && (
                                                <p className="empty-message">No scheduled items yet.</p>
                                            )}
                                        </div>
                                        <div className="psych-schedule-list">
                                            <div className="psych-schedule-list__header">
                                                <h4>{format(calendarDate, 'MMMM d, yyyy')}</h4>
                                                <span>{selectedDateItems.length} item{selectedDateItems.length === 1 ? '' : 's'}</span>
                                            </div>
                                            {selectedDateItems.length > 0 ? (
                                                <div className="psych-schedule-list__items">
                                                    {selectedDateItems.map((item) => (
                                                        <div key={item.id} className="psych-schedule-list__item">
                                                            <div>
                                                                <strong>{item.title}</strong>
                                                                <span>{format(item.scheduledDate, 'p')}</span>
                                                                {item.location && <span>{item.location}</span>}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="btn btn-secondary btn-small"
                                                                onClick={() => handleScheduleRemove(item.id)}
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="empty-message">No items for this day.</p>
                                            )}
                                        </div>
                                        <div className="psych-schedule-list">
                                            <div className="psych-schedule-list__header">
                                                <h4>External calendar</h4>
                                                <span>{selectedExternalItems.length} item{selectedExternalItems.length === 1 ? '' : 's'}</span>
                                            </div>
                                            {selectedExternalItems.length > 0 ? (
                                                <div className="psych-schedule-list__items">
                                                    {selectedExternalItems.map((item, index) => (
                                                        <div key={`${item.title}-${index}`} className="psych-schedule-list__item">
                                                            <div>
                                                                <strong>{item.title}</strong>
                                                                <span>{item.location || 'External event'}</span>
                                                            </div>
                                                            <span>{format(item.scheduledDate, 'p')}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="empty-message">No external items for this day.</p>
                                            )}
                                        </div>
                                        <div className="psych-schedule-list">
                                            <div className="psych-schedule-list__header">
                                                <h4>Calendar integrations</h4>
                                                <span>{calendarIntegrations.length} connected</span>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-outline btn-small"
                                                onClick={handleDownloadIcs}
                                            >
                                                Download iCal
                                            </button>
                                            <form className="psych-schedule-form" onSubmit={handleAddCalendarIntegration}>
                                                <select
                                                    value={calendarIntegrationDraft.provider}
                                                    onChange={(e) => setCalendarIntegrationDraft({ ...calendarIntegrationDraft, provider: e.target.value })}
                                                >
                                                    <option value="google">Google Calendar</option>
                                                    <option value="outlook">Outlook</option>
                                                    <option value="ical">iCal</option>
                                                </select>
                                                <input
                                                    type="text"
                                                    placeholder="Calendar name"
                                                    value={calendarIntegrationDraft.name}
                                                    onChange={(e) => setCalendarIntegrationDraft({ ...calendarIntegrationDraft, name: e.target.value })}
                                                />
                                                <input
                                                    type="url"
                                                    placeholder="Public iCal URL"
                                                    value={calendarIntegrationDraft.icalUrl}
                                                    onChange={(e) => setCalendarIntegrationDraft({ ...calendarIntegrationDraft, icalUrl: e.target.value })}
                                                />
                                                <button type="submit" className="btn btn-primary btn-small">Connect</button>
                                            </form>
                                            {calendarIntegrations.length > 0 ? (
                                                <div className="psych-schedule-list__items">
                                                    {calendarIntegrations.map((integration) => (
                                                        <div key={integration.id} className="psych-schedule-list__item">
                                                            <div>
                                                                <strong>{integration.name || integration.provider}</strong>
                                                                <span>{integration.provider}</span>
                                                            </div>
                                                            <div className="psych-calendar-actions">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-outline btn-small"
                                                                    onClick={() => handleSyncCalendarIntegration(integration.id)}
                                                                >
                                                                    Sync
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-secondary btn-small"
                                                                    onClick={() => handleRemoveCalendarIntegration(integration.id)}
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="empty-message">No external calendars connected.</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </section>

                            <section className="psych-card">
                                <header className="psych-card__header">
                                    <div>
                                        <h3><FaEnvelopeOpenText /> Leads</h3>
                                        <p>Individuals flagged as potentially stressed or depressed.</p>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-outline btn-small psych-card__toggle"
                                        onClick={() => togglePsychCard('leads')}
                                        aria-label={psychCardCollapse.leads ? 'Maximize leads card' : 'Minimize leads card'}
                                    >
                                        {psychCardCollapse.leads ? <FaChevronDown /> : <FaChevronUp />}
                                        {psychCardCollapse.leads ? 'Maximize' : 'Minimize'}
                                    </button>
                                </header>
                                {!psychCardCollapse.leads && (
                                    <div className="psych-card__body">
                                        <div className="psych-leads-list">
                                            {psychLeads.length > 0 ? (
                                                psychLeads.map(lead => (
                                                    <div key={lead.id} className="psych-lead-card">
                                                        <div>
                                                            <h4>{lead.display_name}</h4>
                                                            <p>{lead.summary}</p>
                                                            <span className={`lead-badge lead-${lead.risk_level}`}>{lead.risk_level} risk</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="btn btn-secondary btn-small"
                                                            onClick={() => handleLeadMessage(lead.id)}
                                                        >
                                                            Send message
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline btn-small"
                                                            onClick={() => handleLeadArchive(lead.id)}
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="empty-message">No new leads right now.</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </section>

                            <section className="psych-card">
                                <header className="psych-card__header">
                                    <div>
                                        <h3><FaVideo /> Call Options</h3>
                                        <p>Voice and video calls are enabled with plan-based limits.</p>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-outline btn-small psych-card__toggle"
                                        onClick={() => togglePsychCard('calls')}
                                        aria-label={psychCardCollapse.calls ? 'Maximize call options card' : 'Minimize call options card'}
                                    >
                                        {psychCardCollapse.calls ? <FaChevronDown /> : <FaChevronUp />}
                                        {psychCardCollapse.calls ? 'Maximize' : 'Minimize'}
                                    </button>
                                </header>
                                {!psychCardCollapse.calls && (
                                    <div className="psych-card__body">
                                        <div className="psych-call-summary">
                                            <div>
                                                <p className="psych-call-plan">
                                                    Plan: {psychPermissions?.plan || 'Free'}
                                                </p>
                                                <p className="psych-call-limit">
                                                    Free profiles: {psychPermissions?.callLimits?.minutesPerClient || 120} minutes per client.
                                                </p>
                                                <p className="psych-call-note">
                                                    Premium profiles unlock more features as outlined on the pricing page.
                                                </p>
                                            </div>
                                            <div className="psych-call-actions">
                                                <button
                                                    type="button"
                                                    className="btn btn-outline btn-small"
                                                    onClick={() => handleCallAction('voice')}
                                                    disabled={!psychPermissions?.roleFlags?.voice_video_calls}
                                                >
                                                    <FaPhoneAlt /> Voice
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline btn-small"
                                                    onClick={() => handleCallAction('video')}
                                                    disabled={!psychPermissions?.roleFlags?.voice_video_calls}
                                                >
                                                    <FaVideo /> Video
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </section>
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
