const { query } = require('../utils/database');
const bcrypt = require('bcryptjs');

// Helper function to check if a table exists
const tableExists = async (tableName) => {
    try {
        const result = await query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = $1
            )`,
            [tableName]
        );
        return result.rows[0].exists;
    } catch (error) {
        return false;
    }
};

// Helper function to check if a column exists
const columnExists = async (tableName, columnName) => {
    try {
        const result = await query(
            `SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = $1 AND column_name = $2
            )`,
            [tableName, columnName]
        );
        return result.rows[0].exists;
    } catch (error) {
        return false;
    }
};

const getAdminProfile = async (req, res) => {
    try {
        console.log('Getting admin profile for user:', req.user.id);

        // First check if admin_users table exists
        const adminTableExists = await tableExists('admin_users');

        if (!adminTableExists) {
            console.log('Admin tables not found, checking user role directly');

            // Fallback: Check if user has admin role in users table
            const userResult = await query(
                `SELECT id, email, role, display_name, avatar_url 
                 FROM users 
                 WHERE id = $1`,
                [req.user.id]
            );

            if (userResult.rows.length === 0) {
                return res.status(403).json({ error: 'User not found' });
            }

            const user = userResult.rows[0];
            const adminRoles = ['admin', 'super_admin', 'system_admin'];

            if (!adminRoles.includes(user.role)) {
                console.log('User does not have admin role:', user.role);
                return res.status(403).json({ error: 'Not an admin user' });
            }

            console.log('Admin access granted via user role');
            return res.json({
                id: user.id,
                user_id: user.id,
                email: user.email,
                display_name: user.display_name,
                avatar_url: user.avatar_url,
                role_name: user.role,
                permissions: ['*'], // Grant all permissions
                is_active: true
            });
        }

        // If admin tables exist, use them
        const result = await query(
            `SELECT
                au.*,
                u.email,
                u.display_name,
                u.avatar_url,
                COALESCE(ar.name, u.role) as role_name,
                COALESCE(ar.permissions, '["*"]') as permissions
            FROM admin_users au
            JOIN users u ON au.user_id = u.id
            LEFT JOIN admin_roles ar ON au.role_id = ar.id
            WHERE au.user_id = $1 AND au.is_active = true`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            console.log('No admin record found for user:', req.user.id);

            // Double-check if user has admin role in users table
            const userCheck = await query(
                'SELECT role FROM users WHERE id = $1',
                [req.user.id]
            );

            if (userCheck.rows.length > 0) {
                const adminRoles = ['admin', 'super_admin', 'system_admin'];
                if (adminRoles.includes(userCheck.rows[0].role)) {
                    console.log('User has admin role but no admin record - creating one');

                    // Create admin record on the fly
                    const newAdmin = await query(
                        `INSERT INTO admin_users (user_id, role_id, is_active)
                         VALUES ($1, (SELECT id FROM admin_roles WHERE name = $2 LIMIT 1), true)
                         RETURNING *`,
                        [req.user.id, userCheck.rows[0].role]
                    );

                    return res.json({
                        ...newAdmin.rows[0],
                        role_name: userCheck.rows[0].role,
                        permissions: ['*']
                    });
                }
            }

            return res.status(403).json({ error: 'Not an admin user' });
        }

        console.log('Admin profile found');
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get admin profile error:', error);
        res.status(500).json({ error: 'Failed to fetch admin profile' });
    }
};

const getDashboardStats = async (req, res) => {
    try {
        // Check which tables exist
        const [usersExist, companiesExist, reviewsExist, subscriptionsExist] = await Promise.all([
            tableExists('users'),
            tableExists('companies'),
            tableExists('reviews'),
            tableExists('subscriptions')
        ]);

        // Initialize stats with defaults
        const stats = {
            users: {
                total_users: 0,
                new_users_today: 0,
                employees: 0,
                psychologists: 0,
                businesses: 0
            },
            companies: {
                total_companies: 0,
                claimed_companies: 0,
                verified_companies: 0
            },
            reviews: {
                total_reviews: 0,
                pending_reviews: 0,
                avg_rating: 0
            },
            subscriptions: {
                total_subscriptions: 0,
                active_subscriptions: 0,
                total_revenue: 0
            },
            recentActivity: [],
            revenueGrowth: 12.5,
            userGrowth: 8.3
        };

        // Get user stats if table exists
        if (usersExist) {
            const hasIsVerified = await columnExists('users', 'is_verified');

            const userStatsQuery = hasIsVerified
                ? `SELECT
                    COUNT(*) as total_users,
                    COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as new_users_today,
                    COUNT(CASE WHEN role = 'employee' THEN 1 END) as employees,
                    COUNT(CASE WHEN role = 'psychologist' THEN 1 END) as psychologists,
                    COUNT(CASE WHEN role = 'business' THEN 1 END) as businesses
                FROM users`
                : `SELECT
                    COUNT(*) as total_users,
                    COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as new_users_today,
                    COUNT(CASE WHEN role = 'employee' THEN 1 END) as employees,
                    COUNT(CASE WHEN role = 'psychologist' THEN 1 END) as psychologists,
                    COUNT(CASE WHEN role = 'business' THEN 1 END) as businesses
                FROM users`;

            const userStats = await query(userStatsQuery);
            stats.users = userStats.rows[0];
        }

        // Get company stats if table exists
        if (companiesExist) {
            const hasIsClaimed = await columnExists('companies', 'is_claimed');
            const hasIsVerified = await columnExists('companies', 'is_verified');

            let companyStatsQuery = 'SELECT COUNT(*) as total_companies FROM companies';

            if (hasIsClaimed && hasIsVerified) {
                companyStatsQuery = `
                    SELECT
                        COUNT(*) as total_companies,
                        COUNT(CASE WHEN is_claimed = true THEN 1 END) as claimed_companies,
                        COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_companies
                    FROM companies
                `;
            } else if (hasIsClaimed) {
                companyStatsQuery = `
                    SELECT
                        COUNT(*) as total_companies,
                        COUNT(CASE WHEN is_claimed = true THEN 1 END) as claimed_companies,
                        0 as verified_companies
                    FROM companies
                `;
            }

            const companyStats = await query(companyStatsQuery);
            stats.companies = companyStats.rows[0];
        }

        // Get review stats if table exists
        if (reviewsExist) {
            const hasIsPublic = await columnExists('reviews', 'is_public');
            const hasRating = await columnExists('reviews', 'rating');

            let reviewStatsQuery = 'SELECT COUNT(*) as total_reviews FROM reviews';

            if (hasIsPublic && hasRating) {
                reviewStatsQuery = `
                    SELECT
                        COUNT(*) as total_reviews,
                        COUNT(CASE WHEN is_public = false THEN 1 END) as pending_reviews,
                        COALESCE(AVG(rating), 0) as avg_rating
                    FROM reviews
                `;
            }

            const reviewStats = await query(reviewStatsQuery);
            stats.reviews = reviewStats.rows[0];
        }

        // Get subscription stats if table exists
        if (subscriptionsExist) {
            const hasStatus = await columnExists('subscriptions', 'status');
            const hasPrice = await columnExists('subscriptions', 'price');

            let subStatsQuery = 'SELECT COUNT(*) as total_subscriptions FROM subscriptions';

            if (hasStatus && hasPrice) {
                subStatsQuery = `
                    SELECT
                        COUNT(*) as total_subscriptions,
                        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_subscriptions,
                        COALESCE(SUM(price), 0) as total_revenue
                    FROM subscriptions
                `;
            }

            const subscriptionStats = await query(subStatsQuery);
            stats.subscriptions = subscriptionStats.rows[0];
        }

        // Get recent activity (combine from available tables)
        const activityQueries = [];

        if (usersExist) {
            activityQueries.push(`
                SELECT 'user' as type, id, 'New user registered' as description, created_at
                FROM users
                WHERE created_at IS NOT NULL
            `);
        }

        if (companiesExist) {
            activityQueries.push(`
                SELECT 'company' as type, id, 'New company added' as description, created_at
                FROM companies
                WHERE created_at IS NOT NULL
            `);
        }

        if (reviewsExist) {
            activityQueries.push(`
                SELECT 'review' as type, id, 'New review posted' as description, created_at
                FROM reviews
                WHERE created_at IS NOT NULL
            `);
        }

        if (activityQueries.length > 0) {
            const recentActivity = await query(
                activityQueries.join(' UNION ALL ') + ' ORDER BY created_at DESC LIMIT 10'
            );
            stats.recentActivity = recentActivity.rows;
        }

        res.json(stats);
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        // Return partial stats instead of failing completely
        res.json({
            users: { total_users: 0, new_users_today: 0, employees: 0, psychologists: 0, businesses: 0 },
            companies: { total_companies: 0, claimed_companies: 0, verified_companies: 0 },
            reviews: { total_reviews: 0, pending_reviews: 0, avg_rating: 0 },
            subscriptions: { total_subscriptions: 0, active_subscriptions: 0, total_revenue: 0 },
            recentActivity: [],
            revenueGrowth: 0,
            userGrowth: 0
        });
    }
};

const getUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', role = '', status = '' } = req.query;
        const offset = (page - 1) * limit;

        // Check if reviews table exists for joins
        const reviewsExist = await tableExists('reviews');
        const hasIsVerified = await columnExists('users', 'is_verified');

        let queryText = `
            SELECT
                u.id, u.email, u.display_name, u.role, u.is_anonymous,
                u.created_at, u.updated_at
        `;

        if (hasIsVerified) {
            queryText = `
                SELECT
                    u.id, u.email, u.display_name, u.role, u.is_anonymous,
                    u.is_verified, u.created_at, u.updated_at
            `;
        }

        if (reviewsExist) {
            queryText += `,
                COUNT(r.id) as review_count,
                COALESCE(AVG(r.rating), 0) as avg_rating
            FROM users u
            LEFT JOIN reviews r ON u.id = r.author_id
            `;
        } else {
            queryText += `
            FROM users u
            `;
        }

        queryText += ` WHERE 1=1`;

        const params = [];
        let paramIndex = 1;

        if (search) {
            queryText += ` AND (u.email ILIKE $${paramIndex} OR u.display_name ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (role) {
            queryText += ` AND u.role = $${paramIndex}`;
            params.push(role);
            paramIndex++;
        }

        if (status === 'verified' && hasIsVerified) {
            queryText += ` AND u.is_verified = true`;
        } else if (status === 'pending' && hasIsVerified) {
            queryText += ` AND u.is_verified = false`;
        }

        if (reviewsExist) {
            queryText += ` GROUP BY u.id`;
        }

        queryText += ` ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await query(queryText, params);

        // Get total count
        const countResult = await query('SELECT COUNT(*) FROM users');
        const total = parseInt(countResult.rows[0].count);

        res.json({
            users: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

const getUserDetails = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if reviews table exists
        const reviewsExist = await tableExists('reviews');

        let queryText = `
            SELECT u.*
            FROM users u
            WHERE u.id = $1
        `;

        if (reviewsExist) {
            queryText = `
                SELECT
                    u.*,
                    COUNT(r.id) as review_count,
                    COALESCE(AVG(r.rating), 0) as avg_rating,
                    COALESCE(
                        json_agg(DISTINCT jsonb_build_object(
                            'id', r.id,
                            'company_id', r.company_id,
                            'rating', r.rating,
                            'content', r.content,
                            'created_at', r.created_at
                        )) FILTER (WHERE r.id IS NOT NULL),
                        '[]'
                    ) as reviews
                FROM users u
                LEFT JOIN reviews r ON u.id = r.author_id
                WHERE u.id = $1
                GROUP BY u.id
            `;
        }

        const result = await query(queryText, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get user details error:', error);
        res.status(500).json({ error: 'Failed to fetch user details' });
    }
};

const createUser = async (req, res) => {
    try {
        const { email, password, role, displayName, isAnonymous } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Check if user exists
        const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await query(
            `INSERT INTO users (email, password_hash, role, display_name, is_anonymous, is_verified)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, email, display_name, role, created_at`,
            [email, hashedPassword, role || 'user', displayName || email.split('@')[0], isAnonymous || false, true]
        );

        // Log action if audit_logs table exists
        const auditExists = await tableExists('audit_logs');
        if (auditExists && req.user) {
            await logAdminAction(req.user.id, 'CREATE_USER', 'users', result.rows[0].id, null, result.rows[0]);
        }

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
};

const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { displayName, role, isVerified, isAnonymous } = req.body;

        // Get old values for audit log
        const oldUser = await query('SELECT * FROM users WHERE id = $1', [id]);

        const result = await query(
            `UPDATE users
             SET display_name = COALESCE($1, display_name),
                 role = COALESCE($2, role),
                 is_verified = COALESCE($3, is_verified),
                 is_anonymous = COALESCE($4, is_anonymous),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $5
             RETURNING *`,
            [displayName, role, isVerified, isAnonymous, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Log action if audit_logs table exists
        const auditExists = await tableExists('audit_logs');
        if (auditExists && req.user) {
            await logAdminAction(
                req.user.id,
                'UPDATE_USER',
                'users',
                id,
                oldUser.rows[0] || null,
                result.rows[0]
            );
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Get user data for audit log
        const user = await query('SELECT * FROM users WHERE id = $1', [id]);

        if (user.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        await query('DELETE FROM users WHERE id = $1', [id]);

        // Log action if audit_logs table exists
        const auditExists = await tableExists('audit_logs');
        if (auditExists && req.user) {
            await logAdminAction(req.user.id, 'DELETE_USER', 'users', id, user.rows[0], null);
        }

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
};

const getCompanies = async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', industry = '', status = '' } = req.query;
        const offset = (page - 1) * limit;

        // Check if reviews table exists
        const reviewsExist = await tableExists('reviews');
        const hasIsVerified = await columnExists('companies', 'is_verified');
        const hasIsClaimed = await columnExists('companies', 'is_claimed');

        let queryText = `
            SELECT c.*
            FROM companies c
            WHERE 1=1
        `;

        if (reviewsExist) {
            queryText = `
                SELECT
                    c.*,
                    COUNT(r.id) as review_count,
                    COALESCE(AVG(r.rating), 0) as avg_rating
                FROM companies c
                LEFT JOIN reviews r ON c.id = r.company_id
                WHERE 1=1
            `;
        }

        const params = [];
        let paramIndex = 1;

        if (search) {
            queryText += ` AND (c.name ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (industry) {
            queryText += ` AND c.industry = $${paramIndex}`;
            params.push(industry);
            paramIndex++;
        }

        if (status === 'verified' && hasIsVerified) {
            queryText += ` AND c.is_verified = true`;
        } else if (status === 'pending' && hasIsVerified) {
            queryText += ` AND c.is_verified = false`;
        } else if (status === 'claimed' && hasIsClaimed) {
            queryText += ` AND c.is_claimed = true`;
        } else if (status === 'unclaimed' && hasIsClaimed) {
            queryText += ` AND c.is_claimed = false`;
        }

        if (reviewsExist) {
            queryText += ` GROUP BY c.id`;
        }

        queryText += ` ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await query(queryText, params);

        // Get total count
        const countResult = await query('SELECT COUNT(*) FROM companies');
        const total = parseInt(countResult.rows[0].count);

        res.json({
            companies: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get companies error:', error);
        res.status(500).json({ error: 'Failed to fetch companies' });
    }
};

const getCompanyDetails = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if reviews table exists
        const reviewsExist = await tableExists('reviews');

        let queryText = `
            SELECT c.*
            FROM companies c
            WHERE c.id = $1
        `;

        if (reviewsExist) {
            queryText = `
                SELECT
                    c.*,
                    COUNT(r.id) as review_count,
                    COALESCE(AVG(r.rating), 0) as avg_rating,
                    COALESCE(
                        json_agg(DISTINCT jsonb_build_object(
                            'id', r.id,
                            'author_id', r.author_id,
                            'rating', r.rating,
                            'content', r.content,
                            'created_at', r.created_at
                        )) FILTER (WHERE r.id IS NOT NULL),
                        '[]'
                    ) as reviews
                FROM companies c
                LEFT JOIN reviews r ON c.id = r.company_id
                WHERE c.id = $1
                GROUP BY c.id
            `;
        }

        const result = await query(queryText, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get company details error:', error);
        res.status(500).json({ error: 'Failed to fetch company details' });
    }
};

const verifyCompany = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if verification columns exist
        const hasVerifiedBy = await columnExists('companies', 'verified_by');
        const hasVerifiedAt = await columnExists('companies', 'verified_at');

        let updateQuery = `UPDATE companies SET is_verified = true`;

        if (hasVerifiedBy) {
            updateQuery += `, verified_by = $1`;
        }
        if (hasVerifiedAt) {
            updateQuery += `, verified_at = CURRENT_TIMESTAMP`;
        }

        updateQuery += `, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`;

        const params = hasVerifiedBy ? [req.user.id, id] : [id];
        const result = await query(updateQuery, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }

        // Log action if audit_logs table exists
        const auditExists = await tableExists('audit_logs');
        if (auditExists && req.user) {
            await logAdminAction(req.user.id, 'VERIFY_COMPANY', 'companies', id, null, result.rows[0]);
        }

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

        // Check if status column exists
        const hasStatus = await columnExists('companies', 'status');

        if (!hasStatus) {
            return res.status(400).json({ error: 'Status column does not exist' });
        }

        const result = await query(
            `UPDATE companies
             SET status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update company status error:', error);
        res.status(500).json({ error: 'Failed to update company status' });
    }
};

const deleteCompany = async (req, res) => {
    try {
        const { id } = req.params;

        // Get company data for audit log
        const company = await query('SELECT * FROM companies WHERE id = $1', [id]);

        if (company.rows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }

        await query('DELETE FROM companies WHERE id = $1', [id]);

        // Log action if audit_logs table exists
        const auditExists = await tableExists('audit_logs');
        if (auditExists && req.user) {
            await logAdminAction(req.user.id, 'DELETE_COMPANY', 'companies', id, company.rows[0], null);
        }

        res.json({ message: 'Company deleted successfully' });
    } catch (error) {
        console.error('Delete company error:', error);
        res.status(500).json({ error: 'Failed to delete company' });
    }
};

const getReviews = async (req, res) => {
    try {
        const { page = 1, limit = 20, status = 'all' } = req.query;
        const offset = (page - 1) * limit;

        // Check if required tables exist
        const [usersExist, companiesExist] = await Promise.all([
            tableExists('users'),
            tableExists('companies')
        ]);

        if (!usersExist || !companiesExist) {
            return res.json({
                reviews: [],
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: 0,
                    pages: 0
                }
            });
        }

        const hasIsPublic = await columnExists('reviews', 'is_public');

        let queryText = `
            SELECT
                r.*,
                u.display_name as author_name,
                u.email as author_email,
                c.name as company_name,
                c.id as company_id
            FROM reviews r
            JOIN users u ON r.author_id = u.id
            JOIN companies c ON r.company_id = c.id
            WHERE 1=1
        `;

        if (status === 'pending' && hasIsPublic) {
            queryText += ` AND r.is_public = false`;
        } else if (status === 'approved' && hasIsPublic) {
            queryText += ` AND r.is_public = true`;
        }

        queryText += ` ORDER BY r.created_at DESC LIMIT $1 OFFSET $2`;

        const result = await query(queryText, [limit, offset]);

        // Get total count
        const countResult = await query('SELECT COUNT(*) FROM reviews');
        const total = parseInt(countResult.rows[0].count);

        res.json({
            reviews: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
};

const getPendingReviews = async (req, res) => {
    try {
        // Check if is_public column exists
        const hasIsPublic = await columnExists('reviews', 'is_public');

        if (!hasIsPublic) {
            return res.json([]);
        }

        const result = await query(
            `SELECT
                r.*,
                u.display_name as author_name,
                u.email as author_email,
                c.name as company_name
            FROM reviews r
            JOIN users u ON r.author_id = u.id
            JOIN companies c ON r.company_id = c.id
            WHERE r.is_public = false
            ORDER BY r.created_at ASC`
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

        // Check if moderation columns exist
        const hasModeratedBy = await columnExists('reviews', 'moderated_by');
        const hasModeratedAt = await columnExists('reviews', 'moderated_at');
        const hasModerationReason = await columnExists('reviews', 'moderation_reason');
        const hasIsFlagged = await columnExists('reviews', 'is_flagged');
        const hasFlaggedBy = await columnExists('reviews', 'flagged_by');
        const hasFlaggedAt = await columnExists('reviews', 'flagged_at');
        const hasFlagReason = await columnExists('reviews', 'flag_reason');

        let updateQuery = '';
        let params = [];

        if (action === 'approve') {
            updateQuery = `UPDATE reviews SET is_public = true`;
            if (hasModeratedBy) {
                updateQuery += `, moderated_by = $1`;
                params.push(req.user.id);
            }
            if (hasModeratedAt) {
                updateQuery += `, moderated_at = CURRENT_TIMESTAMP`;
            }
            updateQuery += ` WHERE id = $${params.length + 1} RETURNING *`;
            params.push(id);
        }
        else if (action === 'reject') {
            updateQuery = `UPDATE reviews SET is_public = false`;
            if (hasModeratedBy) {
                updateQuery += `, moderated_by = $1`;
                params.push(req.user.id);
            }
            if (hasModeratedAt) {
                updateQuery += `, moderated_at = CURRENT_TIMESTAMP`;
            }
            if (hasModerationReason && reason) {
                updateQuery += `, moderation_reason = $${params.length + 1}`;
                params.push(reason);
            }
            updateQuery += ` WHERE id = $${params.length + 1} RETURNING *`;
            params.push(id);
        }
        else if (action === 'flag') {
            updateQuery = `UPDATE reviews SET is_flagged = true`;
            if (hasFlaggedBy) {
                updateQuery += `, flagged_by = $1`;
                params.push(req.user.id);
            }
            if (hasFlaggedAt) {
                updateQuery += `, flagged_at = CURRENT_TIMESTAMP`;
            }
            if (hasFlagReason && reason) {
                updateQuery += `, flag_reason = $${params.length + 1}`;
                params.push(reason);
            }
            updateQuery += ` WHERE id = $${params.length + 1} RETURNING *`;
            params.push(id);
        }

        const result = await query(updateQuery, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Review not found' });
        }

        res.json({ message: `Review ${action}ed successfully`, review: result.rows[0] });
    } catch (error) {
        console.error('Moderate review error:', error);
        res.status(500).json({ error: 'Failed to moderate review' });
    }
};

const deleteReview = async (req, res) => {
    try {
        const { id } = req.params;

        // Get review data for audit log
        const review = await query('SELECT * FROM reviews WHERE id = $1', [id]);

        if (review.rows.length === 0) {
            return res.status(404).json({ error: 'Review not found' });
        }

        await query('DELETE FROM reviews WHERE id = $1', [id]);

        // Log action if audit_logs table exists
        const auditExists = await tableExists('audit_logs');
        if (auditExists && req.user) {
            await logAdminAction(req.user.id, 'DELETE_REVIEW', 'reviews', id, review.rows[0], null);
        }

        res.json({ message: 'Review deleted successfully' });
    } catch (error) {
        console.error('Delete review error:', error);
        res.status(500).json({ error: 'Failed to delete review' });
    }
};

const getSubscriptions = async (req, res) => {
    try {
        // Check if subscriptions table exists
        const subsExist = await tableExists('subscriptions');

        if (!subsExist) {
            return res.json([]);
        }

        const result = await query(
            `SELECT
                s.*,
                u.email as user_email,
                u.display_name as user_name
            FROM subscriptions s
            JOIN users u ON s.user_id = u.id
            ORDER BY s.created_at DESC`
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

        // Check if subscriptions table exists
        const subsExist = await tableExists('subscriptions');

        if (!subsExist) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        const result = await query(
            `SELECT
                s.*,
                u.email as user_email,
                u.display_name as user_name
            FROM subscriptions s
            JOIN users u ON s.user_id = u.id
            WHERE s.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get subscription details error:', error);
        res.status(500).json({ error: 'Failed to fetch subscription details' });
    }
};

const cancelSubscription = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if subscriptions table exists
        const subsExist = await tableExists('subscriptions');

        if (!subsExist) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        // Check if cancellation columns exist
        const hasCancelledBy = await columnExists('subscriptions', 'cancelled_by');
        const hasCancelledAt = await columnExists('subscriptions', 'cancelled_at');

        let updateQuery = `UPDATE subscriptions SET status = 'cancelled'`;

        if (hasCancelledBy) {
            updateQuery += `, cancelled_by = $1`;
        }
        if (hasCancelledAt) {
            updateQuery += `, cancelled_at = CURRENT_TIMESTAMP`;
        }

        updateQuery += `, updated_at = CURRENT_TIMESTAMP WHERE id = $${hasCancelledBy ? 2 : 1} RETURNING *`;

        const params = hasCancelledBy ? [req.user.id, id] : [id];
        const result = await query(updateQuery, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        res.json({ message: 'Subscription cancelled successfully', subscription: result.rows[0] });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ error: 'Failed to cancel subscription' });
    }
};

const getPricingConfig = async (req, res) => {
    try {
        // Check if pricing_config table exists
        const pricingExists = await tableExists('pricing_config');

        if (!pricingExists) {
            // Return default pricing
            return res.json({
                user: {
                    free: { price: 0, features: ['Basic features'] },
                    premium: { price: 9.99, features: ['Advanced features'] }
                },
                business: {
                    basic: { price: 29.99, features: ['Company profile', 'Review responses'] },
                    pro: { price: 49.99, features: ['Analytics', 'Priority support'] }
                }
            });
        }

        const result = await query(
            `SELECT * FROM pricing_config WHERE is_active = true ORDER BY role, plan`
        );

        const pricing = {};
        result.rows.forEach(item => {
            if (!pricing[item.role]) {
                pricing[item.role] = {};
            }
            pricing[item.role][item.plan] = item;
        });

        res.json(pricing);
    } catch (error) {
        console.error('Get pricing config error:', error);
        res.status(500).json({ error: 'Failed to fetch pricing configuration' });
    }
};

const updatePricing = async (req, res) => {
    try {
        const { role, plan } = req.params;
        const { base_price_usd, features, limits } = req.body;

        // Check if pricing_config table exists
        const pricingExists = await tableExists('pricing_config');

        if (!pricingExists) {
            return res.status(404).json({ error: 'Pricing configuration not found' });
        }

        const result = await query(
            `UPDATE pricing_config
             SET base_price_usd = $1,
                 features = $2,
                 limits = $3,
                 updated_by = $4,
                 updated_at = CURRENT_TIMESTAMP
             WHERE role = $5 AND plan = $6
             RETURNING *`,
            [base_price_usd, JSON.stringify(features || []), JSON.stringify(limits || {}), req.user.id, role, plan]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pricing configuration not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update pricing error:', error);
        res.status(500).json({ error: 'Failed to update pricing' });
    }
};

const getCountryPricing = async (req, res) => {
    try {
        // Check if country_pricing table exists
        const countryExists = await tableExists('country_pricing');

        if (!countryExists) {
            return res.json([]);
        }

        const result = await query(
            `SELECT * FROM country_pricing WHERE is_active = true ORDER BY country_name`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get country pricing error:', error);
        res.status(500).json({ error: 'Failed to fetch country pricing' });
    }
};

const addCountryPricing = async (req, res) => {
    try {
        const { country_code, country_name, multiplier, currency, currency_symbol } = req.body;

        // Check if country_pricing table exists
        const countryExists = await tableExists('country_pricing');

        if (!countryExists) {
            return res.status(500).json({ error: 'Country pricing table does not exist' });
        }

        const result = await query(
            `INSERT INTO country_pricing (country_code, country_name, multiplier, currency, currency_symbol, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [country_code, country_name, multiplier, currency, currency_symbol, req.user.id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Add country pricing error:', error);
        res.status(500).json({ error: 'Failed to add country pricing' });
    }
};

const updateCountryPricing = async (req, res) => {
    try {
        const { countryCode } = req.params;
        const { multiplier, currency, currency_symbol } = req.body;

        // Check if country_pricing table exists
        const countryExists = await tableExists('country_pricing');

        if (!countryExists) {
            return res.status(404).json({ error: 'Country not found' });
        }

        const result = await query(
            `UPDATE country_pricing
             SET multiplier = COALESCE($1, multiplier),
                 currency = COALESCE($2, currency),
                 currency_symbol = COALESCE($3, currency_symbol),
                 updated_by = $4,
                 updated_at = CURRENT_TIMESTAMP
             WHERE country_code = $5
             RETURNING *`,
            [multiplier, currency, currency_symbol, req.user.id, countryCode]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Country not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update country pricing error:', error);
        res.status(500).json({ error: 'Failed to update country pricing' });
    }
};

const getSystemSettings = async (req, res) => {
    try {
        // Check if system_settings table exists
        const settingsExist = await tableExists('system_settings');

        if (!settingsExist) {
            return res.json({});
        }

        const result = await query(`SELECT * FROM system_settings ORDER BY key`);

        const settings = {};
        result.rows.forEach(item => {
            settings[item.key] = item.value;
        });

        res.json(settings);
    } catch (error) {
        console.error('Get system settings error:', error);
        res.status(500).json({ error: 'Failed to fetch system settings' });
    }
};

const updateSystemSettings = async (req, res) => {
    try {
        const { key, value } = req.body;

        // Check if system_settings table exists
        const settingsExist = await tableExists('system_settings');

        if (!settingsExist) {
            return res.status(500).json({ error: 'System settings table does not exist' });
        }

        const result = await query(
            `INSERT INTO system_settings (key, value, updated_by)
             VALUES ($1, $2, $3)
             ON CONFLICT (key) DO UPDATE
             SET value = EXCLUDED.value,
                 updated_by = EXCLUDED.updated_by,
                 updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [key, JSON.stringify(value), req.user.id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update system settings error:', error);
        res.status(500).json({ error: 'Failed to update system settings' });
    }
};

const getAuditLogs = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        // Check if audit_logs table exists
        const auditExists = await tableExists('audit_logs');

        if (!auditExists) {
            return res.json({
                logs: [],
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: 0,
                    pages: 0
                }
            });
        }

        const result = await query(
            `SELECT
                al.*,
                u_admin.email as admin_email,
                u_admin.display_name as admin_name,
                u_target.email as target_email
            FROM audit_logs al
            LEFT JOIN users u_admin ON al.admin_id = u_admin.id
            LEFT JOIN users u_target ON al.user_id = u_target.id
            ORDER BY al.created_at DESC
            LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        const countResult = await query('SELECT COUNT(*) FROM audit_logs');
        const total = parseInt(countResult.rows[0].count);

        res.json({
            logs: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
};

const getRevenueAnalytics = async (req, res) => {
    try {
        const { period = 'month' } = req.query;

        // Check if subscriptions table exists
        const subsExist = await tableExists('subscriptions');

        if (!subsExist) {
            return res.json([]);
        }

        let interval;
        if (period === 'day') {
            interval = 'day';
        } else if (period === 'week') {
            interval = 'week';
        } else {
            interval = 'month';
        }

        const result = await query(
            `SELECT
                DATE_TRUNC($1, created_at) as date,
                COUNT(*) as subscriptions,
                SUM(price) as revenue
            FROM subscriptions
            WHERE status = 'active'
            GROUP BY DATE_TRUNC($1, created_at)
            ORDER BY date DESC
            LIMIT 12`,
            [interval]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get revenue analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch revenue analytics' });
    }
};

const getUserAnalytics = async (req, res) => {
    try {
        const result = await query(
            `SELECT
                DATE_TRUNC('day', created_at) as date,
                COUNT(*) as new_users,
                COUNT(CASE WHEN role = 'employee' THEN 1 END) as employees,
                COUNT(CASE WHEN role = 'psychologist' THEN 1 END) as psychologists,
                COUNT(CASE WHEN role = 'business' THEN 1 END) as businesses
            FROM users
            WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY DATE_TRUNC('day', created_at)
            ORDER BY date DESC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get user analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch user analytics' });
    }
};

const getSubscriptionAnalytics = async (req, res) => {
    try {
        // Check if subscriptions table exists
        const subsExist = await tableExists('subscriptions');

        if (!subsExist) {
            return res.json([]);
        }

        const result = await query(
            `SELECT
                plan,
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
                SUM(CASE WHEN status = 'active' THEN price ELSE 0 END) as revenue
            FROM subscriptions
            GROUP BY plan`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get subscription analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch subscription analytics' });
    }
};

const logAdminAction = async (adminId, action, entityType, entityId, oldValues, newValues) => {
    try {
        // Check if audit_logs table exists
        const auditExists = await tableExists('audit_logs');

        if (!auditExists) {
            return;
        }

        await query(
            `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, old_values, new_values)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [adminId, action, entityType, entityId, JSON.stringify(oldValues), JSON.stringify(newValues)]
        );
    } catch (error) {
        console.error('Failed to log admin action:', error);
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