// backend/src/routes/authRoutes.js
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { authLimiter, loginLimiter } = require('../middleware/rateLimiter');
const { validate, registerValidation, loginValidation } = require('../middleware/validation');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/register', authLimiter, validate(registerValidation), authController.register);
router.post('/login', authLimiter, loginLimiter, validate(loginValidation), authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authController.getCurrentUser);

module.exports = router;