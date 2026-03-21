
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import socketService from '../services/socket';
import ConversationList from '../components/messages/ConversationList';
import MessageThread from '../components/messages/MessageThread';
import ChatAllocationModal from '../components/messages/ChatAllocationModal';
import SessionRatingModal from '../components/messages/SessionRatingModal';
import PsychologistBookingModal from '../components/messages/PsychologistBookingModal';
import CallDurationModal from '../components/messages/CallDurationModal';
import EmployeeVideoCallModal from '../components/messages/EmployeeVideoCallModal';
import Loading from '../components/common/Loading';
import toast from 'react-hot-toast';
import { FaSearch, FaStar, FaUserPlus, FaVideo, FaHistory, FaClock, FaExclamationTriangle, FaLock } from 'react-icons/fa';
import { fetchChatUsage } from '../services/chatUsageService';
import SponsoredCard from '../components/ads/SponsoredCard';
import { getPlanKey, hasAccess } from '../utils/subscriptionAccess';
import { formatMoneyForUser } from '../utils/currency';
import { addDays, startOfWeek } from 'date-fns';

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
    const [showSupportPanel, setShowSupportPanel] = useState(true);
    const [isMobileView, setIsMobileView] = useState(false);
    const [allocationModal, setAllocationModal] = useState({ open: false, psychologist: null, loading: false });
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [now, setNow] = useState(Date.now());
    const [callState, setCallState] = useState({ status: 'idle', mediaType: 'video', conversationId: null, fromUserId: null });
    const [incomingOffer, setIncomingOffer] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [callStartedAt, setCallStartedAt] = useState(null);
    const [callView, setCallView] = useState('standard');
    const [audioOutputs, setAudioOutputs] = useState([]);
    const [selectedAudioOutput, setSelectedAudioOutput] = useState('default');
    const [supportsAudioOutput, setSupportsAudioOutput] = useState(false);
    const [extendingSession, setExtendingSession] = useState(false);
    const [psychologistDeletedNotice, setPsychologistDeletedNotice] = useState('');
    const [extendMinutes, setExtendMinutes] = useState(10);
    const [pendingRatings, setPendingRatings] = useState([]);
    const [ratingSubmitting, setRatingSubmitting] = useState(false);
    const [bookingModalOpen, setBookingModalOpen] = useState(false);
    const [currentRates, setCurrentRates] = useState([]);
    const [currentRatesLoading, setCurrentRatesLoading] = useState(false);
    const [callEntitlement, setCallEntitlement] = useState(null);
    const [callDurationOpen, setCallDurationOpen] = useState(false);
    const [callDurationLoading, setCallDurationLoading] = useState(false);
    const [callMediaType, setCallMediaType] = useState('video');
    const [videoCallModalOpen, setVideoCallModalOpen] = useState(false);
    const [videoCallAvailability, setVideoCallAvailability] = useState([]);
    const [videoCallWeekStart, setVideoCallWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [hasSavedCard, setHasSavedCard] = useState(false);
    const [videoCallScheduling, setVideoCallScheduling] = useState(false);
    const autoStartRef = useRef(false);

    useEffect(() => {
        setPsychologistDeletedNotice('');
    }, [activeConversation?.id]);

    useEffect(() => {
        const autoStart = searchParams.get('autostart');
        if (!autoStart || autoStartRef.current) return;
        if (!activeConversation?.id || user?.role !== 'psychologist') return;
        autoStartRef.current = true;
        startCall('video', 60, null).catch(() => {
            autoStartRef.current = false;
        });
    }, [activeConversation?.id, searchParams, user?.role]);
    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        const handleChange = () => setIsMobileView(mediaQuery.matches);
        handleChange();
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
    }, []);

    useEffect(() => {
        setShowSupportPanel(!isMobileView);
    }, [isMobileView]);

    useEffect(() => {
        if (!isMobileView && isSidebarOpen) {
            setIsSidebarOpen(false);
        }
    }, [isMobileView, isSidebarOpen]);
    const [callDurationSec, setCallDurationSec] = useState(0);
    const hasFetchedConversations = React.useRef(false);
    const localVideoRef = React.useRef(null);
    const remoteVideoRef = React.useRef(null);
    const callModalRef = React.useRef(null);
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
    const activePsychRate = useMemo(() => {
        if (!currentRates?.length) return null;
        return currentRates.find((rate) => rate.is_active ?? rate.isActive) || currentRates[0];
    }, [currentRates]);
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
    const canStartVideoCall = Boolean(activeConversation) && (user?.role === 'psychologist' || !isConversationExpired);
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

    const fetchPaymentSummary = async () => {
        try {
            const { data } = await api.get('/payments/methods/summary');
            setHasSavedCard(Boolean(data?.hasSavedCard));
        } catch (err) {
            setHasSavedCard(false);
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

    const loadCallEntitlement = async () => {
        if (!activeConversation?.id) return;
        setCallDurationLoading(true);
        try {
            const { data } = await api.get(`/messages/conversations/${activeConversation.id}/call-entitlement`);
            setCallEntitlement(data);
        } catch (error) {
            toast.error('Failed to load call entitlement');
        } finally {
            setCallDurationLoading(false);
        }
    };

    const fetchVideoCallAvailability = async (weekStartOverride) => {
        if (!currentPsychologist?.id) return;
        const targetWeek = weekStartOverride || videoCallWeekStart;
        try {
            const { data } = await api.get(`/psychologists/${currentPsychologist.id}/availability`, {
                params: { weekStart: targetWeek.toISOString().slice(0, 10) }
            });
            setVideoCallAvailability(data?.availability || []);
        } catch {
            setVideoCallAvailability([]);
        }
    };

    const fetchPendingRatings = useCallback(async () => {
        if (user?.role !== 'employee') return;
        try {
            const { data } = await api.get('/sessions/pending-ratings');
            setPendingRatings(data?.sessions || []);
        } catch (error) {
            console.error('Failed to load pending ratings', error);
        }
    }, [user?.role]);

    const fetchMessages = useCallback(async (conversationId) => {
        try {
            const { data } = await api.get(`/messages/conversations/${conversationId}/messages`);
            if (Array.isArray(data)) {
                setMessages(data);
            } else if (Array.isArray(data?.messages)) {
                setMessages(data.messages);
            } else {
                setMessages([]);
            }
        } catch (error) {
            console.error('Failed to fetch messages:', error);
            setMessages([]);
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

    const activeRatingSession = pendingRatings?.[0] || null;

    const handleSubmitRating = async ({ ratingValue, feedback }) => {
        if (!activeRatingSession) return;
        setRatingSubmitting(true);
        try {
            await api.post(`/sessions/${activeRatingSession.conversation_id}/rating`, {
                ratingValue,
                reviewText: feedback
            });
            toast.success('Thanks for rating your session!');
            await fetchPendingRatings();
        } catch (error) {
            const message = error?.response?.data?.error || 'Failed to submit rating';
            toast.error(message);
        } finally {
            setRatingSubmitting(false);
        }
    };

    const handleSkipRating = async () => {
        if (!activeRatingSession) return;
        setRatingSubmitting(true);
        try {
            await api.post(`/sessions/${activeRatingSession.conversation_id}/rating/skip`, { remindAfterHours: 48 });
            await fetchPendingRatings();
        } catch (error) {
            console.error('Failed to defer rating', error);
        } finally {
            setRatingSubmitting(false);
        }
    };

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
            fetchPendingRatings();
            fetchPaymentSummary();
        }
    }, [userId, userRole, loadChatUsage, fetchPendingRatings]);

    useEffect(() => {
        if (user?.role !== 'employee') return;
        if (!currentPsychologist?.id) {
            setCurrentRates([]);
            return;
        }
        setCurrentRatesLoading(true);
        api.get(`/psychologists/${currentPsychologist.id}/rates`)
            .then(({ data }) => setCurrentRates(data?.rates || []))
            .catch(() => setCurrentRates([]))
            .finally(() => setCurrentRatesLoading(false));
    }, [currentPsychologist?.id, user?.role]);

    useEffect(() => {
        if (videoCallModalOpen) {
            fetchVideoCallAvailability();
        }
    }, [videoCallWeekStart, videoCallModalOpen]);

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
        if (user?.role !== 'employee') return;
        if (activeConversation?.status === 'ended' || (timeRemainingMs != null && timeRemainingMs <= 0)) {
            fetchPendingRatings();
        }
    }, [activeConversation?.status, timeRemainingMs, fetchPendingRatings, user?.role]);

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
            if (!activeConversation) {
                setActiveConversation(null);
                setMessages([]);
            }
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
        if (!isMobileView) return;
        if (!activeConversation && visibleConversations.length > 0) {
            const firstConversation = visibleConversations[0];
            setActiveConversation(firstConversation);
            fetchMessages(firstConversation.id);
            if (searchParams.get('conversation') !== firstConversation.id) {
                setSearchParams({ conversation: firstConversation.id });
            }
            setIsSidebarOpen(false);
        }
    }, [isMobileView, activeConversation, visibleConversations, fetchMessages, searchParams, setSearchParams]);

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
        const supportsSink = typeof HTMLMediaElement !== 'undefined' && typeof HTMLMediaElement.prototype.setSinkId === 'function';
        setSupportsAudioOutput(supportsSink);
    }, []);

    useEffect(() => {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        if (callState.status === 'idle') return;
        navigator.mediaDevices.enumerateDevices()
            .then((devices) => {
                const outputs = devices.filter((device) => device.kind === 'audiooutput');
                setAudioOutputs(outputs);
            })
            .catch(() => null);
    }, [callState.status]);

    useEffect(() => {
        if (!supportsAudioOutput) return;
        const element = remoteVideoRef.current;
        if (!element || !selectedAudioOutput) return;
        element.setSinkId(selectedAudioOutput).catch(() => null);
    }, [supportsAudioOutput, selectedAudioOutput, callState.status]);

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
            if (payload.code === 'CALL_BUSY') {
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

    const handleConfirmCallDuration = async (minutes) => {
        setCallDurationOpen(false);
        if (callState.status !== 'idle') return;
        await startCall(callMediaType, minutes);
    };

    const handleConfirmVideoCall = async ({ scheduledAt, durationMinutes, rateId }) => {
        if (!currentPsychologist?.id) return;
        if (!hasSavedCard) {
            toast.error('Add a saved card to schedule this call.');
            return;
        }
        setVideoCallScheduling(true);
        try {
            const { data } = await api.post(`/psychologists/${currentPsychologist.id}/bookings`, {
                rateId: rateId || activePsychRate?.id || null,
                scheduledAt: new Date(scheduledAt).toISOString(),
                durationMinutes
            });
            const booking = data?.booking;
            if (booking?.id) {
                await api.post(`/psychologists/bookings/${booking.id}/checkout`);
                setVideoCallModalOpen(false);
                await startCall('video', durationMinutes, booking.scheduled_at || booking.scheduledAt);
            }
        } catch (error) {
            const message = error?.response?.data?.error || 'Psychologist is busy. Choose another time.';
            toast.error(message);
        } finally {
            setVideoCallScheduling(false);
        }
    };

    const handleVideoCall = () => {
        if (!activeConversation || !currentPsychologist) {
            toast.error('No active psychologist yet.');
            return;
        }
        if (user?.role === 'employee') {
            if (isFreeEmployee) {
                toast(callRestrictionCopy);
                return;
            }
            setVideoCallModalOpen(true);
            fetchVideoCallAvailability();
            return;
        }

        if (callState.status !== 'idle') {
            toast('You are already in a call.');
            return;
        }\r\n
        if (activeConversation?.status !== 'accepted') {
            toast('This request is still pending. Calls unlock after acceptance.');
            return;
        }

        setCallDurationOpen(true);
        setCallMediaType('video');
        loadCallEntitlement();
    };

    const handleVoiceCall = () => {
        if (!activeConversation || !currentPsychologist) {
            toast.error('No active psychologist yet.');
            return;
        }
        if (user?.role === 'employee') {
            toast(callRestrictionCopy);
            return;
        }

        if (callState.status !== 'idle') {
            toast('You are already in a call.');
            return;
        }\r\n
        if (activeConversation?.status !== 'accepted') {
            toast('This request is still pending. Calls unlock after acceptance.');
            return;
        }

        setCallDurationOpen(true);
        setCallMediaType('voice');
        loadCallEntitlement();
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

    const startCall = async (mediaType, durationMinutes, scheduledAt) => {
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
                mediaType,
                durationMinutes,
                scheduledAt
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
        setCallView('standard');
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
        const nextConversation = visibleConversations.find((item) => item.id === conversation?.id) || conversation;
        setActiveConversation(nextConversation || null);
        if (conversation?.id) {
            if (searchParams.get('conversation') !== conversation.id) {
                setSearchParams({ conversation: conversation.id });
            }
            fetchMessages(conversation.id);
        }
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

    const handleSendVoiceNote = async ({ file, duration }) => {
        if (!activeConversation) return;
        if (isPsychRestricted) {
            toast.error('Your account is restricted until KYC is approved.');
            return;
        }
        const tempId = `temp-voice-${Date.now()}`;
        const tempUrl = URL.createObjectURL(file);
        const optimisticMessage = {
            id: tempId,
            conversation_id: activeConversation.id,
            sender_id: user?.id,
            content: 'Voice note',
            message_type: 'voice_note',
            attachment_url: tempUrl,
            attachment_duration: duration || null,
            attachment_mime: file?.type || null,
            created_at: new Date().toISOString()
        };
        setMessages((prev) => [...prev, optimisticMessage]);
        try {
            const formData = new FormData();
            formData.append('voice', file);
            if (duration) {
                formData.append('duration', String(duration));
            }
            const { data } = await api.post(
                `/messages/conversations/${activeConversation.id}/voice-notes`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            const message = data?.message || data;
            if (message) {
                setMessages((prev) => prev.filter((item) => item.id !== tempId).concat(message));
                setConversations((prev) => prev.map((conv) => {
                    if (conv.id !== activeConversation.id) return conv;
                    return {
                        ...conv,
                        last_message: {
                            content: message.content,
                            createdAt: message.created_at || message.createdAt,
                            senderId: message.sender_id || message.senderId,
                            messageType: message.message_type || message.messageType,
                            attachmentUrl: message.attachment_url || message.attachmentUrl,
                            attachmentDuration: message.attachment_duration || message.attachmentDuration,
                            attachmentMime: message.attachment_mime || message.attachmentMime
                        },
                        updated_at: message.created_at || message.createdAt || conv.updated_at
                    };
                }));
                fetchMessages(activeConversation.id);
            }
        } catch (error) {
            const message = error?.response?.data?.error || 'Failed to send voice note.';
            toast.error(message);
            setMessages((prev) => prev.filter((item) => item.id !== tempId));
        } finally {
            URL.revokeObjectURL(tempUrl);
        }
    };

    const toggleCallView = () => {
        setCallView((prev) => (prev === 'expanded' ? 'standard' : 'expanded'));
    };

    const toggleFullscreen = async () => {
        const modal = callModalRef.current;
        if (!modal) return;
        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => null);
            return;
        }
        await modal.requestFullscreen?.().catch(() => null);
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
        <div className="msg-page">
            {error && <div className="alert alert-error">{error}</div>}
            {isPsychRestricted && (
                <div className="alert alert-warning">
                    Your account is restricted until KYC is completed and approved.
                </div>
            )}
            <div className={`msg-container ${isSidebarOpen ? 'sidebar-open' : ''}`}>
                <div
                    className={`msg-sidebar ${isSidebarOpen ? 'open' : ''}`}
                    onWheel={(event) => event.stopPropagation()}
                    onTouchMove={(event) => event.stopPropagation()}
                >
                    <div className="msg-sidebar-header">
                        <h2>Messages</h2>
                        <button
                            type="button"
                            className="msg-btn msg-btn-outline msg-btn-small msg-sidebar-toggle"
                            onClick={() => setIsSidebarOpen(false)}
                        >
                            Close
                        </button>
                    </div>
                    <div className="msg-sidebar-content">
                    {user?.role === 'psychologist' && (
                        <div className="msg-psych-sidebar">
                            <div className="msg-psych-search">
                                <label>Search employees</label>
                                <div className="msg-psych-search-input">
                                    <FaSearch />
                                    <input
                                        type="text"
                                        placeholder="Type a name"
                                        value={employeeQuery}
                                        onChange={(e) => handleEmployeeSearch(e.target.value)}
                                    />
                                </div>
                                {employeeResults.length > 0 && (
                                    <div className="msg-psych-search-results">
                                        {employeeResults.map((employee) => (
                                            <div key={employee.id} className="msg-psych-search-item">
                                                <div>
                                                    <strong>{employee.display_name}</strong>
                                                    <span>{employee.occupation || 'Employee'}</span>
                                                </div>
                                                <div className="msg-psych-search-actions">
                                                    <button
                                                        className="msg-btn msg-btn-outline msg-btn-small"
                                                        onClick={() => handleStartConversation(employee.id)}
                                                    >
                                                        <FaUserPlus /> Request
                                                    </button>
                                                    <button
                                                        className="msg-btn msg-btn-secondary msg-btn-small"
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

                            <div className="msg-psych-section">
                                <h3>Leads</h3>
                                {psychLeads.length > 0 ? (
                                    psychLeads.map((lead) => (
                                        <div key={lead.id} className="msg-psych-lead-row">
                                            <div>
                                                <strong>{lead.display_name}</strong>
                                                <span>{lead.summary}</span>
                                            </div>
                                            <button
                                                className="msg-btn msg-btn-outline msg-btn-small"
                                                onClick={() => handleLeadMessage(lead.id)}
                                            >
                                                Message
                                            </button>
                                            <button
                                                className="msg-btn msg-btn-secondary msg-btn-small"
                                                onClick={() => handleLeadArchive(lead.id)}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="msg-psych-empty">No leads yet.</p>
                                )}
                            </div>

                            <div className="msg-psych-section">
                                <h3>Favorites</h3>
                                {psychFavorites.length > 0 ? (
                                    psychFavorites.map((favorite) => (
                                        <div key={favorite.id} className="msg-psych-favorite-row">
                                            <div>
                                                <strong>{favorite.display_name}</strong>
                                                <span>{favorite.notes || 'Connected client'}</span>
                                            </div>
                                            <button
                                                className="msg-btn msg-btn-secondary msg-btn-small"
                                                onClick={() => handleFavoriteRemove(favorite.id)}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="msg-psych-empty">No favorites saved.</p>
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
                </div>

                <div className="msg-main">
                    {!activeConversation && visibleConversations.length === 0 && (
                        <div className="msg-empty-state">
                            <p>No conversations yet</p>
                            <span>Start a chat to see it here.</span>
                        </div>
                    )}
                    {user?.role === 'employee' && (
                        <div className="msg-support-toggle">
                            <button
                                type="button"
                                className="msg-btn msg-btn-outline msg-btn-small"
                                onClick={() => setShowSupportPanel((prev) => !prev)}
                            >
                                {showSupportPanel ? 'Hide support insights' : 'Show support insights'}
                            </button>
                        </div>
                    )}
                    {user?.role === 'employee' && showSupportPanel && (
                        <div className="msg-support-panel">
                            {chatUsage && (
                                <section className="msg-chat-usage-card">
                                    <div>
                                        <p className="msg-status-label">Today's chat time</p>
                                        <h4>{chatUsage.remaining} minutes remaining</h4>
                                        <p className="msg-status-subtitle">
                                            Used {chatUsage.used} / {chatUsage.limit} minutes
                                        </p>
                                        {chatUsage.remaining <= 0 && (
                                            <p className="msg-upgrade-reminder">
                                                Daily limit reached. Come back tomorrow for more chats.
                                            </p>
                                        )}
                                    </div>
                                    {psychologistDeletedNotice && (
                                        <div className="msg-upgrade-reminder" style={{ marginTop: '0.75rem' }}>
                                            <FaExclamationTriangle />
                                            <span>{psychologistDeletedNotice}</span>
                                        </div>
                                    )}
                                    {psychologistDeletedNotice && featuredPsychologist && ((chatUsage?.remaining ?? 0) > 0) && (
                                        <button
                                            className="msg-btn msg-btn-outline msg-btn-small"
                                            onClick={() => handleRequestPsychologist(featuredPsychologist)}
                                        >
                                            Request a new psychologist
                                        </button>
                                    )}
                                </section>
                            )}
                            <section className="msg-psych-card">
                                <div className="msg-psych-card__header">
                                    <span>Available psychologist</span>
                                    <span className="msg-psych-card__tier">
                                        {isPaidTier ? 'Premium access' : 'Free tier'}
                                    </span>
                                </div>
                                {featuredPsychologist ? (
                                    <>
                                        <h3>{featuredPsychologist.display_name}</h3>
                                        {featuredSpecialization ? (
                                            <p className="msg-psych-card__role">{featuredSpecialization}</p>
                                        ) : (
                                            <p className="msg-psych-card__role">Certified therapists standing by</p>
                                        )}
                                        {(featuredPsychologist.years_of_experience || featuredLanguages) && (
                                            <p className="msg-psych-card__meta">
                                                {featuredPsychologist.years_of_experience
                                                    ? `${featuredPsychologist.years_of_experience} years experience`
                                                    : ''}
                                                {featuredPsychologist.years_of_experience && featuredLanguages ? ' • ' : ''}
                                                {featuredLanguages}
                                            </p>
                                        )}
                                        <p className="msg-psych-card__note">
                                            {featuredPsychologist.biography
                                                || 'Private support from licensed practitioners is available for every request.'}
                                        </p>
                                    </>
                                ) : (
                                    <p className="msg-psych-card__note">
                                        No psychologist recommended yet.
                                    </p>
                                )}
                                <div className="msg-psych-card__actions">
                                    <button
                                        className="msg-btn msg-btn-primary msg-btn-small"
                                        onClick={() => handleRequestPsychologist(featuredPsychologist)}
                                        disabled={!canRequestSupport || allocationModal.loading || !featuredPsychologist}
                                    >
                                        {allocationModal.loading ? 'Requesting...' : 'Request private support'}
                                    </button>
                                    <button
                                        className="msg-btn msg-btn-outline msg-btn-small"
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
                                            className="msg-btn msg-btn-outline msg-btn-small"
                                        >
                                            View profile
                                        </a>
                                    )}
                                </div>
                                <p className="msg-psych-card__note msg-psych-card__note--muted">
                                    Free employees are limited to one psychologist at a time. {autoDeleteNote}
                                </p>
                            </section>

                            <section className="msg-status-card">
                                <div className="msg-status-header">
                                    <div>
                                        <p className="msg-status-label">Current Psychologist</p>
                                        <h4>{currentPsychologist?.display_name || 'Awaiting support'}</h4>
                                        {currentSpecialization && (
                                            <p className="msg-status-subtitle">{currentSpecialization}</p>
                                        )}
                                    </div>
                                    <span className={`msg-status-badge ${isConversationExpired ? 'warning' : 'active'}`}>
                                        {isConversationExpired ? 'Session ended' : 'Active'}
                                    </span>
                                </div>
                                {user?.role === 'employee' && (
                                    <div className="msg-rate-summary">
                                        <span>Session rate</span>
                                        {currentRatesLoading ? (
                                            <strong>Loading...</strong>
                                        ) : activePsychRate ? (
                                            <strong>
                                                {formatMoneyForUser(activePsychRate.amount_minor, user) || '—'}{' '}
                                                {activePsychRate.duration_type === 'per_minute' ? 'per minute' : 'per hour'}
                                            </strong>
                                        ) : (
                                            <strong>Not available yet</strong>
                                        )}
                                    </div>
                                )}
                                <div className="msg-status-line">
                                    <FaClock /> {timeLabel}
                                </div>
                                <div className="msg-status-progress">
                                    <div className="msg-progress-track">
                                        <div className="msg-progress-fill" style={{ width: `${sessionProgress}%` }} />
                                    </div>
                                    <p className="msg-progress-text">
                                        {sessionLimitMinutes} minute limit • Auto-deletes when time runs out
                                    </p>
                                </div>
                                <div className="msg-status-line">
                                    {hasResponse ? 'Psychologist has replied' : 'Waiting for a reply'}
                                </div>
                                <div className="msg-status-actions">
                                    <button
                                        className="msg-btn msg-btn-outline msg-btn-small"
                                        onClick={handleVideoCall}
                                        disabled={!canStartVideoCall || isFreeEmployee}
                                          title={isFreeEmployee ? callRestrictionCopy : undefined}
                                      >
                                        <FaVideo /> Setup video call
                                    </button>
                                    {user?.role === 'employee' && currentPsychologist && (
                                        <button
                                            className="msg-btn msg-btn-primary msg-btn-small"
                                            onClick={() => setBookingModalOpen(true)}
                                        >
                                            Book session
                                        </button>
                                    )}
                                    <button
                                        className="msg-btn msg-btn-secondary msg-btn-small"
                                        onClick={handleViewHistory}
                                        disabled={!activeConversation}
                                    >
                                        <FaHistory /> View message history
                                    </button>
                                    {isConversationExpired && (chatUsage?.remaining ?? 0) > 0 && (
                                        <button
                                            className="msg-btn msg-btn-primary msg-btn-small"
                                            onClick={handleExtendSession}
                                            disabled={extendingSession}
                                        >
                                            {extendingSession ? 'Extending…' : 'Extend session'}
                                        </button>
                                    )}
                                </div>
                                {isConversationExpired && (chatUsage?.remaining ?? 0) > 0 && (
                                    <div className="msg-extend">
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
                                      <div className="msg-upgrade-reminder">
                                          <FaExclamationTriangle />
                                          <span>
                                              {isConversationExpired
                                                  ? 'Upgrade to premium to keep conversations alive longer and preserve history.'
                                                  : 'Time is running out on the free plan. Upgrade to extend the session.'}
                                          </span>
                                      </div>
                                  )}
                                  {isFreeEmployee && (
                                      <div className="msg-upgrade-reminder" style={{ marginTop: '0.75rem' }}>
                                          <FaLock />
                                          <span>
                                              {callRestrictionCopy} Psychologists can still initiate a call with you.
                                          </span>
                                      </div>
                                  )}
                            </section>

                            <section className="msg-sponsored-slot">
                                   <SponsoredCard
                                    placement="category"
                                    behaviors={[userRole, featuredSpecialization].filter(Boolean)}
                                    rotateIntervalMs={65000}
                                />
                            </section>
                        </div>
                    )}

                    <div
                        className="msg-thread-wrapper"
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
                            onSendVoiceNote={handleSendVoiceNote}
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
                <div className="msg-call-overlay">
                    <div className={`msg-call-modal ${callView}`} ref={callModalRef}>
                        <div className="msg-call-header">
                            <h3>{callState.mediaType === 'voice' ? 'Voice Call' : 'Video Call'}</h3>
                            {callState.status === 'incoming' && <span>Incoming call...</span>}
                            {callState.status === 'calling' && <span>Calling...</span>}
                            {callState.status === 'in-call' && <span>Connected • {new Date(callDurationSec * 1000).toISOString().substr(11, 8)}</span>}
                        </div>
                        {callState.status === 'in-call' && (
                            <div className="msg-call-status-badge">On call</div>
                        )}
                        <div className="msg-call-videos">
                            <video ref={remoteVideoRef} autoPlay playsInline className="msg-call-video remote" />
                            <video ref={localVideoRef} autoPlay playsInline muted className="msg-call-video local" />
                        </div>
                        <div className="msg-call-actions">
                            {callState.status === 'incoming' ? (
                                <>
                                    <button className="msg-btn msg-btn-primary" onClick={acceptCall}>Accept</button>
                                    <button className="msg-btn msg-btn-secondary" onClick={declineCall}>Decline</button>
                                </>
                            ) : (
                                <>
                                    <button className="msg-btn msg-btn-outline msg-btn-small" onClick={toggleMute}>
                                        {isMuted ? 'Unmute' : 'Mute'}
                                    </button>
                                    {callState.mediaType === 'video' && (
                                        <button className="msg-btn msg-btn-outline msg-btn-small" onClick={toggleCamera}>
                                            {isCameraOff ? 'Camera On' : 'Camera Off'}
                                        </button>
                                    )}
                                    <button className="msg-btn msg-btn-outline msg-btn-small" onClick={toggleCallView}>
                                        {callView === 'expanded' ? 'Compact' : 'Expand'}
                                    </button>
                                    <button className="msg-btn msg-btn-outline msg-btn-small" onClick={toggleFullscreen}>
                                        Fullscreen
                                    </button>
                                    <button className="msg-btn msg-btn-secondary" onClick={() => endCall(true)}>End Call</button>
                                </>
                            )}
                        </div>
                        {callState.status === 'in-call' && supportsAudioOutput && audioOutputs.length > 0 && (
                            <div className="msg-call-audio-output">
                                <label>
                                    Speaker
                                    <select
                                        value={selectedAudioOutput}
                                        onChange={(event) => setSelectedAudioOutput(event.target.value)}
                                    >
                                        <option value="default">System default</option>
                                        {audioOutputs.map((device) => (
                                            <option key={device.deviceId} value={device.deviceId}>
                                                {device.label || 'Audio output'}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {isSidebarOpen && isMobileView && (
                <div
                    className="msg-sidebar-overlay"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
            <SessionRatingModal
                open={Boolean(activeRatingSession)}
                session={activeRatingSession}
                submitting={ratingSubmitting}
                onSubmit={handleSubmitRating}
                onSkip={handleSkipRating}
            />
            <ChatAllocationModal
                open={allocationModal.open}
                psychologist={allocationModal.psychologist}
                remainingMinutes={chatUsage?.remaining}
                dailyLimit={chatUsage?.limit}
                loading={allocationModal.loading}
                onClose={() => setAllocationModal({ open: false, psychologist: null, loading: false })}
                onConfirm={handleConfirmAllocation}
            />
            <CallDurationModal
                open={callDurationOpen}
                onClose={() => setCallDurationOpen(false)}
                onConfirm={handleConfirmCallDuration}
                entitlement={callEntitlement?.entitlement}
                callFeeMinor={callEntitlement?.callFeeMinor}
            />
            <EmployeeVideoCallModal
                open={videoCallModalOpen}
                onClose={() => setVideoCallModalOpen(false)}
                availability={videoCallAvailability}
                rates={currentRates}
                weekStart={videoCallWeekStart}
                onWeekChange={(nextWeek) => {
                    setVideoCallWeekStart(nextWeek);
                    fetchVideoCallAvailability(nextWeek);
                }}
                onConfirm={handleConfirmVideoCall}
                hasSavedCard={hasSavedCard}
                loading={videoCallScheduling}
            />
            <PsychologistBookingModal
                open={bookingModalOpen}
                psychologist={currentPsychologist}
                onClose={() => setBookingModalOpen(false)}
            />
        </div>
    );
};

export default Messages;












