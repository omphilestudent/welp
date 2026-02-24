// backend/src/routes/companyRoutes.js (UPDATED VERSION)
const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validate, companyValidation } = require('../middleware/validation');
const companyController = require('../controllers/companyController');

const router = express.Router();

// Public routes
router.get('/search', apiLimiter, companyController.searchCompanies);
router.get('/industries', apiLimiter, companyController.getIndustries);
router.get('/unclaimed', apiLimiter, companyController.getUnclaimedCompanies);
router.get('/:id', apiLimiter, companyController.getCompany);

// Employee routes
router.post('/',
    authenticate,
    authorize('employee'),
    validate(companyValidation),
    companyController.createCompany
);

// Business routes
router.get('/my-companies',
    authenticate,
    authorize('business'),
    companyController.getMyCompanies
);

router.post('/:id/claim',
    authenticate,
    authorize('business'),
    companyController.claimCompany
);

router.patch('/:id',
    authenticate,
    authorize('business'),
    validate(companyValidation),
    companyController.updateCompany
);

router.get('/:id/business-reviews',
    authenticate,
    authorize('business'),
    companyController.getCompanyReviewsForBusiness
);

module.exports = router;