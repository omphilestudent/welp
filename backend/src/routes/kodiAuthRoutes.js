const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');
const authService = require('../modules/kodiPortal/kodiPortal.auth');

const router = express.Router();

router.post(
    '/sign-in',
    validate([
        body('username').trim().isLength({ min: 3 }),
        body('password').optional().isString(),
        body('otp').optional().isString()
    ]),
    async (req, res) => {
        try {
            const payload = await authService.signInWithUsername({
                username: req.body.username,
                password: req.body.password,
                otp: req.body.otp
            });
            return res.json({ success: true, data: payload });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message || 'Failed to sign in' });
        }
    }
);

router.post(
    '/first-login',
    authenticate,
    validate([
        body('firstLoginToken').isLength({ min: 6 }),
        body('password').isLength({ min: 8 })
    ]),
    async (req, res) => {
        try {
            const payload = await authService.completeFirstLogin({
                userId: req.user?.id,
                firstLoginToken: req.body.firstLoginToken,
                password: req.body.password
            });
            return res.json({ success: true, data: payload });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message || 'Failed to complete first login' });
        }
    }
);

module.exports = router;
