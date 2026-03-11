
const express = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validate, companyValidation } = require('../middleware/validation');
const companyController = require('../controllers/companyController');

const router = express.Router();


router.get('/search', apiLimiter, companyController.searchCompanies);
router.get('/industries', apiLimiter, companyController.getIndustries);
router.get('/unclaimed', apiLimiter, companyController.getUnclaimedCompanies);
router.get('/:id', apiLimiter, companyController.getCompany);



router.post('/scrape',
    authenticate,
    authorize('admin', 'super_admin', 'hr_admin'),
    validate([
        body('website').isString().trim().notEmpty().withMessage('Website URL is required')
    ]),
    companyController.scrapeCompany
);
router.post('/',
    authenticate,
    authorize('employee'),
    validate(companyValidation),
    companyController.createCompany
);


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


router.post('/:id/request-claim',
    authenticate,
    authorize('business'),
    validate([
        body('businessEmail').isEmail().normalizeEmail(),
        body('businessPhone').optional().trim(),
        body('position').optional().trim(),
        body('message').optional().trim().isLength({ max: 500 })
    ]),
    companyController.requestClaimCompany
);

router.get('/my-claim-requests',
    authenticate,
    authorize('business'),
    companyController.getMyClaimRequests
);


router.post('/verify-email',
    authenticate,
    authorize('business'),
    validate([
        body('email').isEmail().normalizeEmail()
    ]),
    companyController.verifyBusinessEmail
);

router.post('/confirm-verification',
    authenticate,
    authorize('business'),
    validate([
        body('email').isEmail().normalizeEmail(),
        body('code').isLength({ min: 6, max: 6 }).isNumeric()
    ]),
    companyController.confirmEmailVerification
);

module.exports = router;