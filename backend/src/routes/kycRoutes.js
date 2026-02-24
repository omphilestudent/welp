// backend/src/routes/kycRoutes.js
const express = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validation');
const kycController = require('../controllers/kycController');

const router = express.Router();

// KYC submission validation
const kycValidation = [
    body('companyId').isUUID().withMessage('Valid company ID is required'),
    body('businessName').notEmpty().withMessage('Business name is required'),
    body('registrationNumber').notEmpty().withMessage('Registration number is required'),
    body('businessType').notEmpty().withMessage('Business type is required'),
    body('legalRepresentative').notEmpty().withMessage('Legal representative name is required'),
    body('representativeId').notEmpty().withMessage('ID type is required'),
    body('representativeIdNumber').notEmpty().withMessage('ID number is required'),
    body('agreeToTerms').isBoolean().custom(value => value === true).withMessage('You must agree to the terms')
];

// User routes
router.post('/submit',
    authenticate,
    authorize('business'),
    apiLimiter,
    validate(kycValidation),
    kycController.submitKYC
);

router.get('/status/:companyId',
    authenticate,
    authorize('business'),
    kycController.getKYCStatus
);

router.get('/my-applications',
    authenticate,
    authorize('business'),
    kycController.getMyKYCs
);

// Admin routes (you may want to add an admin middleware)
router.get('/admin/pending',
    authenticate,
    // authorize('admin'),
    kycController.getPendingKYCs
);

router.patch('/admin/review/:applicationId',
    authenticate,
    // authorize('admin'),
    validate([
        body('status').isIn(['approved', 'rejected']),
        body('adminNotes').optional().trim()
    ]),
    kycController.reviewKYC
);

module.exports = router;