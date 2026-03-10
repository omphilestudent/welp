const express = require('express');
const { authenticate } = require('../middleware/auth');
const { authorizeHR } = require('../middleware/adminAuth');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validate, jobPostingValidation, jobApplicationValidation, interviewValidation, departmentValidation } = require('../middleware/validation');
const hrController = require('../controllers/hrController');
const { body, param } = require('express-validator');

const router = express.Router();

// Public job endpoints (no auth required)
router.get('/public/jobs', hrController.getPublicJobPostings);
router.get('/public/jobs/:id', hrController.getPublicJobDetails);
router.post('/public/jobs/:id/apply',
    validate([
        param('id').isUUID().withMessage('Invalid job ID'),
        body('first_name').notEmpty().trim().isLength({ max: 100 }),
        body('last_name').notEmpty().trim().isLength({ max: 100 }),
        body('email').isEmail().normalizeEmail(),
        body('phone').optional().trim(),
        body('cover_letter').optional().trim().isLength({ max: 5000 }),
        body('skills').optional().isArray(),
        body('skills.*').optional().isString().trim()
    ]),
    hrController.submitPublicJobApplication
);

// All HR routes require authentication and HR authorization
router.use(authenticate);
router.use(authorizeHR());

// HR Profile
router.get('/profile', hrController.getHRProfile);
router.get('/dashboard/stats', hrController.getHRDashboardStats);

// Job Postings - Using the new validation
router.post('/jobs',
    validate(jobPostingValidation),
    hrController.createJobPosting
);

router.get('/jobs', hrController.getJobPostings);
router.get('/jobs/:id', hrController.getJobDetails);
router.patch('/jobs/:id',
    validate(jobPostingValidation.map(validation => validation.optional())),
    hrController.updateJobPosting
);
router.patch('/jobs/:id/publish', hrController.publishJob);
router.patch('/jobs/:id/close', hrController.closeJob);
router.delete('/jobs/:id', hrController.deleteJobPosting);

// Job Applications
router.get('/jobs/:jobId/applications', hrController.getJobApplications);
router.get('/applications', hrController.getAllApplications);
router.get('/applications/:id', hrController.getApplicationDetails);
router.patch('/applications/:id/status',
    validate([
        body('status').isIn(['pending', 'reviewed', 'shortlisted', 'interviewed', 'rejected', 'hired']),
        body('notes').optional().trim()
    ]),
    hrController.updateApplicationStatus
);
router.post('/applications/:id/notes',
    validate([body('notes').notEmpty()]),
    hrController.addApplicationNotes
);

// Interviews
router.post('/applications/:id/interviews',
    validate(interviewValidation),
    hrController.scheduleInterview
);
router.get('/interviews/upcoming', hrController.getUpcomingInterviews);
router.patch('/interviews/:id', hrController.updateInterview);
router.post('/interviews/:id/feedback',
    validate([
        body('feedback').notEmpty(),
        body('rating').optional().isInt({ min: 1, max: 5 }),
        body('recommended_for_next').optional().isBoolean()
    ]),
    hrController.submitInterviewFeedback
);

// Employee Relations
router.post('/employee-relations',
    validate([
        body('employee_id').isUUID(),
        body('issue_type').notEmpty(),
        body('priority').isIn(['low', 'medium', 'high', 'urgent']),
        body('subject').notEmpty(),
        body('description').notEmpty()
    ]),
    hrController.createEmployeeRelation
);
router.get('/employee-relations', hrController.getEmployeeRelations);
router.get('/employee-relations/:id', hrController.getRelationDetails);
router.patch('/employee-relations/:id',
    validate([
        body('status').isIn(['open', 'in-progress', 'resolved', 'closed']),
        body('resolution').optional()
    ]),
    hrController.updateEmployeeRelation
);

// Employee Documents
router.post('/documents',
    validate([
        body('employee_id').isUUID(),
        body('document_type').notEmpty(),
        body('title').notEmpty(),
        body('file_url').isURL(),
        body('is_confidential').optional().isBoolean()
    ]),
    hrController.uploadEmployeeDocument
);
router.get('/documents/:employeeId', hrController.getEmployeeDocuments);
router.delete('/documents/:id', hrController.deleteEmployeeDocument);

// Performance Reviews
router.post('/performance-reviews',
    validate([
        body('employee_id').isUUID(),
        body('review_period').notEmpty(),
        body('review_date').isDate(),
        body('goals').optional().isArray()
    ]),
    hrController.createPerformanceReview
);
router.get('/performance-reviews', hrController.getPerformanceReviews);
router.get('/performance-reviews/:id', hrController.getPerformanceReviewDetails);
router.patch('/performance-reviews/:id',
    validate([
        body('strengths').optional().isArray(),
        body('areas_for_improvement').optional().isArray(),
        body('overall_rating').optional().isInt({ min: 1, max: 5 }),
        body('comments').optional().trim()
    ]),
    hrController.updatePerformanceReview
);
router.post('/performance-reviews/:id/submit', hrController.submitPerformanceReview);
router.post('/performance-reviews/:id/acknowledge', hrController.acknowledgePerformanceReview);

// Departments
router.get('/departments', hrController.getDepartments);
router.post('/departments',
    validate(departmentValidation),
    hrController.createDepartment
);
router.patch('/departments/:id', hrController.updateDepartment);

// Analytics
router.get('/analytics/hiring', hrController.getHiringAnalytics);
router.get('/analytics/employee', hrController.getEmployeeAnalytics);

module.exports = router;