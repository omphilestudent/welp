// backend/src/controllers/hrController.js
const { query } = require('../utils/database');

// Helper function to check if a table exists
const tableExists = async (tableName) => {
    try {
        const result = await query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = $1
            )`,
            [tableName]
        );
        return result.rows[0].exists;
    } catch (error) {
        return false;
    }
};

// Helper function to check if a column exists
const columnExists = async (tableName, columnName) => {
    try {
        const result = await query(
            `SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = $1 AND column_name = $2
            )`,
            [tableName, columnName]
        );
        return result.rows[0].exists;
    } catch (error) {
        return false;
    }
};

// Helper to ensure we only send native JS arrays to Postgres array columns
const validateArrayField = (value, fieldName) => {
    if (value === undefined || value === null) return null;
    if (!Array.isArray(value)) {
        return `${fieldName} must be an array`;
    }
    return null;
};

const getHRProfile = async (req, res) => {
    try {
        console.log('🔍 Getting HR profile for user:', req.user.id);

        // Check if admin tables exist
        const adminUsersExist = await tableExists('admin_users');
        const adminRolesExist = await tableExists('admin_roles');

        if (!adminUsersExist || !adminRolesExist) {
            console.log('Admin tables not found, checking user role directly');

            // Fallback: Check if user has HR role in users table
            const userResult = await query(
                `SELECT id, email, role, display_name
                 FROM users
                 WHERE id = $1`,
                [req.user.id]
            );

            if (userResult.rows.length === 0) {
                return res.status(403).json({ error: 'User not found' });
            }

            const user = userResult.rows[0];
            const hrRoles = ['hr_admin', 'super_admin', 'admin'];

            if (!hrRoles.includes(user.role)) {
                console.log('User does not have HR role:', user.role);
                return res.status(403).json({ error: 'Not an HR user' });
            }

            console.log('HR access granted via user role');
            return res.json({
                user_id: user.id,
                email: user.email,
                display_name: user.display_name,
                role_name: user.role,
                is_active: true
            });
        }

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
               AND (ar.name = 'hr_admin' OR ar.name = 'super_admin' OR ar.name = 'admin')`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            console.log('No HR profile found for user:', req.user.id);
            return res.status(403).json({ error: 'Not an HR user' });
        }

        console.log('✅ HR profile found');
        res.json(result.rows[0]);
    } catch (error) {
        console.error('❌ Get HR profile error:', error);
        res.status(500).json({ error: 'Failed to fetch HR profile' });
    }
};

const getHRDashboardStats = async (req, res) => {
    try {
        // Check which tables exist
        const [jobsExist, appsExist, interviewsExist, deptsExist] = await Promise.all([
            tableExists('job_postings'),
            tableExists('job_applications'),
            tableExists('interviews'),
            tableExists('departments')
        ]);

        // Initialize stats with defaults
        const stats = {
            jobs: { total_jobs: 0, open_jobs: 0, closed_jobs: 0, draft_jobs: 0 },
            applications: {
                total_applications: 0, pending_applications: 0, reviewed_applications: 0,
                shortlisted_applications: 0, interviewed_applications: 0, hired_applications: 0,
                rejected_applications: 0
            },
            interviews: { total_interviews: 0, scheduled_interviews: 0, completed_interviews: 0, cancelled_interviews: 0 },
            departments: { total_departments: 0, departments_with_manager: 0 },
            employees: { total_employees: 0, active_employees: 0 }
        };

        // Get job stats
        if (jobsExist) {
            const jobStats = await query(
                `SELECT
                     COUNT(*) as total_jobs,
                     COUNT(CASE WHEN status = 'open' THEN 1 END) as open_jobs,
                     COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_jobs,
                     COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_jobs
                 FROM job_postings`
            );
            stats.jobs = jobStats.rows[0];
        }

        // Get application stats
        if (appsExist) {
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
            stats.applications = applicationStats.rows[0];
        }

        // Get interview stats
        if (interviewsExist) {
            const interviewStats = await query(
                `SELECT
                     COUNT(*) as total_interviews,
                     COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_interviews,
                     COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_interviews,
                     COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_interviews
                 FROM interviews`
            );
            stats.interviews = interviewStats.rows[0];
        }

        // Get department stats
        if (deptsExist) {
            const hasManagerId = await columnExists('departments', 'manager_id');

            if (hasManagerId) {
                const departmentStats = await query(
                    `SELECT
                         COUNT(*) as total_departments,
                         COUNT(CASE WHEN manager_id IS NOT NULL THEN 1 END) as departments_with_manager
                     FROM departments`
                );
                stats.departments = departmentStats.rows[0];
            } else {
                const deptCount = await query('SELECT COUNT(*) as total_departments FROM departments');
                stats.departments = {
                    total_departments: parseInt(deptCount.rows[0].count),
                    departments_with_manager: 0
                };
            }
        }

        // Get employee stats from users table
        const employeeStats = await query(
            `SELECT
                 COUNT(*) as total_employees,
                 COUNT(CASE WHEN is_active = true OR is_active IS NULL THEN 1 END) as active_employees
             FROM users WHERE role IN ('employee', 'hr_admin', 'admin', 'super_admin')`
        );
        stats.employees = employeeStats.rows[0];

        res.json(stats);
    } catch (error) {
        console.error('❌ Get HR dashboard stats error:', error);
        // Return default stats instead of failing
        res.json({
            jobs: { total_jobs: 0, open_jobs: 0, closed_jobs: 0, draft_jobs: 0 },
            applications: {
                total_applications: 0, pending_applications: 0, reviewed_applications: 0,
                shortlisted_applications: 0, interviewed_applications: 0, hired_applications: 0,
                rejected_applications: 0
            },
            interviews: { total_interviews: 0, scheduled_interviews: 0, completed_interviews: 0, cancelled_interviews: 0 },
            departments: { total_departments: 0, departments_with_manager: 0 },
            employees: { total_employees: 0, active_employees: 0 }
        });
    }
};

// FIXED: createJobPosting now accepts status from frontend and handles department_id better
const createJobPosting = async (req, res) => {
    try {
        // Check if table exists
        const jobsExist = await tableExists('job_postings');
        if (!jobsExist) {
            return res.status(503).json({ error: 'Job postings table not initialized' });
        }

        const {
            title,
            department_id,
            employment_type,
            location,
            salary_min,
            salary_max,
            salary_currency,
            description,
            requirements,
            responsibilities,
            benefits,
            skills_required,
            experience_level,
            education_required,
            application_deadline,
            status
        } = req.body;

        // Validate required fields
        if (!title || !employment_type || !description) {
            return res.status(400).json({ error: 'Missing required fields: title, employment_type, description' });
        }

        const arrayValidationError =
            validateArrayField(requirements, 'requirements') ||
            validateArrayField(responsibilities, 'responsibilities') ||
            validateArrayField(benefits, 'benefits') ||
            validateArrayField(skills_required, 'skills_required');

        if (arrayValidationError) {
            return res.status(400).json({ error: arrayValidationError });
        }

        // Set default status to 'draft' if not provided
        const jobStatus = status || 'draft';

        console.log('Creating job posting with data:', {
            title,
            department_id,
            employment_type,
            location,
            salary_min,
            salary_max,
            salary_currency,
            description: description?.substring(0, 50) + '...',
            requirements: requirements?.length,
            responsibilities: responsibilities?.length,
            benefits: benefits?.length,
            skills_required: skills_required?.length,
            experience_level,
            education_required,
            application_deadline,
            status: jobStatus,
            posted_by: req.user.id
        });

        const result = await query(
            `INSERT INTO job_postings (
                title, department_id, employment_type, location,
                salary_min, salary_max, salary_currency, description,
                requirements, responsibilities, benefits, skills_required,
                experience_level, education_required, application_deadline,
                posted_by, status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10::text[], $11::text[], $12::text[], $13, $14, $15, $16, $17, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 RETURNING *`,
            [
                title,
                department_id || null,
                employment_type,
                location || null,
                salary_min ? parseFloat(salary_min) : null,
                salary_max ? parseFloat(salary_max) : null,
                salary_currency || 'USD',
                description,
                requirements || null,
                responsibilities || null,
                benefits || null,
                skills_required || null,
                experience_level || null,
                education_required || null,
                application_deadline || null,
                req.user.id,
                jobStatus
            ]
        );

        console.log('✅ Job created successfully with status:', jobStatus, 'ID:', result.rows[0].id);
        res.status(201).json({
            success: true,
            id: result.rows[0].id,
            job: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Create job posting error:', error);
        console.error('Error details:', error.message);

        if (error.code === '22P02') {
            return res.status(400).json({
                error: 'Invalid array format for requirements, responsibilities, benefits, or skills_required'
            });
        }

        res.status(500).json({ error: 'Failed to create job posting: ' + error.message });
    }
};

// FIXED: updateJobPosting function
const updateJobPosting = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const setClause = [];
        const values = [];
        let index = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (['requirements', 'responsibilities', 'benefits', 'skills_required'].includes(key)) {
                setClause.push(`${key} = $${index}::jsonb`);
                values.push(value);
            } else {
                setClause.push(`${key} = $${index}`);
                values.push(value);
            }

            index++;
        }

        values.push(id);

        const result = await query(
            `
            UPDATE job_postings
            SET ${setClause.join(', ')},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $${index}
            RETURNING *
            `,
            values
        );

        if (!result.rows.length) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update Job Error:', error);

        res.status(500).json({
            error: 'Failed to update job'
        });
    }
};


const getJobPostings = async (req, res) => {
    try {
        const { status, department } = req.query;

        // Check if tables exist
        const jobsExist = await tableExists('job_postings');
        if (!jobsExist) {
            return res.json([]);
        }

        const appsExist = await tableExists('job_applications');

        let queryText = `
            SELECT
                j.*,
                d.name as department_name,
                u.display_name as posted_by_name
        `;

        if (appsExist) {
            queryText += `,
                COUNT(a.id) as applications_count
            FROM job_postings j
            LEFT JOIN departments d ON j.department_id = d.id
            LEFT JOIN users u ON j.posted_by = u.id
            LEFT JOIN job_applications a ON j.id = a.job_id
            `;
        } else {
            queryText += `
            FROM job_postings j
            LEFT JOIN departments d ON j.department_id = d.id
            LEFT JOIN users u ON j.posted_by = u.id
            `;
        }

        queryText += ` WHERE 1=1`;
        const params = [];
        let paramIndex = 1;

        if (status && status !== 'all') {
            queryText += ` AND j.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (department && department !== 'all') {
            queryText += ` AND j.department_id = $${paramIndex}`;
            params.push(department);
            paramIndex++;
        }

        if (appsExist) {
            queryText += ` GROUP BY j.id, d.name, u.display_name`;
        }

        queryText += ` ORDER BY j.created_at DESC`;

        const result = await query(queryText, params);

        res.json(result.rows);
    } catch (error) {
        console.error('❌ Get job postings error:', error);
        res.status(500).json({ error: 'Failed to fetch job postings' });
    }
};

const getJobDetails = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if tables exist
        const appsExist = await tableExists('job_applications');

        let queryText = `
            SELECT
                j.*,
                d.name as department_name,
                u.display_name as posted_by_name
        `;

        if (appsExist) {
            queryText += `,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', a.id,
                            'first_name', a.first_name,
                            'last_name', a.last_name,
                            'email', a.email,
                            'status', a.status,
                            'created_at', a.created_at
                        ) ORDER BY a.created_at DESC
                    ) FILTER (WHERE a.id IS NOT NULL),
                    '[]'
                ) as applications
            FROM job_postings j
            LEFT JOIN departments d ON j.department_id = d.id
            LEFT JOIN users u ON j.posted_by = u.id
            LEFT JOIN job_applications a ON j.id = a.job_id
            `;
        } else {
            queryText += `
            FROM job_postings j
            LEFT JOIN departments d ON j.department_id = d.id
            LEFT JOIN users u ON j.posted_by = u.id
            `;
        }

        queryText += ` WHERE j.id = $1`;

        if (appsExist) {
            queryText += ` GROUP BY j.id, d.name, u.display_name`;
        }

        const result = await query(queryText, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job posting not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('❌ Get job details error:', error);
        res.status(500).json({ error: 'Failed to fetch job details' });
    }
};

const publishJob = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `UPDATE job_postings
             SET status = 'open',
                 published_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
                 RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job posting not found' });
        }

        console.log('✅ Job published successfully:', id);
        res.json({
            success: true,
            job: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Publish job error:', error);
        res.status(500).json({ error: 'Failed to publish job' });
    }
};

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

        console.log('✅ Job closed successfully:', id);
        res.json({
            success: true,
            job: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Close job error:', error);
        res.status(500).json({ error: 'Failed to close job' });
    }
};

const deleteJobPosting = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query('DELETE FROM job_postings WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job posting not found' });
        }

        console.log('✅ Job deleted successfully:', id);
        res.json({
            success: true,
            message: 'Job posting deleted successfully'
        });
    } catch (error) {
        console.error('❌ Delete job posting error:', error);
        res.status(500).json({ error: 'Failed to delete job posting' });
    }
};

const getJobApplications = async (req, res) => {
    try {
        const { jobId } = req.params;
        const { status } = req.query;

        // Check if applications table exists
        const appsExist = await tableExists('job_applications');
        if (!appsExist) {
            return res.json([]);
        }

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

        if (status && status !== 'all') {
            queryText += ` AND a.status = $${paramIndex}`;
            params.push(status);
        }

        queryText += ` ORDER BY a.created_at DESC`;

        const result = await query(queryText, params);

        res.json(result.rows);
    } catch (error) {
        console.error('❌ Get job applications error:', error);
        res.status(500).json({ error: 'Failed to fetch job applications' });
    }
};

const getApplicationDetails = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if applications table exists
        const appsExist = await tableExists('job_applications');
        if (!appsExist) {
            return res.status(404).json({ error: 'Application not found' });
        }

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
        console.error('❌ Get application details error:', error);
        res.status(500).json({ error: 'Failed to fetch application details' });
    }
};

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
        console.error('❌ Update application status error:', error);
        res.status(500).json({ error: 'Failed to update application status' });
    }
};

const addApplicationNotes = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const result = await query(
            `UPDATE job_applications
             SET notes = CASE
                             WHEN notes IS NULL THEN $1
                             ELSE notes || E'\n' || $1
                 END,
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
        console.error('❌ Add application notes error:', error);
        res.status(500).json({ error: 'Failed to add notes' });
    }
};

const scheduleInterview = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            interviewer_id, interview_type, scheduled_at,
            duration_minutes, location, meeting_link
        } = req.body;

        // Check if interviews table exists
        const interviewsExist = await tableExists('interviews');
        if (!interviewsExist) {
            return res.status(503).json({ error: 'Interviews table not initialized' });
        }

        const result = await query(
            `INSERT INTO interviews (
                application_id, interviewer_id, interview_type,
                scheduled_at, duration_minutes, location, meeting_link, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled')
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
        console.error('❌ Schedule interview error:', error);
        res.status(500).json({ error: 'Failed to schedule interview' });
    }
};

const getUpcomingInterviews = async (req, res) => {
    try {
        // Check if interviews table exists
        const interviewsExist = await tableExists('interviews');
        if (!interviewsExist) {
            return res.json([]);
        }

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
        console.error('❌ Get upcoming interviews error:', error);
        res.status(500).json({ error: 'Failed to fetch upcoming interviews' });
    }
};

const updateInterview = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Remove undefined fields
        Object.keys(updates).forEach(key =>
            updates[key] === undefined && delete updates[key]
        );

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const setClause = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
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
        console.error('❌ Update interview error:', error);
        res.status(500).json({ error: 'Failed to update interview' });
    }
};

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
        console.error('❌ Submit interview feedback error:', error);
        res.status(500).json({ error: 'Failed to submit interview feedback' });
    }
};

const createEmployeeRelation = async (req, res) => {
    try {
        const {
            employee_id, issue_type, priority, subject, description
        } = req.body;

        // Check if employee_relations table exists
        const relationsExist = await tableExists('employee_relations');
        if (!relationsExist) {
            return res.status(503).json({ error: 'Employee relations table not initialized' });
        }

        const result = await query(
            `INSERT INTO employee_relations (
                employee_id, hr_representative_id, issue_type,
                priority, subject, description, status
            ) VALUES ($1, $2, $3, $4, $5, $6, 'open')
                 RETURNING *`,
            [employee_id, req.user.id, issue_type, priority, subject, description]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('❌ Create employee relation error:', error);
        res.status(500).json({ error: 'Failed to create employee relation' });
    }
};

const getEmployeeRelations = async (req, res) => {
    try {
        const { status, priority } = req.query;

        // Check if employee_relations table exists
        const relationsExist = await tableExists('employee_relations');
        if (!relationsExist) {
            return res.json([]);
        }

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
        console.error('❌ Get employee relations error:', error);
        res.status(500).json({ error: 'Failed to fetch employee relations' });
    }
};

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
        console.error('❌ Get relation details error:', error);
        res.status(500).json({ error: 'Failed to fetch relation details' });
    }
};

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
        console.error('❌ Update employee relation error:', error);
        res.status(500).json({ error: 'Failed to update employee relation' });
    }
};

const uploadEmployeeDocument = async (req, res) => {
    try {
        const {
            employee_id, document_type, title, description,
            file_url, is_confidential
        } = req.body;

        // Check if employee_documents table exists
        const docsExist = await tableExists('employee_documents');
        if (!docsExist) {
            return res.status(503).json({ error: 'Employee documents table not initialized' });
        }

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
        console.error('❌ Upload employee document error:', error);
        res.status(500).json({ error: 'Failed to upload document' });
    }
};

const getEmployeeDocuments = async (req, res) => {
    try {
        const { employeeId } = req.params;

        // Check if employee_documents table exists
        const docsExist = await tableExists('employee_documents');
        if (!docsExist) {
            return res.json([]);
        }

        const result = await query(
            `SELECT * FROM employee_documents
             WHERE employee_id = $1
             ORDER BY created_at DESC`,
            [employeeId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('❌ Get employee documents error:', error);
        res.status(500).json({ error: 'Failed to fetch employee documents' });
    }
};

const deleteEmployeeDocument = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query('DELETE FROM employee_documents WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        console.error('❌ Delete employee document error:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
};

const createPerformanceReview = async (req, res) => {
    try {
        const {
            employee_id, review_period, review_date, goals
        } = req.body;

        // Check if performance_reviews table exists
        const reviewsExist = await tableExists('performance_reviews');
        if (!reviewsExist) {
            return res.status(503).json({ error: 'Performance reviews table not initialized' });
        }

        const result = await query(
            `INSERT INTO performance_reviews (
                employee_id, reviewer_id, review_period, review_date, goals, status
            ) VALUES ($1, $2, $3, $4, $5, 'draft')
                 RETURNING *`,
            [employee_id, req.user.id, review_period, review_date, JSON.stringify(goals || [])]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('❌ Create performance review error:', error);
        res.status(500).json({ error: 'Failed to create performance review' });
    }
};

const getPerformanceReviews = async (req, res) => {
    try {
        const { employee_id } = req.query;

        // Check if performance_reviews table exists
        const reviewsExist = await tableExists('performance_reviews');
        if (!reviewsExist) {
            return res.json([]);
        }

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
        console.error('❌ Get performance reviews error:', error);
        res.status(500).json({ error: 'Failed to fetch performance reviews' });
    }
};

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
        console.error('❌ Get performance review details error:', error);
        res.status(500).json({ error: 'Failed to fetch performance review details' });
    }
};

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
            [
                strengths ? JSON.stringify(strengths) : null,
                areas_for_improvement ? JSON.stringify(areas_for_improvement) : null,
                overall_rating, comments, id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Performance review not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('❌ Update performance review error:', error);
        res.status(500).json({ error: 'Failed to update performance review' });
    }
};

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
        console.error('❌ Submit performance review error:', error);
        res.status(500).json({ error: 'Failed to submit performance review' });
    }
};

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
        console.error('❌ Acknowledge performance review error:', error);
        res.status(500).json({ error: 'Failed to acknowledge performance review' });
    }
};

// FIXED: getDepartments now returns default data when table doesn't exist
const getDepartments = async (req, res) => {
    try {
        // Check if departments table exists
        const deptsExist = await tableExists('departments');
        if (!deptsExist) {
            console.log('Departments table does not exist, returning default departments');
            // Return default departments with UUIDs
            return res.json([
                { id: '5f8f6f2e-1d4a-4c7a-9b11-1a2b3c4d5e61', name: 'General' },
                { id: '6a9c2d10-3f44-4b90-a4d3-2b3c4d5e6f72', name: 'Engineering' },
                { id: '7b1d3e21-5a66-4f83-b5e4-3c4d5e6f7a83', name: 'Product' },
                { id: '8c2e4f32-6b78-42a1-8c95-4d5e6f7a8b94', name: 'Design' },
                { id: '9d3f5a43-7c8a-4d2b-9da6-5e6f7a8b9ca5', name: 'Marketing' },
                { id: 'ae4a6b54-8d9c-4e3c-aeb7-6f7a8b9cadb6', name: 'Sales' },
                { id: 'bf5b7c65-9e0f-4f4d-bfc8-7a8b9cadbec7', name: 'Human Resources' },
                { id: 'c06c8d76-af12-4a5e-80d9-8b9cadbecfd8', name: 'Finance' },
                { id: 'd17d9e87-b234-4b6f-91ea-9cadbecfd0e9', name: 'Operations' }
            ]);
        }

        const hasUsersDepartmentId = await columnExists('users', 'department_id');
        const hasUsersDepartment = await columnExists('users', 'department');

        let employeeCountSelect = '0';
        if (hasUsersDepartmentId) {
            employeeCountSelect = '(SELECT COUNT(*) FROM users WHERE department_id = d.id)';
        } else if (hasUsersDepartment) {
            employeeCountSelect = "(SELECT COUNT(*) FROM users WHERE department = d.name)";
        }

        const result = await query(
            `SELECT
                 d.*,
                 u.display_name as manager_name,
                 ${employeeCountSelect} as employee_count
             FROM departments d
                      LEFT JOIN users u ON d.manager_id = u.id
             ORDER BY d.name`
        );

        // If no departments in database, return defaults
        if (result.rows.length === 0) {
            return res.json([
                { id: '5f8f6f2e-1d4a-4c7a-9b11-1a2b3c4d5e61', name: 'General' },
                { id: '6a9c2d10-3f44-4b90-a4d3-2b3c4d5e6f72', name: 'Engineering' },
                { id: '7b1d3e21-5a66-4f83-b5e4-3c4d5e6f7a83', name: 'Product' },
                { id: '8c2e4f32-6b78-42a1-8c95-4d5e6f7a8b94', name: 'Design' },
                { id: '9d3f5a43-7c8a-4d2b-9da6-5e6f7a8b9ca5', name: 'Marketing' },
                { id: 'ae4a6b54-8d9c-4e3c-aeb7-6f7a8b9cadb6', name: 'Sales' },
                { id: 'bf5b7c65-9e0f-4f4d-bfc8-7a8b9cadbec7', name: 'Human Resources' },
                { id: 'c06c8d76-af12-4a5e-80d9-8b9cadbecfd8', name: 'Finance' },
                { id: 'd17d9e87-b234-4b6f-91ea-9cadbecfd0e9', name: 'Operations' }
            ]);
        }

        res.json(result.rows);
    } catch (error) {
        console.error('❌ Get departments error:', error);
        // Return default departments on error
        res.json([
            { id: '5f8f6f2e-1d4a-4c7a-9b11-1a2b3c4d5e61', name: 'General' },
            { id: '6a9c2d10-3f44-4b90-a4d3-2b3c4d5e6f72', name: 'Engineering' },
            { id: '7b1d3e21-5a66-4f83-b5e4-3c4d5e6f7a83', name: 'Product' },
            { id: '8c2e4f32-6b78-42a1-8c95-4d5e6f7a8b94', name: 'Design' },
            { id: '9d3f5a43-7c8a-4d2b-9da6-5e6f7a8b9ca5', name: 'Marketing' },
            { id: 'ae4a6b54-8d9c-4e3c-aeb7-6f7a8b9cadb6', name: 'Sales' },
            { id: 'bf5b7c65-9e0f-4f4d-bfc8-7a8b9cadbec7', name: 'Human Resources' },
            { id: 'c06c8d76-af12-4a5e-80d9-8b9cadbecfd8', name: 'Finance' },
            { id: 'd17d9e87-b234-4b6f-91ea-9cadbecfd0e9', name: 'Operations' }
        ]);
    }
};

const createDepartment = async (req, res) => {
    try {
        const { name, description, manager_id, parent_department_id } = req.body;

        // Check if departments table exists
        const deptsExist = await tableExists('departments');
        if (!deptsExist) {
            return res.status(503).json({ error: 'Departments table not initialized' });
        }

        const result = await query(
            `INSERT INTO departments (name, description, manager_id, parent_department_id)
             VALUES ($1, $2, $3, $4)
                 RETURNING *`,
            [name, description, manager_id, parent_department_id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('❌ Create department error:', error);
        res.status(500).json({ error: 'Failed to create department' });
    }
};

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
        console.error('❌ Update department error:', error);
        res.status(500).json({ error: 'Failed to update department' });
    }
};

const getHiringAnalytics = async (req, res) => {
    try {
        // Check if job_applications table exists
        const appsExist = await tableExists('job_applications');
        if (!appsExist) {
            return res.json([]);
        }

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
        console.error('❌ Get hiring analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch hiring analytics' });
    }
};

const getEmployeeAnalytics = async (req, res) => {
    try {
        // Check if departments table exists
        const deptsExist = await tableExists('departments');

        if (deptsExist) {
            const result = await query(
                `SELECT
                     d.name as department,
                     COUNT(u.id) as total_employees,
                     COUNT(CASE WHEN u.is_active = true THEN 1 END) as active_employees,
                     COALESCE(AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.created_at))), 0) as avg_tenure_years
                 FROM departments d
                          LEFT JOIN users u ON u.department_id = d.id AND u.role IN ('employee', 'hr_admin', 'admin')
                 GROUP BY d.name
                 ORDER BY d.name`
            );
            res.json(result.rows);
        } else {
            // Fallback: just count users by role
            const result = await query(
                `SELECT
                     role as department,
                     COUNT(*) as total_employees,
                     COUNT(*) as active_employees,
                     0 as avg_tenure_years
                 FROM users
                 WHERE role IN ('employee', 'hr_admin', 'admin', 'super_admin')
                 GROUP BY role`
            );
            res.json(result.rows);
        }
    } catch (error) {
        console.error('❌ Get employee analytics error:', error);
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