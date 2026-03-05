
const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validation');
const pricingController = require('../controllers/pricingController');

const router = express.Router();


router.get('/plans', apiLimiter, pricingController.getPricing);
router.get('/countries', apiLimiter, pricingController.getCountries);


router.post('/subscribe',
    authenticate,
    apiLimiter,
    validate([
        body('plan').isIn(['free', 'premium']),
        body('role').isIn(['employee', 'psychologist', 'business']),
        body('country').optional().isLength({ min: 2, max: 2 }),
        body('paymentMethod').optional().isObject()
    ]),
    pricingController.createSubscription
);

router.get('/my-subscription',
    authenticate,
    apiLimiter,
    pricingController.getMySubscription
);

router.delete('/cancel/:subscriptionId',
    authenticate,
    apiLimiter,
    pricingController.cancelSubscription
);

module.exports = router;