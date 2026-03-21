
import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import socketService from '../../services/socket';
import api from '../../services/api';
import { resolveMediaUrl } from '../../utils/media';
import { FaPhoneAlt, FaVideo, FaChevronLeft } from 'react-icons/fa';

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
    const autoSendRef = useRef(false);
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

    const getAudioDuration = (blob) => new Promise((resolve) => {
        if (!blob) return resolve(null);
        const url = URL.createObjectURL(blob);
        const audio = new Audio();
        audio.preload = 'metadata';
        audio.src = url;
        const cleanup = () => {
            URL.revokeObjectURL(url);
        };
        audio.onloadedmetadata = () => {
            const seconds = Number.isFinite(audio.duration) ? Math.ceil(audio.duration) : null;
            cleanup();
            resolve(seconds && seconds > 0 ? seconds : null);
        };
        audio.onerror = () => {
            cleanup();
            resolve(null);
        };
    });

    const getPreferredMimeType = () => {
        if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
            return null;
        }
        const candidates = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/ogg',
            'audio/mp4'
        ];
        return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || null;
    };

    const getExtensionFromMime = (mime) => {
        if (!mime) return 'webm';
        if (mime.includes('ogg')) return 'ogg';
        if (mime.includes('mp4')) return 'm4a';
        if (mime.includes('mpeg')) return 'mp3';
        return 'webm';
    };

    const sendVoiceNoteBlob = async ({ blob, mimeType, duration }) => {
        if (!blob || !onSendVoiceNote) return;
        setSending(true);
        setError('');
        try {
            const safeMime = mimeType || blob.type || 'audio/webm';
            const extension = getExtensionFromMime(safeMime);
            const file = new File([blob], `voice-note.${extension}`, { type: safeMime });
            let safeDuration = Number.isFinite(duration) ? duration : null;
            if (!safeDuration || safeDuration <= 0) {
                safeDuration = await getAudioDuration(blob);
            }
            await onSendVoiceNote({ file, duration: safeDuration || undefined });
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
            const preferredMime = getPreferredMimeType();
            const recorder = preferredMime ? new MediaRecorder(stream, { mimeType: preferredMime }) : new MediaRecorder(stream);
            const chunks = [];
            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    chunks.push(event.data);
                }
            };
            recorder.onstop = () => {
                if (!chunks.length) {
                    setRecordingError('No audio captured. Please try again.');
                    setIsRecording(false);
                    return;
                }
                const blob = new Blob(chunks, { type: recorder.mimeType || preferredMime || 'audio/webm' });
                const url = URL.createObjectURL(blob);
                const duration = recordDuration || Math.ceil((Date.now() - recorder.startTime) / 1000) || 1;
                if (autoSendRef.current) {
                    autoSendRef.current = false;
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
            <div className="msg-thread-placeholder">
                <p>Select a conversation to start messaging</p>
            </div>
        );
    }

    const other = getOtherParticipant();
    const canCall = conversation?.status === 'accepted' && (user?.role === 'psychologist' || !isExpired);
    const allowPsychCalls = callConfig?.roleFlags?.voice_video_calls;
    const showCallActions = user?.role === 'psychologist'
        ? Boolean(allowPsychCalls || callConfig)
        : user?.role === 'employee';
    const callLimitText = timeRemainingLabel && timeRemainingLabel !== 'No timer'
        ? `Time left: ${timeRemainingLabel}`
        : `Daily limit: ${sessionLimitMinutes} min`;

    return (
        <div className={`msg-thread ${isExpired ? 'is-expired' : ''}`} ref={threadRef}>
            <div className="msg-thread-header">
                <div className="msg-thread-header-left">
                    <button
                        type="button"
                        className="msg-thread-back"
                        onClick={() => onOpenSidebar?.()}
                        aria-label="Open conversations"
                    >
                        <FaChevronLeft />
                    </button>
                    <div className="msg-thread-participant">
                        <button
                            type="button"
                            className="msg-thread-participant-name"
                            onClick={() => other?.id && navigate(`/users/${other.id}`)}
                        >
                            {other?.display_name || 'Unknown'}
                        </button>
                        {other?.role === 'psychologist' && (
                            <span className="msg-role-badge">
                                {other.is_verified ? 'Verified Psychologist' : 'Psychologist'}
                            </span>
                        )}
                    </div>
                </div>
                {showCallActions && (
                    <div className="msg-thread-actions">
                        <button
                            className="msg-thread-action-btn"
                            disabled={callDisabled}
                            title={callDisabled ? callDisabledReason : 'Voice call'}
                            onClick={() => {
                                if (callDisabled) return;
                                if (!canCall) {
                                    return onStartVoiceCall?.({ reason: 'pending' });
                                }
                                return onStartVoiceCall?.();
                            }}
                        >
                            <FaPhoneAlt />
                            <span className="msg-thread-action-label">Voice</span>
                        </button>
                        <button
                            className="msg-thread-action-btn"
                            disabled={callDisabled}
                            title={callDisabled ? callDisabledReason : 'Video call'}
                            onClick={() => {
                                if (callDisabled) return;
                                if (!canCall) {
                                    return onStartVideoCall?.({ reason: 'pending' });
                                }
                                return onStartVideoCall?.();
                            }}
                        >
                            <FaVideo />
                            <span className="msg-thread-action-label">Video</span>
                        </button>
                        <span className="msg-thread-call-limit">
                            {callLimitText}
                        </span>
                    </div>
                )}
            </div>

            <div
                className={`msg-thread-body ${isExpired ? 'is-expired' : ''}`}
                ref={messagesContainerRef}
                onScroll={handleScroll}
            >
                {isExpired && (
                    <div className="msg-time-flag">
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
                                <div className="msg-date-divider">
                                    {format(new Date(message.created_at), 'MMMM d, yyyy')}
                                </div>
                            )}
                            <div className={`msg-wrapper ${isOwn ? 'own' : 'other'}`}>
                                <div className={`msg-bubble ${isOwn ? 'own' : 'other'}`}>
                                    {messageType === 'voice_note' && attachmentUrl ? (
                                        <div className="msg-voice-note">
                                            <audio
                                                controls
                                                preload="metadata"
                                            >
                                                <source
                                                    src={attachmentUrl.startsWith('blob:') ? attachmentUrl : resolveMediaUrl(attachmentUrl)}
                                                    type={message.attachment_mime || message.attachmentMime || undefined}
                                                />
                                            </audio>
                                            <div className="msg-voice-meta">
                                                <span>Voice note</span>
                                                {attachmentDuration ? (
                                                    <span>{attachmentDuration}s</span>
                                                ) : null}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="msg-content">{message.content}</p>
                                    )}
                                    <span className="msg-time">
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
                <form onSubmit={handleSend} className="msg-input-form">
                    <div className="msg-input-controls">
                        {isRecording && (
                            <div className="msg-voice-recording-bar">
                                <span className="msg-voice-recording-dot" />
                                <span className="msg-voice-recording-text">Recording</span>
                                <span className="msg-voice-recording-time">{recordDuration}s</span>
                            </div>
                        )}
                        {recordingError && (
                            <span className="msg-input-error">{recordingError}</span>
                        )}
                    </div>
                    <div className="msg-input-row">
                        <div className="msg-input-wrapper">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type your message..."
                                className="msg-input"
                                disabled={sending || isRecording}
                            />
                        </div>
                        <button
                            type="button"
                            className={`msg-mic-btn ${isRecording ? 'is-recording' : ''}`}
                            onClick={() => {
                                if (isRecording) {
                                    autoSendRef.current = true;
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
                            className="msg-send-btn"
                        >
                            {sending ? 'Sending...' : 'Send'}
                        </button>
                    </div>
                </form>
            )}

            {conversation.status === 'accepted' && isExpired && (
                <div className="msg-pending-message msg-pending-message--expired">
                    <p>Your allocated chat time has ended. Daily minutes reset every midnight.</p>
                </div>
            )}

            {conversation.status === 'pending' && conversation.employee?.id === user?.id && (
                <div className="msg-pending-message">
                    {conversation.last_message?.senderId === user?.id ? (
                        <p>Waiting for the psychologist to accept your request...</p>
                    ) : (
                        <>
                            <p>This conversation request is pending your approval.</p>
                            <div className="msg-pending-actions">
                                <button onClick={handleAcceptRequest} className="msg-btn msg-btn-primary">Accept</button>
                                <button onClick={handleRejectRequest} className="msg-btn msg-btn-secondary">Decline</button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {conversation.status === 'pending' && conversation.psychologist?.id === user?.id && (
                <div className="msg-pending-message">
                    {conversation.last_message?.senderId === user?.id ? (
                        <p>Waiting for the employee to accept your message request...</p>
                    ) : (
                        <>
                            <p>New request from an employee.</p>
                            <div className="msg-pending-actions">
                                <button onClick={handleAcceptRequest} className="msg-btn msg-btn-primary">Accept</button>
                                <button onClick={handleRejectRequest} className="msg-btn msg-btn-secondary">Decline</button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default MessageThread;




