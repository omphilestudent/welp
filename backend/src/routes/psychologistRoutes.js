
const express = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { checkRoleFlag } = require('../middleware/roleFlags');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validation');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const psychologistController = require('../controllers/psychologistController');
const psychologistDashboardController = require('../controllers/psychologistDashboardController');
const sessionRatingController = require('../controllers/sessionRatingController');
const psychologistBillingController = require('../controllers/psychologistBillingController');
const psychologistEventController = require('../controllers/psychologistEventController');
const { requirePsychologistLeadAccess } = require('../middleware/psychologistEntitlements');
const { restrictUnverifiedPsychologist } = require('../middleware/restrictUnverifiedPsychologist');

const router = express.Router();

const payoutProofDir = path.join(__dirname, '../../uploads/payout-proofs');
if (!fs.existsSync(payoutProofDir)) {
    fs.mkdirSync(payoutProofDir, { recursive: true });
}
const payoutProofStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, payoutProofDir),
    filename: (_req, file, cb) => {
        const safe = file.originalname.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-_]/g, '');
        cb(null, `${Date.now()}-${safe}`);
    }
});
const payoutProofUpload = multer({
    storage: payoutProofStorage,
    limits: { fileSize: 5 * 1024 * 1024 }
});


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

router.get('/dashboard/ratings/summary',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('dashboard'),
    psychologistDashboardController.getRatingsSummary
);

router.get('/:psychologistId/ratings/summary',
    authenticate,
    apiLimiter,
    sessionRatingController.getPsychologistSummary
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
    requirePsychologistLeadAccess,
    psychologistDashboardController.getLeads
);

router.post('/dashboard/leads/:leadId/message',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('leads'),
    requirePsychologistLeadAccess,
    restrictUnverifiedPsychologist,
    psychologistDashboardController.sendLeadMessage
);

router.patch('/dashboard/leads/:leadId/archive',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('leads'),
    requirePsychologistLeadAccess,
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

// Public psychologist events + booking scheduling
router.get('/:psychologistId/events',
    apiLimiter,
    psychologistEventController.listPsychologistEvents
);

router.post('/:psychologistId/events',
    authenticate,
    apiLimiter,
    psychologistEventController.createPsychologistEvent
);

// Psychologist rates + payouts
router.get('/dashboard/rates',
    authenticate,
    authorize('psychologist'),
    psychologistBillingController.getMyRates
);

router.post('/dashboard/rates',
    authenticate,
    authorize('psychologist'),
    psychologistBillingController.createRate
);

router.post('/dashboard/rates/:rateId/activate',
    authenticate,
    authorize('psychologist'),
    psychologistBillingController.setActiveRate
);

router.get('/dashboard/payout-account',
    authenticate,
    authorize('psychologist'),
    psychologistBillingController.getPayoutDetails
);

router.post('/dashboard/payout-account',
    authenticate,
    authorize('psychologist'),
    psychologistBillingController.updatePayoutDetails
);

router.post('/dashboard/payout-account/proof',
    authenticate,
    authorize('psychologist'),
    payoutProofUpload.single('proof'),
    psychologistBillingController.uploadPayoutProof
);

router.get('/dashboard/plan',
    authenticate,
    authorize('psychologist'),
    psychologistBillingController.getDashboardPlan
);

router.get('/dashboard/availability',
    authenticate,
    authorize('psychologist'),
    psychologistBillingController.getWeeklyAvailabilityForDashboard
);

router.post('/dashboard/availability',
    authenticate,
    authorize('psychologist'),
    psychologistBillingController.updateWeeklyAvailabilityForDashboard
);

router.get('/dashboard/ledger',
    authenticate,
    authorize('psychologist'),
    psychologistBillingController.getPsychologistLedger
);

router.get('/dashboard/earnings',
    authenticate,
    authorize('psychologist'),
    psychologistBillingController.getEarningsSummary
);

router.get('/dashboard/statements',
    authenticate,
    authorize('psychologist'),
    psychologistBillingController.listMonthlyStatements
);

router.post('/dashboard/statements',
    authenticate,
    authorize('psychologist'),
    psychologistBillingController.generateStatement
);

router.get('/dashboard/statements/:statementId/download',
    authenticate,
    authorize('psychologist'),
    psychologistBillingController.downloadStatement
);

// Public psych rates + availability for booking
router.get('/:psychologistId/rates',
    authenticate,
    apiLimiter,
    psychologistBillingController.getRatesForPsychologist
);

router.get('/:psychologistId/availability',
    authenticate,
    apiLimiter,
    psychologistBillingController.getAvailabilityForPsychologist
);

router.get('/:psychologistId/booking-preview',
    authenticate,
    apiLimiter,
    psychologistBillingController.getBookingPreview
);

router.post('/:psychologistId/bookings',
    authenticate,
    authorize('employee'),
    psychologistBillingController.createBookingForPsychologist
);

router.post('/bookings/:bookingId/checkout',
    authenticate,
    authorize('employee'),
    psychologistBillingController.checkoutBookingPayment
);

module.exports = router;
