const express = require('express');
const { getMentalHealthResources } = require('../controllers/resourcesController');

const router = express.Router();

router.get('/mental-health', getMentalHealthResources);

module.exports = router;
