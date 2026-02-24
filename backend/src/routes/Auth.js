// src/auth/routes.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const prisma = new PrismaClient();

// Register endpoint
router.post('/register', [
    body('email').isEmail().optional(),
    body('password').isLength({ min: 6 }).optional(),
    body('role').isIn(['EMPLOYEE', 'PSYCHOLOGIST', 'BUSINESS']),
    body('isAnonymous').isBoolean().optional(),
    body('displayName').optional()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, password, role, isAnonymous, displayName } = req.body;

        // Handle anonymous users
        if (isAnonymous) {
            const anonymousUser = await prisma.user.create({
                data: {
                    role,
                    isAnonymous: true,
                    displayName: displayName || `Anonymous_${Date.now()}`
                }
            });

            const token = jwt.sign(
                { userId: anonymousUser.id, role: anonymousUser.role },
                process.env.JWT_SECRET,
                { expiresIn: '30d' }
            );

            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
            });

            return res.json({
                user: {
                    id: anonymousUser.id,
                    role: anonymousUser.role,
                    isAnonymous: true,
                    displayName: anonymousUser.displayName
                }
            });
        }

        // Handle regular users
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required for non-anonymous users' });
        }

        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                role,
                displayName,
                isAnonymous: false
            }
        });

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                displayName: user.displayName
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login endpoint
router.post('/login', [
    body('email').isEmail(),
    body('password').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user || !user.passwordHash) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                displayName: user.displayName,
                isAnonymous: user.isAnonymous
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Logout endpoint
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});

// Get current user
router.get('/me', async (req, res) => {
    try {
        const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(200).json({ user: null });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                role: true,
                isAnonymous: true,
                displayName: true,
                avatarUrl: true
            }
        });

        res.json({ user });
    } catch (error) {
        res.status(200).json({ user: null });
    }
});

module.exports = router;