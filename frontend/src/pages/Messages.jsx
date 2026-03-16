
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import socketService from '../services/socket';
import ConversationList from '../components/messages/ConversationList';
import MessageThread from '../components/messages/MessageThread';
import ChatAllocationModal from '../components/messages/ChatAllocationModal';
import Loading from '../components/common/Loading';
import toast from 'react-hot-toast';
import { FaSearch, FaStar, FaUserPlus, FaVideo, FaHistory, FaClock, FaExclamationTriangle } from 'react-icons/fa';
import { fetchChatUsage } from '../services/chatUsageService';

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
    const [chatUsage, setChatUsage] = useState(null);
    const [allocationModal, setAllocationModal] = useState({ open: false, psychologist: null, loading: false });
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [now, setNow] = useState(Date.now());
    const [callState, setCallState] = useState({ status: 'idle', mediaType: 'video', conversationId: null, fromUserId: null });
    const [incomingOffer, setIncomingOffer] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [callStartedAt, setCallStartedAt] = useState(null);
    const [callDurationSec, setCallDurationSec] = useState(0);
    const localVideoRef = React.useRef(null);
    const remoteVideoRef = React.useRef(null);
    const peerRef = React.useRef(null);
    const localStreamRef = React.useRef(null);
    const ringIntervalRef = React.useRef(null);
    const audioCtxRef = React.useRef(null);
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
    const sessionLimitMinutes = Math.max(1, Number(activeConversation?.time_limit_minutes ?? 120));
    const fallbackStart = activeConversation?.started_at ? new Date(activeConversation.started_at) : null;
    const derivedExpiry = fallbackStart
        ? new Date(fallbackStart.getTime() + sessionLimitMinutes * 60 * 1000)
        : null;
    const expiresAt = activeConversation?.expires_at
        ? new Date(activeConversation.expires_at)
        : derivedExpiry;
    const timeRemainingMs = expiresAt ? expiresAt.getTime() - now : null;
    const isConversationExpired = activeConversation?.status === 'ended' || (timeRemainingMs != null && timeRemainingMs <= 0);
    const timeLabel = formatTimeRemaining(timeRemainingMs);
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
    const canRequestSupport = user?.role === 'employee'
        && visibleConversations.length === 0
        && !!featuredPsychologist
        && (chatUsage?.remaining ?? 1) > 0;
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

    const loadChatUsage = useCallback(async () => {
        if (user?.role !== 'employee') return;
        try {
            const summary = await fetchChatUsage();
            setChatUsage(summary);
        } catch (error) {
            console.error('Failed to load chat usage', error);
        }
    }, [user?.role]);

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

    const ensureConversationActive = useCallback((conversationId) => {
        if (!conversationId) return;
        if (activeConversation?.id === conversationId) return;
        const found = visibleConversations.find(c => c.id === conversationId);
        if (found) {
            setActiveConversation(found);
            fetchMessages(found.id);
        }
    }, [activeConversation, visibleConversations, fetchMessages]);

    useEffect(() => {
        fetchConversations();
    }, []);

    const userId = user?.id;
    const userRole = user?.role;

    useEffect(() => {
        if (userRole === 'psychologist' && userId) {
            fetchPsychologistSidebar();
        }
    }, [userId, userRole]);

    useEffect(() => {
        if (userRole === 'employee' && userId) {
            fetchSubscription();
            fetchAvailablePsychologists();
            loadChatUsage();
        }
    }, [userId, userRole, loadChatUsage]);

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

        if (activeConversation && !visibleConversations.some(c => c.id === activeConversation.id)) {
            setActiveConversation(null);
            setMessages([]);
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
        return () => {
            endCall(false);
        };
    }, [activeConversation?.id]);

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!callStartedAt) {
            setCallDurationSec(0);
            return;
        }
        const timer = setInterval(() => {
            setCallDurationSec(Math.floor((Date.now() - callStartedAt) / 1000));
        }, 1000);
        return () => clearInterval(timer);
    }, [callStartedAt]);

    useEffect(() => {
        if (!activeConversation) {
            setIsSidebarOpen(true);
        }
    }, [activeConversation]);

    useEffect(() => {
        if (!userId) {
            return;
        }
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (token) {
            socketService.connect(token);
        }

        return () => {
            socketService.disconnect();
        };
    }, [userId]);

    useEffect(() => {
        const handleOffer = (payload) => {
            if (!payload?.conversationId || payload?.fromUserId === user?.id) return;
            if (callState.status !== 'idle') {
                socketService.emitCallEnd({ conversationId: payload.conversationId, reason: 'busy' });
                return;
            }
            ensureConversationActive(payload.conversationId);
            setIncomingOffer(payload);
            setCallState({
                status: 'incoming',
                mediaType: payload.mediaType || 'video',
                conversationId: payload.conversationId,
                fromUserId: payload.fromUserId
            });
            startRingtone();
            showIncomingNotification(payload);
        };

        const handleAnswer = async (payload) => {
            if (!payload?.conversationId || payload?.fromUserId === user?.id) return;
            if (peerRef.current && payload.sdp) {
                await peerRef.current.setRemoteDescription(payload.sdp);
                setCallState((prev) => ({
                    ...prev,
                    status: 'in-call',
                    conversationId: payload.conversationId
                }));
                setCallStartedAt(Date.now());
            }
        };

        const handleIce = async (payload) => {
            if (!payload?.conversationId || payload?.fromUserId === user?.id) return;
            if (peerRef.current && payload.candidate) {
                try {
                    await peerRef.current.addIceCandidate(payload.candidate);
                } catch (err) {
                    console.error('ICE add error', err);
                }
            }
        };

        const handleEnd = (payload) => {
            if (!payload?.conversationId || payload?.fromUserId === user?.id) return;
            if (payload.reason === 'busy') {
                toast('User is busy on another call.');
            }
            endCall(false);
        };

        socketService.onCallOffer(handleOffer);
        socketService.onCallAnswer(handleAnswer);
        socketService.onCallIce(handleIce);
        socketService.onCallEnd(handleEnd);

        return () => {
            socketService.offCallOffer();
            socketService.offCallAnswer();
            socketService.offCallIce();
            socketService.offCallEnd();
        };
    }, [userId, ensureConversationActive, callState.status]);

    const startRingtone = () => {
        stopRingtone();
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = audioCtxRef.current;
            const ring = () => {
                if (!ctx) return;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                gain.gain.setValueAtTime(0.001, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
                osc.connect(gain).connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.5);
            };
            ring();
            ringIntervalRef.current = setInterval(ring, 1200);
        } catch (err) {
            // ignore
        }
    };

    const stopRingtone = () => {
        if (ringIntervalRef.current) {
            clearInterval(ringIntervalRef.current);
            ringIntervalRef.current = null;
        }
    };

    const showIncomingNotification = (payload) => {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') {
            Notification.requestPermission().catch(() => null);
        }
        if (Notification.permission !== 'granted') return;
        const title = payload.mediaType === 'voice' ? 'Incoming voice call' : 'Incoming video call';
        new Notification(title, { body: 'Open Welp to respond.' });
    };

    const handleRequestPsychologist = (psychologist) => {
        if (!psychologist) return;
        setAllocationModal({
            open: true,
            psychologist,
            loading: false
        });
    };

    const handleConfirmAllocation = async (minutes) => {
        if (!allocationModal.psychologist || !minutes) return;
        setAllocationModal((prev) => ({ ...prev, loading: true }));
        try {
            await api.post('/messages/request-chat', {
                psychologistId: allocationModal.psychologist.id,
                sessionMinutes: minutes,
                initialMessage: 'Hi, I am looking for confidential support when you are free.'
            });
            toast.success('Request sent. The psychologist will reach out shortly.');
            setAllocationModal({ open: false, psychologist: null, loading: false });
            fetchConversations();
            fetchAvailablePsychologists();
            loadChatUsage();
        } catch (err) {
            toast.error(err?.response?.data?.error || 'Failed to request support');
            setAllocationModal((prev) => ({ ...prev, loading: false }));
        }
    };

    const handleVideoCall = () => {
        if (!activeConversation || !currentPsychologist) {
            toast.error('No active psychologist yet.');
            return;
        }

        if (callState.status !== 'idle') {
            toast('You are already in a call.');
            return;
        }

        if (isConversationExpired) {
            toast('This session has ended. Upgrade to premium to keep chatting longer.');
            return;
        }

        if (activeConversation?.status !== 'accepted') {
            toast('This request is still pending. Calls unlock after acceptance.');
            return;
        }

        startCall('video');
    };

    const handleVoiceCall = () => {
        if (!activeConversation || !currentPsychologist) {
            toast.error('No active psychologist yet.');
            return;
        }

        if (callState.status !== 'idle') {
            toast('You are already in a call.');
            return;
        }

        if (isConversationExpired) {
            toast('This session has ended. Upgrade to premium to keep chatting longer.');
            return;
        }

        if (activeConversation?.status !== 'accepted') {
            toast('This request is still pending. Calls unlock after acceptance.');
            return;
        }

        startCall('voice');
    };

    const createPeerConnection = (conversationId) => {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socketService.emitCallIce({
                    conversationId,
                    candidate: event.candidate
                });
            }
        };

        pc.ontrack = (event) => {
            const [stream] = event.streams;
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = stream;
            }
        };

        return pc;
    };

    const startCall = async (mediaType) => {
        if (!activeConversation) return;
        try {
            let constraints = mediaType === 'voice'
                ? { audio: true, video: false }
                : { audio: true, video: true };

            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (err) {
                if (mediaType === 'video') {
                    constraints = { audio: true, video: false };
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                    mediaType = 'voice';
                    toast('Camera unavailable. Falling back to audio call.');
                } else {
                    throw err;
                }
            }

            localStreamRef.current = stream;
            setIsMuted(false);
            setIsCameraOff(mediaType === 'voice');
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            const pc = createPeerConnection(activeConversation.id);
            peerRef.current = pc;
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            socketService.emitCallOffer({
                conversationId: activeConversation.id,
                sdp: offer,
                mediaType
            });

            setCallState({
                status: 'calling',
                mediaType,
                conversationId: activeConversation.id,
                fromUserId: user?.id
            });
        } catch (error) {
            console.error('Start call error', error);
            toast.error('Unable to start call. Please check microphone/camera permissions.');
            endCall(false);
        }
    };

    const acceptCall = async () => {
        if (!incomingOffer?.conversationId || !incomingOffer?.sdp) return;
        try {
            let mediaType = incomingOffer.mediaType || 'video';
            let constraints = mediaType === 'voice'
                ? { audio: true, video: false }
                : { audio: true, video: true };

            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (err) {
                if (mediaType === 'video') {
                    constraints = { audio: true, video: false };
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                    mediaType = 'voice';
                    toast('Camera unavailable. Falling back to audio call.');
                } else {
                    throw err;
                }
            }

            localStreamRef.current = stream;
            setIsMuted(false);
            setIsCameraOff(mediaType === 'voice');
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            const pc = createPeerConnection(incomingOffer.conversationId);
            peerRef.current = pc;
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));

            await pc.setRemoteDescription(incomingOffer.sdp);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socketService.emitCallAnswer({
                conversationId: incomingOffer.conversationId,
                sdp: answer
            });

            setCallState({
                status: 'in-call',
                mediaType,
                conversationId: incomingOffer.conversationId,
                fromUserId: incomingOffer.fromUserId
            });
            setIncomingOffer(null);
            stopRingtone();
            setCallStartedAt(Date.now());
        } catch (error) {
            console.error('Accept call error', error);
            toast.error('Unable to join call.');
            endCall(false);
        }
    };

    const declineCall = () => {
        if (incomingOffer?.conversationId) {
            socketService.emitCallEnd({
                conversationId: incomingOffer.conversationId,
                reason: 'declined'
            });
        }
        setIncomingOffer(null);
        setCallState({ status: 'idle', mediaType: 'video', conversationId: null, fromUserId: null });
        stopRingtone();
        setCallStartedAt(null);
    };

    const endCall = (notify = true) => {
        if (notify && callState.conversationId) {
            socketService.emitCallEnd({ conversationId: callState.conversationId, reason: 'ended' });
        }
        if (peerRef.current) {
            peerRef.current.ontrack = null;
            peerRef.current.onicecandidate = null;
            peerRef.current.close();
            peerRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        setCallState({ status: 'idle', mediaType: 'video', conversationId: null, fromUserId: null });
        setIncomingOffer(null);
        stopRingtone();
        setCallStartedAt(null);
    };

    const toggleMute = () => {
        const stream = localStreamRef.current;
        if (!stream) return;
        const next = !isMuted;
        stream.getAudioTracks().forEach((track) => {
            track.enabled = !next;
        });
        setIsMuted(next);
    };

    const toggleCamera = () => {
        const stream = localStreamRef.current;
        if (!stream) return;
        const tracks = stream.getVideoTracks();
        if (tracks.length === 0) return;
        const next = !isCameraOff;
        tracks.forEach((track) => {
            track.enabled = !next;
        });
        setIsCameraOff(next);
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
        setIsSidebarOpen(false);
    };

    const handleSendMessage = async (content) => {
        if (!activeConversation) return;

        setSendingMessage(true);
        try {
            const { data } = await api.post(`/messages/conversations/${activeConversation.id}/messages`, {
                content
            });
            if (data) {
                setMessages((prev) => [...prev, data]);
                setConversations((prev) => prev.map((conv) => {
                    if (conv.id !== activeConversation.id) return conv;
                    return {
                        ...conv,
                        last_message: {
                            content: data.content,
                            createdAt: data.created_at || data.createdAt,
                            senderId: data.sender_id || data.senderId
                        },
                        updated_at: data.created_at || data.createdAt || conv.updated_at
                    };
                }));
            }
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

    const handleLeadArchive = async (leadId) => {
        try {
            await api.patch(`/psychologists/dashboard/leads/${leadId}/archive`);
            setPsychLeads((prev) => prev.filter((lead) => lead.id !== leadId));
            toast.success('Lead removed');
        } catch (err) {
            toast.error('Failed to remove lead');
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
                <div className={`messages-sidebar ${isSidebarOpen ? 'open' : ''}`}>
                    <div className="sidebar-header">
                        <h2>Messages</h2>
                        <button
                            type="button"
                            className="btn btn-outline btn-small messages-sidebar-toggle"
                            onClick={() => setIsSidebarOpen(false)}
                        >
                            Close
                        </button>
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
                                            <button
                                                className="btn btn-secondary btn-small"
                                                onClick={() => handleLeadArchive(lead.id)}
                                            >
                                                Remove
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
                            {chatUsage && (
                                <section className="chat-usage-card">
                                    <div>
                                        <p className="status-label">Today's chat time</p>
                                        <h4>{chatUsage.remaining} minutes remaining</h4>
                                    <p className="conversation-status-subtitle">
                                        Used {chatUsage.used} / {chatUsage.limit} minutes
                                    </p>
                                    {chatUsage.remaining <= 0 && (
                                        <p className="upgrade-reminder">
                                            Daily limit reached. Come back tomorrow for more chats.
                                        </p>
                                    )}
                                    </div>
                                </section>
                            )}
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
                                        disabled={!canRequestSupport || allocationModal.loading || !featuredPsychologist}
                                    >
                                        {allocationModal.loading ? 'Requesting...' : 'Request private support'}
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
                        onStartVoiceCall={handleVoiceCall}
                        onStartVideoCall={handleVideoCall}
                        onOpenSidebar={() => setIsSidebarOpen(true)}
                    />
                </div>
            </div>
            {(callState.status === 'calling' || callState.status === 'incoming' || callState.status === 'in-call') && (
                <div className="call-overlay">
                    <div className="call-modal">
                        <div className="call-header">
                            <h3>{callState.mediaType === 'voice' ? 'Voice Call' : 'Video Call'}</h3>
                            {callState.status === 'incoming' && <span>Incoming call...</span>}
                            {callState.status === 'calling' && <span>Calling...</span>}
                            {callState.status === 'in-call' && <span>Connected • {new Date(callDurationSec * 1000).toISOString().substr(11, 8)}</span>}
                        </div>
                        {callState.status === 'in-call' && (
                            <div className="call-status-badge">On call</div>
                        )}
                        <div className="call-videos">
                            <video ref={remoteVideoRef} autoPlay playsInline className="call-video remote" />
                            <video ref={localVideoRef} autoPlay playsInline muted className="call-video local" />
                        </div>
                        <div className="call-actions">
                            {callState.status === 'incoming' ? (
                                <>
                                    <button className="btn btn-primary" onClick={acceptCall}>Accept</button>
                                    <button className="btn btn-secondary" onClick={declineCall}>Decline</button>
                                </>
                            ) : (
                                <>
                                    <button className="btn btn-outline btn-small" onClick={toggleMute}>
                                        {isMuted ? 'Unmute' : 'Mute'}
                                    </button>
                                    {callState.mediaType === 'video' && (
                                        <button className="btn btn-outline btn-small" onClick={toggleCamera}>
                                            {isCameraOff ? 'Camera On' : 'Camera Off'}
                                        </button>
                                    )}
                                    <button className="btn btn-secondary" onClick={() => endCall(true)}>End Call</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {isSidebarOpen && (
                <div
                    className="messages-sidebar-overlay"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
            <ChatAllocationModal
                open={allocationModal.open}
                psychologist={allocationModal.psychologist}
                remainingMinutes={chatUsage?.remaining}
                loading={allocationModal.loading}
                onClose={() => setAllocationModal({ open: false, psychologist: null, loading: false })}
                onConfirm={handleConfirmAllocation}
            />
        </div>
    );
};

export default Messages;
