const express = require('express');
const { authenticate } = require('../middleware/auth');
const subscriptionController = require('../controllers/subcriptionController');

const router = express.Router();

router.get('/me',
    authenticate,
    subscriptionController.getMySubscription
);

router.post('/premium',
    authenticate,
    subscriptionController.subscribePremium
);

router.post('/cancel',
    authenticate,
    subscriptionController.cancelSubscription
);

module.exports = router;
