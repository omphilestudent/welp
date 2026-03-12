const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const {
    validate,
    companyUpdateValidation,
    reviewValidation,
    replyValidation
} = require('../middleware/validation');
const companyController = require('../controllers/companyController');
const reviewController = require('../controllers/reviewController');

const router = express.Router();
const ownerRoles = ['business', 'admin', 'super_admin', 'superadmin', 'system_admin', 'hr_admin'];

router.get('/', apiLimiter, companyController.searchCompanies);
router.get('/:companyId', apiLimiter, companyController.getBusinessProfile);

router.get('/:companyId/analytics',
    authenticate,
    authorize(...ownerRoles),
    companyController.getCompanyAnalytics
);

router.put('/:companyId',
    authenticate,
    authorize(...ownerRoles),
    validate(companyUpdateValidation),
    companyController.updateCompany
);

router.get('/:companyId/reviews',
    authenticate,
    authorize(...ownerRoles),
    companyController.getCompanyReviewsForBusiness
);

router.post('/:companyId/review',
    authenticate,
    authorize('employee'),
    validate(reviewValidation),
    (req, res, next) => {
        req.body.companyId = req.params.companyId;
        return reviewController.createReview(req, res, next);
    }
);

router.post('/:companyId/review/:reviewId/reply',
    authenticate,
    authorize(...ownerRoles),
    validate(replyValidation),
    reviewController.addReply
);

module.exports = router;
