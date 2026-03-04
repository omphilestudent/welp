// backend/src/controllers/hrController.js
const { query } = require('../utils/database');

// Get HR profile
const getHRProfile = async (req, res) => {
    try {
        const result = await query(
            `SELECT 
                au.*,
                u.email,
                u.display_name,
                ar.name as role_name
            FROM admin_users au
            JOIN users u ON au.user_id = u.id
            JOIN admin_roles ar ON au.role_id = ar.id
            WHERE au.user_id = $1 AND au.is_active = true 
            AND (ar.name = 'hr_admin' OR ar.name = 'super_admin')`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'Not an HR user' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get HR profile error:', error);
        res.status(500).json({ error: 'Failed to fetch HR profile' });
    }
};

// Get HR dashboard stats
const getHRDashboardStats = async (req, res) => {
    try {
        const jobStats = await query(
            `SELECT 
                COUNT(*) as total_jobs,
                COUNT(CASE WHEN status = 'open' THEN 1 END) as open_jobs,
                COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_jobs,
                COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_jobs
            FROM job_postings`
        );

        const applicationStats = await query(
            `SELECT 
                COUNT(*) as total_applications,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_applications,
                COUNT(CASE WHEN status = 'reviewed' THEN 1 END) as reviewed_applications,
                COUNT(CASE WHEN status = 'shortlisted' THEN 1 END) as shortlisted_applications,
                COUNT(CASE WHEN status = 'interviewed' THEN 1 END) as interviewed_applications,
                COUNT(CASE WHEN status = 'hired' THEN 1 END) as hired_applications,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_applications
            FROM job_applications`
        );

        const interviewStats = await query(
            `SELECT 
                COUNT(*) as total_interviews,
                COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_interviews,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_interviews,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_interviews
            FROM interviews`
        );

        const departmentStats = await query(
            `SELECT 
                COUNT(*) as total_departments,
                COUNT(DISTINCT manager_id) as departments_with_manager
            FROM departments`
        );

        const employeeStats = await query(
            `SELECT 
                COUNT(*) as total_employees,
                COUNT(CASE WHEN is_active = true THEN 1 END) as active_employees
            FROM users WHERE role = 'employee'`
        );

        res.json({
            jobs: jobStats.rows[0],
            applications: applicationStats.rows[0],
            interviews: interviewStats.rows[0],
            departments: departmentStats.rows[0],
            employees: employeeStats.rows[0]
        });
    } catch (error) {
        console.error('Get HR dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to fetch HR dashboard stats' });
    }
};

// Create job posting
const createJobPosting = async (req, res) => {
    try {
        const {
            title, department_id, employment_type, location,
            salary_min, salary_max, salary_currency, description,
            requirements, responsibilities, benefits, skills_required,
            experience_level, education_required, application_deadline
        } = req.body;

        const result = await query(
            `INSERT INTO job_postings (
                title, department_id, employment_type, location,
                salary_min, salary_max, salary_currency, description,
                requirements, responsibilities, benefits, skills_required,
                experience_level, education_required, application_deadline,
                posted_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *`,
            [
                title, department_id, employment_type, location,
                salary_min, salary_max, salary_currency, description,
                JSON.stringify(requirements), JSON.stringify(responsibilities),
                JSON.stringify(benefits), JSON.stringify(skills_required),
                experience_level, education_required, application_deadline,
                req.user.id
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create job posting error:', error);
        res.status(500).json({ error: 'Failed to create job posting' });
    }
};

// Get all job postings
const getJobPostings = async (req, res) => {
    try {
        const { status, department } = req.query;

        let queryText = `
            SELECT 
                j.*,
                d.name as department_name,
                u.display_name as posted_by_name,
                COUNT(a.id) as applications_count
            FROM job_postings j
            LEFT JOIN departments d ON j.department_id = d.id
            LEFT JOIN users u ON j.posted_by = u.id
            LEFT JOIN job_applications a ON j.id = a.job_id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (status) {
            queryText += ` AND j.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (department) {
            queryText += ` AND j.department_id = $${paramIndex}`;
            params.push(department);
            paramIndex++;
        }

        queryText += ` GROUP BY j.id, d.name, u.display_name ORDER BY j.created_at DESC`;

        const result = await query(queryText, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Get job postings error:', error);
        res.status(500).json({ error: 'Failed to fetch job postings' });
    }
};

// Get job details
const getJobDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `SELECT 
                j.*,
                d.name as department_name,
                u.display_name as posted_by_name,
                json_agg(
                    json_build_object(
                        'id', a.id,
                        'first_name', a.first_name,
                        'last_name', a.last_name,
                        'email', a.email,
                        'status', a.status,
                        'created_at', a.created_at
                    ) ORDER BY a.created_at DESC
                ) as applications
            FROM job_postings j
            LEFT JOIN departments d ON j.department_id = d.id
            LEFT JOIN users u ON j.posted_by = u.id
            LEFT JOIN job_applications a ON j.id = a.job_id
            WHERE j.id = $1
            GROUP BY j.id, d.name, u.display_name`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job posting not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get job details error:', error);
        res.status(500).json({ error: 'Failed to fetch job details' });
    }
};

// Update job posting
const updateJobPosting = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const setClause = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) {
                setClause.push(`${key} = $${paramIndex}`);
                values.push(Array.isArray(value) ? JSON.stringify(value) : value);
                paramIndex++;
            }
        }

        setClause.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);

        const query_text = `
            UPDATE job_postings 
            SET ${setClause.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await query(query_text, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job posting not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update job posting error:', error);
        res.status(500).json({ error: 'Failed to update job posting' });
    }
};

// Publish job
const publishJob = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `UPDATE job_postings 
             SET status = 'published', 
                 published_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job posting not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Publish job error:', error);
        res.status(500).json({ error: 'Failed to publish job' });
    }
};

// Close job
const closeJob = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `UPDATE job_postings 
             SET status = 'closed', 
                 closed_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job posting not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Close job error:', error);
        res.status(500).json({ error: 'Failed to close job' });
    }
};

// Delete job posting
const deleteJobPosting = async (req, res) => {
    try {
        const { id } = req.params;

        await query('DELETE FROM job_postings WHERE id = $1', [id]);

        res.json({ message: 'Job posting deleted successfully' });
    } catch (error) {
        console.error('Delete job posting error:', error);
        res.status(500).json({ error: 'Failed to delete job posting' });
    }
};

// Get job applications
const getJobApplications = async (req, res) => {
    try {
        const { jobId } = req.params;
        const { status } = req.query;

        let queryText = `
            SELECT 
                a.*,
                j.title as job_title,
                d.name as department_name
            FROM job_applications a
            JOIN job_postings j ON a.job_id = j.id
            JOIN departments d ON j.department_id = d.id
            WHERE a.job_id = $1
        `;
        const params = [jobId];
        let paramIndex = 2;

        if (status) {
            queryText += ` AND a.status = $${paramIndex}`;
            params.push(status);
        }

        queryText += ` ORDER BY a.created_at DESC`;

        const result = await query(queryText, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Get job applications error:', error);
        res.status(500).json({ error: 'Failed to fetch job applications' });
    }
};

// Get application details
const getApplicationDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `SELECT 
                a.*,
                j.title as job_title,
                j.description as job_description,
                d.name as department_name,
                u.display_name as reviewer_name
            FROM job_applications a
            JOIN job_postings j ON a.job_id = j.id
            JOIN departments d ON j.department_id = d.id
            LEFT JOIN users u ON a.reviewed_by = u.id
            WHERE a.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Application not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get application details error:', error);
        res.status(500).json({ error: 'Failed to fetch application details' });
    }
};

// Update application status
const updateApplicationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        const result = await query(
            `UPDATE job_applications 
             SET status = $1, 
                 notes = $2,
                 reviewed_by = $3,
                 reviewed_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [status, notes, req.user.id, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Application not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update application status error:', error);
        res.status(500).json({ error: 'Failed to update application status' });
    }
};

// Add application notes
const addApplicationNotes = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const result = await query(
            `UPDATE job_applications 
             SET notes = CONCAT(notes, '\n', $1),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [notes, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Application not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Add application notes error:', error);
        res.status(500).json({ error: 'Failed to add notes' });
    }
};

// Schedule interview
const scheduleInterview = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            interviewer_id, interview_type, scheduled_at,
            duration_minutes, location, meeting_link
        } = req.body;

        const result = await query(
            `INSERT INTO interviews (
                application_id, interviewer_id, interview_type,
                scheduled_at, duration_minutes, location, meeting_link
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [id, interviewer_id, interview_type, scheduled_at, duration_minutes, location, meeting_link]
        );

        // Update application status
        await query(
            `UPDATE job_applications 
             SET status = 'interviewed', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Schedule interview error:', error);
        res.status(500).json({ error: 'Failed to schedule interview' });
    }
};

// Get upcoming interviews
const getUpcomingInterviews = async (req, res) => {
    try {
        const result = await query(
            `SELECT 
                i.*,
                a.first_name, a.last_name, a.email,
                j.title as job_title,
                u.display_name as interviewer_name
            FROM interviews i
            JOIN job_applications a ON i.application_id = a.id
            JOIN job_postings j ON a.job_id = j.id
            JOIN users u ON i.interviewer_id = u.id
            WHERE i.scheduled_at >= CURRENT_TIMESTAMP
            ORDER BY i.scheduled_at ASC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get upcoming interviews error:', error);
        res.status(500).json({ error: 'Failed to fetch upcoming interviews' });
    }
};

// Update interview
const updateInterview = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const setClause = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) {
                setClause.push(`${key} = $${paramIndex}`);
                values.push(value);
                paramIndex++;
            }
        }

        setClause.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);

        const query_text = `
            UPDATE interviews 
            SET ${setClause.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await query(query_text, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Interview not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update interview error:', error);
        res.status(500).json({ error: 'Failed to update interview' });
    }
};

// Submit interview feedback
const submitInterviewFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const { feedback, rating, recommended_for_next } = req.body;

        const result = await query(
            `UPDATE interviews 
             SET feedback = $1, 
                 rating = $2, 
                 recommended_for_next = $3,
                 status = 'completed',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [feedback, rating, recommended_for_next, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Interview not found' });
        }

        // If recommended, update application status
        if (recommended_for_next) {
            await query(
                `UPDATE job_applications 
                 SET status = 'shortlisted', updated_at = CURRENT_TIMESTAMP
                 WHERE id = (SELECT application_id FROM interviews WHERE id = $1)`,
                [id]
            );
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Submit interview feedback error:', error);
        res.status(500).json({ error: 'Failed to submit interview feedback' });
    }
};

// Create employee relation
const createEmployeeRelation = async (req, res) => {
    try {
        const {
            employee_id, issue_type, priority, subject, description
        } = req.body;

        const result = await query(
            `INSERT INTO employee_relations (
                employee_id, hr_representative_id, issue_type,
                priority, subject, description
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [employee_id, req.user.id, issue_type, priority, subject, description]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create employee relation error:', error);
        res.status(500).json({ error: 'Failed to create employee relation' });
    }
};

// Get employee relations
const getEmployeeRelations = async (req, res) => {
    try {
        const { status, priority } = req.query;

        let queryText = `
            SELECT 
                er.*,
                u.display_name as employee_name,
                u.email as employee_email,
                hr.display_name as hr_name
            FROM employee_relations er
            JOIN users u ON er.employee_id = u.id
            LEFT JOIN users hr ON er.hr_representative_id = hr.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (status) {
            queryText += ` AND er.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (priority) {
            queryText += ` AND er.priority = $${paramIndex}`;
            params.push(priority);
            paramIndex++;
        }

        queryText += ` ORDER BY er.created_at DESC`;

        const result = await query(queryText, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Get employee relations error:', error);
        res.status(500).json({ error: 'Failed to fetch employee relations' });
    }
};

// Get relation details
const getRelationDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `SELECT 
                er.*,
                u.display_name as employee_name,
                u.email as employee_email,
                u.phone_number as employee_phone,
                hr.display_name as hr_name
            FROM employee_relations er
            JOIN users u ON er.employee_id = u.id
            LEFT JOIN users hr ON er.hr_representative_id = hr.id
            WHERE er.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Employee relation not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get relation details error:', error);
        res.status(500).json({ error: 'Failed to fetch relation details' });
    }
};

// Update employee relation
const updateEmployeeRelation = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, resolution } = req.body;

        const result = await query(
            `UPDATE employee_relations 
             SET status = $1, 
                 resolution = $2,
                 resolved_at = CASE WHEN $1 = 'resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [status, resolution, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Employee relation not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update employee relation error:', error);
        res.status(500).json({ error: 'Failed to update employee relation' });
    }
};

// Upload employee document
const uploadEmployeeDocument = async (req, res) => {
    try {
        const {
            employee_id, document_type, title, description,
            file_url, is_confidential
        } = req.body;

        const result = await query(
            `INSERT INTO employee_documents (
                employee_id, document_type, title, description,
                file_url, is_confidential, uploaded_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [employee_id, document_type, title, description, file_url, is_confidential, req.user.id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Upload employee document error:', error);
        res.status(500).json({ error: 'Failed to upload document' });
    }
};

// Get employee documents
const getEmployeeDocuments = async (req, res) => {
    try {
        const { employeeId } = req.params;

        const result = await query(
            `SELECT * FROM employee_documents 
             WHERE employee_id = $1 
             ORDER BY created_at DESC`,
            [employeeId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get employee documents error:', error);
        res.status(500).json({ error: 'Failed to fetch employee documents' });
    }
};

// Delete employee document
const deleteEmployeeDocument = async (req, res) => {
    try {
        const { id } = req.params;

        await query('DELETE FROM employee_documents WHERE id = $1', [id]);

        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Delete employee document error:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
};

// Create performance review
const createPerformanceReview = async (req, res) => {
    try {
        const {
            employee_id, review_period, review_date, goals
        } = req.body;

        const result = await query(
            `INSERT INTO performance_reviews (
                employee_id, reviewer_id, review_period, review_date, goals
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [employee_id, req.user.id, review_period, review_date, JSON.stringify(goals)]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create performance review error:', error);
        res.status(500).json({ error: 'Failed to create performance review' });
    }
};

// Get performance reviews
const getPerformanceReviews = async (req, res) => {
    try {
        const { employee_id } = req.query;

        let queryText = `
            SELECT 
                pr.*,
                u.display_name as employee_name,
                r.display_name as reviewer_name
            FROM performance_reviews pr
            JOIN users u ON pr.employee_id = u.id
            JOIN users r ON pr.reviewer_id = r.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (employee_id) {
            queryText += ` AND pr.employee_id = $${paramIndex}`;
            params.push(employee_id);
            paramIndex++;
        }

        queryText += ` ORDER BY pr.created_at DESC`;

        const result = await query(queryText, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Get performance reviews error:', error);
        res.status(500).json({ error: 'Failed to fetch performance reviews' });
    }
};

// Get performance review details
const getPerformanceReviewDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `SELECT 
                pr.*,
                u.display_name as employee_name,
                u.email as employee_email,
                r.display_name as reviewer_name
            FROM performance_reviews pr
            JOIN users u ON pr.employee_id = u.id
            JOIN users r ON pr.reviewer_id = r.id
            WHERE pr.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Performance review not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get performance review details error:', error);
        res.status(500).json({ error: 'Failed to fetch performance review details' });
    }
};

// Update performance review
const updatePerformanceReview = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            strengths, areas_for_improvement, overall_rating, comments
        } = req.body;

        const result = await query(
            `UPDATE performance_reviews 
             SET strengths = $1,
                 areas_for_improvement = $2,
                 overall_rating = $3,
                 comments = $4,
                 status = 'submitted',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $5
             RETURNING *`,
            [JSON.stringify(strengths), JSON.stringify(areas_for_improvement), overall_rating, comments, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Performance review not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update performance review error:', error);
        res.status(500).json({ error: 'Failed to update performance review' });
    }
};

// Submit performance review
const submitPerformanceReview = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `UPDATE performance_reviews 
             SET status = 'submitted',
                 review_date = CURRENT_DATE,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Performance review not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Submit performance review error:', error);
        res.status(500).json({ error: 'Failed to submit performance review' });
    }
};

// Acknowledge performance review
const acknowledgePerformanceReview = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `UPDATE performance_reviews 
             SET employee_acknowledged = true,
                 employee_acknowledged_at = CURRENT_TIMESTAMP,
                 status = 'acknowledged',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Performance review not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Acknowledge performance review error:', error);
        res.status(500).json({ error: 'Failed to acknowledge performance review' });
    }
};

// Get departments
const getDepartments = async (req, res) => {
    try {
        const result = await query(
            `SELECT 
                d.*,
                u.display_name as manager_name,
                COUNT(e.id) as employee_count
            FROM departments d
            LEFT JOIN users u ON d.manager_id = u.id
            LEFT JOIN users e ON e.department_id = d.id
            GROUP BY d.id, u.display_name
            ORDER BY d.name`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get departments error:', error);
        res.status(500).json({ error: 'Failed to fetch departments' });
    }
};

// Create department
const createDepartment = async (req, res) => {
    try {
        const { name, description, manager_id, parent_department_id } = req.body;

        const result = await query(
            `INSERT INTO departments (name, description, manager_id, parent_department_id)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [name, description, manager_id, parent_department_id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create department error:', error);
        res.status(500).json({ error: 'Failed to create department' });
    }
};

// Update department
const updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, manager_id } = req.body;

        const result = await query(
            `UPDATE departments 
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 manager_id = COALESCE($3, manager_id),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [name, description, manager_id, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Department not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update department error:', error);
        res.status(500).json({ error: 'Failed to update department' });
    }
};

// Get hiring analytics
const getHiringAnalytics = async (req, res) => {
    try {
        const result = await query(
            `SELECT 
                DATE_TRUNC('month', created_at) as month,
                COUNT(*) as applications,
                COUNT(CASE WHEN status = 'hired' THEN 1 END) as hires,
                COUNT(DISTINCT job_id) as jobs_posted
            FROM job_applications
            WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY month DESC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get hiring analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch hiring analytics' });
    }
};

// Get employee analytics
const getEmployeeAnalytics = async (req, res) => {
    try {
        const result = await query(
            `SELECT 
                d.name as department,
                COUNT(u.id) as total_employees,
                COUNT(CASE WHEN u.is_active = true THEN 1 END) as active_employees,
                AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.created_at))) as avg_tenure_years
            FROM departments d
            LEFT JOIN users u ON u.department_id = d.id AND u.role = 'employee'
            GROUP BY d.name
            ORDER BY d.name`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get employee analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch employee analytics' });
    }
};

module.exports = {
    getHRProfile,
    getHRDashboardStats,
    createJobPosting,
    getJobPostings,
    getJobDetails,
    updateJobPosting,
    publishJob,
    closeJob,
    deleteJobPosting,
    getJobApplications,
    getApplicationDetails,
    updateApplicationStatus,
    addApplicationNotes,
    scheduleInterview,
    getUpcomingInterviews,
    updateInterview,
    submitInterviewFeedback,
    createEmployeeRelation,
    getEmployeeRelations,
    getRelationDetails,
    updateEmployeeRelation,
    uploadEmployeeDocument,
    getEmployeeDocuments,
    deleteEmployeeDocument,
    createPerformanceReview,
    getPerformanceReviews,
    getPerformanceReviewDetails,
    updatePerformanceReview,
    submitPerformanceReview,
    acknowledgePerformanceReview,
    getDepartments,
    createDepartment,
    updateDepartment,
    getHiringAnalytics,
    getEmployeeAnalytics
};