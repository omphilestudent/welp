const express = require('express');
const jwt = require('jsonwebtoken');
const { User, Role } = require('../models');
const { authenticate } = require('../middleware/rbacAuth');

const router = express.Router();

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ where: { email }, include: [{ model: Role }] });

        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        if (!user.isActive) return res.status(401).json({ error: 'Account is deactivated' });

        const isValid = await user.validatePassword(password);
        if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

        await user.update({ lastLogin: new Date() });

        const token = jwt.sign({ id: user.id, email: user.email, role: user.Role.name }, process.env.JWT_SECRET, { expiresIn: '24h' });

        const userResponse = user.toJSON();
        delete userResponse.password;

        res.json({ message: 'Login successful', token, user: userResponse });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            include: [{ model: Role }],
            attributes: { exclude: ['password'] }
        });
        res.json(user);
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

router.post('/change-password', authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findByPk(req.user.id);

        const isValid = await user.validatePassword(currentPassword);
        if (!isValid) return res.status(401).json({ error: 'Current password is incorrect' });

        await user.update({ password: newPassword });
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

module.exports = router;
