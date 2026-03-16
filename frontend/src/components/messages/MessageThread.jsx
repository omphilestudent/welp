
import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import socketService from '../../services/socket';
import api from '../../services/api';

const MessageThread = ({
    conversation,
    messages: initialMessages,
    onSendMessage,
    callConfig,
    isExpired,
    timeRemainingLabel,
    sessionLimitMinutes = 30,
    onStartVoiceCall,
    onStartVideoCall,
    onOpenSidebar,
    callDisabled = false,
    callDisabledReason = ''
}) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [messages, setMessages] = useState(initialMessages || []);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const messagesEndRef = useRef(null);
    const threadRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const isNearBottomRef = useRef(true);

    useEffect(() => {
        setMessages(initialMessages || []);
    }, [initialMessages]);

    useEffect(() => {
        const lastMessage = messages[messages.length - 1];
        const isOwnMessage = lastMessage?.sender_id === user?.id;
        if (isNearBottomRef.current || isOwnMessage) {
            scrollToBottom();
        }
    }, [messages, user]);

    useEffect(() => {
        if (conversation) {
            socketService.joinConversation(conversation.id);

            const handleNewMessage = (message) => {
                setMessages(prev => {
                    if (prev.some((item) => item.id === message.id)) {
                        return prev;
                    }
                    return [...prev, message];
                });
            };

            socketService.onNewMessage(handleNewMessage);

            return () => {
                socketService.leaveConversation(conversation.id);
                socketService.offNewMessage();
            };
        }
    }, [conversation]);

    const scrollToBottom = () => {
        const container = messagesContainerRef.current;
        if (!container) return;
        container.scrollTop = container.scrollHeight;
    };

    const handleScroll = () => {
        const container = messagesContainerRef.current;
        if (!container) return;
        const threshold = 80;
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        isNearBottomRef.current = distanceFromBottom < threshold;
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;

        setSending(true);
        setError('');
        try {
            await onSendMessage(newMessage);
            setNewMessage('');
        } catch (error) {
            setError('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    const handleAcceptRequest = async () => {
        try {
            await api.patch(`/messages/conversations/${conversation.id}/status`, {
                status: 'accepted'
            });
            window.location.reload();
        } catch (error) {
            setError('Failed to accept request');
        }
    };

    const handleRejectRequest = async () => {
        try {
            await api.patch(`/messages/conversations/${conversation.id}/status`, {
                status: 'rejected'
            });
            window.location.reload();
        } catch (error) {
            setError('Failed to reject request');
        }
    };

    const getOtherParticipant = () => {
        if (!conversation) return null;
        if (conversation.employee?.id === user?.id) {
            return conversation.psychologist;
        }
        return conversation.employee;
    };

    if (!conversation) {
        return (
            <div className="message-thread-placeholder">
                <p>Select a conversation to start messaging</p>
            </div>
        );
    }

    const other = getOtherParticipant();
    const canCall = !isExpired && conversation?.status === 'accepted';
    const allowPsychCalls = callConfig?.roleFlags?.voice_video_calls;
    const showCallActions = user?.role === 'psychologist'
        ? Boolean(allowPsychCalls || callConfig)
        : user?.role === 'employee';
    const callLimitText = timeRemainingLabel && timeRemainingLabel !== 'No timer'
        ? `Time left: ${timeRemainingLabel}`
        : `Daily limit: ${sessionLimitMinutes} min`;

    return (
        <div className={`message-thread ${isExpired ? 'is-expired' : ''}`} ref={threadRef}>
            <div className="thread-header">
                <button
                    type="button"
                    className="thread-back-button"
                    onClick={() => onOpenSidebar?.()}
                    aria-label="Open conversations"
                >
                    Back
                </button>
                <div className="thread-participant">
                    <button
                        type="button"
                        className="thread-participant-name"
                        onClick={() => other?.id && navigate(`/users/${other.id}`)}
                    >
                        {other?.display_name || 'Unknown'}
                    </button>
                    {other?.role === 'psychologist' && (
                        <span className="role-badge">
              {other.is_verified ? 'Verified Psychologist' : 'Psychologist'}
            </span>
                    )}
                </div>
                {showCallActions && (
                    <div className="thread-actions">
                        <button
                            className="btn btn-outline btn-small"
                            disabled={callDisabled}
                            title={callDisabled ? callDisabledReason : undefined}
                            onClick={() => {
                                if (callDisabled) return;
                                if (!canCall) {
                                    return onStartVoiceCall?.({ reason: 'pending' });
                                }
                                return onStartVoiceCall?.();
                            }}
                        >
                            Voice
                        </button>
                        <button
                            className="btn btn-outline btn-small"
                            disabled={callDisabled}
                            title={callDisabled ? callDisabledReason : undefined}
                            onClick={() => {
                                if (callDisabled) return;
                                if (!canCall) {
                                    return onStartVideoCall?.({ reason: 'pending' });
                                }
                                return onStartVideoCall?.();
                            }}
                        >
                            Video
                        </button>
                        <span className="thread-call-limit">
                            {callLimitText}
                        </span>
                    </div>
                )}
                {callDisabled && callDisabledReason && (
                    <div
                        className="call-disabled-hint"
                        style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: '0.35rem' }}
                    >
                        {callDisabledReason}
                    </div>
                )}
            </div>

            <div
                className={`messages-thread-container ${isExpired ? 'is-expired' : ''}`}
                ref={messagesContainerRef}
                onScroll={handleScroll}
            >
                {isExpired && (
                    <div className="messages-time-flag">
                        {timeRemainingLabel} • Messages are archived when time expires.
                    </div>
                )}
                {error && <div className="alert alert-error">{error}</div>}

                {messages.map((message, index) => {
                    const isOwn = message.sender_id === user?.id;
                    const showDate = index === 0 ||
                        format(new Date(message.created_at), 'yyyy-MM-dd') !==
                        format(new Date(messages[index - 1].created_at), 'yyyy-MM-dd');

                    return (
                        <React.Fragment key={message.id}>
                            {showDate && (
                                <div className="message-date-divider">
                                    {format(new Date(message.created_at), 'MMMM d, yyyy')}
                                </div>
                            )}
                            <div className={`message-wrapper ${isOwn ? 'own' : 'other'}`}>
                                <div className={`message-bubble ${isOwn ? 'own' : 'other'}`}>
                                    <p className="message-content">{message.content}</p>
                                    <span className="message-time">
                    {format(new Date(message.created_at), 'h:mm a')}
                  </span>
                                </div>
                            </div>
                        </React.Fragment>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {conversation.status === 'accepted' && !isExpired && (
                <form onSubmit={handleSend} className="message-input-form">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="message-input"
                        disabled={sending}
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className="btn btn-primary"
                    >
                        {sending ? 'Sending...' : 'Send'}
                    </button>
                </form>
            )}

            {conversation.status === 'accepted' && isExpired && (
                <div className="pending-message pending-message--expired">
                    <p>Your allocated chat time has ended. Daily minutes reset every midnight.</p>
                </div>
            )}

            {conversation.status === 'pending' && conversation.employee?.id === user?.id && (
                <div className="pending-message">
                    {conversation.last_message?.senderId === user?.id ? (
                        <p>Waiting for the psychologist to accept your request...</p>
                    ) : (
                        <>
                            <p>This conversation request is pending your approval.</p>
                            <div className="pending-actions">
                                <button onClick={handleAcceptRequest} className="btn btn-primary">Accept</button>
                                <button onClick={handleRejectRequest} className="btn btn-secondary">Decline</button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {conversation.status === 'pending' && conversation.psychologist?.id === user?.id && (
                <div className="pending-message">
                    {conversation.last_message?.senderId === user?.id ? (
                        <p>Waiting for the employee to accept your message request...</p>
                    ) : (
                        <>
                            <p>New request from an employee.</p>
                            <div className="pending-actions">
                                <button onClick={handleAcceptRequest} className="btn btn-primary">Accept</button>
                                <button onClick={handleRejectRequest} className="btn btn-secondary">Decline</button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default MessageThread;
