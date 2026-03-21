
const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { authorizeAdmin } = require('../middleware/adminAuth');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validation');
const { companyValidation } = require('../middleware/validation');
const adminController = require('../controllers/adminController');
const adminAdsController = require('../controllers/adminAdsController');
const companyController = require('../controllers/companyController');
const marketingRoutes = require('../modules/marketing/marketing.routes');
const marketingController = require('../modules/marketing/marketing.controller');
const psychologistBillingController = require('../controllers/psychologistBillingController');

const router = express.Router();


router.use(authenticate);
router.use(authorizeAdmin());


router.get('/profile', adminController.getAdminProfile);


router.get('/dashboard/stats', adminController.getDashboardStats);


router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserDetails);
router.get('/psychologists/search', adminController.searchPsychologists);
router.get('/psychologists/:id/schedule', adminController.getPsychologistSchedule);
router.get('/psychologists/:id/calendar-integrations', adminController.getPsychologistCalendarIntegrations);
router.get('/psychologists/:id/external-events', adminController.getPsychologistExternalEvents);
router.post('/users',
    validate([
        body('email').isEmail(),
        body('password').isLength({ min: 6 }),
        body('role').isIn(['employee', 'psychologist', 'business', 'admin', 'super_admin', 'hr_admin', 'welp_employee'])
    ]),
    adminController.createUser
);
router.patch('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

router.get('/welp-staff', adminController.listWelpStaff);
router.post('/welp-staff', adminController.upsertWelpStaff);


router.get('/companies', adminController.getCompanies);
router.get('/companies/:id', adminController.getCompanyDetails);
router.patch('/companies/:id/verify', adminController.verifyCompany);
router.patch('/companies/:id/status', adminController.updateCompanyStatus);
router.post('/companies',
    validate(companyValidation),
    companyController.createCompany
);
router.delete('/companies/:id', adminController.deleteCompany);
router.patch('/companies/:id/unclaim', companyController.unclaimCompany);


router.get('/reviews', adminController.getReviews);
router.get('/reviews/pending', adminController.getPendingReviews);
router.patch('/reviews/:id/moderate',
    validate([
        body('action').isIn(['approve', 'reject', 'flag', 'hide', 'show']),
        body('reason').optional().trim()
    ]),
    adminController.moderateReview
);
router.delete('/reviews/:id', adminController.deleteReview);
router.patch('/reviews/:id/visibility', adminController.setReviewVisibility);
router.get('/review-notifications/logs', adminController.getReviewNotificationLogs);
router.post('/review-notifications/logs/:logId/resend',
    validate([
        param('logId').isUUID()
    ]),
    adminController.resendReviewNotification
);


router.get('/subscriptions', adminController.getSubscriptions);
router.get('/subscriptions/:id', adminController.getSubscriptionDetails);
router.post('/subscriptions', adminController.createSubscription);
router.patch('/subscriptions/:id', adminController.updateSubscription);
router.put('/subscriptions/:id', adminController.updateSubscription);
router.patch('/subscriptions/:id/cancel', adminController.cancelSubscription);
router.post('/subscriptions/:id/cancel', adminController.cancelSubscription);
router.get('/subscriptions/revenue', adminController.getRevenueAnalytics);
router.get('/subscriptions/stats', adminController.getSubscriptionAnalytics);
router.get('/subscriptions/pricing', adminController.getCountryPricing);
router.get('/subscriptions/export', adminController.exportSubscriptions);

router.get('/ads', adminAdsController.listAds);
router.post('/ads/approve',
    validate([
        body('adId').isUUID(),
        body('forceStatus').optional().isIn(['active', 'paused', 'completed']),
        body('overrideRestrictions').optional().isBoolean(),
        body('notes').optional().isString()
    ]),
    adminAdsController.approveAd
);
router.post('/ads/reject',
    validate([
        body('adId').isUUID(),
        body('reason').isString().isLength({ min: 3 }),
        body('notes').optional().isString()
    ]),
    adminAdsController.rejectAd
);

// Psychologist ledger access (account number gated)
router.post('/psychologist-ledger/lookup',
    validate([
        body('accountNumber').isString().isLength({ min: 4 })
    ]),
    psychologistBillingController.adminLookupLedgerByAccount
);

router.patch('/psychologist-ledger/payouts/:paymentId',
    validate([
        param('paymentId').isUUID()
    ]),
    psychologistBillingController.adminMarkPayoutPaid
);

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
router.get('/session-settings', adminController.getSessionSettings);

router.use('/marketing', marketingRoutes);
// Explicit admin marketing routes (fallback)
router.get('/marketing/templates', marketingController.listTemplates);
router.get('/marketing/templates/:id',
    validate([param('id').isUUID()]),
    marketingController.getTemplate
);
router.post('/marketing/templates', marketingController.createTemplate);
router.put('/marketing/templates/:id',
    validate([param('id').isUUID()]),
    marketingController.updateTemplate
);
router.post('/marketing/templates/:id/preview',
    validate([param('id').isUUID()]),
    marketingController.previewTemplate
);
router.get('/marketing/campaigns', marketingController.listCampaigns);
router.post('/marketing/campaigns', marketingController.createCampaign);
router.put('/marketing/campaigns/:id',
    validate([param('id').isUUID()]),
    marketingController.updateCampaign
);
router.post('/marketing/campaigns/:id/run',
    validate([param('id').isUUID()]),
    marketingController.runCampaign
);
router.get('/marketing/triggers', marketingController.listTriggers);
router.put('/marketing/triggers/:triggerKey', marketingController.updateTrigger);
router.get('/marketing/logs', marketingController.listLogs);
router.get('/marketing/settings', marketingController.getSettings);
router.put('/marketing/settings', marketingController.updateSettings);

// Claim requests (business profile ownership)
router.get('/claim-requests', companyController.getPendingClaimRequests);
router.patch('/claim-requests/:requestId/approve', companyController.approveClaimRequest);
router.patch('/claim-requests/:requestId/reject',
    validate([
        body('reason').optional().trim().isLength({ max: 500 })
    ]),
    companyController.rejectClaimRequest
);


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
router.post('/session-settings',
    validate([
        body('inactivityTimeoutMinutes').optional().isInt({ min: 1 }),
        body('inactivityTimeout').optional().isInt({ min: 1 }),
        body('autoLogoutEnabled').optional().isBoolean()
    ]),
    adminController.updateSessionSettings
);


router.get('/audit-logs', adminController.getAuditLogs);

// Admin notifications
router.get('/notifications', adminController.listAdminNotifications);
router.patch('/notifications/:id/read', adminController.markNotificationRead);

// Registration applications
router.get('/registration-applications', adminController.getRegistrationApplications);
router.patch('/registration-applications/:id', adminController.reviewRegistrationApplication);


router.get('/analytics/revenue', adminController.getRevenueAnalytics);
router.get('/analytics/users', adminController.getUserAnalytics);
router.get('/analytics/subscriptions', adminController.getSubscriptionAnalytics);

module.exports = router;
