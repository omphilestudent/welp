// backend/src/controllers/adminController.js
const { query } = require('../utils/database');
const bcrypt = require('bcryptjs');
const { getAdminNotifications, markAdminNotificationRead } = require('../utils/adminNotifications');
const { recordAuditLog } = require('../utils/auditLogger');
const { fetchSessionSettings, persistSessionSettings } = require('../utils/sessionSettings');
const {
    listApplications,
    applyApplicationAction,
    STATUS_LABELS: APPLICATION_STATUS_LABELS
} = require('../services/applicationWorkflowService');
const { sendApplicationStatusEmail } = require('../utils/emailService');
const { resolveAccountNumber } = require('../services/accountNumberService');
const {
    listReviewNotificationLogs,
    resendReviewNotificationLog
} = require('../services/reviewNotificationService');

// ─── Helpers ─────────────────────────────────────────────────────────────────
const tableExists = async (tableName) => {
    try {
        const result = await query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = $1
            )`, [tableName]
        );
        return result.rows[0].exists;
    } catch { return false; }
};

const columnExists = async (tableName, columnName) => {
    try {
        const result = await query(
            `SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
            )`, [tableName, columnName]
        );
        return result.rows[0].exists;
    } catch { return false; }
};

const getTableColumns = async (tableName) => {
    try {
        const result = await query(
            `SELECT column_name
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = $1`,
            [tableName]
        );
        return result.rows.map(r => r.column_name);
    } catch {
        return [];
    }
};

const getColumnType = async (tableName, columnName) => {
    try {
        const result = await query(
            `SELECT data_type
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = $1
               AND column_name = $2`,
            [tableName, columnName]
        );
        return result.rows[0]?.data_type || null;
    } catch {
        return null;
    }
};

const resolveUpdatedBy = async (userId) => {
    if (!userId) return null;
    try {
        if (!await tableExists('users')) return null;
        const result = await query('SELECT id FROM users WHERE id = $1', [userId]);
        return result.rows.length ? userId : null;
    } catch {
        return null;
    }
};

const ensureSystemSettingsTable = async () => {
    try {
        console.log('Creating system_settings table...');
        const exists = await tableExists('system_settings');
        if (exists) {
            console.log('system_settings table already exists');
            return true;
        }

        await query(
            `CREATE TABLE IF NOT EXISTS system_settings (
                key VARCHAR(128) PRIMARY KEY,
                value JSONB NOT NULL,
                updated_by UUID,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )`
        );

        console.log('system_settings table created successfully');

        const defaultSettings = [
            { key: 'site_name', value: JSON.stringify('Welp Hub') },
            { key: 'site_url', value: JSON.stringify('https://welphub.onrender.com') },
            { key: 'maintenance_mode', value: JSON.stringify(false) },
            { key: 'registration_enabled', value: JSON.stringify(true) },
            { key: 'default_user_role', value: JSON.stringify('employee') },
            { key: 'session_timeout', value: JSON.stringify(30) },
            { key: 'inactivity_timeout_minutes', value: JSON.stringify(30) },
            { key: 'auto_logout_enabled', value: JSON.stringify(false) },
            { key: 'max_login_attempts', value: JSON.stringify(5) },
            { key: 'two_factor_auth', value: JSON.stringify(false) },
            { key: 'email_notifications', value: JSON.stringify(true) },
            { key: 'backup_frequency', value: JSON.stringify('daily') },
            { key: 'logs_retention', value: JSON.stringify('30 days') },
            { key: 'system_email', value: JSON.stringify('') },
            { key: 'company_name', value: JSON.stringify('') },
            { key: 'timezone', value: JSON.stringify('UTC') },
            { key: 'date_format', value: JSON.stringify('MM/DD/YYYY') }
        ];

        for (const setting of defaultSettings) {
            try {
                await query(
                    `INSERT INTO system_settings (key, value, created_at, updated_at)
                     VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                     ON CONFLICT (key) DO NOTHING`,
                    [setting.key, setting.value]
                );
                console.log(`Inserted default setting: ${setting.key}`);
            } catch (err) {
                console.error(`Error inserting default setting ${setting.key}:`, err.message);
            }
        }

        return true;
    } catch (error) {
        console.error('Failed to ensure system_settings table:', error.message);
        console.error('Error stack:', error.stack);
        return false;
    }
};

const APPLICATION_STATUS_ALIASES = {
    pending: 'pending_review',
    pending_review: 'pending_review',
    review: 'pending_review',
    verifying: 'under_verification',
    verification: 'under_verification',
    under_verification: 'under_verification',
    awaiting: 'awaiting_information',
    awaiting_information: 'awaiting_information',
    info: 'awaiting_information',
    approved: 'approved',
    rejected: 'rejected',
    all: 'all'
};

const normalizeApplicationStatusFilter = (value) => {
    if (!value) return 'pending_review';
    const key = String(value).toLowerCase().trim();
    return APPLICATION_STATUS_ALIASES[key] || 'all';
};

const normalizeApplicationTypeFilter = (value) => {
    if (!value || value === 'all') return 'all';
    const key = String(value).toLowerCase().trim();
    return ['psychologist', 'business'].includes(key) ? key : 'all';
};

const APPLICATION_ACTIONS = new Set([
    'verify_documents',
    'verify_ownership',
    'verify_experience',
    'request_info',
    'approve',
    'reject'
]);

const logAdminAction = async (adminId, action, entityType, entityId, oldValues, newValues) => {
    try {
        if (!await tableExists('audit_logs')) return;
        await query(
            `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, old_values, new_values)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [adminId, action, entityType, entityId,
                JSON.stringify(oldValues), JSON.stringify(newValues)]
        );
    } catch (err) {
        console.error('Failed to log admin action:', err.message);
    }
};

// ─── Admin Profile ────────────────────────────────────────────────────────────
const getAdminProfile = async (req, res) => {
    try {
        console.log('Getting admin profile for user:', req.user.id);

        const adminTableExists = await tableExists('admin_users');

        if (!adminTableExists) {
            const userResult = await query(
                `SELECT id, email, role, display_name, avatar_url FROM users WHERE id = $1`,
                [req.user.id]
            );
            if (userResult.rows.length === 0) return res.status(403).json({ error: 'User not found' });

            const user = userResult.rows[0];
            const adminRoles = ['admin', 'super_admin', 'system_admin', 'hr_admin'];
            if (!adminRoles.includes(user.role)) return res.status(403).json({ error: 'Not an admin user' });

            return res.json({
                success: true,
                data: {
                    id: user.id, user_id: user.id,
                    email: user.email, display_name: user.display_name,
                    avatar_url: user.avatar_url, role_name: user.role,
                    permissions: ['*'], is_active: true
                }
            });
        }

        const result = await query(
            `SELECT au.*, u.email, u.display_name, u.avatar_url,
                    COALESCE(ar.name, u.role) as role_name,
                    COALESCE(ar.permissions, '["*"]'::jsonb) as permissions
             FROM admin_users au
             JOIN users u ON au.user_id = u.id
             LEFT JOIN admin_roles ar ON au.role_id = ar.id
             WHERE au.user_id = $1 AND au.is_active = true`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            const userCheck = await query('SELECT role FROM users WHERE id = $1', [req.user.id]);
            if (userCheck.rows.length > 0) {
                const adminRoles = ['admin', 'super_admin', 'system_admin', 'hr_admin'];
                if (adminRoles.includes(userCheck.rows[0].role)) {
                    return res.json({
                        success: true,
                        data: {
                            user_id: req.user.id, role_name: userCheck.rows[0].role,
                            permissions: ['*'], is_active: true
                        }
                    });
                }
            }
            return res.status(403).json({ error: 'Not an admin user' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Get admin profile error:', error);
        res.status(500).json({ error: 'Failed to fetch admin profile' });
    }
};

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
const getDashboardStats = async (req, res) => {
    try {
        const [usersExist, companiesExist, reviewsExist, subscriptionsExist] = await Promise.all([
            tableExists('users'), tableExists('companies'),
            tableExists('reviews'), tableExists('subscriptions')
        ]);

        const stats = {
            users:         { total_users: 0, new_users_today: 0, employees: 0, psychologists: 0, businesses: 0 },
            companies:     { total_companies: 0, claimed_companies: 0, verified_companies: 0 },
            reviews:       { total_reviews: 0, pending_reviews: 0, avg_rating: 0 },
            subscriptions: { total_subscriptions: 0, active_subscriptions: 0, total_revenue: 0 },
            recentActivity: [], revenueGrowth: 12.5, userGrowth: 8.3
        };

        if (usersExist) {
            const r = await query(
                `SELECT COUNT(*) as total_users,
                        COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as new_users_today,
                        COUNT(CASE WHEN role = 'employee'    THEN 1 END) as employees,
                        COUNT(CASE WHEN role = 'psychologist' THEN 1 END) as psychologists,
                        COUNT(CASE WHEN role = 'business'    THEN 1 END) as businesses
                 FROM users`
            );
            stats.users = r.rows[0];
        }

        if (companiesExist) {
            const hasClaimed  = await columnExists('companies', 'is_claimed');
            const hasVerified = await columnExists('companies', 'is_verified');
            const q = hasClaimed && hasVerified
                ? `SELECT COUNT(*) as total_companies,
                          COUNT(CASE WHEN is_claimed  = true THEN 1 END) as claimed_companies,
                          COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_companies
                   FROM companies`
                : `SELECT COUNT(*) as total_companies, 0 as claimed_companies, 0 as verified_companies FROM companies`;
            stats.companies = (await query(q)).rows[0];
        }

        if (reviewsExist) {
            const hasPublic = await columnExists('reviews', 'is_public');
            const hasRating = await columnExists('reviews', 'rating');
            const q = hasPublic && hasRating
                ? `SELECT COUNT(*) as total_reviews,
                          COUNT(CASE WHEN is_public = false THEN 1 END) as pending_reviews,
                          COALESCE(AVG(rating), 0) as avg_rating
                   FROM reviews`
                : `SELECT COUNT(*) as total_reviews, 0 as pending_reviews, 0 as avg_rating FROM reviews`;
            stats.reviews = (await query(q)).rows[0];
        }

        if (subscriptionsExist) {
            const hasStatus = await columnExists('subscriptions', 'status');
            const hasPrice  = await columnExists('subscriptions', 'price');
            const q = hasStatus && hasPrice
                ? `SELECT COUNT(*) as total_subscriptions,
                          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_subscriptions,
                          COALESCE(SUM(price), 0) as total_revenue
                   FROM subscriptions`
                : `SELECT COUNT(*) as total_subscriptions, 0 as active_subscriptions, 0 as total_revenue FROM subscriptions`;
            stats.subscriptions = (await query(q)).rows[0];
        }

        const activityQueries = [];
        if (usersExist)    activityQueries.push(`SELECT 'user' as type, id, 'New user registered' as description, created_at FROM users WHERE created_at IS NOT NULL`);
        if (companiesExist) activityQueries.push(`SELECT 'company' as type, id, 'New company added' as description, created_at FROM companies WHERE created_at IS NOT NULL`);
        if (reviewsExist)  activityQueries.push(`SELECT 'review' as type, id, 'New review posted' as description, created_at FROM reviews WHERE created_at IS NOT NULL`);
        if (activityQueries.length > 0) {
            const r = await query(activityQueries.join(' UNION ALL ') + ' ORDER BY created_at DESC LIMIT 10');
            stats.recentActivity = r.rows;
        }

        res.json(stats);
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.json({
            users: { total_users: 0, new_users_today: 0, employees: 0, psychologists: 0, businesses: 0 },
            companies: { total_companies: 0, claimed_companies: 0, verified_companies: 0 },
            reviews: { total_reviews: 0, pending_reviews: 0, avg_rating: 0 },
            subscriptions: { total_subscriptions: 0, active_subscriptions: 0, total_revenue: 0 },
            recentActivity: [], revenueGrowth: 0, userGrowth: 0
        });
    }
};

// ─── Users CRUD ───────────────────────────────────────────────────────────────

/**
 * GET /admin/users
 * Returns { success: true, data: { users: [...], total: N } }
 */
const getUsers = async (req, res) => {
    try {
        const { page = 1, limit = 15, search = '', role = '', isActive = '' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const hasIsActive    = await columnExists('users', 'is_active');
        const hasPermissions = await columnExists('users', 'permissions');
        const hasPublicId    = await columnExists('users', 'public_id');
        const reviewsExist   = await tableExists('reviews');
        const normalized     = String(search || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        // Build SELECT
        let selectCols = `u.id, u.email, u.display_name, u.role, u.created_at, u.updated_at`;
        if (hasIsActive)    selectCols += `, u.is_active`;
        if (hasPermissions) selectCols += `, u.permissions`;
        if (hasPublicId)    selectCols += `, u.public_id`;

        let fromClause = `FROM users u`;
        if (reviewsExist) {
            selectCols += `, COUNT(r.id) as review_count`;
            fromClause += ` LEFT JOIN reviews r ON u.id = r.author_id`;
        }

        let where  = `WHERE 1=1`;
        const vals = [];
        let   idx  = 1;

        if (search) {
            let searchClause = `u.email ILIKE $${idx} OR u.display_name ILIKE $${idx} OR u.id::text ILIKE $${idx}`;
            if (hasPublicId) searchClause += ` OR u.public_id ILIKE $${idx}`;
            vals.push(`%${search}%`); idx++;

            if (normalized) {
                searchClause += ` OR regexp_replace(lower(COALESCE(u.display_name, '')), '[^a-z0-9]', '', 'g') LIKE $${idx}`;
                vals.push(`%${normalized}%`); idx++;
            }

            where += ` AND (${searchClause})`;
        }
        if (role) {
            where += ` AND u.role = $${idx}`;
            vals.push(role); idx++;
        }
        if (isActive !== '' && hasIsActive) {
            where += ` AND u.is_active = $${idx}`;
            vals.push(isActive === 'true'); idx++;
        }

        const groupBy = reviewsExist ? `GROUP BY u.id` : '';
        const orderBy = `ORDER BY u.created_at DESC`;
        const limitQ  = `LIMIT $${idx} OFFSET $${idx + 1}`;
        vals.push(parseInt(limit), offset);

        const [dataResult, countResult] = await Promise.all([
            query(`SELECT ${selectCols} ${fromClause} ${where} ${groupBy} ${orderBy} ${limitQ}`, vals),
            query(`SELECT COUNT(*) FROM users u ${where}`, vals.slice(0, -2))
        ]);

        res.json({
            success: true,
            data: {
                users: dataResult.rows,
                total: parseInt(countResult.rows[0].count),
                page:  parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
};

const getUserDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const reviewsExist = await tableExists('reviews');

        let queryText = `SELECT u.* FROM users u WHERE u.id = $1`;

        if (reviewsExist) {
            queryText = `
                SELECT u.*,
                       COUNT(r.id) as review_count,
                       COALESCE(AVG(r.rating), 0) as avg_rating
                FROM users u
                LEFT JOIN reviews r ON u.id = r.author_id
                WHERE u.id = $1
                GROUP BY u.id`;
        }

        const result = await query(queryText, [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Get user details error:', error);
        res.status(500).json({ error: 'Failed to fetch user details' });
    }
};

/**
 * POST /admin/users
 * Body: { email, password, displayName, role, isActive, permissions }
 */
const createUser = async (req, res) => {
    try {
        const { email, password, role, displayName, isActive = true, permissions } = req.body;

        if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
        if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

        const normalizedRole = String(role || '').toLowerCase().trim();
        const allowedRoles = ['employee', 'psychologist', 'business', 'admin', 'super_admin', 'hr_admin'];
        if (normalizedRole && !allowedRoles.includes(normalizedRole)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already exists' });

        const hashedPassword    = await bcrypt.hash(password, 10);
        const hasPermissionsCol = await columnExists('users', 'permissions');
        const hasIsActiveCol    = await columnExists('users', 'is_active');
        const hasIsVerifiedCol  = await columnExists('users', 'is_verified');

        const cols    = ['email', 'password_hash', 'role', 'display_name'];
        const holders = ['$1',   '$2',             '$3',   '$4'];
        const params  = [email, hashedPassword, normalizedRole || 'employee', displayName || email.split('@')[0]];
        let   idx     = 5;

        if (hasIsActiveCol)   { cols.push('is_active');   holders.push(`$${idx}`); params.push(isActive); idx++; }
        if (hasIsVerifiedCol) { cols.push('is_verified'); holders.push(`$${idx}`); params.push(true);     idx++; }
        if (hasPermissionsCol && permissions) {
            cols.push('permissions');
            holders.push(`$${idx}::jsonb`);
            params.push(JSON.stringify(permissions));
            idx++;
        }

        const result = await query(
            `INSERT INTO users (${cols.join(', ')}) VALUES (${holders.join(', ')})
             RETURNING id, email, display_name, role, created_at`,
            params
        );

        await logAdminAction(req.user.id, 'CREATE_USER', 'users', result.rows[0].id, null, result.rows[0]);

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
};

/**
 * PUT /admin/users/:id
 * Body: { displayName, role, isActive, permissions, password? }
 */
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { displayName, role, isActive, permissions, password } = req.body;

        const hasPermissionsCol = await columnExists('users', 'permissions');
        const hasIsActiveCol    = await columnExists('users', 'is_active');

        const oldUser = await query('SELECT * FROM users WHERE id = $1', [id]);
        if (oldUser.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const setClauses = [];
        const params     = [];
        let   idx        = 1;

        if (displayName !== undefined) { setClauses.push(`display_name = $${idx}`); params.push(displayName); idx++; }
        if (role        !== undefined) { setClauses.push(`role = $${idx}`);         params.push(role);        idx++; }
        if (isActive    !== undefined && hasIsActiveCol) {
            setClauses.push(`is_active = $${idx}`); params.push(isActive); idx++;
        }
        if (permissions !== undefined && hasPermissionsCol) {
            setClauses.push(`permissions = $${idx}::jsonb`);
            params.push(JSON.stringify(permissions)); idx++;
        }
        if (password && password.length >= 8) {
            const hashed = await bcrypt.hash(password, 10);
            setClauses.push(`password_hash = $${idx}`); params.push(hashed); idx++;
        }

        if (setClauses.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

        setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(id);

        const result = await query(
            `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
            params
        );

        await logAdminAction(req.user.id, 'UPDATE_USER', 'users', id, oldUser.rows[0], result.rows[0]);

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
};

/**
 * DELETE /admin/users/:id
 */
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await query('SELECT * FROM users WHERE id = $1', [id]);
        if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        // Prevent self-deletion
        if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });

        await query('DELETE FROM users WHERE id = $1', [id]);
        await logAdminAction(req.user.id, 'DELETE_USER', 'users', id, user.rows[0], null);

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
};

/**
 * POST /admin/users/bulk-delete
 * Body: { userIds: [...] }
 */
const bulkDeleteUsers = async (req, res) => {
    try {
        const { userIds } = req.body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ error: 'userIds must be a non-empty array' });
        }

        // Prevent self-deletion
        const safeIds = userIds.filter(id => id !== req.user.id);

        if (safeIds.length === 0) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        const placeholders = safeIds.map((_, i) => `$${i + 1}`).join(', ');
        await query(`DELETE FROM users WHERE id IN (${placeholders})`, safeIds);

        await logAdminAction(req.user.id, 'BULK_DELETE_USERS', 'users', null, { count: safeIds.length }, null);

        res.json({ success: true, message: `${safeIds.length} users deleted` });
    } catch (error) {
        console.error('Bulk delete users error:', error);
        res.status(500).json({ error: 'Failed to delete users' });
    }
};

/**
 * POST /admin/users/reset-password
 * Body: { userId, newPassword }
 */
const resetUserPassword = async (req, res) => {
    try {
        const { userId, newPassword } = req.body;

        if (!userId || !newPassword) return res.status(400).json({ error: 'userId and newPassword are required' });
        if (newPassword.length < 8)  return res.status(400).json({ error: 'Password must be at least 8 characters' });

        const userCheck = await query('SELECT id, email FROM users WHERE id = $1', [userId]);
        if (userCheck.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const hashed = await bcrypt.hash(newPassword, 10);
        await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hashed, userId]);

        await logAdminAction(req.user.id, 'RESET_PASSWORD', 'users', userId, null, { email: userCheck.rows[0].email });

        res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
};

// ─── Companies ────────────────────────────────────────────────────────────────
const getCompanies = async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', industry = '', status = '' } = req.query;
        const offset = (page - 1) * limit;

        const reviewsExist = await tableExists('reviews');
        const hasVerified  = await columnExists('companies', 'is_verified');
        const hasClaimed   = await columnExists('companies', 'is_claimed');

        let selectCols = reviewsExist
            ? `c.*, COUNT(r.id) as review_count, COALESCE(AVG(r.rating), 0) as avg_rating`
            : `c.*`;
        let fromClause = reviewsExist
            ? `FROM companies c LEFT JOIN reviews r ON c.id = r.company_id`
            : `FROM companies c`;
        let where  = `WHERE 1=1`;
        const vals = [];
        let   idx  = 1;

        if (search)   { where += ` AND (c.name ILIKE $${idx} OR c.description ILIKE $${idx})`; vals.push(`%${search}%`); idx++; }
        if (industry) { where += ` AND c.industry = $${idx}`; vals.push(industry); idx++; }
        if (status === 'verified'  && hasVerified) where += ` AND c.is_verified = true`;
        if (status === 'pending'   && hasVerified) where += ` AND c.is_verified = false`;
        if (status === 'claimed'   && hasClaimed)  where += ` AND c.is_claimed  = true`;
        if (status === 'unclaimed' && hasClaimed)  where += ` AND c.is_claimed  = false`;

        const groupBy = reviewsExist ? `GROUP BY c.id` : '';
        vals.push(limit, offset);

        const [dataResult, countResult] = await Promise.all([
            query(`SELECT ${selectCols} ${fromClause} ${where} ${groupBy} ORDER BY c.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`, vals),
            query(`SELECT COUNT(*) FROM companies c ${where}`, vals.slice(0, -2))
        ]);

        res.json({
            companies: dataResult.rows,
            pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(countResult.rows[0].count), pages: Math.ceil(parseInt(countResult.rows[0].count) / limit) }
        });
    } catch (error) {
        console.error('Get companies error:', error);
        res.status(500).json({ error: 'Failed to fetch companies' });
    }
};

const getCompanyDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const reviewsExist = await tableExists('reviews');

        let q = `SELECT c.* FROM companies c WHERE c.id = $1`;
        if (reviewsExist) {
            q = `SELECT c.*, COUNT(r.id) as review_count, COALESCE(AVG(r.rating), 0) as avg_rating,
                        COALESCE(json_agg(DISTINCT jsonb_build_object('id', r.id, 'rating', r.rating, 'created_at', r.created_at)) FILTER (WHERE r.id IS NOT NULL), '[]') as reviews
                 FROM companies c LEFT JOIN reviews r ON c.id = r.company_id WHERE c.id = $1 GROUP BY c.id`;
        }

        const result = await query(q, [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Company not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get company details error:', error);
        res.status(500).json({ error: 'Failed to fetch company details' });
    }
};

const verifyCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const hasVerifiedBy = await columnExists('companies', 'verified_by');
        const hasVerifiedAt = await columnExists('companies', 'verified_at');
        const hasStatus = await columnExists('companies', 'status');

        let q = `UPDATE companies SET is_verified = true`;
        const params = [];
        if (hasVerifiedBy) { q += `, verified_by = $1`; params.push(req.user.id); }
        if (hasVerifiedAt) q += `, verified_at = CURRENT_TIMESTAMP`;
        if (hasStatus) q += `, status = 'active'`;
        q += `, updated_at = CURRENT_TIMESTAMP WHERE id = $${params.length + 1} RETURNING *`;
        params.push(id);

        const result = await query(q, params);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Company not found' });
        await logAdminAction(req.user.id, 'VERIFY_COMPANY', 'companies', id, null, result.rows[0]);
        res.json({ message: 'Company verified successfully', company: result.rows[0] });
    } catch (error) {
        console.error('Verify company error:', error);
        res.status(500).json({ error: 'Failed to verify company' });
    }
};

const updateCompanyStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!await columnExists('companies', 'status')) return res.status(400).json({ error: 'Status column does not exist' });
        const result = await query(`UPDATE companies SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`, [status, id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Company not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update company status error:', error);
        res.status(500).json({ error: 'Failed to update company status' });
    }
};

const deleteCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const company = await query('SELECT * FROM companies WHERE id = $1', [id]);
        if (company.rows.length === 0) return res.status(404).json({ error: 'Company not found' });
        await query('DELETE FROM companies WHERE id = $1', [id]);
        await logAdminAction(req.user.id, 'DELETE_COMPANY', 'companies', id, company.rows[0], null);
        res.json({ message: 'Company deleted successfully' });
    } catch (error) {
        console.error('Delete company error:', error);
        res.status(500).json({ error: 'Failed to delete company' });
    }
};

// ─── Reviews ──────────────────────────────────────────────────────────────────
const getReviews = async (req, res) => {
    try {
        const { page = 1, limit = 20, status = 'all' } = req.query;
        const offset = (page - 1) * limit;

        if (!await tableExists('reviews')) return res.json({ reviews: [], pagination: { page: parseInt(page), limit: parseInt(limit), total: 0, pages: 0 } });

        const hasIsPublic = await columnExists('reviews', 'is_public');
        const hasModerationStatus = await columnExists('reviews', 'moderation_status');
        let where = `WHERE 1=1`;

        if (status !== 'all') {
            if (hasModerationStatus && ['approved', 'rejected', 'flagged', 'pending'].includes(status)) {
                where += ` AND COALESCE(r.moderation_status, 'approved') = $3`;
            } else if (hasIsPublic) {
                if (status === 'pending') where += ` AND r.is_public = false`;
                if (status === 'approved') where += ` AND r.is_public = true`;
            }
        }

        const params = [limit, offset];
        if (status !== 'all' && hasModerationStatus && ['approved', 'rejected', 'flagged', 'pending'].includes(status)) {
            params.push(status);
        }

        const [result, countResult] = await Promise.all([
            query(`SELECT r.*, u.display_name as author_name, u.email as author_email, c.name as company_name
                   FROM reviews r JOIN users u ON r.author_id = u.id JOIN companies c ON r.company_id = c.id
                   ${where} ORDER BY r.created_at DESC LIMIT $1 OFFSET $2`, params),
            query(`SELECT COUNT(*) FROM reviews r ${where}`, params.slice(2))
        ]);

        res.json({
            reviews: result.rows,
            pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(countResult.rows[0].count), pages: Math.ceil(parseInt(countResult.rows[0].count) / limit) }
        });
    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
};

const getPendingReviews = async (req, res) => {
    try {
        if (!await columnExists('reviews', 'is_public')) return res.json([]);
        const result = await query(
            `SELECT r.*, u.display_name as author_name, u.email as author_email, c.name as company_name
             FROM reviews r JOIN users u ON r.author_id = u.id JOIN companies c ON r.company_id = c.id
             WHERE r.is_public = false ORDER BY r.created_at ASC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get pending reviews error:', error);
        res.status(500).json({ error: 'Failed to fetch pending reviews' });
    }
};

const moderateReview = async (req, res) => {
    try {
        if (!ensureSuperAdmin(req, res)) return;
        const { id } = req.params;
        const { action, reason } = req.body;

        const [hasModeratedBy, hasModeratedAt, hasModerationReason, hasFlaggedBy, hasFlaggedAt, hasFlagReason] = await Promise.all([
            columnExists('reviews', 'moderated_by'), columnExists('reviews', 'moderated_at'),
            columnExists('reviews', 'moderation_reason'), columnExists('reviews', 'flagged_by'),
            columnExists('reviews', 'flagged_at'), columnExists('reviews', 'flag_reason')
        ]);

        let q = '';
        let params = [];

        if (action === 'hide' || action === 'show') {
            q = `UPDATE reviews SET is_public = ${action === 'show'}`;
            if (hasModeratedBy) { q += `, moderated_by = $1`; params.push(req.user.id); }
            if (hasModeratedAt)  q += `, moderated_at = CURRENT_TIMESTAMP`;
            if (hasModerationReason && reason) { q += `, moderation_reason = $${params.length + 1}`; params.push(reason); }
        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }

        q += ` WHERE id = $${params.length + 1} RETURNING *`;
        params.push(id);

        const result = await query(q, params);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Review not found' });

        res.json({ message: `Review ${action}d successfully`, review: result.rows[0] });
    } catch (error) {
        console.error('Moderate review error:', error);
        res.status(500).json({ error: 'Failed to moderate review' });
    }
};

const deleteReview = async (req, res) => {
    try {
        if (!ensureSuperAdmin(req, res)) return;
        const { id } = req.params;
        const review = await query('SELECT * FROM reviews WHERE id = $1', [id]);
        if (review.rows.length === 0) return res.status(404).json({ error: 'Review not found' });
        await query('DELETE FROM reviews WHERE id = $1', [id]);
        await logAdminAction(req.user.id, 'DELETE_REVIEW', 'reviews', id, review.rows[0], null);
        res.json({ message: 'Review deleted successfully' });
    } catch (error) {
        console.error('Delete review error:', error);
        res.status(500).json({ error: 'Failed to delete review' });
    }
};

const setReviewVisibility = async (req, res) => {
    try {
        if (!ensureSuperAdmin(req, res)) return;
        const { id } = req.params;
        const { isPublic, reason } = req.body;

        if (!await columnExists('reviews', 'is_public')) {
            return res.status(400).json({ error: 'is_public column not available' });
        }

        const params = [Boolean(isPublic), id];
        let q = `UPDATE reviews SET is_public = $1, updated_at = CURRENT_TIMESTAMP`;
        if (await columnExists('reviews', 'moderation_reason') && reason) {
            q += `, moderation_reason = $3`;
            params.push(reason);
        }
        q += ` WHERE id = $2 RETURNING *`;

        const result = await query(q, params);
        if (!result.rows.length) return res.status(404).json({ error: 'Review not found' });

        res.json({ success: true, review: result.rows[0] });
    } catch (error) {
        console.error('Set review visibility error:', error);
        res.status(500).json({ error: 'Failed to update review visibility' });
    }
};

const getReviewNotificationLogs = async (req, res) => {
    try {
        const { page = 1, limit = 20, status = 'all', search = '' } = req.query;
        const result = await listReviewNotificationLogs({ page, limit, status, search });
        res.json({
            success: true,
            logs: result.logs,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Get review notification logs error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch review notification activity' });
    }
};

const resendReviewNotification = async (req, res) => {
    try {
        const { logId } = req.params;
        const result = await resendReviewNotificationLog(logId, req.user.id);
        res.json({ success: true, result });
    } catch (error) {
        const status = error.status || 500;
        console.error('Resend review notification error:', error);
        res.status(status).json({
            success: false,
            error: error.message || 'Failed to resend review notification'
        });
    }
};

const listAdminNotifications = async (req, res) => {
    try {
        const rows = await getAdminNotifications(40);
        res.json({ notifications: rows });
    } catch (error) {
        console.error('Get admin notifications error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

const markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;
        const row = await markAdminNotificationRead(id);
        if (!row) return res.status(404).json({ error: 'Notification not found' });
        res.json({ notification: row });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ error: 'Failed to update notification' });
    }
};

const getRegistrationApplications = async (req, res) => {
    try {
        const normalizedType = normalizeApplicationTypeFilter(req.query.type || 'all');
        const normalizedStatus = normalizeApplicationStatusFilter(req.query.status || 'pending_review');
        const applications = await listApplications({ type: normalizedType, status: normalizedStatus });
        res.json({ applications });
    } catch (error) {
        console.error('Get registration applications error:', error);
        res.status(500).json({ error: 'Failed to fetch applications' });
    }
};

const reviewRegistrationApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const normalizedType = normalizeApplicationTypeFilter(req.body.type);
        if (normalizedType === 'all') {
            return res.status(400).json({ error: 'Invalid application type' });
        }

        let actionInput = req.body.action || req.body.status;
        if (!actionInput) {
            return res.status(400).json({ error: 'Action is required' });
        }
        let action = String(actionInput).toLowerCase().trim();
        if (action === 'approved') action = 'approve';
        if (action === 'rejected') action = 'reject';
        if (!APPLICATION_ACTIONS.has(action)) {
            return res.status(400).json({ error: 'Invalid action for this application' });
        }

        const notes = req.body.notes || req.body.adminNotes || null;

        const result = await applyApplicationAction({
            type: normalizedType,
            id,
            action,
            adminId: req.user.id,
            notes
        });

        if (!result) {
            return res.status(404).json({ error: 'Application not found' });
        }

        const summary = result.summary;
        const applicantId = summary?.applicantId || result.updated?.user_id || null;
        const applicantEmail = summary?.applicant_email || result.updated?.user_email || null;

        if (applicantId) {
            const hasIsActive = await columnExists('users', 'is_active');
            const hasIsVerified = await columnExists('users', 'is_verified');
            const hasStatus = await columnExists('users', 'status');

            if (summary?.status === 'approved') {
                const updates = [];
                const params = [];
                let idx = 1;
                if (hasIsActive) { updates.push(`is_active = $${idx++}`); params.push(true); }
                if (hasIsVerified) { updates.push(`is_verified = $${idx++}`); params.push(true); }
                if (hasStatus) { updates.push(`status = $${idx++}`); params.push('active'); }
                if (updates.length) {
                    params.push(applicantId);
                    await query(`UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx}`, params);
                }
            } else if (summary?.status === 'rejected' && hasStatus) {
                await query('UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['rejected', applicantId]);
            }
        }

        await recordAuditLog({
            userId: applicantId,
            adminId: req.user.id,
            actorRole: req.user.role,
            action: `application.${action}`,
            entityType: `${normalizedType}_application`,
            entityId: id,
            oldValues: { status: result.previous?.status },
            newValues: { status: summary?.status },
            metadata: { applicationType: normalizedType }
        });

        if (['approve', 'reject', 'request_info'].includes(action) && applicantEmail) {
            try {
                await sendApplicationStatusEmail({
                    email: applicantEmail,
                    name: summary.applicant_name,
                    type: normalizedType,
                    status: summary.status,
                    notes
                });
            } catch (emailError) {
                console.warn('Application status email failed:', emailError.message);
            }
        }

        res.json({ success: true, application: summary });
    } catch (error) {
        console.error('Review registration application error:', error);
        res.status(500).json({ error: 'Failed to update application' });
    }
};

// ─── Subscriptions ────────────────────────────────────────────────────────────
const getSubscriptions = async (req, res) => {
    try {
        if (!await tableExists('subscriptions')) return res.json([]);
        const result = await query(
            `SELECT s.*, u.email as user_email, u.display_name as user_name
             FROM subscriptions s JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get subscriptions error:', error);
        res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
};

const getSubscriptionDetails = async (req, res) => {
    try {
        const { id } = req.params;
        if (!await tableExists('subscriptions')) return res.status(404).json({ error: 'Subscription not found' });
        const result = await query(
            `SELECT s.*, u.email as user_email, u.display_name as user_name
             FROM subscriptions s JOIN users u ON s.user_id = u.id WHERE s.id = $1`, [id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get subscription details error:', error);
        res.status(500).json({ error: 'Failed to fetch subscription details' });
    }
};

const createSubscription = async (req, res) => {
    try {
        if (!await tableExists('subscriptions')) {
            return res.status(404).json({ error: 'Subscriptions table not found' });
        }
        const userId = req.body.user_id ?? req.body.userId;
        if (!userId && await columnExists('subscriptions', 'user_id')) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        const columns = [];
        const values = [];
        const params = [];
        let idx = 1;

        const tryAdd = async (column, value) => {
            if (value === undefined) return;
            if (!await columnExists('subscriptions', column)) return;
            columns.push(column);
            values.push(`$${idx}`);
            params.push(value);
            idx++;
        };

        const planType = req.body.plan_type ?? req.body.planType;
        const status = req.body.status ?? 'active';
        const price = req.body.price;
        const currencyCode = req.body.currency_code ?? req.body.currencyCode;
        const currencySymbol = req.body.currency_symbol ?? req.body.currencySymbol;
        const autoRenew = req.body.auto_renew ?? req.body.autoRenew;
        const chatHours = req.body.chat_hours_per_day ?? req.body.chatHoursPerDay;
        const videoCalls = req.body.video_calls_per_week ?? req.body.videoCallsPerWeek;
        const leadsPerMonth = req.body.leads_per_month ?? req.body.leadsPerMonth;
        const acceptsAssignments = req.body.accepts_assignments ?? req.body.acceptsAssignments;
        const countryCode = req.body.country_code ?? req.body.countryCode;

        await tryAdd('user_id', userId);
        if (planType !== undefined) {
            await tryAdd('plan_type', planType);
            await tryAdd('plan', planType);
        }
        await tryAdd('status', status);
        await tryAdd('price', price);
        await tryAdd('currency_code', currencyCode);
        await tryAdd('currency_symbol', currencySymbol);
        await tryAdd('auto_renew', autoRenew);
        await tryAdd('chat_hours_per_day', chatHours);
        await tryAdd('video_calls_per_week', videoCalls);
        await tryAdd('leads_per_month', leadsPerMonth);
        await tryAdd('accepts_assignments', acceptsAssignments);
        await tryAdd('country_code', countryCode);

        if (!columns.length) {
            return res.status(400).json({ error: 'No valid subscription fields to insert' });
        }

        const result = await query(
            `INSERT INTO subscriptions (${columns.join(', ')})
             VALUES (${values.join(', ')})
             RETURNING *`,
            params
        );

        return res.status(201).json({ success: true, subscription: result.rows[0] });
    } catch (error) {
        console.error('Create subscription error:', error);
        return res.status(500).json({ error: 'Failed to create subscription' });
    }
};

const cancelSubscription = async (req, res) => {
    try {
        const { id } = req.params;
        if (!await tableExists('subscriptions')) return res.status(404).json({ error: 'Subscription not found' });
        const hasCancelledBy = await columnExists('subscriptions', 'cancelled_by');
        const hasCancelledAt = await columnExists('subscriptions', 'cancelled_at');
        let q = `UPDATE subscriptions SET status = 'cancelled'`;
        const params = [];
        if (hasCancelledBy) { q += `, cancelled_by = $1`; params.push(req.user.id); }
        if (hasCancelledAt)  q += `, cancelled_at = CURRENT_TIMESTAMP`;
        q += `, updated_at = CURRENT_TIMESTAMP WHERE id = $${params.length + 1} RETURNING *`;
        params.push(id);
        const result = await query(q, params);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });
        res.json({ message: 'Subscription cancelled successfully', subscription: result.rows[0] });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ error: 'Failed to cancel subscription' });
    }
};

// ─── Settings / Pricing / Analytics ──────────────────────────────────────────
const getPricingConfig = async (req, res) => {
    try {
        if (!await tableExists('pricing_config')) {
            return res.json({ user: { free: { price: 0 }, premium: { price: 9.99 } }, business: { basic: { price: 29.99 }, pro: { price: 49.99 } } });
        }
        const result = await query(`SELECT * FROM pricing_config WHERE is_active = true ORDER BY role, plan`);
        const pricing = {};
        result.rows.forEach(item => { if (!pricing[item.role]) pricing[item.role] = {}; pricing[item.role][item.plan] = item; });
        res.json(pricing);
    } catch (error) { res.status(500).json({ error: 'Failed to fetch pricing' }); }
};

const updatePricing = async (req, res) => {
    try {
        const { role, plan } = req.params;
        const { base_price_usd, features, limits } = req.body;
        if (!await tableExists('pricing_config')) return res.status(404).json({ error: 'Pricing table not found' });
        const result = await query(
            `UPDATE pricing_config SET base_price_usd=$1, features=$2, limits=$3, updated_by=$4, updated_at=CURRENT_TIMESTAMP WHERE role=$5 AND plan=$6 RETURNING *`,
            [base_price_usd, JSON.stringify(features || []), JSON.stringify(limits || {}), req.user.id, role, plan]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Pricing config not found' });
        res.json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: 'Failed to update pricing' }); }
};

const getCountryPricing = async (req, res) => {
    try {
        if (!await tableExists('country_pricing')) return res.json([]);
        const result = await query(`SELECT * FROM country_pricing WHERE is_active = true ORDER BY country_name`);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: 'Failed to fetch country pricing' }); }
};

const addCountryPricing = async (req, res) => {
    try {
        const { country_code, country_name, multiplier, currency, currency_symbol } = req.body;
        if (!await tableExists('country_pricing')) return res.status(500).json({ error: 'Table not found' });
        const result = await query(
            `INSERT INTO country_pricing (country_code, country_name, multiplier, currency, currency_symbol, updated_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [country_code, country_name, multiplier, currency, currency_symbol, req.user.id]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: 'Failed to add country pricing' }); }
};

const updateCountryPricing = async (req, res) => {
    try {
        const { countryCode } = req.params;
        const { multiplier, currency, currency_symbol } = req.body;
        if (!await tableExists('country_pricing')) return res.status(404).json({ error: 'Not found' });
        const result = await query(
            `UPDATE country_pricing SET multiplier=COALESCE($1,multiplier), currency=COALESCE($2,currency), currency_symbol=COALESCE($3,currency_symbol), updated_by=$4, updated_at=CURRENT_TIMESTAMP WHERE country_code=$5 RETURNING *`,
            [multiplier, currency, currency_symbol, req.user.id, countryCode]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Country not found' });
        res.json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: 'Failed to update country pricing' }); }
};

const getSystemSettings = async (req, res) => {
    try {
        if (!await tableExists('system_settings')) return res.json({});
        const result = await query(`SELECT * FROM system_settings ORDER BY key`);
        const settings = {};
        result.rows.forEach(item => { settings[item.key] = item.value; });
        res.json(settings);
    } catch (error) { res.status(500).json({ error: 'Failed to fetch settings' }); }
};

const updateSystemSettings = async (req, res) => {
    try {
        console.log('=== UPDATE SYSTEM SETTINGS CALLED ===');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('User:', req.user?.id, req.user?.role);

        const tableExistsResult = await tableExists('system_settings');
        console.log('system_settings table exists:', tableExistsResult);

        if (!tableExistsResult) {
            console.log('Creating system_settings table...');
            const created = await ensureSystemSettingsTable();
            console.log('Table created:', created);
            if (!created) {
                return res.status(500).json({
                    success: false,
                    error: 'System settings table could not be created'
                });
            }
        }

        const updatedBy = await resolveUpdatedBy(req.user?.id);
        console.log('Updated by:', updatedBy);

        const valueColumnType = await getColumnType('system_settings', 'value');
        console.log('Value column type:', valueColumnType);
        const normalizeValue = (raw) => {
            if (raw === null || raw === undefined) return null;
            if (valueColumnType === 'jsonb' || valueColumnType === 'json') {
                return JSON.stringify(raw);
            }
            if (typeof raw === 'string') return raw;
            return JSON.stringify(raw);
        };

        let entries = [];
        if (Array.isArray(req.body)) {
            console.log('Request body is array');
            entries = req.body;
        } else if (req.body.entries && Array.isArray(req.body.entries)) {
            console.log('Request body has entries array');
            entries = req.body.entries;
        } else if (typeof req.body === 'object' && Object.keys(req.body).length > 0) {
            console.log('Request body is object');
            if (req.body.key !== undefined) {
                console.log('Request body has key');
                entries = [req.body];
            } else {
                console.log('Converting object to entries');
                entries = Object.entries(req.body).map(([key, value]) => ({
                    key,
                    value
                }));
            }
        }

        console.log('Processing entries count:', entries.length);
        console.log('Entries:', JSON.stringify(entries, null, 2));

        if (entries.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid settings provided'
            });
        }

        const updates = [];
        for (const entry of entries) {
            const key = entry?.key;
            if (!key) {
                console.warn('Skipping entry without key:', entry);
                continue;
            }
            const value = entry?.value;
            console.log(`Processing setting: ${key} =`, value);
            try {
                const normalizedValue = normalizeValue(value);
                console.log(`Normalized value for ${key}:`, normalizedValue);
                let result;
                try {
                    result = await query(
                        `INSERT INTO system_settings (key, value, updated_by, updated_at)
                         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                         ON CONFLICT (key) DO UPDATE
                         SET value = EXCLUDED.value,
                             updated_by = EXCLUDED.updated_by,
                             updated_at = CURRENT_TIMESTAMP
                         RETURNING *`,
                        [String(key), normalizedValue, updatedBy]
                    );
                } catch (innerError) {
                    if (innerError?.code === '23503') {
                        console.warn(`FK violation for ${key}; retrying without updated_by`);
                        result = await query(
                            `INSERT INTO system_settings (key, value, updated_by, updated_at)
                             VALUES ($1, $2, NULL, CURRENT_TIMESTAMP)
                             ON CONFLICT (key) DO UPDATE
                             SET value = EXCLUDED.value,
                                 updated_by = NULL,
                                 updated_at = CURRENT_TIMESTAMP
                             RETURNING *`,
                            [String(key), normalizedValue]
                        );
                    } else {
                        throw innerError;
                    }
                }
                if (result.rows[0]) {
                    console.log(`Updated ${key} successfully`);
                    updates.push(result.rows[0]);
                }
            } catch (err) {
                console.error(`Error updating setting ${key}:`, err);
                console.error('Error details:', err.message, err.stack);
            }
        }

        console.log(`Updated ${updates.length} settings`);

        const allSettings = await query('SELECT * FROM system_settings ORDER BY key');
        console.log('Fetched all settings count:', allSettings.rows.length);

        const settingsObj = {};
        allSettings.rows.forEach(item => {
            try {
                if (typeof item.value === 'string') {
                    try {
                        settingsObj[item.key] = JSON.parse(item.value);
                    } catch {
                        settingsObj[item.key] = item.value;
                    }
                } else {
                    settingsObj[item.key] = item.value;
                }
            } catch {
                settingsObj[item.key] = item.value;
            }
        });

        console.log('Returning settings:', Object.keys(settingsObj));

        return res.json({
            success: true,
            message: `${updates.length} setting(s) updated successfully`,
            settings: settingsObj,
            updates: updates.length === 1 ? updates[0] : updates
        });
    } catch (error) {
        console.error('=== UPDATE SYSTEM SETTINGS ERROR ===');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Error details:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update settings',
            details: error?.message || null,
            stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
        });
    }
};

const updateSubscription = async (req, res) => {
    try {
        const { id } = req.params;
        if (!await tableExists('subscriptions')) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        const updates = [];
        const params = [];
        let idx = 1;

        const trySet = async (field, column, value) => {
            if (value === undefined) return;
            if (!await columnExists('subscriptions', column)) return;
            updates.push(`${column} = $${idx}`);
            params.push(value);
            idx++;
        };

        const planType = req.body.plan_type ?? req.body.planType;
        const status = req.body.status;
        const price = req.body.price;
        const currencyCode = req.body.currency_code ?? req.body.currencyCode;
        const currencySymbol = req.body.currency_symbol ?? req.body.currencySymbol;
        const autoRenew = req.body.auto_renew ?? req.body.autoRenew;
        const chatHours = req.body.chat_hours_per_day ?? req.body.chatHoursPerDay;
        const videoCalls = req.body.video_calls_per_week ?? req.body.videoCallsPerWeek;
        const leadsPerMonth = req.body.leads_per_month ?? req.body.leadsPerMonth;
        const acceptsAssignments = req.body.accepts_assignments ?? req.body.acceptsAssignments;

        if (planType !== undefined) {
            await trySet('plan_type', 'plan_type', planType);
            await trySet('plan', 'plan', planType);
        }

        await trySet('status', 'status', status);
        await trySet('price', 'price', price);
        await trySet('currency_code', 'currency_code', currencyCode);
        await trySet('currency_symbol', 'currency_symbol', currencySymbol);
        await trySet('auto_renew', 'auto_renew', autoRenew);
        await trySet('chat_hours_per_day', 'chat_hours_per_day', chatHours);
        await trySet('video_calls_per_week', 'video_calls_per_week', videoCalls);
        await trySet('leads_per_month', 'leads_per_month', leadsPerMonth);
        await trySet('accepts_assignments', 'accepts_assignments', acceptsAssignments);

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid subscription fields to update' });
        }

        if (await columnExists('subscriptions', 'updated_at')) {
            updates.push('updated_at = CURRENT_TIMESTAMP');
        }

        params.push(id);
        const result = await query(
            `UPDATE subscriptions SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
            params
        );

        if (!result.rows.length) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        res.json({ success: true, subscription: result.rows[0] });
    } catch (error) {
        console.error('Update subscription error:', error);
        res.status(500).json({ error: 'Failed to update subscription' });
    }
};

const exportSubscriptions = async (req, res) => {
    try {
        if (!await tableExists('subscriptions')) {
            return res.status(404).json({ error: 'Subscriptions table not found' });
        }
        const result = await query(
            `SELECT s.*, u.email as user_email, u.display_name as user_name
             FROM subscriptions s JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC`
        );
        const rows = result.rows || [];
        if (!rows.length) {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=subscriptions.csv');
            return res.send('No data');
        }
        const header = Object.keys(rows[0]);
        const csv = [
            header.join(','),
            ...rows.map((row) =>
                header.map((key) => `"${String(row[key] ?? '').replace(/\"/g, '""')}"`).join(',')
            )
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=subscriptions.csv');
        return res.send(csv);
    } catch (error) {
        console.error('Export subscriptions error:', error);
        res.status(500).json({ error: 'Failed to export subscriptions' });
    }
};

const getSessionSettings = async (req, res) => {
    try {
        const settings = await fetchSessionSettings();
        return res.json({
            inactivityTimeout: settings.inactivityTimeoutMinutes,
            inactivityTimeoutMinutes: settings.inactivityTimeoutMinutes,
            autoLogoutEnabled: settings.autoLogoutEnabled
        });
    } catch (error) {
        console.error('Failed to fetch session settings:', error.message);
        return res.status(500).json({ error: 'Failed to fetch session settings' });
    }
};

const updateSessionSettings = async (req, res) => {
    try {
        const timeoutRaw = req.body.inactivityTimeoutMinutes ?? req.body.inactivityTimeout;
        const autoLogoutRaw = req.body.autoLogoutEnabled;

        const updates = {};
        if (timeoutRaw !== undefined) {
            const parsedTimeout = Number(timeoutRaw);
            if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) {
                return res.status(400).json({ error: 'Inactivity timeout must be a positive number of minutes' });
            }
            updates.inactivityTimeoutMinutes = parsedTimeout;
        }
        if (autoLogoutRaw !== undefined) {
            if (typeof autoLogoutRaw !== 'boolean') {
                return res.status(400).json({ error: 'Auto logout enabled must be a boolean' });
            }
            updates.autoLogoutEnabled = autoLogoutRaw;
        }
        if (!Object.keys(updates).length) {
            return res.status(400).json({ error: 'No session settings provided' });
        }
        const updatedBy = await resolveUpdatedBy(req.user?.id);
        const settings = await persistSessionSettings(updates, updatedBy);
        return res.json({
            success: true,
            inactivityTimeout: settings.inactivityTimeoutMinutes,
            inactivityTimeoutMinutes: settings.inactivityTimeoutMinutes,
            autoLogoutEnabled: settings.autoLogoutEnabled
        });
    } catch (error) {
        console.error('Failed to update session settings:', error.message);
        return res.status(500).json({ error: 'Failed to update session settings' });
    }
};


const superAdminRoles = ['super_admin', 'superadmin', 'system_admin'];

const ensureSuperAdmin = (req, res) => {
    const role = String(req?.user?.role || '').toLowerCase().trim();
    if (!superAdminRoles.includes(role)) {
        res.status(403).json({ error: 'Super admin access required' });
        return false;
    }
    return true;
};

// In-memory ML model store for admin UI integration
const mlModelsStore = [
    {
        id: 'ml-model-1',
        name: 'Sentiment Classifier',
        type: 'classification',
        version: '1.0.0',
        accuracy: 0.92,
        active: true,
        predictions: 1240,
        created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        id: 'ml-model-2',
        name: 'Review Moderation',
        type: 'classification',
        version: '1.1.0',
        accuracy: 0.88,
        active: false,
        predictions: 640,
        created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
    }
];

const getMlModels = async (req, res) => {
    try {
        if (!ensureSuperAdmin(req, res)) return;
        return res.json({ models: mlModelsStore });
    } catch (error) {
        console.error('Get ML models error:', error);
        return res.status(500).json({ error: 'Failed to fetch ML models' });
    }
};

const trainMlModel = async (req, res) => {
    try {
        if (!ensureSuperAdmin(req, res)) return;

        const { modelType = 'classification', epochs = 50, batchSize = 32, learningRate = 0.001 } = req.body || {};
        const model = {
            id: `ml-model-${Date.now()}`,
            name: `${modelType[0].toUpperCase() + modelType.slice(1)} Model`,
            type: modelType,
            version: '1.0.0',
            accuracy: Number((0.82 + Math.random() * 0.12).toFixed(2)),
            active: true,
            predictions: 0,
            training: { epochs, batchSize, learningRate },
            created_at: new Date().toISOString()
        };

        // Deactivate other models of same type for clarity in UI
        mlModelsStore.forEach(m => { if (m.type === modelType) m.active = false; });
        mlModelsStore.unshift(model);

        return res.json({ success: true, model });
    } catch (error) {
        console.error('Train ML model error:', error);
        return res.status(500).json({ error: 'Training failed' });
    }
};

const toggleMlModel = async (req, res) => {
    try {
        if (!ensureSuperAdmin(req, res)) return;

        const { id } = req.params;
        const model = mlModelsStore.find(m => m.id === id);
        if (!model) return res.status(404).json({ error: 'Model not found' });

        model.active = !model.active;
        return res.json({ success: true, model });
    } catch (error) {
        console.error('Toggle ML model error:', error);
        return res.status(500).json({ error: 'Failed to toggle model' });
    }
};

const getMlMetrics = async (req, res) => {
    try {
        if (!ensureSuperAdmin(req, res)) return;

        const empty = {
            total_requests: 0,
            pending: 0,
            approved: 0,
            rejected: 0,
            avg_confidence: 0
        };

        if (!await tableExists('ml_interactions')) {
            return res.json(empty);
        }

        try {
            const result = await query(
                `SELECT COUNT(*)::int as total_requests,
                        COUNT(*) FILTER (WHERE status = 'pending')::int as pending,
                        COUNT(*) FILTER (WHERE status = 'approved')::int as approved,
                        COUNT(*) FILTER (WHERE status = 'rejected')::int as rejected,
                        COALESCE(AVG(confidence), 0) as avg_confidence
                 FROM ml_interactions`
            );
            return res.json(result.rows[0] || empty);
        } catch {
            return res.json(empty);
        }
    } catch (error) {
        console.error('Get ML metrics error:', error);
        return res.status(500).json({ error: 'Failed to fetch ML metrics' });
    }
};

const getMlPredictions = async (req, res) => {
    try {
        if (!ensureSuperAdmin(req, res)) return;
        return res.json({ predictions: [] });
    } catch (error) {
        console.error('Get ML predictions error:', error);
        return res.status(500).json({ error: 'Failed to fetch ML predictions' });
    }
};

const getMlPerformance = async (req, res) => {
    try {
        if (!ensureSuperAdmin(req, res)) return;
        return res.json({
            models: mlModelsStore.map(m => ({
                id: m.id,
                name: m.name,
                accuracy: m.accuracy,
                active: m.active
            }))
        });
    } catch (error) {
        console.error('Get ML performance error:', error);
        return res.status(500).json({ error: 'Failed to fetch ML performance' });
    }
};

const exportMlInteractions = async (req, res) => {
    try {
        if (!ensureSuperAdmin(req, res)) return;

        const hasTable = await tableExists('ml_interactions');
        let rows = [];
        if (hasTable) {
            const result = await query('SELECT * FROM ml_interactions ORDER BY created_at DESC LIMIT 5000');
            rows = result.rows || [];
        }

        const headers = rows.length ? Object.keys(rows[0]) : ['id', 'type', 'status', 'confidence', 'created_at'];
        const csvLines = [
            headers.join(','),
            ...rows.map(row => headers.map(h => {
                const val = row[h];
                if (val === null || val === undefined) return '';
                const str = String(val).replace(/"/g, '""');
                return `"${str}"`;
            }).join(','))
        ];

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="ml-interactions.csv"');
        return res.send(csvLines.join('\n'));
    } catch (error) {
        console.error('Export ML interactions error:', error);
        return res.status(500).json({ error: 'Export failed' });
    }
};

const predictMl = async (req, res) => {
    try {
        if (!ensureSuperAdmin(req, res)) return;

        const { modelId, input } = req.body || {};
        const model = mlModelsStore.find(m => m.id === modelId) || mlModelsStore[0];

        return res.json({
            prediction: {
                modelId: model?.id,
                label: 'positive',
                confidence: Number((0.7 + Math.random() * 0.25).toFixed(3)),
                input
            }
        });
    } catch (error) {
        console.error('Predict ML error:', error);
        return res.status(500).json({ error: 'Prediction failed' });
    }
};

const getMlInteractions = async (req, res) => {
    try {
        if (!ensureSuperAdmin(req, res)) return;

        const { page = 1, limit = 50, status } = req.query;
        const pageNum = Math.max(parseInt(page, 10) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
        const offset = (pageNum - 1) * limitNum;

        if (!await tableExists('ml_interactions')) {
            return res.json({ interactions: [], pagination: { page: pageNum, limit: limitNum, total: 0, pages: 0 } });
        }

        const params = [];
        let whereClause = 'WHERE 1=1';

        if (status && status !== 'all') {
            params.push(String(status).toLowerCase());
            whereClause += ` AND LOWER(COALESCE(status, '')) = $${params.length}`;
        }

        params.push(limitNum, offset);

        const rowsPromise = query(
            `SELECT * FROM ml_interactions ${whereClause} ORDER BY created_at DESC NULLS LAST LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        const countPromise = query(
            `SELECT COUNT(*)::int AS total FROM ml_interactions ${whereClause}`,
            params.slice(0, params.length - 2)
        );

        const [rowsResult, countResult] = await Promise.all([rowsPromise, countPromise]);
        const total = Number(countResult.rows[0]?.total || 0);

        return res.json({
            interactions: rowsResult.rows,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('Get ML interactions error:', error);
        return res.status(500).json({ error: 'Failed to fetch ML interactions' });
    }
};

const updateMlInteraction = async (req, res) => {
    try {
        if (!ensureSuperAdmin(req, res)) return;

        const { id } = req.params;
        const { status, notes } = req.body;

        if (!await tableExists('ml_interactions')) {
            return res.status(404).json({ error: 'ML interactions table not found' });
        }

        const hasUpdatedAt = await columnExists('ml_interactions', 'updated_at');
        const hasNotes = await columnExists('ml_interactions', 'notes');

        const params = [id, status || 'edited'];
        let setClause = `status = $2`;

        if (hasNotes && notes !== undefined) {
            params.push(notes);
            setClause += `, notes = $${params.length}`;
        }

        if (hasUpdatedAt) {
            setClause += `, updated_at = CURRENT_TIMESTAMP`;
        }

        const result = await query(
            `UPDATE ml_interactions SET ${setClause} WHERE id = $1 RETURNING *`,
            params
        );

        if (!result.rows.length) {
            return res.status(404).json({ error: 'Interaction not found' });
        }

        return res.json({ success: true, interaction: result.rows[0] });
    } catch (error) {
        console.error('Update ML interaction error:', error);
        return res.status(500).json({ error: 'Failed to update ML interaction' });
    }
};

const getAuditLogs = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;
        if (!await tableExists('audit_logs')) return res.json({ logs: [], pagination: { page: parseInt(page), limit: parseInt(limit), total: 0, pages: 0 } });
        const [result, countResult] = await Promise.all([
            query(`SELECT al.*, u_admin.email as admin_email, u_admin.display_name as admin_name FROM audit_logs al LEFT JOIN users u_admin ON al.admin_id = u_admin.id ORDER BY al.created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]),
            query(`SELECT COUNT(*) FROM audit_logs`)
        ]);
        res.json({ logs: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(countResult.rows[0].count), pages: Math.ceil(parseInt(countResult.rows[0].count) / limit) } });
    } catch (error) { res.status(500).json({ error: 'Failed to fetch audit logs' }); }
};

const getRevenueAnalytics = async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        if (!await tableExists('subscriptions')) return res.json([]);
        const interval = ['day', 'week', 'month'].includes(period) ? period : 'month';
        const result = await query(
            `SELECT DATE_TRUNC($1, created_at) as date, COUNT(*) as subscriptions, SUM(price) as revenue
             FROM subscriptions WHERE status = 'active' GROUP BY DATE_TRUNC($1, created_at) ORDER BY date DESC LIMIT 12`, [interval]
        );
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: 'Failed to fetch revenue analytics' }); }
};

const getUserAnalytics = async (req, res) => {
    try {
        const result = await query(
            `SELECT DATE_TRUNC('day', created_at) as date, COUNT(*) as new_users,
                    COUNT(CASE WHEN role='employee' THEN 1 END) as employees,
                    COUNT(CASE WHEN role='psychologist' THEN 1 END) as psychologists,
                    COUNT(CASE WHEN role='business' THEN 1 END) as businesses
             FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
             GROUP BY DATE_TRUNC('day', created_at) ORDER BY date DESC`
        );
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: 'Failed to fetch user analytics' }); }
};

const getSubscriptionAnalytics = async (req, res) => {
    try {
        if (!await tableExists('subscriptions')) return res.json([]);
        const result = await query(
            `SELECT plan, COUNT(*) as total, COUNT(CASE WHEN status='active' THEN 1 END) as active,
                    SUM(CASE WHEN status='active' THEN price ELSE 0 END) as revenue FROM subscriptions GROUP BY plan`
        );
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: 'Failed to fetch subscription analytics' }); }
};

const searchPsychologists = async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        if (!q) return res.json([]);
        const normalized = q.toLowerCase().replace(/[^a-z0-9]/g, '');
        const hasPublicId = await columnExists('users', 'public_id');
        const result = await query(
            `SELECT u.id, u.display_name, u.email, u.role
             FROM users u
             WHERE (u.display_name ILIKE $1 OR u.email ILIKE $1 OR u.id::text = $2)
                ${hasPublicId ? 'OR u.public_id ILIKE $1' : ''}
                OR (
                    $3 <> '' AND (
                        regexp_replace(lower(COALESCE(u.display_name, '')), '[^a-z0-9]', '', 'g') LIKE $3
                        OR regexp_replace(lower(COALESCE(u.email, '')), '[^a-z0-9]', '', 'g') LIKE $3
                    )
                )
             ORDER BY u.display_name
             LIMIT 20`,
            [`%${q}%`, q, `%${normalized}%`]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Search psychologists error:', error);
        res.status(500).json({ error: 'Failed to search psychologists' });
    }
};

const getPsychologistSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(
            `SELECT id, title, scheduled_for, type, status, location
             FROM psychologist_schedule_items
             WHERE psychologist_id = $1
             ORDER BY scheduled_for ASC`,
            [id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get psychologist schedule error:', error);
        res.status(500).json({ error: 'Failed to fetch schedule' });
    }
};

const getPsychologistCalendarIntegrations = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(
            `SELECT id, provider, name, ical_url, is_active, created_at, updated_at
             FROM psychologist_calendar_integrations
             WHERE psychologist_id = $1
             ORDER BY created_at DESC`,
            [id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get psychologist integrations error:', error);
        res.status(500).json({ error: 'Failed to fetch integrations' });
    }
};

const getPsychologistExternalEvents = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(
            `SELECT e.title, e.starts_at, e.ends_at, e.location, e.source_uid
             FROM psychologist_external_events e
             JOIN psychologist_calendar_integrations i ON e.integration_id = i.id
             WHERE i.psychologist_id = $1
             ORDER BY e.starts_at ASC`,
            [id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get psychologist external events error:', error);
        res.status(500).json({ error: 'Failed to fetch external events' });
    }
};

const lookupLedgerByAccountNumber = async (req, res) => {
    try {
        const { accountNumber } = req.params;
        const record = await resolveAccountNumber(accountNumber);
        if (!record) {
            return res.status(404).json({ error: 'Account number not found' });
        }

        let owner = null;
        if (record.owner_type === 'user') {
            const userResult = await query(
                `SELECT id, email, display_name, role, account_number
                 FROM users WHERE id = $1`,
                [record.owner_id]
            );
            owner = userResult.rows[0] || null;
        } else if (record.owner_type === 'company') {
            const companyResult = await query(
                `SELECT id, name, email, account_number
                 FROM companies WHERE id = $1`,
                [record.owner_id]
            );
            owner = companyResult.rows[0] || null;
        }

        const payments = await query(
            `SELECT id, owner_type, owner_id, currency_code, amount_minor, status, created_at
             FROM payment_records
             WHERE owner_id = $1
             ORDER BY created_at DESC
             LIMIT 50`,
            [record.owner_id]
        );

        return res.json({
            account: record,
            owner,
            payments: payments.rows
        });
    } catch (error) {
        console.error('Lookup ledger error:', error);
        return res.status(500).json({ error: 'Failed to lookup ledger' });
    }
};

const WELP_STAFF_ROLES = ['admin', 'hr_admin', 'developer', 'call_center_agent', 'kodi_admin', 'support_agent', 'operations', 'welp_employee'];

const listWelpStaff = async (_req, res) => {
    try {
        const result = await query(
            `SELECT ws.*, u.email, u.display_name, u.role
             FROM welp_staff ws
             JOIN users u ON u.id = ws.user_id
             WHERE ws.is_active = true
             ORDER BY ws.created_at DESC`
        );
        return res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('List Welp staff error:', error);
        return res.status(500).json({ success: false, error: 'Failed to load staff list' });
    }
};

const upsertWelpStaff = async (req, res) => {
    try {
        const { userId, staffRoleKey, department, isActive = true } = req.body;
        if (!userId || !staffRoleKey) {
            return res.status(400).json({ success: false, error: 'userId and staffRoleKey are required' });
        }
        const normalizedRole = String(staffRoleKey).toLowerCase();
        if (!WELP_STAFF_ROLES.includes(normalizedRole)) {
            return res.status(400).json({ success: false, error: 'Invalid staff role' });
        }
        const userCheck = await query(`SELECT id FROM users WHERE id = $1`, [userId]);
        if (!userCheck.rows[0]) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        const result = await query(
            `INSERT INTO welp_staff (user_id, staff_role_key, department, is_active)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (user_id) DO UPDATE
               SET staff_role_key = EXCLUDED.staff_role_key,
                   department = EXCLUDED.department,
                   is_active = EXCLUDED.is_active,
                   updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [userId, normalizedRole, department || null, Boolean(isActive)]
        );
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Upsert Welp staff error:', error);
        return res.status(500).json({ success: false, error: 'Failed to update staff' });
    }
};

module.exports = {
    getAdminProfile,
    getDashboardStats,
    getUsers,
    getUserDetails,
    createUser,
    updateUser,
    deleteUser,
    bulkDeleteUsers,
    resetUserPassword,
    getCompanies,
    getCompanyDetails,
    verifyCompany,
    updateCompanyStatus,
    deleteCompany,
    getReviews,
    getPendingReviews,
    moderateReview,
    deleteReview,
    setReviewVisibility,
    getReviewNotificationLogs,
    resendReviewNotification,
    listAdminNotifications,
    markNotificationRead,
    getRegistrationApplications,
    reviewRegistrationApplication,
    getSubscriptions,
    getSubscriptionDetails,
    createSubscription,
    cancelSubscription,
    updateSubscription,
    exportSubscriptions,
    getPricingConfig,
    updatePricing,
    getCountryPricing,
    addCountryPricing,
    updateCountryPricing,
    getSessionSettings,
    updateSessionSettings,
    getSystemSettings,
    updateSystemSettings,
    getMlInteractions,
    updateMlInteraction,
    getMlModels,
    trainMlModel,
    toggleMlModel,
    getMlMetrics,
    getMlPredictions,
    getMlPerformance,
    exportMlInteractions,
    predictMl,
    getAuditLogs,
    listWelpStaff,
    upsertWelpStaff,
    getRevenueAnalytics,
    getUserAnalytics,
    getSubscriptionAnalytics,
    searchPsychologists,
    getPsychologistSchedule,
    getPsychologistCalendarIntegrations,
    getPsychologistExternalEvents,
    lookupLedgerByAccountNumber
};

