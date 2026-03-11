
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import socketService from '../services/socket';
import ConversationList from '../components/messages/ConversationList';
import MessageThread from '../components/messages/MessageThread';
import Loading from '../components/common/Loading';
import toast from 'react-hot-toast';
import { FaSearch, FaStar, FaUserPlus, FaVideo, FaHistory, FaClock, FaExclamationTriangle } from 'react-icons/fa';

const Messages = () => {
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sendingMessage, setSendingMessage] = useState(false);
    const [psychLeads, setPsychLeads] = useState([]);
    const [psychFavorites, setPsychFavorites] = useState([]);
    const [employeeQuery, setEmployeeQuery] = useState('');
    const [employeeResults, setEmployeeResults] = useState([]);
    const [psychPermissions, setPsychPermissions] = useState(null);
    const [availablePsychologists, setAvailablePsychologists] = useState([]);
    const [subscription, setSubscription] = useState(null);
    const [isRequestingSupport, setIsRequestingSupport] = useState(false);
    const formatList = (value) => {
        if (!value) return '';
        if (Array.isArray(value)) {
            return value.filter(Boolean).join(', ');
        }
        return String(value);
    };
    const subscriptionPlan = subscription?.plan_type || 'free';
    const isFreeEmployee = user?.role === 'employee' && subscriptionPlan === 'free';

    const sortedConversations = useMemo(() => {
        return [...conversations].sort((a, b) => {
            const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
            const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
            return bTime - aTime;
        });
    }, [conversations]);

    const prioritizedConversations = useMemo(() => {
        return sortedConversations.filter((conversation) => ['accepted', 'pending'].includes(conversation.status));
    }, [sortedConversations]);

    const archivedConversations = useMemo(() => {
        return sortedConversations.filter((conversation) => !['accepted', 'pending'].includes(conversation.status));
    }, [sortedConversations]);

    const visibleConversations = useMemo(() => {
        return [...prioritizedConversations, ...archivedConversations];
    }, [prioritizedConversations, archivedConversations]);
    const featuredPsychologist = availablePsychologists[0];
    const featuredSpecialization = formatList(
        featuredPsychologist?.specialization ||
        featuredPsychologist?.specializations
    );
    const featuredLanguages = formatList(
        featuredPsychologist?.languages ||
        featuredPsychologist?.language
    );
    const currentPsychologist = activeConversation?.psychologist;
    const currentSpecialization = formatList(
        currentPsychologist?.specialization ||
        currentPsychologist?.specializations
    );
    const lastMessageAuthorId = activeConversation?.last_message?.senderId;
    const hasResponse = currentPsychologist && lastMessageAuthorId === currentPsychologist.id;
    const expiresAt = activeConversation?.expires_at ? new Date(activeConversation.expires_at) : null;
    const timeRemainingMs = expiresAt ? expiresAt.getTime() - Date.now() : null;
    const isConversationExpired = activeConversation?.status === 'ended' || (timeRemainingMs != null && timeRemainingMs <= 0);
    const timeLabel = formatTimeRemaining(timeRemainingMs);
    const sessionLimitMinutes = Math.max(1, Number(activeConversation?.time_limit_minutes ?? 120));
    const sessionLimitMs = sessionLimitMinutes * 60 * 1000;
    const sessionProgress = timeRemainingMs != null
        ? Math.max(0, Math.min(100, 100 - (timeRemainingMs / sessionLimitMs) * 100))
        : 0;
    const timeWarningThresholdMs = 12 * 60 * 1000;
    const showTimeWarning = user?.role === 'employee' && timeRemainingMs != null && timeRemainingMs > 0 && timeRemainingMs <= timeWarningThresholdMs;
    const showUpgradeReminder = user?.role === 'employee' && (isConversationExpired || showTimeWarning);
    const autoDeleteNote = user?.role === 'employee'
        ? 'Free sessions last two hours and delete automatically once the timer runs out.'
        : 'Sessions respect your subscription limits.';
    const canRequestSupport = user?.role === 'employee' && visibleConversations.length === 0 && !!featuredPsychologist;
    const canStartVideoCall = Boolean(activeConversation) && !isConversationExpired;

    const fetchConversations = async () => {
        try {
            const { data } = await api.get('/messages/conversations');
            setConversations(data || []);
        } catch (error) {
            setError('Failed to load conversations');
            console.error('Failed to fetch conversations:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPsychologistSidebar = async () => {
        try {
            const [leadsRes, favoritesRes, permissionsRes] = await Promise.all([
                api.get('/psychologists/dashboard/leads').catch(() => ({ data: [] })),
                api.get('/psychologists/dashboard/favorites').catch(() => ({ data: [] })),
                api.get('/psychologists/dashboard/permissions').catch(() => ({ data: null }))
            ]);
            setPsychLeads(leadsRes.data || []);
            setPsychFavorites(favoritesRes.data || []);
            setPsychPermissions(permissionsRes.data || null);
        } catch (err) {
            console.error('Failed to load psychologist sidebar', err);
        }
    };

    const fetchSubscription = async () => {
        try {
            const { data } = await api.get('/subscriptions/me');
            setSubscription(data);
        } catch (err) {
            console.error('Failed to load subscription', err);
        }
    };

    const fetchAvailablePsychologists = async () => {
        try {
            const { data } = await api.get('/messages/available-psychologists');
            setAvailablePsychologists(data || []);
        } catch (err) {
            console.error('Failed to load psychologists', err);
        }
    };

    const fetchMessages = useCallback(async (conversationId) => {
        try {
            const { data } = await api.get(`/messages/conversations/${conversationId}/messages`);
            setMessages(data || []);
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        }
    }, []);

    useEffect(() => {
        fetchConversations();
    }, []);

    useEffect(() => {
        if (user?.role === 'psychologist') {
            fetchPsychologistSidebar();
        }
    }, [user]);

    useEffect(() => {
        if (user?.role === 'employee') {
            fetchSubscription();
            fetchAvailablePsychologists();
        }
    }, [user]);

    useEffect(() => {
        const conversationId = searchParams.get('conversation');
        if (conversationId && visibleConversations.length > 0) {
            const found = visibleConversations.find(c => c.id === conversationId);
            if (found) {
                setActiveConversation(found);
                fetchMessages(found.id);
            }
        }
    }, [searchParams, visibleConversations, fetchMessages]);

    useEffect(() => {
        if (visibleConversations.length === 0) {
            setActiveConversation(null);
            setMessages([]);
            return;
        }

        if (!activeConversation || !visibleConversations.some(c => c.id === activeConversation.id)) {
            setActiveConversation(visibleConversations[0]);
        }
    }, [visibleConversations, activeConversation]);

    useEffect(() => {
        if (activeConversation) {
            fetchMessages(activeConversation.id);
        } else {
            setMessages([]);
        }
    }, [activeConversation, fetchMessages]);

    useEffect(() => {
        if (user) {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (token) {
                socketService.connect(token);
            }

            return () => {
                socketService.disconnect();
            };
        }
    }, [user]);

    const handleRequestPsychologist = async (psychologist) => {
        if (!psychologist) return;
        setIsRequestingSupport(true);
        try {
            await api.post('/messages/request-chat', {
                psychologistId: psychologist.id,
                initialMessage: 'Hi, I am looking for confidential support when you are free.'
            });
            toast.success('Request sent. The psychologist will reach out shortly.');
            fetchConversations();
        } catch (err) {
            toast.error(err?.response?.data?.error || 'Failed to request support');
        } finally {
            setIsRequestingSupport(false);
        }
    };

    const handleVideoCall = () => {
        if (!activeConversation || !currentPsychologist) {
            toast.error('No active psychologist yet.');
            return;
        }

        if (isConversationExpired) {
            toast('This session has ended. Upgrade to premium to keep chatting longer.');
            return;
        }

        toast('Video call setup is in progress — a link will be emailed shortly.');
    };

    const handleViewHistory = () => {
        if (!activeConversation) return;
        fetchMessages(activeConversation.id);
        toast('Refreshing message history...');
    };

    function formatTimeRemaining(milliseconds) {
        if (milliseconds == null) return 'No timer';
        if (milliseconds <= 0) return 'Expired';
        const totalMinutes = Math.floor(milliseconds / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours > 0) {
            return `${hours}h ${minutes}m remaining`;
        }
        return `${minutes}m remaining`;
    }


    const handleSelectConversation = (conversation) => {
        setActiveConversation(conversation);
    };

    const handleSendMessage = async (content) => {
        if (!activeConversation) return;

        setSendingMessage(true);
        try {
            await api.post(`/messages/conversations/${activeConversation.id}/messages`, {
                content
            });
        } catch (error) {
            throw error;
        } finally {
            setSendingMessage(false);
        }
    };

    const handleEmployeeSearch = async (value) => {
        setEmployeeQuery(value);
        if (!value || value.trim().length < 2) {
            setEmployeeResults([]);
            return;
        }
        try {
            const { data } = await api.get('/psychologists/dashboard/employees/search', {
                params: { q: value.trim() }
            });
            setEmployeeResults(data || []);
        } catch (err) {
            console.error('Employee search failed', err);
        }
    };

    const handleStartConversation = async (employeeId) => {
        try {
            await api.post('/messages/conversations/request', {
                employeeId,
                initialMessage: 'Hello, I am available to support you whenever you are ready to talk.'
            });
            toast.success('Message request sent');
        } catch (err) {
            toast.error(err?.response?.data?.error || 'Failed to send request');
        }
    };

    const handleLeadMessage = async (leadId) => {
        try {
            await api.post(`/psychologists/dashboard/leads/${leadId}/message`, {
                message: 'Hello, I noticed you may need support. Let me know if you would like to talk.'
            });
            toast.success('Lead message queued');
        } catch (err) {
            toast.error('Failed to message lead');
        }
    };

    const handleFavoriteAdd = async (employee) => {
        try {
            const { data } = await api.post('/psychologists/dashboard/favorites', {
                employeeId: employee.id,
                displayName: employee.display_name || employee.displayName,
                notes: 'Connected via messages'
            });
            setPsychFavorites((prev) => [data, ...prev]);
            toast.success('Added to favorites');
        } catch (err) {
            toast.error('Failed to add favorite');
        }
    };

    const handleFavoriteRemove = async (favoriteId) => {
        try {
            await api.delete(`/psychologists/dashboard/favorites/${favoriteId}`);
            setPsychFavorites((prev) => prev.filter((item) => item.id !== favoriteId));
        } catch (err) {
            toast.error('Failed to remove favorite');
        }
    };

    if (loading) return <Loading />;

    return (
        <div className="messages-page">
            {error && <div className="alert alert-error">{error}</div>}
            <div className="messages-container">
                <div className="messages-sidebar">
                    <div className="sidebar-header">
                        <h2>Messages</h2>
                    </div>
                    {user?.role === 'psychologist' && (
                        <div className="psych-sidebar">
                            <div className="psych-search">
                                <label>Search employees</label>
                                <div className="psych-search-input">
                                    <FaSearch />
                                    <input
                                        type="text"
                                        placeholder="Type a name"
                                        value={employeeQuery}
                                        onChange={(e) => handleEmployeeSearch(e.target.value)}
                                    />
                                </div>
                                {employeeResults.length > 0 && (
                                    <div className="psych-search-results">
                                        {employeeResults.map((employee) => (
                                            <div key={employee.id} className="psych-search-item">
                                                <div>
                                                    <strong>{employee.display_name}</strong>
                                                    <span>{employee.occupation || 'Employee'}</span>
                                                </div>
                                                <div className="psych-search-actions">
                                                    <button
                                                        className="btn btn-outline btn-small"
                                                        onClick={() => handleStartConversation(employee.id)}
                                                    >
                                                        <FaUserPlus /> Request
                                                    </button>
                                                    <button
                                                        className="btn btn-secondary btn-small"
                                                        onClick={() => handleFavoriteAdd(employee)}
                                                    >
                                                        <FaStar /> Favorite
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="psych-sidebar-section">
                                <h3>Leads</h3>
                                {psychLeads.length > 0 ? (
                                    psychLeads.map((lead) => (
                                        <div key={lead.id} className="psych-lead-row">
                                            <div>
                                                <strong>{lead.display_name}</strong>
                                                <span>{lead.summary}</span>
                                            </div>
                                            <button
                                                className="btn btn-outline btn-small"
                                                onClick={() => handleLeadMessage(lead.id)}
                                            >
                                                Message
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="psych-empty">No leads yet.</p>
                                )}
                            </div>

                            <div className="psych-sidebar-section">
                                <h3>Favorites</h3>
                                {psychFavorites.length > 0 ? (
                                    psychFavorites.map((favorite) => (
                                        <div key={favorite.id} className="psych-favorite-row">
                                            <div>
                                                <strong>{favorite.display_name}</strong>
                                                <span>{favorite.notes || 'Connected client'}</span>
                                            </div>
                                            <button
                                                className="btn btn-secondary btn-small"
                                                onClick={() => handleFavoriteRemove(favorite.id)}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="psych-empty">No favorites saved.</p>
                                )}
                            </div>
                        </div>
                    )}
                    <ConversationList
                        conversations={visibleConversations}
                        activeId={activeConversation?.id}
                        onSelect={handleSelectConversation}
                    />
                </div>

                <div className="messages-main">
                    {user?.role === 'employee' && (
                        <div className="employee-support-panel">
                            <section className="available-psych-card">
                                <div className="available-psych-card__header">
                                    <span>Available psychologist</span>
                                    <span className="available-psych-card__tier">
                                        {subscriptionPlan === 'premium' ? 'Premium access' : 'Free tier'}
                                    </span>
                                </div>
                                {featuredPsychologist ? (
                                    <>
                                        <h3>{featuredPsychologist.display_name}</h3>
                                        {featuredSpecialization ? (
                                            <p className="available-psych-card__role">{featuredSpecialization}</p>
                                        ) : (
                                            <p className="available-psych-card__role">Certified therapists standing by</p>
                                        )}
                                        {(featuredPsychologist.years_of_experience || featuredLanguages) && (
                                            <p className="available-psych-card__meta">
                                                {featuredPsychologist.years_of_experience
                                                    ? `${featuredPsychologist.years_of_experience} years experience`
                                                    : ''}
                                                {featuredPsychologist.years_of_experience && featuredLanguages ? ' • ' : ''}
                                                {featuredLanguages}
                                            </p>
                                        )}
                                        <p className="available-psych-card__note">
                                            {featuredPsychologist.biography
                                                || 'Private support from licensed practitioners is available for every request.'}
                                        </p>
                                    </>
                                ) : (
                                    <p className="available-psych-card__note">
                                        No psychologist recommended yet.
                                    </p>
                                )}
                                <div className="available-psych-card__actions">
                                    <button
                                        className="btn btn-primary btn-small"
                                        onClick={() => handleRequestPsychologist(featuredPsychologist)}
                                        disabled={!canRequestSupport || isRequestingSupport || !featuredPsychologist}
                                    >
                                        {isRequestingSupport ? 'Requesting...' : 'Request private support'}
                                    </button>
                                    {featuredPsychologist?.website && (
                                        <a
                                            href={featuredPsychologist.website}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="btn btn-outline btn-small"
                                        >
                                            View profile
                                        </a>
                                    )}
                                </div>
                                <p className="available-psych-card__note available-psych-card__note--muted">
                                    Free employees are limited to one psychologist at a time. {autoDeleteNote}
                                </p>
                            </section>

                            <section className="conversation-status-card">
                                <div className="conversation-status-header">
                                    <div>
                                        <p className="status-label">Current Psychologist</p>
                                        <h4>{currentPsychologist?.display_name || 'Awaiting support'}</h4>
                                        {currentSpecialization && (
                                            <p className="conversation-status-subtitle">{currentSpecialization}</p>
                                        )}
                                    </div>
                                    <span className={`status-badge ${isConversationExpired ? 'warning' : 'active'}`}>
                                        {isConversationExpired ? 'Session ended' : 'Active'}
                                    </span>
                                </div>
                                <div className="conversation-status-line">
                                    <FaClock /> {timeLabel}
                                </div>
                                <div className="conversation-progress">
                                    <div className="progress-track">
                                        <div className="progress-fill" style={{ width: `${sessionProgress}%` }} />
                                    </div>
                                    <p className="progress-text">
                                        {sessionLimitMinutes} minute limit • Auto-deletes when time runs out
                                    </p>
                                </div>
                                <div className="conversation-status-line">
                                    {hasResponse ? 'Psychologist has replied' : 'Waiting for a reply'}
                                </div>
                                <div className="conversation-status-actions">
                                    <button
                                        className="btn btn-outline btn-small"
                                        onClick={handleVideoCall}
                                        disabled={!canStartVideoCall}
                                    >
                                        <FaVideo /> Setup video call
                                    </button>
                                    <button
                                        className="btn btn-secondary btn-small"
                                        onClick={handleViewHistory}
                                        disabled={!activeConversation}
                                    >
                                        <FaHistory /> View message history
                                    </button>
                                </div>
                                {showUpgradeReminder && (
                                    <div className="upgrade-reminder">
                                        <FaExclamationTriangle />
                                        <span>
                                            {isConversationExpired
                                                ? 'Upgrade to premium to keep conversations alive longer and preserve history.'
                                                : 'Time is running out on the free plan. Upgrade to extend the session.'}
                                        </span>
                                    </div>
                                )}
                            </section>
                        </div>
                    )}

                    <MessageThread
                        conversation={activeConversation}
                        messages={messages}
                        callConfig={psychPermissions}
                        isExpired={isConversationExpired}
                        timeRemainingLabel={timeLabel}
                        onSendMessage={handleSendMessage}
                    />
                </div>
            </div>
        </div>
    );
};

export default Messages;
