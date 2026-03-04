const jwt = require('jsonwebtoken');
const { User, Role } = require('../models');

const authenticate = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            throw new Error('Missing token');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findByPk(decoded.id, {
            include: [{ model: Role }]
        });

        if (!user || !user.isActive) {
            throw new Error('Invalid user');
        }

        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Please authenticate' });
    }
};

const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userRole = req.user.Role?.name;

        if (!userRole || (!allowedRoles.includes(userRole) && userRole !== 'super_admin')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
};

const checkPermission = (resource, action) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const roleName = req.user.Role?.name;
        let permissions = req.user.Role?.permissions || {};

        if (typeof permissions === 'string') {
            try {
                permissions = JSON.parse(permissions);
            } catch (e) {
                permissions = {};
            }
        }

        if (roleName === 'super_admin') {
            return next();
        }

        if (!permissions[resource] || !permissions[resource].includes(action)) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        next();
    };
};

module.exports = { authenticate, authorize, checkPermission };
