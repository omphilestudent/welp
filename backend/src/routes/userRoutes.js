// backend/src/routes/userRoutes.js
const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const userController = require('../controllers/userController');

const router = express.Router();

// Protected routes (all authenticated users)
router.get('/profile', authenticate, apiLimiter, userController.getProfile);
router.patch('/profile', authenticate, apiLimiter, userController.updateProfile);

// Psychologist specific routes
router.get('/psychologists', authenticate, apiLimiter, userController.getPsychologists);
router.get('/employees/:employeeId',
    authenticate,
    authorize('psychologist'),
    apiLimiter,
    userController.getEmployeeForPsychologist
);

// Admin routes (you might want to add admin role later)
router.patch('/psychologists/:userId/verify',
    authenticate,
    // authorize('admin'),
    apiLimiter,
    userController.verifyPsychologist
);

module.exports = router;