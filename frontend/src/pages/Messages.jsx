
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import socketService from '../services/socket';
import ConversationList from '../components/messages/ConversationList';
import MessageThread from '../components/messages/MessageThread';
import Loading from '../components/common/Loading';
import toast from 'react-hot-toast';
import { FaSearch, FaStar, FaUserPlus } from 'react-icons/fa';

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

    useEffect(() => {
        fetchConversations();
    }, []);

    useEffect(() => {
        if (user?.role === 'psychologist') {
            fetchPsychologistSidebar();
        }
    }, [user]);

    useEffect(() => {
        const conversationId = searchParams.get('conversation');
        if (conversationId && conversations.length > 0) {
            const found = conversations.find(c => c.id === conversationId);
            if (found) {
                setActiveConversation(found);
                fetchMessages(found.id);
            }
        }
    }, [searchParams, conversations]);

    useEffect(() => {
        if (user) {
            const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
            if (token) {
                socketService.connect(token);
            }

            return () => {
                socketService.disconnect();
            };
        }
    }, [user]);

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

    const fetchMessages = async (conversationId) => {
        try {
            const { data } = await api.get(`/messages/conversations/${conversationId}/messages`);
            setMessages(data || []);
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        }
    };

    const handleSelectConversation = (conversation) => {
        setActiveConversation(conversation);
        fetchMessages(conversation.id);
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
                        conversations={conversations}
                        activeId={activeConversation?.id}
                        onSelect={handleSelectConversation}
                    />
                </div>

                <div className="messages-main">
                    <MessageThread
                        conversation={activeConversation}
                        messages={messages}
                        callConfig={psychPermissions}
                        onSendMessage={handleSendMessage}
                    />
                </div>
            </div>
        </div>
    );
};

export default Messages;
