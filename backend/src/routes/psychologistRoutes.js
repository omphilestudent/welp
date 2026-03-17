
const express = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { checkRoleFlag } = require('../middleware/roleFlags');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validation');
const psychologistController = require('../controllers/psychologistController');
const psychologistDashboardController = require('../controllers/psychologistDashboardController');
const { restrictUnverifiedPsychologist } = require('../middleware/restrictUnverifiedPsychologist');

const router = express.Router();


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


router.post('/apply',
    apiLimiter,
    validate(psychologistApplicationValidation),
    psychologistController.applyAsPsychologist
);

router.get('/status/:email',
    apiLimiter,
    psychologistController.getApplicationStatus
);


router.post('/upload-license/:applicationId',
    authenticate,
    apiLimiter,
    psychologistController.uploadLicenseDocument
);

router.post('/documents',
    authenticate,
    authorize('psychologist'),
    apiLimiter,
    psychologistController.uploadPsychologistDocuments
);

// Psychologist dashboard (stub endpoints)
router.get('/dashboard/permissions',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('dashboard'),
    psychologistDashboardController.getDashboardPermissions
);

router.get('/dashboard/schedule',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('schedule'),
    psychologistDashboardController.getSchedule
);

router.get('/dashboard/calls',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('dashboard'),
    psychologistDashboardController.getRecentCalls
);

router.post('/dashboard/schedule',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('schedule'),
    restrictUnverifiedPsychologist,
    psychologistDashboardController.addScheduleItem
);

router.get('/dashboard/schedule.ics',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('schedule'),
    psychologistDashboardController.exportScheduleIcs
);

router.delete('/dashboard/schedule/:itemId',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('schedule'),
    restrictUnverifiedPsychologist,
    psychologistDashboardController.removeScheduleItem
);

router.patch('/dashboard/schedule/:itemId',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('schedule'),
    restrictUnverifiedPsychologist,
    psychologistDashboardController.updateScheduleItem
);

router.get('/dashboard/leads',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('leads'),
    psychologistDashboardController.getLeads
);

router.post('/dashboard/leads/:leadId/message',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('leads'),
    restrictUnverifiedPsychologist,
    psychologistDashboardController.sendLeadMessage
);

router.patch('/dashboard/leads/:leadId/archive',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('leads'),
    restrictUnverifiedPsychologist,
    psychologistDashboardController.archiveLead
);

router.get('/dashboard/favorites',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('favorites'),
    psychologistDashboardController.getFavorites
);

router.post('/dashboard/favorites',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('favorites'),
    restrictUnverifiedPsychologist,
    psychologistDashboardController.addFavorite
);

router.delete('/dashboard/favorites/:favoriteId',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('favorites'),
    restrictUnverifiedPsychologist,
    psychologistDashboardController.removeFavorite
);

router.get('/dashboard/employees/search',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('employee_search'),
    psychologistDashboardController.searchEmployees
);

router.get('/dashboard/calendar-integrations',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('schedule'),
    psychologistDashboardController.getCalendarIntegrations
);

router.post('/dashboard/calendar-integrations',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('schedule'),
    restrictUnverifiedPsychologist,
    psychologistDashboardController.addCalendarIntegration
);

router.delete('/dashboard/calendar-integrations/:integrationId',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('schedule'),
    restrictUnverifiedPsychologist,
    psychologistDashboardController.removeCalendarIntegration
);

router.post('/dashboard/calendar-integrations/:integrationId/sync',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('schedule'),
    restrictUnverifiedPsychologist,
    psychologistDashboardController.syncCalendarIntegration
);

module.exports = router;
