const express = require('express');
const { authenticate } = require('../middleware/auth');
const { authorizeHR } = require('../middleware/adminAuth');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validate, jobPostingValidation, jobApplicationValidation, interviewValidation, departmentValidation } = require('../middleware/validation');
const hrController = require('../controllers/hrController');
const hrMvpController = require('../controllers/hrMvpController');
const { body, param } = require('express-validator');
const { query: dbQuery } = require('../utils/database');

const router = express.Router();

// ── Public job endpoints (no auth required) ───────────────────────────────────
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

// ── All routes below require authentication + HR role ─────────────────────────
router.use(authenticate);

// â”€â”€ HR MVP endpoints (employee + HR access) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/employees', hrMvpController.getEmployees);
router.get('/employees/:id', hrMvpController.getEmployeeById);
router.post('/employees', hrMvpController.createEmployee);
router.put('/employees/:id', hrMvpController.updateEmployee);

router.get('/leaves', hrMvpController.getLeaves);
router.post('/leaves', hrMvpController.createLeave);
router.put('/leaves/:id/approve', hrMvpController.approveLeave);
router.put('/leaves/:id/reject', hrMvpController.rejectLeave);

router.get('/documents/:employeeId', hrMvpController.getDocuments);
router.post('/documents/upload', hrMvpController.uploadDocument);
router.delete('/documents/:id', hrMvpController.deleteDocument);

router.get('/onboarding/:employeeId', hrMvpController.getOnboardingTasks);
router.post('/onboarding/tasks', hrMvpController.createOnboardingTask);
router.put('/onboarding/tasks/:id', hrMvpController.updateOnboardingTask);

router.get('/settings', hrMvpController.getSettings);
router.put('/settings', hrMvpController.updateSettings);

router.use(authorizeHR());

// ── HR Profile & Dashboard ────────────────────────────────────────────────────
router.get('/profile', hrController.getHRProfile);
router.get('/dashboard/stats', hrController.getHRDashboardStats);

// ── Users / Managers list ─────────────────────────────────────────────────────
// Used by the Departments page to populate the manager dropdown.
// Returns all users with HR-eligible roles.
router.get('/users/managers', async (req, res) => {
        try {
                const result = await dbQuery(
                    `SELECT u.id, u.email, u.display_name, u.role, ws.staff_role_key
             FROM users u
             LEFT JOIN welp_staff ws ON ws.user_id = u.id AND ws.is_active = true
             WHERE (ws.user_id IS NOT NULL OR u.role IN ('hr_admin', 'admin', 'super_admin', 'system_admin', 'welp_employee'))
               AND (u.is_active = true OR u.is_active IS NULL)
             ORDER BY u.display_name ASC
             LIMIT 200`
                );
                res.json(result.rows);
        } catch (err) {
                console.error('❌ Get managers error:', err);
                res.json([]); // graceful — never break the page
        }
});

// ── Job Postings ──────────────────────────────────────────────────────────────
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

// ── Job Applications ──────────────────────────────────────────────────────────
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

// ── Interviews ────────────────────────────────────────────────────────────────
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

// ── Employee Relations ────────────────────────────────────────────────────────
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

// ── Employee Documents ────────────────────────────────────────────────────────
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

// ── Performance Reviews ───────────────────────────────────────────────────────
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

// ── Departments ───────────────────────────────────────────────────────────────
router.get('/departments', hrController.getDepartments);

router.post('/departments',
    validate(departmentValidation),
    hrController.createDepartment
);

router.patch('/departments/:id', hrController.updateDepartment);

// DELETE /departments/:id
// Checks for child departments and active job postings before deleting.
router.delete('/departments/:id', async (req, res) => {
        try {
                const { id } = req.params;

                // Block if sub-departments exist
                const childCheck = await dbQuery(
                    `SELECT COUNT(*) as cnt FROM departments WHERE parent_department_id = $1`,
                    [id]
                );
                if (parseInt(childCheck.rows[0].cnt) > 0) {
                        return res.status(400).json({
                                error: 'Cannot delete department',
                                message: 'This department has sub-departments. Reassign or delete them first.'
                        });
                }

                // Block if active job postings exist
                const jobCheck = await dbQuery(
                    `SELECT COUNT(*) as cnt FROM job_postings
             WHERE department_id = $1 AND status NOT IN ('closed', 'draft')`,
                    [id]
                ).catch(() => ({ rows: [{ cnt: 0 }] }));

                if (parseInt(jobCheck.rows[0].cnt) > 0) {
                        return res.status(400).json({
                                error: 'Cannot delete department',
                                message: 'This department has active job postings. Close them first.'
                        });
                }

                const result = await dbQuery(
                    `DELETE FROM departments WHERE id = $1 RETURNING id, name`,
                    [id]
                );

                if (result.rows.length === 0) {
                        return res.status(404).json({ error: 'Department not found' });
                }

                console.log(`✅ Department deleted: ${result.rows[0].name} (${id})`);
                res.json({
                        success: true,
                        message: `Department "${result.rows[0].name}" deleted successfully`
                });

        } catch (err) {
                console.error('❌ Delete department error:', err);
                res.status(500).json({ error: 'Failed to delete department' });
        }
});

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get('/analytics/hiring', hrController.getHiringAnalytics);
router.get('/analytics/employee', hrController.getEmployeeAnalytics);

module.exports = router;
