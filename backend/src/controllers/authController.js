// backend/src/controllers/authController.js
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

        // Handle anonymous users
        if (isAnonymous) {
            const result = await query(
                `INSERT INTO users (role, is_anonymous, display_name)
                 VALUES ($1, $2, $3)
                 RETURNING id, role, is_anonymous, display_name, token_version`,
                [role, true, displayName || `Anonymous_${Date.now()}`]
            );

            const user = result.rows[0];
            const token = signUserToken(user);

            res.cookie('token', token, getCookieOptions());

            return res.json({
                user: {
                    id: user.id,
                    role: user.role,
                    isAnonymous: user.is_anonymous,
                    displayName: user.display_name
                }
            });
        }

        // Handle regular users
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Check if user exists
        const existingUser = await query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const result = await query(
            `INSERT INTO users (email, password_hash, role, is_anonymous, display_name)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, email, role, is_anonymous, display_name, token_version`,
            [email, hashedPassword, role, false, displayName || email.split('@')[0]]
        );

        const user = result.rows[0];
        const token = signUserToken(user);

        res.cookie('token', token, getCookieOptions());

        res.json({
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                displayName: user.display_name,
                isAnonymous: user.is_anonymous
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const result = await query(
            'SELECT id, email, password_hash, role, is_anonymous, display_name, token_version FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        if (!user.password_hash) {
            return res.status(401).json({ error: 'Invalid login method for this account' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = signUserToken(user);

        res.cookie('token', token, getCookieOptions());

        res.json({
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                displayName: user.display_name,
                isAnonymous: user.is_anonymous
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
};

const logout = (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
    res.json({ message: 'Logged out successfully' });
};

const getCurrentUser = async (req, res) => {
    try {
        const token = getTokenFromRequest(req);

        if (!token) {
            return res.json({ user: null });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const result = await query(
            'SELECT id, email, role, is_anonymous, display_name, avatar_url, token_version FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.json({ user: null });
        }

        const user = result.rows[0];
        const tokenVersion = Number(decoded.tokenVersion ?? 0);

        if (tokenVersion !== Number(user.token_version ?? 0)) {
            return res.json({ user: null });
        }

        res.json({
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                displayName: user.display_name,
                isAnonymous: user.is_anonymous,
                avatarUrl: user.avatar_url
            }
        });
    } catch (error) {
        res.json({ user: null });
    }
};

module.exports = {
    register,
    login,
    logout,
    getCurrentUser,
    getCookieOptions
};
