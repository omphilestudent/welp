
import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import ReviewList from '../components/reviews/ReviewList';
import Loading from '../components/common/Loading';
import ProfileSettings from '../components/settings/ProfileSettings';
import { FaCamera, FaUpload, FaBriefcase, FaBuilding, FaEdit, FaCalendarAlt, FaEnvelopeOpenText, FaPhoneAlt, FaVideo, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip
} from 'recharts';
const BUSINESS_PIE_COLORS = ['#4f46e5', '#f59e0b', '#0ea5e9', '#10b981', '#9333ea'];
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
            const { data } = await api.get('/businesses', {
                params: {
                    search: query,
                    limit: 5
                }
            });
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
    const [recentCalls, setRecentCalls] = useState([]);
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
    const [selectedCompanyId, setSelectedCompanyId] = useState(null);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [companyPanelTab, setCompanyPanelTab] = useState('reviews');
    const [companyReviews, setCompanyReviews] = useState([]);
    const [companyReviewPagination, setCompanyReviewPagination] = useState({
        page: 1,
        pages: 0,
        total: 0,
        limit: 5
    });
    const [companyAnalytics, setCompanyAnalytics] = useState(null);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [businessSectionError, setBusinessSectionError] = useState('');
    const [companyInfoSaving, setCompanyInfoSaving] = useState(false);
    const [companyInfoMessage, setCompanyInfoMessage] = useState('');
    const [editCompanyForm, setEditCompanyForm] = useState({
        phone: '',
        email: '',
        address: '',
        city: '',
        country: '',
        logo_url: ''
    });
    const formatDuration = (seconds = 0) => {
        const total = Number(seconds) || 0;
        const mins = Math.floor(total / 60);
        const secs = total % 60;
        return `${mins}m ${secs}s`;
    };

    const fetchSelectedCompanyProfile = async (companyId, options = {}) => {
        if (!companyId) return;
        try {
            const { data } = await api.get(`/business/${companyId}`, { params: { reviewLimit: 3 } });
            setSelectedCompany(data);
            setCompanyInfoMessage('');
            if (!options.skipFormUpdate) {
                setEditCompanyForm({
                    phone: data.phone || '',
                    email: data.email || '',
                    address: data.address || '',
                    city: data.city || '',
                    country: data.country || '',
                    logo_url: data.logo_url || ''
                });
            }
            setBusinessSectionError('');
        } catch (err) {
            setBusinessSectionError(err.response?.data?.error || 'Failed to load business profile');
        }
    };

    const fetchBusinessReviews = async (companyId, page = 1) => {
        if (!companyId) return;
        setReviewsLoading(true);
        try {
            const { data } = await api.get(`/business/${companyId}/reviews`, {
                params: { page, limit: companyReviewPagination.limit || 5 }
            });
            setCompanyReviews(data.reviews || []);
            setCompanyReviewPagination({
                page: data.pagination?.page || 1,
                pages: data.pagination?.pages || 1,
                total: data.pagination?.total || 0,
                limit: data.pagination?.limit || companyReviewPagination.limit || 5,
                lastViewedAt: data.lastViewedAt
            });
            setBusinessSectionError('');
        } catch (err) {
            setBusinessSectionError(err.response?.data?.error || 'Failed to load reviews');
            setCompanyReviews([]);
        } finally {
            setReviewsLoading(false);
        }
    };

    const fetchBusinessAnalytics = async (companyId) => {
        if (!companyId) return;
        setAnalyticsLoading(true);
        try {
            const { data } = await api.get(`/business/${companyId}/analytics`);
            setCompanyAnalytics(data);
            setBusinessSectionError('');
        } catch (err) {
            setBusinessSectionError(err.response?.data?.error || 'Failed to load analytics');
            setCompanyAnalytics(null);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const handleBusinessReviewPageChange = (direction) => {
        const nextPage = (companyReviewPagination.page || 1) + direction;
        if (nextPage < 1 || nextPage > (companyReviewPagination.pages || 1)) {
            return;
        }
        fetchBusinessReviews(selectedCompanyId, nextPage);
    };

    const handleCompanyInfoChange = (field, value) => {
        setEditCompanyForm((prev) => ({
            ...prev,
            [field]: value
        }));
    };

    const handleCompanyInfoSubmit = async (event) => {
        event.preventDefault();
        if (!selectedCompanyId) return;
        setCompanyInfoSaving(true);
        setCompanyInfoMessage('');
        try {
            const { data } = await api.put(`/business/${selectedCompanyId}`, editCompanyForm);
            setSelectedCompany(data);
            setMyCompanies((prev) =>
                Array.isArray(prev)
                    ? prev.map((company) => (company.id === data.id ? data : company))
                    : prev
            );
            setCompanyInfoMessage('Business profile updated.');
            toast.success('Business info updated');
        } catch (err) {
            const message = err.response?.data?.error || 'Failed to update business info';
            setCompanyInfoMessage(message);
            toast.error(message);
        } finally {
            setCompanyInfoSaving(false);
        }
    };

    const handleScrapeMissingInfo = async () => {
        if (!selectedCompanyId) return;
        setCompanyInfoSaving(true);
        setCompanyInfoMessage('');
        try {
            const { data } = await api.post(`/companies/${selectedCompanyId}/scrape-missing`);
            const updated = data.company || data;
            setSelectedCompany(updated);
            setEditCompanyForm({
                phone: updated.phone || '',
                email: updated.email || '',
                address: updated.address || '',
                city: updated.city || '',
                country: updated.country || '',
                logo_url: updated.logo_url || ''
            });
            setCompanyInfoMessage('Latest website data applied.');
            toast.success('Company info refreshed from website');
        } catch (err) {
            const message = err.response?.data?.error || 'Unable to refresh company info';
            setCompanyInfoMessage(message);
            toast.error(message);
        } finally {
            setCompanyInfoSaving(false);
        }
    };

    const refreshBusinessSections = () => {
        if (!selectedCompanyId) return;
        fetchSelectedCompanyProfile(selectedCompanyId, { skipFormUpdate: true });
        fetchBusinessReviews(selectedCompanyId, companyReviewPagination.page || 1);
        fetchBusinessAnalytics(selectedCompanyId);
    };

    const ratingChartData = companyAnalytics
        ? Object.entries(companyAnalytics.ratingDistribution || {}).map(([rating, count]) => ({
            rating,
            count: Number(count || 0)
        }))
        : [];

    const trendChartData = companyAnalytics
        ? (companyAnalytics.trend || []).map((point) => ({
            label: point.bucket ? format(new Date(point.bucket), 'MMM yy') : 'N/A',
            count: Number(point.count || 0)
        }))
        : [];

    const reviewerBreakdown = companyAnalytics
        ? [
            { name: 'Employee', value: Number(companyAnalytics.employeeVsAnonymous?.employee || 0) },
            { name: 'Anonymous', value: Number(companyAnalytics.employeeVsAnonymous?.anonymous || 0) }
        ]
        : [];

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

    useEffect(() => {
        if (user?.role === 'business' && selectedCompanyId) {
            fetchSelectedCompanyProfile(selectedCompanyId);
            fetchBusinessReviews(selectedCompanyId, 1);
            fetchBusinessAnalytics(selectedCompanyId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCompanyId, user?.role]);

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
                if (companiesRes.data?.length) {
                    setSelectedCompanyId((prev) => prev || companiesRes.data[0].id);
                }
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
                const callsRes = await api.get('/psychologists/dashboard/calls').catch(() => ({ data: [] }));
                setRecentCalls(callsRes.data || []);
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
                                                    onClick={() => {
                                                        setSelectedCompanyId(company.id);
                                                        setCompanyPanelTab('reviews');
                                                        setActiveTab('reviews');
                                                    }}
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
                        <div className="business-dashboard-panel">
                            <div className="business-panel-header">
                                <div>
                                    <h3>Business Control Center</h3>
                                    <p>Monitor reviews, insights, and keep your public profile accurate.</p>
                                </div>
                                {myCompanies.length > 0 && (
                                    <div className="business-company-selector">
                                        <label htmlFor="business-company-select">Company</label>
                                        <select
                                            id="business-company-select"
                                            value={selectedCompanyId || ''}
                                            onChange={(e) => setSelectedCompanyId(e.target.value || null)}
                                        >
                                            <option value="" disabled>
                                                Choose a company
                                            </option>
                                            {myCompanies.map((company) => (
                                                <option key={company.id} value={company.id}>
                                                    {company.name}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-small"
                                            onClick={refreshBusinessSections}
                                            disabled={!selectedCompanyId || reviewsLoading || analyticsLoading}
                                        >
                                            Refresh
                                        </button>
                                    </div>
                                )}
                            </div>

                            {businessSectionError && (
                                <div className="alert alert-error">{businessSectionError}</div>
                            )}

                            {(!myCompanies || myCompanies.length === 0) ? (
                                <p className="empty-message">
                                    You don't have any companies yet.{' '}
                                    <a href="/search">Search for your profile</a> to claim it.
                                </p>
                            ) : (
                                <>
                                    <div className="business-panel-tabs">
                                        <button
                                            className={`business-panel-tab ${companyPanelTab === 'reviews' ? 'active' : ''}`}
                                            onClick={() => setCompanyPanelTab('reviews')}
                                        >
                                            Reviews
                                        </button>
                                        <button
                                            className={`business-panel-tab ${companyPanelTab === 'analytics' ? 'active' : ''}`}
                                            onClick={() => setCompanyPanelTab('analytics')}
                                        >
                                            Analytics
                                        </button>
                                        <button
                                            className={`business-panel-tab ${companyPanelTab === 'edit' ? 'active' : ''}`}
                                            onClick={() => setCompanyPanelTab('edit')}
                                        >
                                            Edit Info
                                        </button>
                                    </div>

                                    <div className="business-panel-body">
                                        {companyPanelTab === 'reviews' && (
                                            <div className="business-reviews-panel">
                                                {reviewsLoading ? (
                                                    <Loading />
                                                ) : companyReviews.length > 0 ? (
                                                    <>
                                                        {companyReviewPagination.lastViewedAt && (
                                                            <p className="business-last-seen">
                                                                Last checked{' '}
                                                                {new Date(companyReviewPagination.lastViewedAt).toLocaleString()}
                                                            </p>
                                                        )}
                                                        {companyReviews.map((review) => (
                                                            <ReviewCard
                                                                key={review.id}
                                                                review={review}
                                                                onReplyAdded={() =>
                                                                    fetchBusinessReviews(
                                                                        selectedCompanyId,
                                                                        companyReviewPagination.page || 1
                                                                    )
                                                                }
                                                                replyEndpoint={
                                                                    selectedCompanyId
                                                                        ? `/business/${selectedCompanyId}/review/${review.id}/reply`
                                                                        : undefined
                                                                }
                                                            />
                                                        ))}
                                                        <div className="business-pagination">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleBusinessReviewPageChange(-1)}
                                                                disabled={
                                                                    (companyReviewPagination.page || 1) <= 1 || reviewsLoading
                                                                }
                                                            >
                                                                Previous
                                                            </button>
                                                            <span>
                                                                Page {companyReviewPagination.page || 1} of{' '}
                                                                {companyReviewPagination.pages || 1}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleBusinessReviewPageChange(1)}
                                                                disabled={
                                                                    (companyReviewPagination.page || 1) >=
                                                                        (companyReviewPagination.pages || 1) || reviewsLoading
                                                                }
                                                            >
                                                                Next
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <p className="empty-message">No reviews yet.</p>
                                                )}
                                            </div>
                                        )}

                                        {companyPanelTab === 'analytics' && (
                                            <div className="business-analytics-panel">
                                                {analyticsLoading ? (
                                                    <Loading />
                                                ) : companyAnalytics ? (
                                                    <>
                                                        <div className="business-analytics-cards">
                                                            <div className="analytics-card">
                                                                <p>Average rating</p>
                                                                <strong>{companyAnalytics.averageRating}</strong>
                                                            </div>
                                                            <div className="analytics-card">
                                                                <p>Total reviews</p>
                                                                <strong>{companyAnalytics.totalReviews}</strong>
                                                            </div>
                                                            <div className="analytics-card">
                                                                <p>Response rate</p>
                                                                <strong>{(companyAnalytics.responseRate * 100).toFixed(0)}%</strong>
                                                            </div>
                                                        </div>

                                                        <div className="business-analytics-grid">
                                                            <div className="analytics-chart">
                                                                <h4>Rating distribution</h4>
                                                                <ResponsiveContainer width="100%" height={220}>
                                                                    <BarChart data={ratingChartData}>
                                                                        <CartesianGrid strokeDasharray="3 3" />
                                                                        <XAxis dataKey="rating" />
                                                                        <YAxis allowDecimals={false} />
                                                                        <Tooltip />
                                                                        <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                                                                    </BarChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                            <div className="analytics-chart">
                                                                <h4>Anonymous vs employee</h4>
                                                                <ResponsiveContainer width="100%" height={220}>
                                                                    <PieChart>
                                                                        <Pie
                                                                            data={reviewerBreakdown}
                                                                            dataKey="value"
                                                                            nameKey="name"
                                                                            innerRadius={50}
                                                                            outerRadius={80}
                                                                            paddingAngle={2}
                                                                        >
                                                                            {reviewerBreakdown.map((entry, index) => (
                                                                                <Cell
                                                                                    key={`cell-${entry.name}`}
                                                                                    fill={BUSINESS_PIE_COLORS[index % BUSINESS_PIE_COLORS.length]}
                                                                                />
                                                                            ))}
                                                                        </Pie>
                                                                        <Tooltip />
                                                                    </PieChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        </div>

                                                        <div className="analytics-chart">
                                                            <h4>Review volume</h4>
                                                            <ResponsiveContainer width="100%" height={260}>
                                                                <LineChart data={trendChartData}>
                                                                    <CartesianGrid strokeDasharray="3 3" />
                                                                    <XAxis dataKey="label" />
                                                                    <YAxis allowDecimals={false} />
                                                                    <Tooltip />
                                                                    <Line
                                                                        type="monotone"
                                                                        dataKey="count"
                                                                        stroke="#0ea5e9"
                                                                        strokeWidth={2}
                                                                    />
                                                                </LineChart>
                                                            </ResponsiveContainer>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <p className="empty-message">Analytics will appear once reviews start rolling in.</p>
                                                )}
                                            </div>
                                        )}

                                        {companyPanelTab === 'edit' && selectedCompany && (
                                            <form className="business-edit-panel" onSubmit={handleCompanyInfoSubmit}>
                                                <div className="form-grid-two">
                                                    <label>
                                                        Public phone
                                                        <input
                                                            type="text"
                                                            value={editCompanyForm.phone}
                                                            onChange={(e) => handleCompanyInfoChange('phone', e.target.value)}
                                                            placeholder="+1 555 123 4567"
                                                        />
                                                    </label>
                                                    <label>
                                                        Public email
                                                        <input
                                                            type="email"
                                                            value={editCompanyForm.email}
                                                            onChange={(e) => handleCompanyInfoChange('email', e.target.value)}
                                                            placeholder="press@company.com"
                                                        />
                                                    </label>
                                                    <label>
                                                        Street address
                                                        <input
                                                            type="text"
                                                            value={editCompanyForm.address}
                                                            onChange={(e) => handleCompanyInfoChange('address', e.target.value)}
                                                            placeholder="123 Main Road"
                                                        />
                                                    </label>
                                                    <label>
                                                        City
                                                        <input
                                                            type="text"
                                                            value={editCompanyForm.city}
                                                            onChange={(e) => handleCompanyInfoChange('city', e.target.value)}
                                                            placeholder="Johannesburg"
                                                        />
                                                    </label>
                                                    <label>
                                                        Country
                                                        <input
                                                            type="text"
                                                            value={editCompanyForm.country}
                                                            onChange={(e) => handleCompanyInfoChange('country', e.target.value)}
                                                            placeholder="South Africa"
                                                        />
                                                    </label>
                                                    <label>
                                                        Logo URL
                                                        <input
                                                            type="url"
                                                            value={editCompanyForm.logo_url}
                                                            onChange={(e) => handleCompanyInfoChange('logo_url', e.target.value)}
                                                            placeholder="https://example.com/logo.png"
                                                        />
                                                    </label>
                                                </div>
                                                {companyInfoMessage && (
                                                    <p className="form-hint">{companyInfoMessage}</p>
                                                )}
                                                <div className="business-edit-actions">
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary"
                                                        onClick={handleScrapeMissingInfo}
                                                        disabled={companyInfoSaving || !selectedCompany?.website}
                                                    >
                                                        {selectedCompany?.website ? 'Auto-fill from website' : 'Add a website to enable auto-fill'}
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        className="btn btn-primary"
                                                        disabled={companyInfoSaving}
                                                    >
                                                        {companyInfoSaving ? 'Saving...' : 'Save changes'}
                                                    </button>
                                                </div>
                                            </form>
                                        )}
                                    </div>
                                </>
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
                            <section className="psych-card psych-card--schedule">
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

                            <section className="psych-card psych-card--compact">
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

                            <section className="psych-card psych-card--compact">
                                <header className="psych-card__header">
                                    <div>
                                        <h3><FaVideo /> Recent Calls</h3>
                                        <p>Previous voice/video sessions with employees.</p>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-outline btn-small psych-card__toggle"
                                        onClick={() => togglePsychCard('calls')}
                                        aria-label={psychCardCollapse.calls ? 'Maximize recent calls card' : 'Minimize recent calls card'}
                                    >
                                        {psychCardCollapse.calls ? <FaChevronDown /> : <FaChevronUp />}
                                        {psychCardCollapse.calls ? 'Maximize' : 'Minimize'}
                                    </button>
                                </header>
                                {!psychCardCollapse.calls && (
                                    <div className="psych-card__body">
                                        {recentCalls.length === 0 ? (
                                            <p className="empty-message">No previous calls yet.</p>
                                        ) : (
                                            <div className="psych-call-summary">
                                                {recentCalls.map((call) => (
                                                    <div key={call.id} className="psych-call-row">
                                                        <strong>{call.employee_name || 'Employee'}</strong>
                                                        <span>{call.media_type || 'call'}</span>
                                                        <span>{formatDuration(call.duration_seconds)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
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
