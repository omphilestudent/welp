
const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { authorizeAdmin } = require('../middleware/adminAuth');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validation');
const adminController = require('../controllers/adminController');

const router = express.Router();


router.use(authenticate);
router.use(authorizeAdmin());


router.get('/profile', adminController.getAdminProfile);


router.get('/dashboard/stats', adminController.getDashboardStats);


router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserDetails);
router.post('/users',
    validate([
        body('email').isEmail(),
        body('password').isLength({ min: 6 }),
        body('role').isIn(['employee', 'psychologist', 'business'])
    ]),
    adminController.createUser
);
router.patch('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);


router.get('/companies', adminController.getCompanies);
router.get('/companies/:id', adminController.getCompanyDetails);
router.patch('/companies/:id/verify', adminController.verifyCompany);
router.patch('/companies/:id/status', adminController.updateCompanyStatus);
router.delete('/companies/:id', adminController.deleteCompany);


router.get('/reviews', adminController.getReviews);
router.get('/reviews/pending', adminController.getPendingReviews);
router.patch('/reviews/:id/moderate',
    validate([
        body('action').isIn(['approve', 'reject', 'flag']),
        body('reason').optional().trim()
    ]),
    adminController.moderateReview
);
router.delete('/reviews/:id', adminController.deleteReview);


router.get('/subscriptions', adminController.getSubscriptions);
router.get('/subscriptions/:id', adminController.getSubscriptionDetails);
router.patch('/subscriptions/:id/cancel', adminController.cancelSubscription);


router.get('/pricing', adminController.getPricingConfig);
router.put('/pricing/:role/:plan',
    validate([
        body('base_price_usd').isFloat({ min: 0 }),
        body('features').isArray(),
        body('limits').isObject()
    ]),
    adminController.updatePricing
);
router.get('/pricing/countries', adminController.getCountryPricing);
router.post('/pricing/country',
    validate([
        body('country_code').isLength({ min: 2, max: 2 }),
        body('country_name').notEmpty(),
        body('multiplier').isFloat({ min: 0.1, max: 2.0 }),
        body('currency').isLength({ min: 3, max: 3 })
    ]),
    adminController.addCountryPricing
);
router.patch('/pricing/country/:countryCode', adminController.updateCountryPricing);


// Backward-compatible subscription pricing aliases used by older admin UIs
router.put('/subscriptions/pricing/:countryCode',
    validate([
        body('multiplier').optional().isFloat({ min: 0.1, max: 2.0 }),
        body('currency').optional().isLength({ min: 3, max: 3 }),
        body('currency_symbol').optional().isString().trim()
    ]),
    adminController.updateCountryPricing
);
router.patch('/subscriptions/pricing/:countryCode', adminController.updateCountryPricing);



router.get('/settings', adminController.getSystemSettings);


router.get('/ml-interactions', adminController.getMlInteractions);
router.patch('/ml-interactions/:id',
    validate([
        body('status').optional().isIn(['pending', 'edited', 'approved', 'rejected']),
        body('notes').optional().isString().trim()
    ]),
    adminController.updateMlInteraction
);

// ML admin endpoints (matches frontend /admin/ml/* calls)
router.get('/ml/interactions', adminController.getMlInteractions);
router.patch('/ml/interactions/:id',
    validate([
        body('status').optional().isIn(['pending', 'edited', 'approved', 'rejected']),
        body('notes').optional().isString().trim()
    ]),
    adminController.updateMlInteraction
);
router.get('/ml/models', adminController.getMlModels);
router.patch('/ml/models/:id/toggle', adminController.toggleMlModel);
router.get('/ml/metrics', adminController.getMlMetrics);
router.get('/ml/predictions', adminController.getMlPredictions);
router.get('/ml/performance', adminController.getMlPerformance);
router.get('/ml/export', adminController.exportMlInteractions);
router.post('/ml/train', adminController.trainMlModel);
router.post('/ml/predict', adminController.predictMl);

router.patch('/settings', adminController.updateSystemSettings);


router.get('/audit-logs', adminController.getAuditLogs);


router.get('/analytics/revenue', adminController.getRevenueAnalytics);
router.get('/analytics/users', adminController.getUserAnalytics);
router.get('/analytics/subscriptions', adminController.getSubscriptionAnalytics);

module.exports = router;
