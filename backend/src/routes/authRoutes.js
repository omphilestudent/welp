const express = require('express');
const router = express.Router();

const {
    registerEmployee,
    registerPsychologist,
    registerBusiness,
    login,
    getMe,
    getSessionSettings,
    logout,
    refreshToken
} = require('../controllers/authController');
const {
    startGoogleOAuth,
    handleGoogleOAuthCallback
} = require('../controllers/authController');

const { authenticate } = require('../middleware/auth');
const { authLimiter, loginLimiter } = require('../middleware/rateLimiter');
const { validate, loginValidation } = require('../middleware/validation');

// Public
router.post('/register', authLimiter, registerEmployee);
router.post('/register/psychologist', authLimiter, registerPsychologist);
router.post('/register/business', authLimiter, registerBusiness);
router.post('/login', loginLimiter, validate(loginValidation), login);
router.post('/logout', logout);
router.post('/refresh', refreshToken);
router.get('/google', startGoogleOAuth);
router.get('/google/callback', handleGoogleOAuthCallback);

// Protected
router.get('/me', authenticate, getMe);
router.get('/session-settings', authenticate, getSessionSettings);

module.exports = router;
