const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const paymentMethodController = require('../controllers/paymentMethodController');

const router = express.Router();

router.get('/methods',
    authenticate,
    paymentMethodController.listMyPaymentMethods
);

router.get('/methods/summary',
    authenticate,
    paymentMethodController.getPaymentMethodSummary
);

router.post('/methods',
    authenticate,
    validate([
        body('last4').trim().isLength({ min: 4, max: 4 }),
        body('provider').optional().trim(),
        body('cardBrand').optional().trim()
    ]),
    paymentMethodController.addPaymentMethod
);

module.exports = router;
