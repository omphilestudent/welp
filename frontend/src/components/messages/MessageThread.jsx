
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
    onSendVoiceNote,
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
    const [recordingError, setRecordingError] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [recordDuration, setRecordDuration] = useState(0);
    const [voiceNote, setVoiceNote] = useState(null);
    const [autoSendOnStop, setAutoSendOnStop] = useState(false);
    const messagesEndRef = useRef(null);
    const threadRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const isNearBottomRef = useRef(true);
    const recorderRef = useRef(null);
    const recordTimerRef = useRef(null);
    const recordStreamRef = useRef(null);

    useEffect(() => {
        setMessages(initialMessages || []);
    }, [initialMessages]);

    useEffect(() => {
        return () => {
            if (voiceNote?.url) {
                URL.revokeObjectURL(voiceNote.url);
            }
        };
    }, [voiceNote]);

    useEffect(() => {
        return () => {
            if (recorderRef.current) {
                recorderRef.current.stop();
                recorderRef.current = null;
            }
            if (recordStreamRef.current) {
                recordStreamRef.current.getTracks().forEach((track) => track.stop());
                recordStreamRef.current = null;
            }
            if (recordTimerRef.current) {
                clearInterval(recordTimerRef.current);
                recordTimerRef.current = null;
            }
        };
    }, []);

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

    const sendVoiceNoteBlob = async ({ blob, mimeType, duration }) => {
        if (!blob || !onSendVoiceNote) return;
        setSending(true);
        setError('');
        try {
            const file = new File([blob], 'voice-note.webm', { type: mimeType || 'audio/webm' });
            await onSendVoiceNote({ file, duration });
            setVoiceNote(null);
            setRecordDuration(0);
        } catch (err) {
            setError('Failed to send voice note');
        } finally {
            setSending(false);
        }
    };

    const startRecording = async () => {
        setRecordingError('');
        setVoiceNote(null);
        try {
            if (typeof MediaRecorder === 'undefined') {
                setRecordingError('Voice notes are not supported in this browser.');
                return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            recordStreamRef.current = stream;
            const recorder = new MediaRecorder(stream);
            const chunks = [];
            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    chunks.push(event.data);
                }
            };
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
                const url = URL.createObjectURL(blob);
                const duration = recordDuration || Math.ceil((Date.now() - recorder.startTime) / 1000) || 1;
                if (autoSendOnStop) {
                    setAutoSendOnStop(false);
                    sendVoiceNoteBlob({ blob, mimeType: recorder.mimeType || blob.type, duration });
                } else {
                    setVoiceNote({
                        blob,
                        url,
                        duration,
                        mimeType: recorder.mimeType || blob.type
                    });
                }
                if (recordStreamRef.current) {
                    recordStreamRef.current.getTracks().forEach((track) => track.stop());
                    recordStreamRef.current = null;
                }
            };
            recorder.start();
            recorder.startTime = Date.now();
            recorderRef.current = recorder;
            setIsRecording(true);
            setRecordDuration(0);
            recordTimerRef.current = setInterval(() => {
                setRecordDuration((prev) => prev + 1);
            }, 1000);
        } catch (err) {
            setRecordingError('Microphone access was denied or unavailable.');
        }
    };

    const stopRecording = () => {
        if (!recorderRef.current) return;
        recorderRef.current.stop();
        recorderRef.current = null;
        setIsRecording(false);
        if (recordTimerRef.current) {
            clearInterval(recordTimerRef.current);
            recordTimerRef.current = null;
        }
        if (recordStreamRef.current) {
            recordStreamRef.current.getTracks().forEach((track) => track.stop());
            recordStreamRef.current = null;
        }
    };

    const cancelRecording = () => {
        if (recorderRef.current) {
            recorderRef.current.stop();
            recorderRef.current = null;
        }
        if (recordStreamRef.current) {
            recordStreamRef.current.getTracks().forEach((track) => track.stop());
            recordStreamRef.current = null;
        }
        if (recordTimerRef.current) {
            clearInterval(recordTimerRef.current);
            recordTimerRef.current = null;
        }
        setIsRecording(false);
        setRecordDuration(0);
        setVoiceNote(null);
    };

    const handleSendVoiceNote = async () => {
        if (!voiceNote?.blob) return;
        await sendVoiceNoteBlob({ blob: voiceNote.blob, mimeType: voiceNote.mimeType, duration: voiceNote.duration });
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
                    Conversations
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
                            Voice Call
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
                            Video Call
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
                    const messageType = message.message_type || message.messageType || 'text';
                    const attachmentUrl = message.attachment_url || message.attachmentUrl;
                    const attachmentDuration = message.attachment_duration || message.attachmentDuration;
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
                                    {messageType === 'voice_note' && attachmentUrl ? (
                                        <div className="message-voice-note">
                                            <audio controls src={attachmentUrl} preload="metadata" />
                                            <div className="message-voice-meta">
                                                <span>Voice note</span>
                                                {attachmentDuration ? (
                                                    <span>{attachmentDuration}s</span>
                                                ) : null}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="message-content">{message.content}</p>
                                    )}
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
                    <div className="message-input-controls">
                        {recordingError && (
                            <span className="message-input-error">{recordingError}</span>
                        )}
                    </div>
                    <div className="message-input-row">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type your message..."
                            className="message-input"
                            disabled={sending || isRecording}
                        />
                        <button
                            type="button"
                            className={`message-mic-btn ${isRecording ? 'recording' : ''}`}
                            onClick={() => {
                                if (isRecording) {
                                    setAutoSendOnStop(true);
                                    stopRecording();
                                } else {
                                    startRecording();
                                }
                            }}
                            disabled={sending}
                            title={isRecording ? `Tap to send (${recordDuration}s)` : 'Record voice note'}
                        >
                            🎤
                        </button>
                        <button
                            type="submit"
                            disabled={!newMessage.trim() || sending}
                            className="btn btn-primary"
                        >
                            {sending ? 'Sending...' : 'Send'}
                        </button>
                    </div>
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
