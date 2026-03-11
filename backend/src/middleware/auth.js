
const jwt = require('jsonwebtoken');
const { query } = require('../utils/database');
const { getRoleFlags } = require('./roleFlags');

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
    try {
        const token = getTokenFromRequest(req);

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const result = await query(
            'SELECT id, email, role, is_anonymous, display_name, token_version FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        const tokenVersion = Number(decoded.tokenVersion ?? 0);
        const normalizedRole = String(user.role || '').toLowerCase().trim();
        const isAdminRole = ['super_admin', 'superadmin', 'system_admin', 'admin', 'hr_admin'].includes(normalizedRole);

        if (!isAdminRole && tokenVersion !== Number(user.token_version ?? 0)) {
            return res.status(401).json({ error: 'Session expired. Please login again.' });
        }

        req.user = {
            ...user,
            role_flags: getRoleFlags(user.role)
        };
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Unauthorized access' });
        }

        next();
    };
};

module.exports = { authenticate, authorize, getTokenFromRequest };
