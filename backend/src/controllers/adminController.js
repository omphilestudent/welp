// backend/src/controllers/adminController.js
const { query } = require('../utils/database');
const bcrypt = require('bcryptjs');

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
        const reviewsExist   = await tableExists('reviews');

        // Build SELECT
        let selectCols = `u.id, u.email, u.display_name, u.role, u.created_at, u.updated_at`;
        if (hasIsActive)    selectCols += `, u.is_active`;
        if (hasPermissions) selectCols += `, u.permissions`;

        let fromClause = `FROM users u`;
        if (reviewsExist) {
            selectCols += `, COUNT(r.id) as review_count`;
            fromClause += ` LEFT JOIN reviews r ON u.id = r.author_id`;
        }

        let where  = `WHERE 1=1`;
        const vals = [];
        let   idx  = 1;

        if (search) {
            where += ` AND (u.email ILIKE $${idx} OR u.display_name ILIKE $${idx})`;
            vals.push(`%${search}%`); idx++;
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

        const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already exists' });

        const hashedPassword    = await bcrypt.hash(password, 10);
        const hasPermissionsCol = await columnExists('users', 'permissions');
        const hasIsActiveCol    = await columnExists('users', 'is_active');
        const hasIsVerifiedCol  = await columnExists('users', 'is_verified');

        const cols    = ['email', 'password_hash', 'role', 'display_name'];
        const holders = ['$1',   '$2',             '$3',   '$4'];
        const params  = [email, hashedPassword, role || 'user', displayName || email.split('@')[0]];
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

        let q = `UPDATE companies SET is_verified = true`;
        const params = [];
        if (hasVerifiedBy) { q += `, verified_by = $1`; params.push(req.user.id); }
        if (hasVerifiedAt) q += `, verified_at = CURRENT_TIMESTAMP`;
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
        let where = `WHERE 1=1`;
        if (status === 'pending'  && hasIsPublic) where += ` AND r.is_public = false`;
        if (status === 'approved' && hasIsPublic) where += ` AND r.is_public = true`;

        const [result, countResult] = await Promise.all([
            query(`SELECT r.*, u.display_name as author_name, u.email as author_email, c.name as company_name
                   FROM reviews r JOIN users u ON r.author_id = u.id JOIN companies c ON r.company_id = c.id
                   ${where} ORDER BY r.created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]),
            query(`SELECT COUNT(*) FROM reviews r ${where}`)
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
        const { id } = req.params;
        const { action, reason } = req.body;

        const [hasModeratedBy, hasModeratedAt, hasModerationReason, hasFlaggedBy, hasFlaggedAt, hasFlagReason] = await Promise.all([
            columnExists('reviews', 'moderated_by'), columnExists('reviews', 'moderated_at'),
            columnExists('reviews', 'moderation_reason'), columnExists('reviews', 'flagged_by'),
            columnExists('reviews', 'flagged_at'), columnExists('reviews', 'flag_reason')
        ]);

        let q = '';
        let params = [];

        if (action === 'approve' || action === 'reject') {
            q = `UPDATE reviews SET is_public = ${action === 'approve'}`;
            if (hasModeratedBy) { q += `, moderated_by = $1`; params.push(req.user.id); }
            if (hasModeratedAt)  q += `, moderated_at = CURRENT_TIMESTAMP`;
            if (hasModerationReason && reason) { q += `, moderation_reason = $${params.length + 1}`; params.push(reason); }
        } else if (action === 'flag') {
            q = `UPDATE reviews SET is_flagged = true`;
            if (hasFlaggedBy) { q += `, flagged_by = $1`; params.push(req.user.id); }
            if (hasFlaggedAt) q += `, flagged_at = CURRENT_TIMESTAMP`;
            if (hasFlagReason && reason) { q += `, flag_reason = $${params.length + 1}`; params.push(reason); }
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
        const { key, value } = req.body;
        if (!await tableExists('system_settings')) return res.status(500).json({ error: 'Table not found' });
        const result = await query(
            `INSERT INTO system_settings (key, value, updated_by) VALUES ($1,$2,$3)
             ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_by=EXCLUDED.updated_by, updated_at=CURRENT_TIMESTAMP RETURNING *`,
            [key, JSON.stringify(value), req.user.id]
        );
        res.json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: 'Failed to update settings' }); }
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
    getSubscriptions,
    getSubscriptionDetails,
    cancelSubscription,
    getPricingConfig,
    updatePricing,
    getCountryPricing,
    addCountryPricing,
    updateCountryPricing,
    getSystemSettings,
    updateSystemSettings,
    getAuditLogs,
    getRevenueAnalytics,
    getUserAnalytics,
    getSubscriptionAnalytics
};