// backend/src/routes/adminRoutes.js
const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { authorizeAdmin } = require('../middleware/adminAuth');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validation');
const adminController = require('../controllers/adminController');

const router = express.Router();

// All admin routes require authentication and admin authorization
router.use(authenticate);
router.use(authorizeAdmin());

// User management
router.get('/users', authorizeAdmin(['users.read']), adminController.getAllUsers);
router.get('/users/:id', authorizeAdmin(['users.read']), adminController.getUserDetails);
router.post('/users',
    authorizeAdmin(['users.create']),
    validate([
        body('email').isEmail(),
        body('password').isLength({ min: 6 }),
        body('role').isIn(['employee', 'psychologist', 'business']),
        body('displayName').optional().trim()
    ]),
    adminController.createUser
);
router.patch('/users/:id',
    authorizeAdmin(['users.update']),
    adminController.updateUser
);
router.delete('/users/:id',
    authorizeAdmin(['users.delete']),
    adminController.deleteUser
);

// Pricing management
router.get('/pricing', authorizeAdmin(['pricing.read']), adminController.getPricingConfig);
router.put('/pricing/:role/:plan',
    authorizeAdmin(['pricing.update']),
    validate([
        body('base_price_usd').isFloat({ min: 0 }),
        body('features').isArray(),
        body('limits').isObject()
    ]),
    adminController.updatePricing
);
router.post('/pricing/country',
    authorizeAdmin(['pricing.update']),
    validate([
        body('country_code').isLength({ min: 2, max: 2 }),
        body('country_name').notEmpty(),
        body('multiplier').isFloat({ min: 0.1, max: 2.0 }),
        body('currency').isLength({ min: 3, max: 3 }),
        body('currency_symbol').notEmpty()
    ]),
    adminController.addCountryPricing
);
router.patch('/pricing/country/:countryCode',
    authorizeAdmin(['pricing.update']),
    adminController.updateCountryPricing
);

// Subscription management
router.get('/subscriptions', authorizeAdmin(['subscriptions.read']), adminController.getAllSubscriptions);
router.get('/subscriptions/:id', authorizeAdmin(['subscriptions.read']), adminController.getSubscriptionDetails);
router.patch('/subscriptions/:id/cancel',
    authorizeAdmin(['subscriptions.update']),
    adminController.cancelSubscription
);

// Company management
router.get('/companies', authorizeAdmin(['companies.read']), adminController.getAllCompanies);
router.get('/companies/:id', authorizeAdmin(['companies.read']), adminController.getCompanyDetails);
router.patch('/companies/:id/verify',
    authorizeAdmin(['companies.update']),
    adminController.verifyCompany
);
router.patch('/companies/:id/status',
    authorizeAdmin(['companies.update']),
    adminController.updateCompanyStatus
);

// Review management
router.get('/reviews', authorizeAdmin(['reviews.read']), adminController.getAllReviews);
router.get('/reviews/pending', authorizeAdmin(['reviews.read']), adminController.getPendingReviews);
router.patch('/reviews/:id/moderate',
    authorizeAdmin(['reviews.update']),
    validate([
        body('action').isIn(['approve', 'reject', 'flag']),
        body('reason').optional().trim()
    ]),
    adminController.moderateReview
);
router.delete('/reviews/:id',
    authorizeAdmin(['reviews.delete']),
    adminController.deleteReview
);

// Dashboard and analytics
router.get('/dashboard/stats', authorizeAdmin(), adminController.getDashboardStats);
router.get('/analytics/revenue', authorizeAdmin(), adminController.getRevenueAnalytics);
router.get('/analytics/users', authorizeAdmin(), adminController.getUserAnalytics);
router.get('/analytics/subscriptions', authorizeAdmin(), adminController.getSubscriptionAnalytics);
router.get('/audit-logs', authorizeAdmin(['audit.read']), adminController.getAuditLogs);

// System settings
router.get('/settings', authorizeAdmin(['settings.read']), adminController.getSystemSettings);
router.patch('/settings',
    authorizeAdmin(['settings.update']),
    adminController.updateSystemSettings
);

module.exports = router;