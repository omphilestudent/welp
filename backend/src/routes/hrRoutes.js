
const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { authorizeHR } = require('../middleware/adminAuth');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validation');
const hrController = require('../controllers/hrController');

const router = express.Router();


router.use(authenticate);
router.use(authorizeHR());


router.get('/profile', hrController.getHRProfile);
router.get('/dashboard/stats', hrController.getHRDashboardStats);


router.post('/jobs',
    validate([
        body('title').notEmpty(),
        body('department_id').isUUID(),
        body('employment_type').isIn(['full-time', 'part-time', 'contract', 'internship', 'remote']),
        body('description').notEmpty(),
        body('requirements').isArray(),
        body('application_deadline').optional().isDate()
    ]),
    hrController.createJobPosting
);
router.get('/jobs', hrController.getJobPostings);
router.get('/jobs/:id', hrController.getJobDetails);
router.patch('/jobs/:id', hrController.updateJobPosting);
router.patch('/jobs/:id/publish', hrController.publishJob);
router.patch('/jobs/:id/close', hrController.closeJob);
router.delete('/jobs/:id', hrController.deleteJobPosting);


router.get('/jobs/:jobId/applications', hrController.getJobApplications);
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


router.post('/applications/:id/interviews',
    validate([
        body('interviewer_id').isUUID(),
        body('interview_type').isIn(['phone', 'video', 'in-person', 'technical', 'hr']),
        body('scheduled_at').isISO8601(),
        body('duration_minutes').isInt({ min: 15, max: 240 })
    ]),
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


router.get('/departments', hrController.getDepartments);
router.post('/departments',
    validate([
        body('name').notEmpty(),
        body('description').optional(),
        body('manager_id').optional().isUUID(),
        body('parent_department_id').optional().isUUID()
    ]),
    hrController.createDepartment
);
router.patch('/departments/:id', hrController.updateDepartment);


router.get('/analytics/hiring', hrController.getHiringAnalytics);
router.get('/analytics/employee', hrController.getEmployeeAnalytics);

module.exports = router;