
const express = require('express');
const { apiLimiter } = require('../middleware/rateLimiter');
const pricingController = require('../controllers/pricingController');

const router = express.Router();


router.get('/plans', apiLimiter, pricingController.getPricing);
router.get('/countries', apiLimiter, pricingController.getCountries);
router.get('/:audience', apiLimiter, pricingController.getPricingForAudience);

module.exports = router;
