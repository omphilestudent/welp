// frontend/src/pages/Messages.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import socketService from '../services/socket';
import ConversationList from '../components/messages/ConversationList';
import MessageThread from '../components/messages/MessageThread';
import Loading from '../components/common/Loading';

const Messages = () => {
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sendingMessage, setSendingMessage] = useState(false);

    useEffect(() => {
        fetchConversations();
    }, []);

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
            // Connect to socket
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
            setConversations(data);
        } catch (error) {
            console.error('Failed to fetch conversations:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async (conversationId) => {
        try {
            const { data } = await api.get(`/messages/conversations/${conversationId}/messages`);
            setMessages(data);
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

            // Message will be added via socket
            setMessages(prev => [...prev, {
                id: Date.now(), // temporary ID
                content,
                sender_id: user.id,
                created_at: new Date().toISOString(),
                sender: {
                    id: user.id,
                    displayName: user.displayName,
                    role: user.role
                }
            }]);
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setSendingMessage(false);
        }
    };

    if (loading) return <Loading />;

    return (
        <div className="messages-page">
            <div className="messages-container">
                {/* Sidebar */}
                <div className="messages-sidebar">
                    <div className="sidebar-header">
                        <h2>Messages</h2>
                        {user.role === 'psychologist' && (
                            <button className="btn btn-primary btn-small">
                                New Message
                            </button>
                        )}
                    </div>
                    <ConversationList
                        conversations={conversations}
                        activeId={activeConversation?.id}
                        onSelect={handleSelectConversation}
                    />
                </div>

                {/* Main Chat Area */}
                <div className="messages-main">
                    <MessageThread
                        conversation={activeConversation}
                        messages={messages}
                        onSendMessage={handleSendMessage}
                    />
                </div>
            </div>
        </div>
    );
};

export default Messages;