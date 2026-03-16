const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth');
const pricingController = require('../../controllers/pricingController');

router.use(authenticate, authorize('admin', 'super_admin'));

router.get('/countries', pricingController.getCountryPricing);
router.put('/base', pricingController.updateBasePrices);
router.post('/recalculate', pricingController.recalculateAllPrices);
router.put('/countries/:countryCode', pricingController.updateCountryPricing);
router.post('/countries', pricingController.addCountry);
router.delete('/countries/:countryCode', pricingController.deleteCountry);
router.post('/bulk-update', pricingController.bulkUpdatePricing);

module.exports = router;
