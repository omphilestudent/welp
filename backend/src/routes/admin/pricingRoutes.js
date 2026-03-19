const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { authorizeAdmin } = require('../../middleware/adminAuth');
const pricingController = require('../../controllers/pricingController');

router.use(authenticate, authorizeAdmin());

router.get('/countries', pricingController.getCountryPricing);
router.put('/base', pricingController.updateBasePrices);
router.post('/recalculate', pricingController.recalculateAllPrices);
router.put('/countries/:countryCode', pricingController.updateCountryPricing);
router.post('/countries', pricingController.addCountry);
router.delete('/countries/:countryCode', pricingController.deleteCountry);
router.post('/bulk-update', pricingController.bulkUpdatePricing);

module.exports = router;
