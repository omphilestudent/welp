const express = require('express');
const { authenticate } = require('../middleware/auth');
const subscriptionController = require('../controllers/subscriptionController');

const router = express.Router();

router.get('/me',
    authenticate,
    subscriptionController.getMySubscription
);

router.post('/plan',
    authenticate,
    subscriptionController.subscribePlan
);

router.post('/cancel',
    authenticate,
    subscriptionController.cancelSubscription
);

module.exports = router;
