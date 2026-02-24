// backend/src/middleware/adminAuth.js
const { query } = require('../utils/database');

const authorizeAdmin = (requiredPermissions = []) => {
    return async (req, res, next) => {
        try {
            // Check if user is authenticated
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            // Check if user is an admin
            const adminResult = await query(
                `SELECT au.*, ar.name as role_name, ar.permissions as role_permissions
                 FROM admin_users au
                 JOIN admin_roles ar ON au.role_id = ar.id
                 WHERE au.user_id = $1 AND au.is_active = true`,
                [req.user.id]
            );

            if (adminResult.rows.length === 0) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const admin = adminResult.rows[0];
            req.admin = admin;

            // Check specific permissions if required
            if (requiredPermissions.length > 0) {
                const hasPermissions = requiredPermissions.every(perm => {
                    const [resource, action] = perm.split('.');
                    return admin.role_permissions?.[resource]?.[action] === true;
                });

                if (!hasPermissions) {
                    return res.status(403).json({ error: 'Insufficient permissions' });
                }
            }

            // Log access for audit
            await query(
                `INSERT INTO audit_logs (user_id, admin_id, action, ip_address, user_agent)
                 VALUES ($1, $2, $3, $4, $5)`,
                [req.user.id, admin.id, 'admin_access', req.ip, req.headers['user-agent']]
            );

            next();
        } catch (error) {
            console.error('Admin authorization error:', error);
            res.status(500).json({ error: 'Authorization failed' });
        }
    };
};

const authorizeHR = () => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            // Check if user is HR admin
            const adminResult = await query(
                `SELECT au.*, ar.name as role_name
                 FROM admin_users au
                 JOIN admin_roles ar ON au.role_id = ar.id
                 WHERE au.user_id = $1 AND au.is_active = true 
                 AND (ar.name = 'hr_admin' OR ar.name = 'super_admin')`,
                [req.user.id]
            );

            if (adminResult.rows.length === 0) {
                return res.status(403).json({ error: 'HR access required' });
            }

            req.hrAdmin = adminResult.rows[0];
            next();
        } catch (error) {
            console.error('HR authorization error:', error);
            res.status(500).json({ error: 'Authorization failed' });
        }
    };
};

module.exports = { authorizeAdmin, authorizeHR };