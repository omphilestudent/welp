const { body, validationResult } = require('express-validator');

const passwordValidation = body('password')
    .isLength({ min: 10 }).withMessage('Password must be at least 10 characters long')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must contain at least one special character');

const validate = (validations) => {
    return async (req, res, next) => {
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }

        // Format errors for better readability
        const formattedErrors = errors.array().map(error => ({
            field: error.path,
            message: error.msg,
            value: error.value
        }));

        console.log('❌ Validation errors:', JSON.stringify(formattedErrors, null, 2));

        res.status(400).json({
            success: false,
            error: 'Validation failed',
            errors: formattedErrors
        });
    };
};

const registerValidation = [
    body('email').optional().isEmail().normalizeEmail(),
    body('password').optional()
        .isLength({ min: 10 }).withMessage('Password must be at least 10 characters long')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number')
        .matches(/[^A-Za-z0-9]/).withMessage('Password must contain at least one special character'),
    body('role').isIn(['employee', 'psychologist', 'business']),
    body('isAnonymous').optional().isBoolean(),
    body('displayName').optional().trim().isLength({ min: 2, max: 50 })
];

const loginValidation = [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 })
];

const companyValidation = [
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('industry').optional().trim().isLength({ max: 100 }),
    body('website').optional().isURL({ require_protocol: false }),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('address').optional().trim(),
    body('registrationNumber').optional().trim().isLength({ max: 100 }),
    body('registration_number').optional().trim().isLength({ max: 100 })
];

const companyUpdateValidation = [
    body('name').optional({ checkFalsy: true }).trim().isLength({ min: 2, max: 100 }),
    body('industry').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
    body('description').optional({ checkFalsy: true }).trim().isLength({ max: 1000 }),
    body('website').optional({ checkFalsy: true }).isURL({ require_protocol: false }),
    body('phone').optional({ checkFalsy: true }).trim(),
    body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
    body('location').optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
    body('address').optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
    body('city').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
    body('country').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
    body('registrationNumber').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
    body('registration_number').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
    body('logo_url').optional({ checkFalsy: true }).custom((value) => {
        if (!value) return true;
        return /^https?:\/\//i.test(value) || value.startsWith('/uploads/');
    }).withMessage('logo_url must be a valid URL or upload path'),
    body('logoUrl').optional({ checkFalsy: true }).custom((value) => {
        if (!value) return true;
        return /^https?:\/\//i.test(value) || value.startsWith('/uploads/');
    }).withMessage('logoUrl must be a valid URL or upload path')
];

const reviewValidation = [
    body('rating').isInt({ min: 1, max: 5 }),
    body('content').trim().isLength({ min: 10, max: 2000 }),
    body('isPublic').optional().isBoolean()
];

const replyValidation = [
    body('content').trim().isLength({ min: 1, max: 1000 })
];

const messageValidation = [
    body('content').trim().isLength({ min: 1, max: 2000 })
];

const claimRequestValidation = [
    body('businessEmail').isEmail().normalizeEmail(),
    body('businessPhone').optional().trim(),
    body('position').optional().trim(),
    body('message').optional().trim().isLength({ max: 500 })
];

const verifyEmailValidation = [
    body('email').isEmail().normalizeEmail()
];

const confirmVerificationValidation = [
    body('email').isEmail().normalizeEmail(),
    body('code').isLength({ min: 6, max: 6 }).isNumeric()
];

// ========== HR MODULE VALIDATIONS ==========

// FIXED: More flexible UUID validation
const jobPostingValidation = [
    body('title')
        .notEmpty()
        .withMessage('Job title is required')
        .trim()
        .isLength({ min: 3, max: 255 })
        .withMessage('Job title must be between 3 and 255 characters'),

    body('department_id')
        .notEmpty()
        .withMessage('Department ID is required')
        .custom((value) => {
            // More flexible UUID validation that accepts any valid UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(value)) {
                throw new Error('Invalid department ID format');
            }
            return true;
        }),

    body('employment_type')
        .notEmpty()
        .withMessage('Employment type is required')
        .isIn(['full-time', 'part-time', 'contract', 'internship', 'remote'])
        .withMessage('Invalid employment type'),

    body('description')
        .notEmpty()
        .withMessage('Job description is required')
        .trim()
        .isLength({ min: 10 })
        .withMessage('Description must be at least 10 characters long'),

    body('requirements')
        .optional()
        .isArray()
        .withMessage('Requirements must be an array'),

    body('requirements.*')
        .optional()
        .isString()
        .withMessage('Each requirement must be a string')
        .trim()
        .notEmpty()
        .withMessage('Requirement cannot be empty'),

    body('location')
        .optional()
        .trim()
        .isLength({ max: 255 })
        .withMessage('Location cannot exceed 255 characters'),

    body('is_remote')
        .optional()
        .isBoolean()
        .withMessage('is_remote must be a boolean'),

    body('salary_min')
        .optional()
        .isNumeric()
        .withMessage('Salary minimum must be a number')
        .custom((value, { req }) => {
            if (value && req.body.salary_max && value > req.body.salary_max) {
                throw new Error('Salary minimum cannot be greater than salary maximum');
            }
            return true;
        }),

    body('salary_max')
        .optional()
        .isNumeric()
        .withMessage('Salary maximum must be a number'),

    body('salary_currency')
        .optional()
        .isLength({ min: 3, max: 3 })
        .withMessage('Currency must be a 3-letter code (e.g., USD, ZAR)')
        .isUppercase()
        .withMessage('Currency must be uppercase'),

    body('responsibilities')
        .optional()
        .isArray()
        .withMessage('Responsibilities must be an array'),

    body('responsibilities.*')
        .optional()
        .isString()
        .withMessage('Each responsibility must be a string')
        .trim()
        .notEmpty()
        .withMessage('Responsibility cannot be empty'),

    body('benefits')
        .optional()
        .isArray()
        .withMessage('Benefits must be an array'),

    body('benefits.*')
        .optional()
        .isString()
        .withMessage('Each benefit must be a string')
        .trim()
        .notEmpty()
        .withMessage('Benefit cannot be empty'),

    body('skills_required')
        .optional()
        .isArray()
        .withMessage('Skills required must be an array'),

    body('skills_required.*')
        .optional()
        .isString()
        .withMessage('Each skill must be a string')
        .trim()
        .notEmpty()
        .withMessage('Skill cannot be empty'),

    body('experience_level')
        .optional()
        .isIn(['entry', 'mid', 'senior', 'lead', 'executive'])
        .withMessage('Invalid experience level'),

    body('education_required')
        .optional()
        .trim()
        .isLength({ max: 255 })
        .withMessage('Education required cannot exceed 255 characters'),

    body('application_deadline')
        .optional()
        .isISO8601()
        .withMessage('Invalid date format')
        .custom((value) => {
            if (value && new Date(value) < new Date()) {
                throw new Error('Application deadline cannot be in the past');
            }
            return true;
        }),

    body('status')
        .optional()
        .isIn(['draft', 'open', 'closed'])
        .withMessage('Invalid status')
];

const jobApplicationValidation = [
    body('job_id').custom((value) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(value)) {
            throw new Error('Invalid job ID format');
        }
        return true;
    }),
    body('first_name').notEmpty().trim().isLength({ max: 100 }),
    body('last_name').notEmpty().trim().isLength({ max: 100 }),
    body('email').isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('resume_url').optional().isURL(),
    body('cover_letter').optional().trim().isLength({ max: 5000 })
];

const interviewValidation = [
    body('interviewer_id').custom((value) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(value)) {
            throw new Error('Invalid interviewer ID format');
        }
        return true;
    }),
    body('interview_type').isIn(['phone', 'video', 'in-person', 'technical', 'hr']),
    body('scheduled_at').isISO8601().withMessage('Invalid date format'),
    body('duration_minutes').isInt({ min: 15, max: 240 }),
    body('location').optional().trim(),
    body('meeting_link').optional().isURL()
];

const departmentValidation = [
    body('name')
        .notEmpty()
        .withMessage('Department name is required')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Department name must be between 2 and 100 characters'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description cannot exceed 500 characters'),

    body('manager_id')
        .optional()
        .custom((value) => {
            if (!value) return true;
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(value)) {
                throw new Error('Invalid manager ID format');
            }
            return true;
        }),

    body('parent_department_id')
        .optional()
        .custom((value) => {
            if (!value) return true;
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(value)) {
                throw new Error('Invalid parent department ID format');
            }
            return true;
        })
];

const EMAIL_CAMPAIGN_AUDIENCES = ['user', 'psychologist', 'business'];
const EMAIL_CAMPAIGN_RECURRENCE = ['none', 'daily', 'weekly', 'monthly'];

const emailCampaignValidation = [
    body('name').isString().trim().isLength({ min: 3, max: 150 }),
    body('subject').isString().trim().isLength({ min: 3, max: 255 }),
    body('audience').isIn(EMAIL_CAMPAIGN_AUDIENCES),
    body('scheduleDate').optional({ checkFalsy: true }).isISO8601().withMessage('scheduleDate must be YYYY-MM-DD'),
    body('scheduleTime').optional({ checkFalsy: true }).matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('scheduleTime must be HH:mm'),
    body('recurrence').optional({ checkFalsy: true }).isIn(EMAIL_CAMPAIGN_RECURRENCE),
    body('requireSubscription').optional().isBoolean(),
    body('payload').optional().isObject(),
    body('payload.intro').optional({ checkFalsy: true }).isString().isLength({ max: 800 }),
    body('payload.previewText').optional({ checkFalsy: true }).isString().isLength({ max: 300 }),
    body('payload.ctaLabel').optional({ checkFalsy: true }).isString().isLength({ max: 80 }),
    body('payload.ctaUrl').optional({ checkFalsy: true }).isString().isLength({ max: 400 }),
    body('assetUrls').optional().isArray({ max: 8 }),
    body('assetUrls.*').optional({ checkFalsy: true }).isString().isLength({ max: 500 })
];

const emailCampaignUpdateValidation = [
    body('name').optional({ checkFalsy: true }).isString().trim().isLength({ min: 3, max: 150 }),
    body('subject').optional({ checkFalsy: true }).isString().trim().isLength({ min: 3, max: 255 }),
    body('audience').optional({ checkFalsy: true }).isIn(EMAIL_CAMPAIGN_AUDIENCES),
    body('scheduleDate').optional({ checkFalsy: true }).isISO8601().withMessage('scheduleDate must be YYYY-MM-DD'),
    body('scheduleTime').optional({ checkFalsy: true }).matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('scheduleTime must be HH:mm'),
    body('recurrence').optional({ checkFalsy: true }).isIn(EMAIL_CAMPAIGN_RECURRENCE),
    body('requireSubscription').optional().isBoolean(),
    body('payload').optional().isObject(),
    body('payload.intro').optional({ checkFalsy: true }).isString().isLength({ max: 800 }),
    body('payload.previewText').optional({ checkFalsy: true }).isString().isLength({ max: 300 }),
    body('payload.ctaLabel').optional({ checkFalsy: true }).isString().isLength({ max: 80 }),
    body('payload.ctaUrl').optional({ checkFalsy: true }).isString().isLength({ max: 400 }),
    body('assetUrls').optional().isArray({ max: 8 }),
    body('assetUrls.*').optional({ checkFalsy: true }).isString().isLength({ max: 500 })
];

const emailCampaignPreviewValidation = [
    body('subject').optional({ checkFalsy: true }).isString().trim().isLength({ min: 3, max: 255 }),
    body('audience').optional({ checkFalsy: true }).isIn(EMAIL_CAMPAIGN_AUDIENCES),
    body('scheduleDate').optional({ checkFalsy: true }).isISO8601(),
    body('scheduleTime').optional({ checkFalsy: true }).matches(/^([01]\d|2[0-3]):[0-5]\d$/),
    body('recurrence').optional({ checkFalsy: true }).isIn(EMAIL_CAMPAIGN_RECURRENCE),
    body('payload').optional().isObject(),
    body('assetUrls').optional().isArray({ max: 8 })
];

module.exports = {
    validate,
    registerValidation,
    loginValidation,
    companyValidation,
    companyUpdateValidation,
    reviewValidation,
    replyValidation,
    messageValidation,
    claimRequestValidation,
    verifyEmailValidation,
    confirmVerificationValidation,
    passwordValidation,
    // HR Module Validations
    jobPostingValidation,
    jobApplicationValidation,
    interviewValidation,
    departmentValidation,
    emailCampaignValidation,
    emailCampaignUpdateValidation,
    emailCampaignPreviewValidation
};
