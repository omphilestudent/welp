const express = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const sessionRatingController = require('../controllers/sessionRatingController');

const router = express.Router();

router.get('/pending-ratings',
    authenticate,
    authorize('employee'),
    sessionRatingController.getPendingSessionRatings
);

router.post('/:sessionId/rating',
    authenticate,
    authorize('employee'),
    validate([
        body('ratingValue').optional().isInt({ min: 1, max: 5 }),
        body('rating').optional().isInt({ min: 1, max: 5 }),
        body('rating_value').optional().isInt({ min: 1, max: 5 }),
        body('reviewText').optional().trim().isLength({ max: 2000 }),
        body('review_text').optional().trim().isLength({ max: 2000 }),
        body('feedback').optional().trim().isLength({ max: 2000 })
    ]),
    sessionRatingController.submitSessionRating
);

router.post('/:sessionId/rating/skip',
    authenticate,
    authorize('employee'),
    validate([
        body('remindAfterHours').optional().isInt({ min: 1, max: 168 })
    ]),
    sessionRatingController.deferSessionRating
);

module.exports = router;
