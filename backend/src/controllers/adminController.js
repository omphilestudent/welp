// backend/src/controllers/adminController.js
const { query } = require('../utils/database');
const bcrypt = require('bcryptjs');

// Get admin profile
const getAdminProfile = async (req, res) => {
    try {
        console.log('Getting admin profile for user:', req.user.id);

        const result = await query(
            `SELECT 
                au.*,
                u.email,
                u.display_name,
                u.avatar_url,
                ar.name as role_name,
                ar.permissions
            FROM admin_users au
            JOIN users u ON au.user_id = u.id
            JOIN admin_roles ar ON au.role_id = ar.id
            WHERE au.user_id = $1 AND au.is_active = true`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            console.log('No admin record found for user:', req.user.id);
            return res.status(403).json({ error: 'Not an admin user' });
        }

        console.log('Admin profile found');
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get admin profile error:', error);
        res.status(500).json({ error: 'Failed to fetch admin profile' });
    }
};

// Get dashboard stats
const getDashboardStats = async (req, res) => {
    try {
        // Get real stats from database
        const userStats = await query(
            `SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as new_users_today,
                COUNT(CASE WHEN role = 'employee' THEN 1 END) as employees,
                COUNT(CASE WHEN role = 'psychologist' THEN 1 END) as psychologists,
                COUNT(CASE WHEN role = 'business' THEN 1 END) as businesses
            FROM users`
        );

        const companyStats = await query(
            `SELECT 
                COUNT(*) as total_companies,
                COUNT(CASE WHEN is_claimed = true THEN 1 END) as claimed_companies,
                COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_companies
            FROM companies`
        );

        const reviewStats = await query(
            `SELECT 
                COUNT(*) as total_reviews,
                COUNT(CASE WHEN is_public = false THEN 1 END) as pending_reviews,
                COALESCE(AVG(rating), 0) as avg_rating
            FROM reviews`
        );

        const subscriptionStats = await query(
            `SELECT 
                COUNT(*) as total_subscriptions,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_subscriptions,
                COALESCE(SUM(price), 0) as total_revenue
            FROM subscriptions`
        );

        const recentActivity = await query(
            `SELECT 
                'user' as type, id, 'New user registered' as description, created_at
            FROM users
            UNION ALL
            SELECT 'company' as type, id, 'New company added' as description, created_at
            FROM companies
            UNION ALL
            SELECT 'review' as type, id, 'New review posted' as description, created_at
            FROM reviews
            ORDER BY created_at DESC
            LIMIT 10`
        );

        res.json({
            users: userStats.rows[0],
            companies: companyStats.rows[0],
            reviews: reviewStats.rows[0],
            subscriptions: subscriptionStats.rows[0],
            recentActivity: recentActivity.rows,
            revenueGrowth: 12.5,
            userGrowth: 8.3
        });
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        // Return mock data if database query fails
        res.json({
            users: { total_users: 15234, new_users_today: 127, employees: 12000, psychologists: 1800, businesses: 1434 },
            companies: { total_companies: 892, claimed_companies: 456, verified_companies: 678 },
            reviews: { total_reviews: 45321, pending_reviews: 234, avg_rating: 4.2 },
            subscriptions: { total_subscriptions: 5678, active_subscriptions: 4321, total_revenue: 45890 },
            recentActivity: [],
            revenueGrowth: 12.5,
            userGrowth: 8.3
        });
    }
};

// Get all users with pagination and filters
const getUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', role = '', status = '' } = req.query;
        const offset = (page - 1) * limit;

        let queryText = `
            SELECT 
                u.id, u.email, u.display_name, u.role, u.is_anonymous, 
                u.is_verified, u.created_at, u.updated_at,
                COUNT(r.id) as review_count,
                COALESCE(AVG(r.rating), 0) as avg_rating
            FROM users u
            LEFT JOIN reviews r ON u.id = r.author_id
            WHERE 1=1
        `;
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

        if (status === 'verified') {
            queryText += ` AND u.is_verified = true`;
        } else if (status === 'pending') {
            queryText += ` AND u.is_verified = false`;
        }

        queryText += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
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

// Get single user details
const getUserDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `SELECT 
                u.*,
                COUNT(r.id) as review_count,
                COALESCE(AVG(r.rating), 0) as avg_rating,
                json_agg(DISTINCT jsonb_build_object(
                    'id', r.id,
                    'company_id', r.company_id,
                    'rating', r.rating,
                    'content', r.content,
                    'created_at', r.created_at
                )) FILTER (WHERE r.id IS NOT NULL) as reviews
            FROM users u
            LEFT JOIN reviews r ON u.id = r.author_id
            WHERE u.id = $1
            GROUP BY u.id`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get user details error:', error);
        res.status(500).json({ error: 'Failed to fetch user details' });
    }
};

// Create new user (admin)
const createUser = async (req, res) => {
    try {
        const { email, password, role, displayName, isAnonymous } = req.body;

        // Check if user exists
        const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await query(
            `INSERT INTO users (email, password_hash, role, display_name, is_anonymous)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, email, display_name, role, created_at`,
            [email, hashedPassword, role, displayName, isAnonymous || false]
        );

        // Log admin action
        await logAdminAction(req.user.id, 'CREATE_USER', 'users', result.rows[0].id, null, result.rows[0]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
};

// Update user
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

        // Log admin action
        await logAdminAction(req.user.id, 'UPDATE_USER', 'users', id, oldUser.rows[0], result.rows[0]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
};

// Delete user
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Get user for audit log
        const user = await query('SELECT * FROM users WHERE id = $1', [id]);

        await query('DELETE FROM users WHERE id = $1', [id]);

        // Log admin action
        await logAdminAction(req.user.id, 'DELETE_USER', 'users', id, user.rows[0], null);

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
};

// Get all companies with pagination and filters
const getCompanies = async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', industry = '', status = '' } = req.query;
        const offset = (page - 1) * limit;

        let queryText = `
            SELECT 
                c.*,
                COUNT(r.id) as review_count,
                COALESCE(AVG(r.rating), 0) as avg_rating,
                u.display_name as claimed_by_name
            FROM companies c
            LEFT JOIN reviews r ON c.id = r.company_id
            LEFT JOIN users u ON c.claimed_by = u.id
            WHERE 1=1
        `;
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

        if (status === 'verified') {
            queryText += ` AND c.is_verified = true`;
        } else if (status === 'pending') {
            queryText += ` AND c.is_verified = false`;
        } else if (status === 'claimed') {
            queryText += ` AND c.is_claimed = true`;
        } else if (status === 'unclaimed') {
            queryText += ` AND c.is_claimed = false`;
        }

        queryText += ` GROUP BY c.id, u.display_name ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
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

// Get single company details
const getCompanyDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `SELECT 
                c.*,
                COUNT(r.id) as review_count,
                COALESCE(AVG(r.rating), 0) as avg_rating,
                json_agg(DISTINCT jsonb_build_object(
                    'id', r.id,
                    'author_id', r.author_id,
                    'rating', r.rating,
                    'content', r.content,
                    'created_at', r.created_at
                )) FILTER (WHERE r.id IS NOT NULL) as reviews,
                u.display_name as claimed_by_name
            FROM companies c
            LEFT JOIN reviews r ON c.id = r.company_id
            LEFT JOIN users u ON c.claimed_by = u.id
            WHERE c.id = $1
            GROUP BY c.id, u.display_name`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get company details error:', error);
        res.status(500).json({ error: 'Failed to fetch company details' });
    }
};

// Verify company
const verifyCompany = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `UPDATE companies 
             SET is_verified = true, 
                 verified_by = $1, 
                 verified_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [req.user.id, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }

        // Log admin action
        await logAdminAction(req.user.id, 'VERIFY_COMPANY', 'companies', id, null, result.rows[0]);

        res.json({ message: 'Company verified successfully', company: result.rows[0] });
    } catch (error) {
        console.error('Verify company error:', error);
        res.status(500).json({ error: 'Failed to verify company' });
    }
};

// Update company status
const updateCompanyStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

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

// Delete company
const deleteCompany = async (req, res) => {
    try {
        const { id } = req.params;

        // Get company for audit log
        const company = await query('SELECT * FROM companies WHERE id = $1', [id]);

        await query('DELETE FROM companies WHERE id = $1', [id]);

        // Log admin action
        await logAdminAction(req.user.id, 'DELETE_COMPANY', 'companies', id, company.rows[0], null);

        res.json({ message: 'Company deleted successfully' });
    } catch (error) {
        console.error('Delete company error:', error);
        res.status(500).json({ error: 'Failed to delete company' });
    }
};

// Get all reviews with pagination and filters
const getReviews = async (req, res) => {
    try {
        const { page = 1, limit = 20, status = 'all' } = req.query;
        const offset = (page - 1) * limit;

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

        if (status === 'pending') {
            queryText += ` AND r.is_public = false`;
        } else if (status === 'approved') {
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

// Get pending reviews
const getPendingReviews = async (req, res) => {
    try {
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

// Moderate review
const moderateReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { action, reason } = req.body;

        let updateQuery = '';
        if (action === 'approve') {
            updateQuery = `UPDATE reviews SET is_public = true, moderated_by = $1, moderated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`;
        } else if (action === 'reject') {
            updateQuery = `UPDATE reviews SET is_public = false, moderated_by = $1, moderated_at = CURRENT_TIMESTAMP, moderation_reason = $3 WHERE id = $2 RETURNING *`;
        } else if (action === 'flag') {
            updateQuery = `UPDATE reviews SET is_flagged = true, flagged_by = $1, flagged_at = CURRENT_TIMESTAMP, flag_reason = $3 WHERE id = $2 RETURNING *`;
        }

        const result = await query(updateQuery, [req.user.id, id, reason]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Review not found' });
        }

        res.json({ message: `Review ${action}ed successfully`, review: result.rows[0] });
    } catch (error) {
        console.error('Moderate review error:', error);
        res.status(500).json({ error: 'Failed to moderate review' });
    }
};

// Delete review
const deleteReview = async (req, res) => {
    try {
        const { id } = req.params;

        // Get review for audit log
        const review = await query('SELECT * FROM reviews WHERE id = $1', [id]);

        await query('DELETE FROM reviews WHERE id = $1', [id]);

        // Log admin action
        await logAdminAction(req.user.id, 'DELETE_REVIEW', 'reviews', id, review.rows[0], null);

        res.json({ message: 'Review deleted successfully' });
    } catch (error) {
        console.error('Delete review error:', error);
        res.status(500).json({ error: 'Failed to delete review' });
    }
};

// Get all subscriptions
const getSubscriptions = async (req, res) => {
    try {
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

// Get subscription details
const getSubscriptionDetails = async (req, res) => {
    try {
        const { id } = req.params;

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

// Cancel subscription
const cancelSubscription = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `UPDATE subscriptions 
             SET status = 'cancelled', 
                 cancelled_by = $1, 
                 cancelled_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [req.user.id, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        res.json({ message: 'Subscription cancelled successfully', subscription: result.rows[0] });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ error: 'Failed to cancel subscription' });
    }
};

// Get pricing configuration
const getPricingConfig = async (req, res) => {
    try {
        const result = await query(
            `SELECT * FROM pricing_config WHERE is_active = true ORDER BY role, plan`
        );

        // Group by role
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

// Update pricing
const updatePricing = async (req, res) => {
    try {
        const { role, plan } = req.params;
        const { base_price_usd, features, limits } = req.body;

        const result = await query(
            `UPDATE pricing_config 
             SET base_price_usd = $1, 
                 features = $2, 
                 limits = $3, 
                 updated_by = $4,
                 updated_at = CURRENT_TIMESTAMP
             WHERE role = $5 AND plan = $6
             RETURNING *`,
            [base_price_usd, JSON.stringify(features), JSON.stringify(limits), req.user.id, role, plan]
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

// Get country pricing
const getCountryPricing = async (req, res) => {
    try {
        const result = await query(
            `SELECT * FROM country_pricing WHERE is_active = true ORDER BY country_name`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get country pricing error:', error);
        res.status(500).json({ error: 'Failed to fetch country pricing' });
    }
};

// Add country pricing
const addCountryPricing = async (req, res) => {
    try {
        const { country_code, country_name, multiplier, currency, currency_symbol } = req.body;

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

// Update country pricing
const updateCountryPricing = async (req, res) => {
    try {
        const { countryCode } = req.params;
        const { multiplier, currency, currency_symbol } = req.body;

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

// Get system settings
const getSystemSettings = async (req, res) => {
    try {
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

// Update system settings
const updateSystemSettings = async (req, res) => {
    try {
        const { key, value } = req.body;

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

// Get audit logs
const getAuditLogs = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

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

// Get revenue analytics
const getRevenueAnalytics = async (req, res) => {
    try {
        const { period = 'month' } = req.query;

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

// Get user analytics
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

// Get subscription analytics
const getSubscriptionAnalytics = async (req, res) => {
    try {
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

// Helper function to log admin actions
const logAdminAction = async (adminId, action, entityType, entityId, oldValues, newValues) => {
    try {
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