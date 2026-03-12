const express = require('express');
const marketingController = require('../controllers/marketingController');

const router = express.Router();

router.get('/unsubscribe', marketingController.unsubscribeMarketing);

module.exports = router;
