const express = require('express');
const { authenticateBusinessApiKey, enforceBusinessApiLimit } = require('../middleware/businessApiKey');
const { getBusinessApiAnalytics, getBusinessApiReviews } = require('../controllers/businessApiController');

const router = express.Router();

router.use(authenticateBusinessApiKey);
router.use(enforceBusinessApiLimit);

router.get('/analytics', getBusinessApiAnalytics);
router.get('/reviews', getBusinessApiReviews);

module.exports = router;
