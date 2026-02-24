// backend/src/routes/reviewRoutes.js (UPDATED VERSION)
const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { reviewLimiter } = require('../middleware/rateLimiter');
const { validate, reviewValidation, replyValidation } = require('../middleware/validation');
const reviewController = require('../controllers/reviewController');

const router = express.Router();

// Employee routes
router.post('/',
    authenticate,
    authorize('employee'),
    reviewLimiter,
    validate(reviewValidation),
    reviewController.createReview
);

router.get('/my-reviews',
    authenticate,
    authorize('employee'),
    reviewController.getMyReviews
);

// Public routes
router.get('/company/:companyId', reviewController.getCompanyReviews);
router.get('/company/:companyId/stats', reviewController.getCompanyReviewStats);
router.get('/:reviewId', reviewController.getReviewById);

// Protected routes (authenticated users)
router.patch('/:reviewId',
    authenticate,
    validate(reviewValidation),
    reviewController.updateReview
);

router.delete('/:reviewId',
    authenticate,
    reviewController.deleteReview
);

router.post('/:reviewId/replies',
    authenticate,
    validate(replyValidation),
    reviewController.addReply
);

router.post('/:reviewId/report',
    authenticate,
    reviewController.reportReview
);

module.exports = router;