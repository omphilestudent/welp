
const jwt = require('jsonwebtoken');
const { query } = require('../utils/database');
const { getRoleFlags } = require('./roleFlags');
const { getPsychologistPlan, psychologistHasLeadAccess } = require('../services/psychologistBillingService');
const staff = require('../utils/welpStaff');
const { fetchSessionSettings } = require('../utils/sessionSettings');

const AUTH_CACHE_TTL_MS = Number(process.env.AUTH_CACHE_TTL_MS || 60_000);
const authCache = new Map();
const authInFlight = new Map();
const SESSION_SETTINGS_CACHE_TTL_MS = Number(process.env.SESSION_SETTINGS_CACHE_TTL_MS || 60_000);
const INACTIVITY_GRACE_MS = Number(process.env.INACTIVITY_GRACE_MS || 10_000);
const LAST_ACTIVE_UPDATE_INTERVAL_MS = Number(process.env.LAST_ACTIVE_UPDATE_INTERVAL_MS || 30_000);
let sessionSettingsCache = { value: null, expiresAt: 0 };

const getSessionSettingsCached = async () => {
    if (sessionSettingsCache.value && sessionSettingsCache.expiresAt > Date.now()) {
        return sessionSettingsCache.value;
    }
    try {
        const settings = await fetchSessionSettings();
        sessionSettingsCache = { value: settings, expiresAt: Date.now() + SESSION_SETTINGS_CACHE_TTL_MS };
        return settings;
    } catch (error) {
        console.warn('Failed to load session settings:', error.message);
        const fallback = { inactivityTimeoutMinutes: 30, autoLogoutEnabled: false };
        sessionSettingsCache = { value: fallback, expiresAt: Date.now() + SESSION_SETTINGS_CACHE_TTL_MS };
        return fallback;
    }
};

const enforceInactivityTimeout = async (userId) => {
    const settings = await getSessionSettingsCached();
    if (!userId) return { expired: false };

    if (!settings.autoLogoutEnabled) {
        await query(
            `UPDATE users
             SET last_active = CURRENT_TIMESTAMP
             WHERE id = $1
               AND (last_active IS NULL OR last_active < (CURRENT_TIMESTAMP - INTERVAL '30 seconds'))`,
            [userId]
        );
        return { expired: false };
    }

    const timeoutMs = Math.max(0, Number(settings.inactivityTimeoutMinutes || 0) * 60_000);
    if (!timeoutMs) {
        return { expired: false };
    }

    const result = await query('SELECT last_active FROM users WHERE id = $1', [userId]);
    const lastActiveRaw = result.rows[0]?.last_active;
    const lastActiveMs = lastActiveRaw ? new Date(lastActiveRaw).getTime() : null;
    const now = Date.now();
    if (lastActiveMs && now - lastActiveMs > timeoutMs + INACTIVITY_GRACE_MS) {
        return { expired: true };
    }

    if (!lastActiveMs || now - lastActiveMs > LAST_ACTIVE_UPDATE_INTERVAL_MS) {
        await query('UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
    }

    return { expired: false };
};

const getTokenFromRequest = (req) => {
    const cookieToken = req.cookies?.token;
    if (cookieToken) return cookieToken;

    const authorization = req.headers.authorization;
    if (!authorization) return null;

    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) return null;

    return token;
};

const authenticate = async (req, res, next) => {
    const token = getTokenFromRequest(req);

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
    req.auth = decoded;

    const cached = authCache.get(token);
    const finalizeAuth = async (user) => {
        req.user = user;
        req.auth = decoded;
        try {
            const inactivity = await enforceInactivityTimeout(user?.id);
            if (inactivity.expired) {
                return res.status(401).json({ error: 'Session expired due to inactivity', message: 'Session expired due to inactivity' });
            }
        } catch (error) {
            console.warn('Failed to enforce inactivity timeout:', error.message);
        }

        const path = String(req.originalUrl || req.url || '').replace(/^\/api/, '');
        const bypassPrefixes = [
            '/auth/remote-pin',
            '/auth/me',
            '/auth/logout',
            '/auth/refresh',
            '/auth/session-settings'
        ];
        const shouldBypassPin = bypassPrefixes.some((prefix) => path.startsWith(prefix));
        const hasPin = Boolean(user.remote_pin_hash);
        const pinVerified = Boolean(decoded?.pinVerified);

        if (!shouldBypassPin) {
            if (!hasPin) {
                return res.status(403).json({
                    error: 'Remote PIN setup required',
                    code: 'PIN_SETUP_REQUIRED'
                });
            }
            if (!pinVerified) {
                return res.status(403).json({
                    error: 'Remote PIN verification required',
                    code: 'PIN_REQUIRED'
                });
            }
        }

        return next();
    };
    if (cached && cached.expiresAt > Date.now()) {
        return finalizeAuth(cached.user);
    }

    const inFlight = authInFlight.get(token);
    if (inFlight) {
        try {
            const user = await inFlight;
            return finalizeAuth(user);
        } catch (error) {
            console.error('Auth DB error:', error.message);
            return res.status(503).json({ error: 'Authentication service unavailable. Please try again.' });
        }
    }

    const fetchPromise = (async () => {
        const result = await query(
            `SELECT
                 u.id,
                 u.email,
                 u.role,
                 u.is_anonymous,
                 u.display_name,
                 u.token_version,
                 u.subscription_tier,
                 u.subscription_expires,
                 u.daily_chat_quota_mins,
                 u.used_chat_minutes,
                 u.last_chat_reset,
                 u.kyc_status,
                 u.documents_submitted,
                 u.can_use_profile,
                 u.remote_pin_hash,
                 u.remote_pin_set_at,
                 u.remote_pin_attempt_count,
                 u.remote_pin_locked_until,
                 ws.staff_role_key,
                 ws.department as staff_department
             FROM users u
             LEFT JOIN welp_staff ws ON ws.user_id = u.id AND ws.is_active = true
             WHERE u.id = $1`,
            [decoded.userId]
        );
        if (result.rows.length === 0) {
            const err = new Error('User not found');
            err.statusCode = 401;
            throw err;
        }
        const user = result.rows[0];
        const normalizedRole = String(user.role || '').toLowerCase().trim();
        const staffRole = user.staff_role_key;
        const isAdminRole = staff.isInternalAdminRole(staffRole) || staff.isLegacyAdminRole(normalizedRole);
        const tokenVersion = Number(decoded.tokenVersion ?? 0);
        if (!isAdminRole && tokenVersion !== Number(user.token_version ?? 0)) {
            const err = new Error('Session expired. Please login again.');
            err.statusCode = 401;
            throw err;
        }
        const baseFlags = getRoleFlags(user.role);
        let roleFlags = { ...baseFlags };
        if (normalizedRole === 'psychologist') {
            try {
                const plan = await getPsychologistPlan(user.id);
                const leadAccess = await psychologistHasLeadAccess(user.id);
                roleFlags = {
                    ...roleFlags,
                    plan: plan.tier || roleFlags.plan || 'free',
                    leads: Boolean(leadAccess)
                };
            } catch (entError) {
                console.warn('Psychologist entitlement lookup failed:', entError.message);
            }
        }

        const enrichedUser = {
            ...user,
            isWelpStaff: Boolean(staffRole),
            staffRoleKey: staffRole || null,
            staffDepartment: user.staff_department || null,
            role_flags: roleFlags
        };
        authCache.set(token, { user: enrichedUser, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
        return enrichedUser;
    })();

    authInFlight.set(token, fetchPromise);
    let user;
    try {
        user = await fetchPromise;
    } catch (error) {
        authInFlight.delete(token);
        if (error.statusCode === 401) {
            return res.status(401).json({ error: error.message });
        }
        console.error('Auth DB error:', error.message);
        return res.status(503).json({ error: 'Authentication service unavailable. Please try again.' });
    }
    authInFlight.delete(token);

    return finalizeAuth(user);
};

const normalizeRole = (value) => String(value || '').toLowerCase();

const authorize = (...roles) => {
    const allowedRoles = roles.map(normalizeRole);
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        if (!allowedRoles.length) {
            return next();
        }

        const userRole = normalizeRole(req.user.role);
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions'
            });
        }

        next();
    };
};

const authenticateOptional = (req, res, next) => {
    const token = getTokenFromRequest(req);
    if (!token) {
        return next();
    }
    return authenticate(req, res, next);
};

module.exports = { authenticate, authenticateOptional, authorize, getTokenFromRequest };
