
const jwt = require('jsonwebtoken');
const { query } = require('../utils/database');
const { getRoleFlags } = require('./roleFlags');

const AUTH_CACHE_TTL_MS = Number(process.env.AUTH_CACHE_TTL_MS || 60_000);
const authCache = new Map();
const authInFlight = new Map();

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

    const cached = authCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
        req.user = cached.user;
        return next();
    }

    const inFlight = authInFlight.get(token);
    if (inFlight) {
        try {
            const user = await inFlight;
            req.user = user;
            return next();
        } catch (error) {
            console.error('Auth DB error:', error.message);
            return res.status(503).json({ error: 'Authentication service unavailable. Please try again.' });
        }
    }

    const fetchPromise = (async () => {
        const result = await query(
            `SELECT
                 id,
                 email,
                 role,
                 is_anonymous,
                 display_name,
                 token_version,
                 subscription_tier,
                 subscription_expires,
                 daily_chat_quota_mins,
                 used_chat_minutes,
                 last_chat_reset
             FROM users
             WHERE id = $1`,
            [decoded.userId]
        );
        if (result.rows.length === 0) {
            const err = new Error('User not found');
            err.statusCode = 401;
            throw err;
        }
        const user = result.rows[0];
        const normalizedRole = String(user.role || '').toLowerCase().trim();
        const isAdminRole = ['super_admin', 'superadmin', 'system_admin', 'admin', 'hr_admin'].includes(normalizedRole);
        const tokenVersion = Number(decoded.tokenVersion ?? 0);
        if (!isAdminRole && tokenVersion !== Number(user.token_version ?? 0)) {
            const err = new Error('Session expired. Please login again.');
            err.statusCode = 401;
            throw err;
        }
        const enrichedUser = {
            ...user,
            role_flags: getRoleFlags(user.role)
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

    req.user = user;
    next();
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

module.exports = { authenticate, authorize, getTokenFromRequest };
