const express = require('express');
const router = express.Router();

const {
    registerEmployee,
    registerPsychologist,
    registerBusiness,
    login,
    getMe,
    logout,
    refreshToken
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

// Protected
router.get('/me', authenticate, getMe);

module.exports = router;
