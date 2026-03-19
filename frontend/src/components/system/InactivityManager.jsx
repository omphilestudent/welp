import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { isWelpAdmin } from '../../utils/roleUtils';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'touchmove', 'click'];
const BROADCAST_CHANNEL_NAME = 'welp_session_activity';
const LOCAL_ACTIVITY_KEY = 'welp_session_activity';
const LOCAL_LOGOUT_KEY = 'welp_session_logout';
const INACTIVITY_LOGOUT_FLAG = 'welp_inactivity_logout';
const WARNING_MS = 60_000;
const GRACE_MS = 10_000;
const ACTIVITY_THROTTLE_MS = 1000;

const normalizeSettings = (payload = {}) => {
    const timeoutRaw = payload.inactivityTimeoutMinutes ?? payload.inactivityTimeout ?? 30;
    const parsed = Number(timeoutRaw);
    return {
        inactivityTimeoutMinutes: Number.isFinite(parsed) && parsed > 0 ? parsed : 30,
        autoLogoutEnabled: Boolean(payload.autoLogoutEnabled)
    };
};

const InactivityManager = () => {
    const { isAuthenticated, logout, user } = useAuth();
    const [settings, setSettings] = useState({ inactivityTimeoutMinutes: 30, autoLogoutEnabled: false });
    const [warningOpen, setWarningOpen] = useState(false);
    const timersRef = useRef({ warning: null, logout: null });
    const lastActivityRef = useRef(Date.now());
    const channelRef = useRef(null);
    const throttleRef = useRef(0);

    const clearTimers = useCallback(() => {
        if (timersRef.current.warning) {
            clearTimeout(timersRef.current.warning);
            timersRef.current.warning = null;
        }
        if (timersRef.current.logout) {
            clearTimeout(timersRef.current.logout);
            timersRef.current.logout = null;
        }
    }, []);

    const handleLogout = useCallback(async ({ reason = 'timeout', broadcast = true } = {}) => {
        clearTimers();
        setWarningOpen(false);
        if (broadcast) {
            if (channelRef.current) {
                channelRef.current.postMessage({ type: 'logout', reason, timestamp: Date.now() });
            }
            localStorage.setItem(LOCAL_LOGOUT_KEY, String(Date.now()));
        }
        localStorage.setItem(INACTIVITY_LOGOUT_FLAG, JSON.stringify({ reason, at: Date.now() }));
        try {
            await logout();
        } catch {
            // ignore logout errors
        } finally {
            toast.error('You have been logged out due to inactivity.');
            window.location.href = '/login';
        }
    }, [clearTimers, logout]);

    const scheduleTimers = useCallback((timeoutMs) => {
        clearTimers();
        if (!timeoutMs || timeoutMs <= 0) return;
        const warningDelay = timeoutMs - WARNING_MS;
        if (warningDelay > 0) {
            timersRef.current.warning = setTimeout(() => {
                setWarningOpen(true);
            }, warningDelay);
        }
        timersRef.current.logout = setTimeout(() => {
            handleLogout({ reason: 'timeout' });
        }, timeoutMs + GRACE_MS);
    }, [clearTimers, handleLogout]);

    const broadcastActivity = useCallback((timestamp) => {
        if (channelRef.current) {
            channelRef.current.postMessage({ type: 'activity', timestamp });
        }
        localStorage.setItem(LOCAL_ACTIVITY_KEY, String(timestamp));
    }, []);

    const handleActivity = useCallback((timestamp = Date.now(), { broadcast = true } = {}) => {
        lastActivityRef.current = timestamp;
        if (warningOpen) {
            setWarningOpen(false);
        }
        if (settings.autoLogoutEnabled) {
            scheduleTimers(settings.inactivityTimeoutMinutes * 60_000);
        }
        if (broadcast) {
            broadcastActivity(timestamp);
        }
    }, [broadcastActivity, scheduleTimers, settings.autoLogoutEnabled, settings.inactivityTimeoutMinutes, warningOpen]);

    useEffect(() => {
        if (!isAuthenticated) {
            clearTimers();
            setWarningOpen(false);
            return;
        }
        let cancelled = false;
        const fetchSettings = async () => {
            try {
                const { data } = await api.get('/auth/session-settings');
                if (!cancelled) {
                    setSettings(normalizeSettings(data));
                }
            } catch (error) {
                if (error?.response?.status === 404) {
                    if (isWelpAdmin(user)) {
                        try {
                            const { data } = await api.get('/admin/session-settings');
                            if (!cancelled) {
                                setSettings(normalizeSettings(data));
                                return;
                            }
                        } catch {
                            // ignore fallback failures
                        }
                    }
                }
                if (!cancelled) {
                    setSettings((prev) => ({ ...prev, autoLogoutEnabled: false }));
                }
            }
        };
        fetchSettings();
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated || !settings.autoLogoutEnabled) {
            clearTimers();
            setWarningOpen(false);
            return;
        }
        handleActivity(Date.now(), { broadcast: false });
    }, [clearTimers, handleActivity, isAuthenticated, settings.autoLogoutEnabled, settings.inactivityTimeoutMinutes]);

    useEffect(() => {
        if (!isAuthenticated || !settings.autoLogoutEnabled) return;
        const handler = () => {
            const now = Date.now();
            if (now - throttleRef.current < ACTIVITY_THROTTLE_MS) return;
            throttleRef.current = now;
            handleActivity(now);
        };
        ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, handler, { passive: true }));
        return () => {
            ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handler));
        };
    }, [handleActivity, isAuthenticated, settings.autoLogoutEnabled]);

    useEffect(() => {
        if (!isAuthenticated || !settings.autoLogoutEnabled) return;
        const handleStorage = (event) => {
            if (event.key === LOCAL_ACTIVITY_KEY && event.newValue) {
                const ts = Number(event.newValue);
                if (Number.isFinite(ts)) {
                    handleActivity(ts, { broadcast: false });
                }
            }
            if (event.key === LOCAL_LOGOUT_KEY && event.newValue) {
                handleLogout({ reason: 'remote', broadcast: false });
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [handleActivity, handleLogout, isAuthenticated, settings.autoLogoutEnabled]);

    useEffect(() => {
        if (!isAuthenticated || !settings.autoLogoutEnabled) return;
        if (!('BroadcastChannel' in window)) return;
        const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        channel.onmessage = (event) => {
            if (event.data?.type === 'activity') {
                handleActivity(event.data.timestamp, { broadcast: false });
            }
            if (event.data?.type === 'logout') {
                handleLogout({ reason: 'remote', broadcast: false });
            }
        };
        channelRef.current = channel;
        return () => {
            channel.close();
            channelRef.current = null;
        };
    }, [handleActivity, handleLogout, isAuthenticated, settings.autoLogoutEnabled]);

    if (!isAuthenticated || !settings.autoLogoutEnabled || !warningOpen) {
        return null;
    }

    return (
        <div className="inactivity-modal">
            <div className="inactivity-modal__card" role="dialog" aria-modal="true">
                <h3>Session expiring soon</h3>
                <p>You will be logged out in 1 minute due to inactivity.</p>
                <div className="inactivity-modal__actions">
                    <button className="btn btn-secondary" onClick={() => handleActivity(Date.now())}>
                        Stay Logged In
                    </button>
                    <button className="btn btn-primary" onClick={() => handleLogout({ reason: 'manual' })}>
                        Logout Now
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InactivityManager;
