const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../utils/database');
const { getTokenFromRequest } = require('../middleware/auth');

const getCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000
});

const signUserToken = (user) => jwt.sign(
    {
        userId: user.id,
        role: user.role,
        tokenVersion: Number(user.token_version ?? 0)
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
);

const register = async (req, res) => {
    try {
        const { email, password, role, isAnonymous, displayName } = req.body;

        // Handle anonymous registration
        if (isAnonymous) {
            const result = await query(
                `INSERT INTO users (role, is_anonymous, display_name)
                 VALUES ($1, $2, $3)
                 RETURNING id, role, is_anonymous, display_name, token_version`,
                [role || 'user', true, displayName || `Anonymous_${Date.now()}`]
            );

            const user = result.rows[0];
            const token = signUserToken(user);

            res.cookie('token', token, getCookieOptions());

            return res.status(201).json({
                success: true,
                user: {
                    id: user.id,
                    role: user.role,
                    isAnonymous: user.is_anonymous,
                    displayName: user.display_name
                }
            });
        }

        // Validate email and password for regular registration
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        // Check if user already exists
        const existingUser = await query(
            'SELECT id FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Email already registered'
            });
        }

        // Hash password and create user
        const hashedPassword = await bcrypt.hash(password, 12);
        const displayNameValue = displayName || email.split('@')[0];

        const result = await query(
            `INSERT INTO users (email, password_hash, role, is_anonymous, display_name, is_verified)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, email, role, is_anonymous, display_name, token_version, created_at`,
            [email.toLowerCase(), hashedPassword, role || 'user', false, displayNameValue, false]
        );

        const user = result.rows[0];
        const token = signUserToken(user);

        res.cookie('token', token, getCookieOptions());

        res.status(201).json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                displayName: user.display_name,
                isAnonymous: user.is_anonymous
            }
        });
    } catch (error) {
        console.error('❌ Registration error:', error);
        console.error('Error stack:', error.stack);

        // Handle specific database errors
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({
                success: false,
                error: 'Email already registered'
            });
        }

        if (error.code === '42P01') { // Table doesn't exist
            console.error('❌ Users table does not exist. Please run database migrations.');
            return res.status(503).json({
                success: false,
                error: 'Database not initialized'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Registration failed. Please try again.'
        });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        // Find user by email
        const result = await query(
            `SELECT id, email, password_hash, role, is_anonymous, display_name, 
                    token_version, is_verified, created_at
             FROM users 
             WHERE email = $1`,
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            // Use generic message for security
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        const user = result.rows[0];

        // Check if user has a password (not OAuth only)
        if (!user.password_hash) {
            return res.status(401).json({
                success: false,
                error: 'This account uses a different login method. Please try social login.'
            });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        // Check if email is verified (optional)
        // if (!user.is_verified) {
        //     return res.status(401).json({ 
        //         success: false,
        //         error: 'Please verify your email before logging in' 
        //     });
        // }

        // Generate token
        const token = signUserToken(user);

        // Set cookie
        res.cookie('token', token, getCookieOptions());

        // Return success
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                displayName: user.display_name,
                isAnonymous: user.is_anonymous
            }
        });
    } catch (error) {
        console.error('❌ Login error:', error);
        console.error('Error stack:', error.stack);

        // Handle specific database errors
        if (error.code === '42P01') { // Table doesn't exist
            console.error('❌ Users table does not exist. Please run database migrations.');
            return res.status(503).json({
                success: false,
                error: 'Database not initialized'
            });
        }

        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return res.status(503).json({
                success: false,
                error: 'Database connection error. Please try again.'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Login failed. Please try again.'
        });
    }
};

const logout = (req, res) => {
    try {
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/'
        });

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('❌ Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Logout failed'
        });
    }
};

const getCurrentUser = async (req, res) => {
    try {
        const token = getTokenFromRequest(req);

        if (!token) {
            return res.json({
                success: true,
                user: null
            });
        }

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtError) {
            console.error('❌ Token verification failed:', jwtError.message);
            return res.json({
                success: true,
                user: null
            });
        }

        // Get user from database
        const result = await query(
            `SELECT id, email, role, is_anonymous, display_name, avatar_url, 
                    token_version, is_verified, created_at
             FROM users 
             WHERE id = $1`,
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                user: null
            });
        }

        const user = result.rows[0];
        const tokenVersion = Number(decoded.tokenVersion ?? 0);

        // Check if token version matches (for logout/invalidate)
        if (tokenVersion !== Number(user.token_version ?? 0)) {
            return res.json({
                success: true,
                user: null
            });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                displayName: user.display_name,
                isAnonymous: user.is_anonymous,
                avatarUrl: user.avatar_url,
                isVerified: user.is_verified
            }
        });
    } catch (error) {
        console.error('❌ Get current user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user information'
        });
    }
};

module.exports = {
    register,
    login,
    logout,
    getCurrentUser,
    getCookieOptions
};