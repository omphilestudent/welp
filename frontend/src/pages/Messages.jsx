
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
import { FaSearch, FaStar, FaUserPlus, FaVideo, FaHistory, FaClock, FaExclamationTriangle, FaLock } from 'react-icons/fa';
import { fetchChatUsage } from '../services/chatUsageService';
import SponsoredCard from '../components/ads/SponsoredCard';
import { getPlanKey, hasAccess } from '../utils/subscriptionAccess';

const Messages = () => {
    const [searchParams, setSearchParams] = useSearchParams();
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
    const [employeeFavorites, setEmployeeFavorites] = useState([]);
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
    const [extendingSession, setExtendingSession] = useState(false);
    const [psychologistDeletedNotice, setPsychologistDeletedNotice] = useState('');
    const [extendMinutes, setExtendMinutes] = useState(10);

    useEffect(() => {
        setPsychologistDeletedNotice('');
    }, [activeConversation?.id]);
    const [callDurationSec, setCallDurationSec] = useState(0);
    const hasFetchedConversations = React.useRef(false);
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
    const userWithSubscription = useMemo(() => ({
        ...(user || {}),
        subscription: subscription || user?.subscription
    }), [user, subscription]);
    const subscriptionPlan = getPlanKey(userWithSubscription);
    const callRestrictionCopy = 'Upgrade to a paid plan to initiate calls.';
    const canUseVideoCall = hasAccess(userWithSubscription, 'videoCall');
    const isFreeEmployee = user?.role === 'employee' && !canUseVideoCall;

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
    const favoritePsychologistIds = useMemo(() => (
        new Set((employeeFavorites || []).map((fav) => fav.psychologist_id || fav.id))
    ), [employeeFavorites]);
    const isFeaturedFavorited = featuredPsychologist
        ? favoritePsychologistIds.has(featuredPsychologist.id)
        : false;
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
    const defaultSessionLimit = user?.role === 'employee'
        ? (chatUsage?.limit || 30)
        : 120;
    const sessionLimitMinutes = Math.max(
        1,
        Number(activeConversation?.time_limit_minutes ?? defaultSessionLimit)
    );
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
        ? 'Free sessions last 30 minutes and close automatically once the timer runs out.'
        : 'Sessions respect your subscription limits.';
    const canRequestSupport = user?.role === 'employee'
        && visibleConversations.length === 0
        && !!featuredPsychologist
        && (chatUsage?.remaining ?? 1) > 0;
    const canStartVideoCall = Boolean(activeConversation) && !isConversationExpired;
    const isPaidTier = subscriptionPlan !== 'free';

    const fetchConversations = async () => {
        try {
            const { data } = await api.get('/messages/conversations');
            if (data?.success) {
                setConversations(data.conversations || []);
            } else if (Array.isArray(data)) {
                setConversations(data);
            } else {
                setConversations([]);
            }
        } catch (error) {
            setError('Failed to load conversations');
            console.error('Failed to fetch conversations:', error);
            setConversations([]);
        } finally {
            setLoading(false);
        }
    };

    const handleExtendSession = async () => {
        if (!activeConversation?.id) return;
        if ((chatUsage?.remaining ?? 0) <= 0) {
            toast.error('You do not have any remaining chat minutes to extend the session.');
            return;
        }
        setExtendingSession(true);
        try {
            const requestedMinutes = Math.max(5, Math.min(60, Number(extendMinutes) || 10));
            await api.post(`/messages/conversations/${activeConversation.id}/extend`, {
                extendMinutes: requestedMinutes
            });
            toast.success('Session extended by a few minutes.');
            await Promise.all([loadChatUsage(), fetchConversations()]);
            setNow(Date.now());
            setPsychologistDeletedNotice('');
        } catch (error) {
            const status = error?.response?.status;
            const message = error?.response?.data?.error || 'Failed to extend the session';
            toast.error(message);
            if (status === 410 || status === 404) {
                setPsychologistDeletedNotice(message);
            }
        } finally {
            setExtendingSession(false);
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
            setSubscription(data?.subscription || data);
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

    const fetchEmployeeFavorites = async () => {
        try {
            const { data } = await api.get('/messages/favorites/psychologists');
            setEmployeeFavorites(data?.favorites || []);
        } catch (err) {
            console.error('Failed to load psychologist favorites', err);
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

    const createConversationFromEmployee = useCallback(async (employeeId) => {
        if (!employeeId || user?.role !== 'psychologist') return null;
        try {
            const { data } = await api.post('/messages/conversations/request', {
                employeeId,
                initialMessage: 'Hello, I read your review and wanted to offer private support.'
            });
            return data?.id || data?.conversation?.id || null;
        } catch (error) {
            console.error('Failed to create conversation from employee:', error);
            return null;
        }
    }, [user?.role]);

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
        if (hasFetchedConversations.current) return;
        hasFetchedConversations.current = true;
        fetchConversations();
    }, []);

    const userId = user?.id;
    const userRole = user?.role;
    const isPsychRestricted = userRole === 'psychologist' && user?.can_use_profile === false;

    useEffect(() => {
        if (userRole === 'psychologist' && userId) {
            fetchPsychologistSidebar();
        }
    }, [userId, userRole]);

    useEffect(() => {
        if (userRole === 'employee' && userId) {
            fetchSubscription();
            fetchAvailablePsychologists();
            fetchEmployeeFavorites();
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
        const employeeId = searchParams.get('employee');
        if (!employeeId || user?.role !== 'psychologist') return;
        createConversationFromEmployee(employeeId).then((conversationId) => {
            if (conversationId) {
                setSearchParams({ conversation: conversationId });
                fetchConversations();
            }
        });
    }, [searchParams, user?.role, createConversationFromEmployee, setSearchParams]);

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
            if (!payload?.conversationId) return;
            const isSelfTermination = payload?.fromUserId === user?.id && !payload?.system;
            if (isSelfTermination) return;
            if (payload.reason === 'busy') {
                toast('User is busy on another call.');
            }
            if (payload.reason === 'duration_limit') {
                toast('Call ended because the psychologist session limit was reached.');
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

    useEffect(() => {
        const handleSocketError = (payload) => {
            if (!payload) return;
            if (payload.message) {
                toast.error(payload.message);
            }
            if (payload.code === 'CALL_BLOCKED_FREE_TIER') {
                endCall(false);
            }
        };
        socketService.onError(handleSocketError);
        return () => {
            socketService.offError();
        };
    }, [endCall]);

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

    const handleFavoritePsychologist = async (psychologist) => {
        if (!psychologist) return;
        try {
            await api.post('/messages/favorites/psychologists', {
                psychologistId: psychologist.id
            });
            await fetchEmployeeFavorites();
            toast.success('Saved to favorites');
        } catch (err) {
            toast.error(err?.response?.data?.error || 'Failed to save favorite');
        }
    };

    const handleUnfavoritePsychologist = async (psychologistId) => {
        if (!psychologistId) return;
        try {
            await api.delete(`/messages/favorites/psychologists/${psychologistId}`);
            setEmployeeFavorites((prev) => prev.filter((fav) => fav.psychologist_id !== psychologistId));
            toast.success('Removed from favorites');
        } catch (err) {
            toast.error(err?.response?.data?.error || 'Failed to remove favorite');
        }
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
        if (isFreeEmployee) {
            toast(callRestrictionCopy);
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
        if (isFreeEmployee) {
            toast(callRestrictionCopy);
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
        if (isFreeEmployee) {
            toast(callRestrictionCopy);
            return;
        }
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

    function endCall(notify = true) {
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
    }

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
        if (isPsychRestricted) {
            toast.error('Your account is restricted until KYC is approved.');
            return;
        }

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
        if (isPsychRestricted) {
            toast.error('Your account is restricted until KYC is approved.');
            return;
        }
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
        if (isPsychRestricted) {
            toast.error('Your account is restricted until KYC is approved.');
            return;
        }
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
        if (isPsychRestricted) {
            toast.error('Your account is restricted until KYC is approved.');
            return;
        }
        try {
            await api.patch(`/psychologists/dashboard/leads/${leadId}/archive`);
            setPsychLeads((prev) => prev.filter((lead) => lead.id !== leadId));
            toast.success('Lead removed');
        } catch (err) {
            toast.error('Failed to remove lead');
        }
    };

    const handleFavoriteAdd = async (employee) => {
        if (isPsychRestricted) {
            toast.error('Your account is restricted until KYC is approved.');
            return;
        }
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
        if (isPsychRestricted) {
            toast.error('Your account is restricted until KYC is approved.');
            return;
        }
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
            {isPsychRestricted && (
                <div className="alert alert-warning">
                    Your account is restricted until KYC is completed and approved.
                </div>
            )}
            <div className="messages-container">
                <div
                    className={`messages-sidebar ${isSidebarOpen ? 'open' : ''}`}
                    onWheel={(event) => event.stopPropagation()}
                    onTouchMove={(event) => event.stopPropagation()}
                >
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
                    {!activeConversation && visibleConversations.length === 0 && (
                        <div className="empty-state">
                            <p>No conversations yet</p>
                            <span>Start a chat to see it here.</span>
                        </div>
                    )}
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
                                {psychologistDeletedNotice && (
                                    <div className="upgrade-reminder" style={{ marginTop: '0.75rem' }}>
                                        <FaExclamationTriangle />
                                        <span>{psychologistDeletedNotice}</span>
                                    </div>
                                )}
                                {psychologistDeletedNotice && featuredPsychologist && ((chatUsage?.remaining ?? 0) > 0) && (
                                    <button
                                        className="btn btn-outline btn-small"
                                        onClick={() => handleRequestPsychologist(featuredPsychologist)}
                                    >
                                        Request a new psychologist
                                    </button>
                                )}
                            </section>
                            )}
                            <section className="available-psych-card">
                                <div className="available-psych-card__header">
                                    <span>Available psychologist</span>
                                    <span className="available-psych-card__tier">
                                        {isPaidTier ? 'Premium access' : 'Free tier'}
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
                                    <button
                                        className="btn btn-outline btn-small"
                                        onClick={() => {
                                            if (!featuredPsychologist) return;
                                            if (isFeaturedFavorited) {
                                                handleUnfavoritePsychologist(featuredPsychologist.id);
                                            } else {
                                                handleFavoritePsychologist(featuredPsychologist);
                                            }
                                        }}
                                        disabled={!featuredPsychologist}
                                    >
                                        <FaStar /> {isFeaturedFavorited ? 'Remove favorite' : 'Save favorite'}
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
                                        disabled={!canStartVideoCall || isFreeEmployee}
                                          title={isFreeEmployee ? callRestrictionCopy : undefined}
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
                                    {isConversationExpired && (chatUsage?.remaining ?? 0) > 0 && (
                                        <button
                                            className="btn btn-primary btn-small"
                                            onClick={handleExtendSession}
                                            disabled={extendingSession}
                                        >
                                            {extendingSession ? 'Extending…' : 'Extend session'}
                                        </button>
                                    )}
                                </div>
                                {isConversationExpired && (chatUsage?.remaining ?? 0) > 0 && (
                                    <div className="conversation-extend-control">
                                        <label>
                                            Minutes
                                            <input
                                                type="number"
                                                min="5"
                                                max="60"
                                                value={extendMinutes}
                                                onChange={(event) => {
                                                    const value = Number(event.target.value);
                                                    if (Number.isNaN(value)) return;
                                                    setExtendMinutes(Math.max(5, Math.min(60, value)));
                                                }}
                                            />
                                        </label>
                                        <span>Choose between 5 and 60 minutes</span>
                                    </div>
                                )}
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
                                  {isFreeEmployee && (
                                      <div className="upgrade-reminder" style={{ marginTop: '0.75rem' }}>
                                          <FaLock />
                                          <span>
                                              {callRestrictionCopy} Psychologists can still initiate a call with you.
                                          </span>
                                      </div>
                                  )}
                            </section>

                            <section className="messages-sponsored-slot">
                                   <SponsoredCard
                                    placement="category"
                                    behaviors={[userRole, featuredSpecialization].filter(Boolean)}
                                    rotateIntervalMs={65000}
                                />
                            </section>
                        </div>
                    )}

                    <div
                        className="messages-main"
                        onWheel={(event) => event.stopPropagation()}
                        onTouchMove={(event) => event.stopPropagation()}
                    >
                        <MessageThread
                            conversation={activeConversation}
                            messages={messages}
                            callConfig={psychPermissions}
                            isExpired={isConversationExpired}
                            timeRemainingLabel={timeLabel}
                            sessionLimitMinutes={sessionLimitMinutes}
                            onSendMessage={handleSendMessage}
                            onStartVoiceCall={handleVoiceCall}
                            onStartVideoCall={handleVideoCall}
                            onOpenSidebar={() => setIsSidebarOpen(true)}
                            callDisabled={isFreeEmployee}
                            callDisabledReason={callRestrictionCopy}
                        />
                    </div>
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
                dailyLimit={chatUsage?.limit}
                loading={allocationModal.loading}
                onClose={() => setAllocationModal({ open: false, psychologist: null, loading: false })}
                onConfirm={handleConfirmAllocation}
            />
        </div>
    );
};

export default Messages;
