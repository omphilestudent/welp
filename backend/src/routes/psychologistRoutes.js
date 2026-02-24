// backend/src/routes/psychologistRoutes.js
const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validation');
const psychologistController = require('../controllers/psychologistController');

const router = express.Router();

// Validation rules for psychologist application
const psychologistApplicationValidation = [
    body('fullName').trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('licenseNumber').trim().notEmpty().withMessage('License number is required'),
    body('licenseIssuingBody').trim().notEmpty().withMessage('License issuing body is required'),
    body('yearsOfExperience').isInt({ min: 0, max: 70 }).withMessage('Valid years of experience required'),
    body('specialization').optional().isArray(),
    body('qualifications').optional().isArray(),
    body('biography').optional().trim().isLength({ max: 2000 }),
    body('phoneNumber').optional().trim(),
    body('address').optional().trim(),
    body('website').optional().isURL(),
    body('linkedin').optional().isURL(),
    body('consultationModes').optional().isArray(),
    body('languages').optional().isArray(),
    body('acceptedAgeGroups').optional().isArray(),
    body('emergencyContact').optional().isObject(),
    body('avatarUrl').optional().isURL()
];

// Public routes
router.post('/apply',
    apiLimiter,
    validate(psychologistApplicationValidation),
    psychologistController.applyAsPsychologist
);

router.get('/status/:email',
    apiLimiter,
    psychologistController.getApplicationStatus
);

// Protected routes (authenticated users)
router.post('/upload-license/:applicationId',
    authenticate,
    apiLimiter,
    psychologistController.uploadLicenseDocument
);

module.exports = router;