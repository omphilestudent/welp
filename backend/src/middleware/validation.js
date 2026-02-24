// backend/src/middleware/validation.js
const { body, validationResult } = require('express-validator');

const validate = (validations) => {
    return async (req, res, next) => {
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }

        res.status(400).json({ errors: errors.array() });
    };
};

// Auth validations
const registerValidation = [
    body('email').optional().isEmail().normalizeEmail(),
    body('password').optional().isLength({ min: 6 }),
    body('role').isIn(['employee', 'psychologist', 'business']),
    body('isAnonymous').optional().isBoolean(),
    body('displayName').optional().trim().isLength({ min: 2, max: 50 })
];

const loginValidation = [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 })
];

// Company validations
const companyValidation = [
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('industry').optional().trim().isLength({ max: 100 }),
    body('website').optional().isURL(),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('address').optional().trim()
];

// Review validations
const reviewValidation = [
    body('rating').isInt({ min: 1, max: 5 }),
    body('content').trim().isLength({ min: 10, max: 2000 }),
    body('isPublic').optional().isBoolean()
];

// Reply validation
const replyValidation = [
    body('content').trim().isLength({ min: 1, max: 1000 })
];

// Message validation
const messageValidation = [
    body('content').trim().isLength({ min: 1, max: 2000 })
];

module.exports = {
    validate,
    registerValidation,
    loginValidation,
    companyValidation,
    reviewValidation,
    replyValidation,
    messageValidation
};