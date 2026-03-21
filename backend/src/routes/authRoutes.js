const express = require('express');
const router = express.Router();

const {
    registerEmployee,
    registerPsychologist,
    registerBusiness,
    login,
    getMe,
    getSessionSettings,
    getRemotePinInfo,
    setupRemotePinController,
    verifyRemotePinController,
    changeRemotePinController,
    logout,
    refreshToken
} = require('../controllers/authController');
const {
    startGoogleOAuth,
    handleGoogleOAuthCallback
} = require('../controllers/authController');

const { authenticate } = require('../middleware/auth');
const { authLimiter, loginLimiter, accountSecurityLimiter } = require('../middleware/rateLimiter');
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
router.get('/remote-pin/status', authenticate, accountSecurityLimiter, getRemotePinInfo);
router.post('/remote-pin/setup', authenticate, accountSecurityLimiter, setupRemotePinController);
router.post('/remote-pin/verify', authenticate, accountSecurityLimiter, verifyRemotePinController);
router.post('/remote-pin/change', authenticate, accountSecurityLimiter, changeRemotePinController);

module.exports = router;
