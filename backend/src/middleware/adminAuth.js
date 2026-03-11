
const { query } = require('../utils/database');

const authorizeAdmin = (requiredPermissions = []) => {
    return async (req, res, next) => {
        try {

            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }


            const adminResult = await query(
                `SELECT au.*, ar.name as role_name, ar.permissions as role_permissions
                 FROM admin_users au
                 JOIN admin_roles ar ON au.role_id = ar.id
                 WHERE au.user_id = $1 AND au.is_active = true`,
                [req.user.id]
            );

            if (adminResult.rows.length === 0) {
                const normalizedUserRole = req.user.role?.toLowerCase();
                const isLegacyAdminRole = ['admin', 'super_admin', 'system_admin'].includes(normalizedUserRole);

                if (!isLegacyAdminRole) {
                    return res.status(403).json({ error: 'Admin access required' });
                }

                req.admin = {
                    id: null,
                    user_id: req.user.id,
                    role_name: normalizedUserRole,
                    role_permissions: {}
                };

                return next();
            }

            const admin = adminResult.rows[0];
            req.admin = admin;


            if (requiredPermissions.length > 0) {
                const hasPermissions = requiredPermissions.every(perm => {
                    const [resource, action] = perm.split('.');
                    return admin.role_permissions?.[resource]?.[action] === true;
                });

                if (!hasPermissions) {
                    return res.status(403).json({ error: 'Insufficient permissions' });
                }
            }


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


            const adminResult = await query(
                `SELECT au.*, ar.name as role_name
                 FROM admin_users au
                 JOIN admin_roles ar ON au.role_id = ar.id
                 WHERE au.user_id = $1 AND au.is_active = true
                 AND (ar.name = 'hr_admin' OR ar.name = 'super_admin' OR ar.name = 'system_admin' OR ar.name = 'admin')`,
                [req.user.id]
            );

            if (adminResult.rows.length === 0) {
                const normalizedUserRole = req.user.role?.toLowerCase();
                const isLegacyHRRole = ['hr', 'hr_admin', 'super_admin', 'admin', 'system_admin'].includes(normalizedUserRole);

                if (!isLegacyHRRole) {
                    return res.status(403).json({ error: 'HR access required' });
                }

                req.hrAdmin = {
                    id: null,
                    user_id: req.user.id,
                    role_name: normalizedUserRole
                };

                return next();
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
