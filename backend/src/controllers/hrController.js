// backend/src/controllers/hrController.js
const { query } = require('../utils/database');

// Helper function to check if a table exists
const tableExists = async (tableName) => {
    try {
        const result = await query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = $1
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
                WHERE table_schema = 'public'
                  AND table_name = $1 AND column_name = $2
            )`,
            [tableName, columnName]
        );
        return result.rows[0].exists;
    } catch (error) {
        return false;
    }
};

// Helper: fetch ALL column names that exist for a given table in one query
const getTableColumns = async (tableName) => {
    try {
        const result = await query(
            `SELECT column_name FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = $1`,
            [tableName]
        );
        return result.rows.map(r => r.column_name);
    } catch (error) {
        console.error(`❌ Error fetching columns for ${tableName}:`, error);
        return [];
    }
};


// Helper to validate HR/admin privileges and return a valid poster user ID
const getOrCreateAdminUserId = async (userId) => {
    const userResult = await query(
        `SELECT id, role FROM users WHERE id = $1`,
        [userId]
    );

    if (userResult.rows.length === 0) {
        return null;
    }

    const role = String(userResult.rows[0].role || '').toLowerCase().trim();
    const allowedRoles = ['hr_admin', 'admin', 'super_admin', 'system_admin', 'administrator', 'superadmin'];

    if (!allowedRoles.includes(role)) {
        return null;
    }

    // In this codebase, job_postings.posted_by references users.id.
    return userResult.rows[0].id;
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

        const adminUsersExist = await tableExists('admin_users');
        const adminRolesExist = await tableExists('admin_roles');

        if (!adminUsersExist || !adminRolesExist) {
            console.log('Admin tables not found, checking user role directly');

            const userResult = await query(
                `SELECT id, email, role, display_name FROM users WHERE id = $1`,
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
            `SELECT au.*, u.email, u.display_name, ar.name as role_name
             FROM admin_users au
                      JOIN users u ON au.user_id = u.id
                      JOIN admin_roles ar ON au.role_id = ar.id
             WHERE au.user_id = $1 AND au.is_active = true`,
            [req.user.id]
        );

        if (result.rows.length > 0) {
            console.log('✅ HR profile found');
            return res.json(result.rows[0]);
        }

        const userResult = await query(
            `SELECT id, email, role, display_name FROM users WHERE id = $1`,
            [req.user.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(403).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];
        const hrRoles = ['hr_admin', 'super_admin', 'admin', 'system_admin'];
        if (!hrRoles.includes(String(user.role || '').toLowerCase().trim())) {
            console.log('No HR profile found for user:', req.user.id);
            return res.status(403).json({ error: 'Not an HR user' });
        }

        console.log('✅ HR access granted via user role fallback');
        return res.json({
            user_id: user.id,
            email: user.email,
            display_name: user.display_name,
            role_name: user.role,
            is_active: true
        });

    } catch (error) {
        console.error('❌ Get HR profile error:', error);
        res.status(500).json({ error: 'Failed to fetch HR profile' });
    }
};

const getHRDashboardStats = async (req, res) => {
    try {
        const [jobsExist, appsExist, interviewsExist, deptsExist] = await Promise.all([
            tableExists('job_postings'),
            tableExists('job_applications'),
            tableExists('interviews'),
            tableExists('departments')
        ]);

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

        if (jobsExist) {
            // Use both 'open' and 'published' for open_jobs to handle either schema
            const jobStats = await query(
                `SELECT COUNT(*) as total_jobs,
                        COUNT(CASE WHEN status IN ('open', 'published') THEN 1 END) as open_jobs,
                        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_jobs,
                        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_jobs
                 FROM job_postings`
            );
            stats.jobs = jobStats.rows[0];
        }

        if (appsExist) {
            const applicationStats = await query(
                `SELECT COUNT(*) as total_applications,
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

        if (interviewsExist) {
            const interviewStats = await query(
                `SELECT COUNT(*) as total_interviews,
                        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_interviews,
                        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_interviews,
                        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_interviews
                 FROM interviews`
            );
            stats.interviews = interviewStats.rows[0];
        }

        if (deptsExist) {
            const hasManagerId = await columnExists('departments', 'manager_id');
            if (hasManagerId) {
                const departmentStats = await query(
                    `SELECT COUNT(*) as total_departments,
                            COUNT(CASE WHEN manager_id IS NOT NULL THEN 1 END) as departments_with_manager
                     FROM departments`
                );
                stats.departments = departmentStats.rows[0];
            } else {
                const deptCount = await query('SELECT COUNT(*) as cnt FROM departments');
                stats.departments = {
                    total_departments: parseInt(deptCount.rows[0].cnt || 0),
                    departments_with_manager: 0
                };
            }
        }

        const employeeStats = await query(
            `SELECT COUNT(*) as total_employees,
                    COUNT(CASE WHEN is_active = true OR is_active IS NULL THEN 1 END) as active_employees
             FROM users WHERE role IN ('employee', 'hr_admin', 'admin', 'super_admin')`
        );
        stats.employees = employeeStats.rows[0];

        res.json(stats);
    } catch (error) {
        console.error('❌ Get HR dashboard stats error:', error);
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

// ─────────────────────────────────────────────────────────────────────────────
// getDepartments — returns BOTH `id` and `department_id` so the frontend
// never has to guess which field to use.
// ─────────────────────────────────────────────────────────────────────────────
const getDepartments = async (req, res) => {
    try {
        const deptsExist = await tableExists('departments');
        if (!deptsExist) {
            console.log('Departments table does not exist');
            return res.json([]);
        }

        const existingCols = await getTableColumns('departments');
        const has = (col) => existingCols.includes(col);

        console.log('📋 departments columns detected:', existingCols);

        let selectCols = `d.id, d.id AS department_id, d.name`;
        if (has('description'))          selectCols += `, d.description`;
        if (has('parent_department_id')) selectCols += `, d.parent_department_id`;
        if (has('manager_id'))           selectCols += `, d.manager_id`;
        if (has('created_at'))           selectCols += `, d.created_at`;
        if (has('updated_at'))           selectCols += `, d.updated_at`;

        let joinClause = '';
        if (has('manager_id')) {
            selectCols += `, u.display_name AS manager_name`;
            joinClause = `LEFT JOIN users u ON d.manager_id = u.id`;
        }

        const result = await query(
            `SELECT ${selectCols} FROM departments d ${joinClause} ORDER BY d.name`
        );

        console.log(`✅ Returning ${result.rows.length} departments`);
        if (result.rows.length > 0) {
            console.log('📋 Department IDs in DB:', result.rows.map(r => `${r.name}: ${r.id}`));
        }

        res.json(result.rows);

    } catch (error) {
        console.error('❌ Get departments error:', error);
        res.json([]);
    }
};

// Helper: get departments list (used internally for error responses)
const getValidDepartments = async () => {
    try {
        const deptsExist = await tableExists('departments');
        if (!deptsExist) return [];
        const existingCols = await getTableColumns('departments');
        const has = (col) => existingCols.includes(col);
        const selectCols = has('description') ? `id, name, description` : `id, name`;
        const result = await query(`SELECT ${selectCols} FROM departments ORDER BY name`);
        return result.rows;
    } catch (error) {
        console.error('❌ Error getting departments:', error);
        return [];
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// createJobPosting — reads actual DB columns first, only inserts what exists.
// Status is normalised via resolveJobStatus() to satisfy the DB check constraint.
// ─────────────────────────────────────────────────────────────────────────────
const createJobPosting = async (req, res) => {
    try {
        const jobsExist = await tableExists('job_postings');
        if (!jobsExist) {
            return res.status(503).json({ error: 'Job postings table not initialized' });
        }

        const {
            title, department_id, employment_type, location, is_remote,
            salary_min, salary_max, salary_currency, description,
            requirements, responsibilities, benefits, skills_required,
            experience_level, education_required, application_deadline, status
        } = req.body;

        // ── Required field validation ──────────────────────────────────────
        if (!title || !employment_type || !description) {
            return res.status(400).json({
                error: 'Missing required fields',
                details: 'title, employment_type, and description are all required'
            });
        }

        const arrayValidationError =
            validateArrayField(requirements,     'requirements')     ||
            validateArrayField(responsibilities, 'responsibilities') ||
            validateArrayField(benefits,         'benefits')         ||
            validateArrayField(skills_required,  'skills_required');

        if (arrayValidationError) {
            return res.status(400).json({ error: arrayValidationError });
        }

        if (!department_id) {
            return res.status(400).json({
                error: 'Department is required',
                field: 'department_id',
                message: 'Please select a department from the dropdown'
            });
        }

        if (!isValidUUID(department_id)) {
            return res.status(400).json({
                error: 'Invalid department ID format',
                field: 'department_id',
                value: department_id,
                message: 'The department ID must be a valid UUID'
            });
        }

        // ── Department existence check ──────────────────────────────────────
        console.log('🔍 Checking department existence for ID:', department_id);
        const deptCheck = await query(
            'SELECT id, name FROM departments WHERE id = $1',
            [department_id]
        );
        console.log('📋 Department check result:', deptCheck.rows);

        if (deptCheck.rows.length === 0) {
            const availableDepts = await getValidDepartments();
            console.log('❌ Department not found. Available IDs:', availableDepts.map(d => d.id));
            return res.status(400).json({
                error: 'Department not found',
                field: 'department_id',
                value: department_id,
                message: `Department with ID ${department_id} does not exist in the database. Please refresh the page and select a department again.`,
                availableDepartments: availableDepts
            });
        }

        const adminUserId = await getOrCreateAdminUserId(req.user.id);
        if (!adminUserId) {
            return res.status(403).json({
                error: 'User not authorized to create job postings',
                details: 'User must have HR privileges (hr_admin, admin, or super_admin role) to create job postings'
            });
        }

        // ── Read every column that actually exists in job_postings ──────────
        const existingCols = await getTableColumns('job_postings');
        const has = (col) => existingCols.includes(col);

        console.log('📋 job_postings columns detected:', existingCols);

        // ── Resolve status against the actual DB check constraint ───────────
        // The frontend sends "open" but the DB constraint may only allow
        // "draft" | "published" | "closed". resolveJobStatus() handles the
        // alias mapping AND probes Postgres for the real allowed values.
        const finalStatus = await resolveJobStatus(status);

        const cols    = ['title', 'department_id', 'employment_type', 'posted_by', 'status'];
        const holders = ['$1',    '$2',             '$3',              '$4',         '$5'];
        const params  = [title, department_id, employment_type, adminUserId, finalStatus];
        let idx = 6;

        if (has('created_at')) { cols.push('created_at'); holders.push('CURRENT_TIMESTAMP'); }
        if (has('updated_at')) { cols.push('updated_at'); holders.push('CURRENT_TIMESTAMP'); }

        if (has('description')) {
            cols.push('description'); holders.push(`$${idx}`); params.push(description); idx++;
        }
        if (has('location')) {
            cols.push('location'); holders.push(`$${idx}`); params.push(location || null); idx++;
        }
        if (has('is_remote')) {
            cols.push('is_remote'); holders.push(`$${idx}`); params.push(is_remote !== undefined ? is_remote : false); idx++;
        }
        if (has('salary_min')) {
            cols.push('salary_min'); holders.push(`$${idx}`); params.push(salary_min ? parseFloat(salary_min) : null); idx++;
        }
        if (has('salary_max')) {
            cols.push('salary_max'); holders.push(`$${idx}`); params.push(salary_max ? parseFloat(salary_max) : null); idx++;
        }
        if (has('salary_currency')) {
            cols.push('salary_currency'); holders.push(`$${idx}`); params.push(salary_currency || 'USD'); idx++;
        }
        if (has('experience_level')) {
            cols.push('experience_level'); holders.push(`$${idx}`); params.push(experience_level || null); idx++;
        }
        if (has('education_required')) {
            cols.push('education_required'); holders.push(`$${idx}`); params.push(education_required || null); idx++;
        }
        if (has('application_deadline')) {
            cols.push('application_deadline'); holders.push(`$${idx}`); params.push(application_deadline || null); idx++;
        }
        if (has('requirements')) {
            cols.push('requirements'); holders.push(`$${idx}::jsonb`); params.push(JSON.stringify(requirements || [])); idx++;
        }
        if (has('responsibilities')) {
            cols.push('responsibilities'); holders.push(`$${idx}::jsonb`); params.push(JSON.stringify(responsibilities || [])); idx++;
        }
        if (has('benefits')) {
            cols.push('benefits'); holders.push(`$${idx}::jsonb`); params.push(JSON.stringify(benefits || [])); idx++;
        }
        if (has('skills_required')) {
            cols.push('skills_required'); holders.push(`$${idx}::jsonb`); params.push(JSON.stringify(skills_required || [])); idx++;
        }

        const queryText = `
            INSERT INTO job_postings (${cols.join(', ')})
            VALUES (${holders.join(', ')})
            RETURNING *
        `;

        console.log('📥 Inserting job posting, columns used:', cols);
        console.log('📥 Final status value being inserted:', finalStatus);

        const result = await query(queryText, params);

        console.log('✅ Job created successfully with ID:', result.rows[0].id);
        res.status(201).json({ success: true, id: result.rows[0].id, job: result.rows[0] });

    } catch (error) {
        console.error('❌ Create job posting error:', error);
        if (error.code === '23514') {
            // Check constraint violation — surface the constraint detail
            return res.status(400).json({
                error: 'Invalid status value',
                details: error.detail || error.message,
                message: 'The status value is not allowed by the database. Try using "draft" or "published".'
            });
        }
        if (error.code === '23503') {
            return res.status(400).json({
                error: 'Invalid reference — the department ID or user ID does not exist in the database',
                field: 'department_id',
                details: error.detail || error.message
            });
        }
        if (error.code === '23502') {
            return res.status(400).json({ error: 'Missing required field', details: error.message });
        }
        if (error.code === '22P02') {
            return res.status(400).json({ error: 'Invalid data format', details: 'One of the array fields is malformed' });
        }
        res.status(500).json({ error: 'Failed to create job posting', details: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// updateJobPosting — skips fields that don't exist in the DB.
// Also normalises status via resolveJobStatus() if it is being updated.
// ─────────────────────────────────────────────────────────────────────────────
const updateJobPosting = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = { ...req.body };

        // ── Normalise status if present ────────────────────────────────────
        if (updates.status !== undefined) {
            updates.status = await resolveJobStatus(updates.status);
        }

        // ── If department_id is being updated, validate it exists ──────────
        if (updates.department_id) {
            if (!isValidUUID(updates.department_id)) {
                return res.status(400).json({
                    error: 'Invalid department ID format',
                    field: 'department_id',
                    value: updates.department_id
                });
            }
            const deptCheck = await query(
                'SELECT id FROM departments WHERE id = $1',
                [updates.department_id]
            );
            if (deptCheck.rows.length === 0) {
                const availableDepts = await getValidDepartments();
                return res.status(400).json({
                    error: 'Department not found',
                    field: 'department_id',
                    value: updates.department_id,
                    message: `Department with ID ${updates.department_id} does not exist. Please refresh and select a valid department.`,
                    availableDepartments: availableDepts
                });
            }
        }

        const existingCols = await getTableColumns('job_postings');
        const has = (col) => existingCols.includes(col);

        const arrayFields = ['requirements', 'responsibilities', 'benefits', 'skills_required'];
        const setClause = [];
        const values = [];
        let index = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (!has(key)) {
                console.log(`⚠️  Skipping unknown column in update: ${key}`);
                continue;
            }
            if (arrayFields.includes(key)) {
                const arrayValidationError = validateArrayField(value, key);
                if (arrayValidationError) {
                    return res.status(400).json({ error: arrayValidationError });
                }
                setClause.push(`${key} = $${paramIndex}::jsonb`);
                values.push(JSON.stringify(value || []));
            } else {
                setClause.push(`${key} = $${index}`);
                values.push(value);
            }

            index++;
        }

        if (setClause.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        if (has('updated_at')) setClause.push(`updated_at = CURRENT_TIMESTAMP`);
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
        console.error('❌ Update job posting error:', error);
        if (error.code === '23514') {
            return res.status(400).json({
                error: 'Invalid status value',
                details: error.detail || error.message,
                message: 'The status value is not allowed by the database constraint.'
            });
        }
        if (error.code === '22P02') {
            return res.status(400).json({ error: 'Invalid array format for requirements, responsibilities, benefits, or skills_required' });
        }
        res.status(500).json({ error: 'Failed to update job posting' });
    }
};


const getJobPostings = async (req, res) => {
    try {
        const { status, department } = req.query;

        const jobsExist = await tableExists('job_postings');
        if (!jobsExist) return res.json([]);

        const appsExist  = await tableExists('job_applications');
        const deptsExist = await tableExists('departments');

        let selectPart = `SELECT j.*`;
        if (deptsExist) selectPart += `, d.name as department_name`;
        if (appsExist)  selectPart += `, COUNT(a.id) as applications_count`;

        let fromPart = `FROM job_postings j`;
        if (deptsExist) fromPart += ` LEFT JOIN departments d ON j.department_id = d.id`;
        fromPart += ` LEFT JOIN users u ON j.posted_by = u.id`;
        if (appsExist)  fromPart += ` LEFT JOIN job_applications a ON j.id = a.job_id`;

        let wherePart = `WHERE 1=1`;
        const params = [];
        let paramIndex = 1;

        if (status && status !== 'all') {
            // Accept 'open' as a filter alias for 'published'
            const statusFilter = STATUS_ALIAS_MAP[status] ?? status;
            wherePart += ` AND j.status = $${paramIndex}`;
            params.push(statusFilter);
            paramIndex++;
        }
        if (department && department !== 'all' && deptsExist) {
            wherePart += ` AND j.department_id = $${paramIndex}`;
            params.push(department);
            paramIndex++;
        }

        let groupPart = '';
        if (appsExist) {
            groupPart = `GROUP BY j.id`;
            if (deptsExist) groupPart += `, d.name`;
        }

        const result = await query(
            `${selectPart} ${fromPart} ${wherePart} ${groupPart} ORDER BY j.created_at DESC`,
            params
        );
        res.json(result.rows);

    } catch (error) {
        console.error('❌ Get job postings error:', error);
        res.status(500).json({ error: 'Failed to fetch job postings' });
    }
};

const getJobDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const appsExist  = await tableExists('job_applications');
        const deptsExist = await tableExists('departments');

        let selectPart = `SELECT j.*`;
        if (deptsExist) selectPart += `, d.name as department_name`;

        let fromPart = `FROM job_postings j`;
        if (deptsExist) fromPart += ` LEFT JOIN departments d ON j.department_id = d.id`;
        fromPart += ` LEFT JOIN users u ON j.posted_by = u.id`;
        if (appsExist) fromPart += ` LEFT JOIN job_applications a ON j.id = a.job_id`;

        let groupPart = '';
        if (appsExist) {
            groupPart = `GROUP BY j.id`;
            if (deptsExist) groupPart += `, d.name`;
        }

        const result = await query(
            `${selectPart} ${fromPart} WHERE j.id = $1 ${groupPart}`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job posting not found' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('❌ Get job details error:', error);
        res.status(500).json({ error: 'Failed to fetch job details' });
    }
};


const getPublicJobPostings = async (req, res) => {
    try {
        const { department } = req.query;

        const jobsExist = await tableExists('job_postings');
        if (!jobsExist) return res.json([]);

        const deptsExist = await tableExists('departments');
        const appsExist = await tableExists('job_applications');

        let selectPart = `SELECT j.*`;
        if (deptsExist) selectPart += `, d.name as department_name`;
        if (appsExist) selectPart += `, COUNT(a.id) as applications_count`;

        let fromPart = `FROM job_postings j`;
        if (deptsExist) fromPart += ` LEFT JOIN departments d ON j.department_id = d.id`;
        if (appsExist) fromPart += ` LEFT JOIN job_applications a ON j.id = a.job_id`;

        const params = [];
        let paramIndex = 1;
        let wherePart = `WHERE j.status IN ('open', 'published')`;

        if (department && department !== 'all' && deptsExist) {
            wherePart += ` AND j.department_id = $${paramIndex}`;
            params.push(department);
            paramIndex += 1;
        }

        let groupPart = '';
        if (appsExist) {
            groupPart = `GROUP BY j.id`;
            if (deptsExist) groupPart += `, d.name`;
        }

        const result = await query(
            `${selectPart} ${fromPart} ${wherePart} ${groupPart} ORDER BY j.created_at DESC`,
            params
        );

        return res.json(result.rows);
    } catch (error) {
        console.error('❌ Get public job postings error:', error);
        return res.status(500).json({ error: 'Failed to fetch job postings' });
    }
};

const getPublicJobDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const deptsExist = await tableExists('departments');
        const appsExist = await tableExists('job_applications');

        let selectPart = `SELECT j.*`;
        if (deptsExist) selectPart += `, d.name as department_name`;
        if (appsExist) selectPart += `, COUNT(a.id) as applications_count`;

        let fromPart = `FROM job_postings j`;
        if (deptsExist) fromPart += ` LEFT JOIN departments d ON j.department_id = d.id`;
        if (appsExist) fromPart += ` LEFT JOIN job_applications a ON j.id = a.job_id`;

        let groupPart = '';
        if (appsExist) {
            groupPart = `GROUP BY j.id`;
            if (deptsExist) groupPart += `, d.name`;
        }

        const result = await query(
            `${selectPart} ${fromPart} WHERE j.id = $1 AND j.status IN ('open', 'published') ${groupPart}`,
            [id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ error: 'Job posting not found' });
        }

        return res.json(result.rows[0]);
    } catch (error) {
        console.error('❌ Get public job details error:', error);
        return res.status(500).json({ error: 'Failed to fetch job details' });
    }
};

const submitPublicJobApplication = async (req, res) => {
    try {
        const { id: jobId } = req.params;
        const {
            first_name,
            last_name,
            email,
            phone,
            cover_letter,
            resume_url,
            linkedin_url,
            github_url,
            portfolio_url,
            years_experience,
            current_company,
            current_position,
            skills,
            salary_expectation,
            available_start_date,
            work_authorization,
            remote_preference
        } = req.body;

        const jobResult = await query(`SELECT id, status FROM job_postings WHERE id = $1`, [jobId]);
        if (!jobResult.rows.length) {
            return res.status(404).json({ error: 'Job posting not found' });
        }

        const jobStatus = String(jobResult.rows[0].status || '').toLowerCase();
        if (!['open', 'published'].includes(jobStatus)) {
            return res.status(400).json({ error: 'This job is not accepting applications' });
        }

        const appCols = await getTableColumns('job_applications');
        if (!appCols.length) {
            return res.status(500).json({ error: 'Applications table not available' });
        }

        const cols = ['job_id'];
        const holders = ['$1'];
        const params = [jobId];
        let idx = 2;

        const pushIfCol = (col, value, cast = '') => {
            if (!appCols.includes(col)) return;
            cols.push(col);
            holders.push(`$${idx}${cast}`);
            params.push(value);
            idx += 1;
        };

        pushIfCol('first_name', first_name);
        pushIfCol('last_name', last_name);
        pushIfCol('email', String(email || '').toLowerCase().trim());
        pushIfCol('phone', phone || null);
        pushIfCol('cover_letter', cover_letter || null);
        pushIfCol('resume_url', resume_url || null);
        pushIfCol('linkedin_url', linkedin_url || null);
        pushIfCol('github_url', github_url || null);
        pushIfCol('portfolio_url', portfolio_url || null);
        pushIfCol('years_experience', years_experience || null);
        pushIfCol('current_company', current_company || null);
        pushIfCol('current_position', current_position || null);
        pushIfCol('salary_expectation', salary_expectation || null);
        pushIfCol('available_start_date', available_start_date || null);
        pushIfCol('work_authorization', work_authorization || null);
        pushIfCol('remote_preference', remote_preference || null);

        if (appCols.includes('skills')) {
            pushIfCol('skills', JSON.stringify(Array.isArray(skills) ? skills : []), '::jsonb');
        }

        if (appCols.includes('status')) {
            cols.push('status');
            holders.push(`$${idx}`);
            params.push('pending');
            idx += 1;
        }

        if (appCols.includes('created_at')) {
            cols.push('created_at');
            holders.push('CURRENT_TIMESTAMP');
        }
        if (appCols.includes('updated_at')) {
            cols.push('updated_at');
            holders.push('CURRENT_TIMESTAMP');
        }

        const result = await query(
            `INSERT INTO job_applications (${cols.join(', ')}) VALUES (${holders.join(', ')}) RETURNING *`,
            params
        );

        return res.status(201).json({ success: true, message: 'Application submitted successfully', application: result.rows[0] });
    } catch (error) {
        console.error('❌ Submit public job application error:', error);
        return res.status(500).json({ error: 'Failed to submit application' });
    }
};

const getJobApplications = async (req, res) => {
    try {
        const { jobId } = req.params;
        const { status } = req.query;

        const appsExist  = await tableExists('job_applications');
        const deptsExist = await tableExists('departments');

        if (!appsExist) return res.json([]);

        let selectPart = `SELECT a.*, j.title as job_title`;
        if (deptsExist) selectPart += `, d.name as department_name`;

        let fromPart = `FROM job_applications a JOIN job_postings j ON a.job_id = j.id`;
        if (deptsExist) fromPart += ` LEFT JOIN departments d ON j.department_id = d.id`;

        const params = [jobId];
        let wherePart = `WHERE a.job_id = $1`;
        let paramIndex = 2;

        if (status && status !== 'all') {
            wherePart += ` AND a.status = $${paramIndex}`;
            params.push(status);
        }

        const result = await query(
            `${selectPart} ${fromPart} ${wherePart} ORDER BY a.created_at DESC`,
            params
        );
        res.json(result.rows);

    } catch (error) {
        console.error('❌ Get job applications error:', error);
        res.status(500).json({ error: 'Failed to fetch job applications' });
    }
};

const getAllApplications = async (req, res) => {
    try {
        const { status, jobId } = req.query;

        const appsExist = await tableExists('job_applications');
        const deptsExist = await tableExists('departments');

        if (!appsExist) return res.json([]);

        let selectPart = `SELECT a.*, j.title as job_title`;
        if (deptsExist) selectPart += `, d.name as department_name`;

        let fromPart = `FROM job_applications a JOIN job_postings j ON a.job_id = j.id`;
        if (deptsExist) fromPart += ` LEFT JOIN departments d ON j.department_id = d.id`;

        const whereClauses = [];
        const params = [];

        if (status && status !== 'all') {
            params.push(status);
            whereClauses.push(`a.status = $${params.length}`);
        }

        if (jobId) {
            params.push(jobId);
            whereClauses.push(`a.job_id = $${params.length}`);
        }

        const wherePart = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const result = await query(
            `${selectPart} ${fromPart} ${wherePart} ORDER BY a.created_at DESC`,
            params
        );

        res.json(result.rows);
    } catch (error) {
        console.error('❌ Get all applications error:', error);
        res.status(500).json({ error: 'Failed to fetch applications' });
    }
};

const getApplicationDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const appsExist  = await tableExists('job_applications');
        const deptsExist = await tableExists('departments');

        if (!appsExist) return res.status(404).json({ error: 'Application not found' });

        let selectPart = `SELECT a.*, j.title as job_title, j.description as job_description`;
        if (deptsExist) selectPart += `, d.name as department_name`;
        selectPart += `, u.display_name as reviewer_name`;

        let fromPart = `FROM job_applications a JOIN job_postings j ON a.job_id = j.id`;
        if (deptsExist) fromPart += ` LEFT JOIN departments d ON j.department_id = d.id`;
        fromPart += ` LEFT JOIN users u ON a.reviewed_by = u.id`;

        const result = await query(`${selectPart} ${fromPart} WHERE a.id = $1`, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Application not found' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('❌ Get application details error:', error);
        res.status(500).json({ error: 'Failed to fetch application details' });
    }
};

const publishJob = async (req, res) => {
    try {
        const { id } = req.params;
        const existingCols = await getTableColumns('job_postings');
        const has = (col) => existingCols.includes(col);

        // Resolve 'open' vs 'published' via constraint probe
        const publishStatus = await resolveJobStatus('open');

        let setPart = `status = '${publishStatus}'`;
        if (has('published_at')) setPart += `, published_at = CURRENT_TIMESTAMP`;
        if (has('updated_at'))   setPart += `, updated_at = CURRENT_TIMESTAMP`;

        const result = await query(`UPDATE job_postings SET ${setPart} WHERE id = $1 RETURNING *`, [id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Job posting not found' });

        console.log('✅ Job published successfully:', id);
        res.json({ success: true, job: result.rows[0] });

    } catch (error) {
        console.error('❌ Publish job error:', error);
        res.status(500).json({ error: 'Failed to publish job' });
    }
};

const closeJob = async (req, res) => {
    try {
        const { id } = req.params;
        const existingCols = await getTableColumns('job_postings');
        const has = (col) => existingCols.includes(col);

        let setPart = `status = 'closed'`;
        if (has('closed_at'))  setPart += `, closed_at = CURRENT_TIMESTAMP`;
        if (has('updated_at')) setPart += `, updated_at = CURRENT_TIMESTAMP`;

        const result = await query(`UPDATE job_postings SET ${setPart} WHERE id = $1 RETURNING *`, [id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Job posting not found' });

        console.log('✅ Job closed successfully:', id);
        res.json({ success: true, job: result.rows[0] });

    } catch (error) {
        console.error('❌ Close job error:', error);
        res.status(500).json({ error: 'Failed to close job' });
    }
};

const deleteJobPosting = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('DELETE FROM job_postings WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Job posting not found' });

        console.log('✅ Job deleted successfully:', id);
        res.json({ success: true, message: 'Job posting deleted successfully' });

    } catch (error) {
        console.error('❌ Delete job posting error:', error);
        res.status(500).json({ error: 'Failed to delete job posting' });
    }
};

const updateApplicationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        const existingCols = await getTableColumns('job_applications');
        const has = (col) => existingCols.includes(col);

        const setClauses = [`status = $1`];
        const params = [status];
        let idx = 2;

        if (has('notes'))        { setClauses.push(`notes = $${idx}`);          params.push(notes);       idx++; }
        if (has('reviewed_by'))  { setClauses.push(`reviewed_by = $${idx}`);    params.push(req.user.id); idx++; }
        if (has('reviewed_at'))  { setClauses.push(`reviewed_at = CURRENT_TIMESTAMP`); }
        if (has('updated_at'))   { setClauses.push(`updated_at = CURRENT_TIMESTAMP`); }

        params.push(id);

        const result = await query(
            `UPDATE job_applications SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
            params
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Application not found' });

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

        const existingCols = await getTableColumns('job_applications');
        const has = (col) => existingCols.includes(col);

        let setPart = `notes = CASE WHEN notes IS NULL THEN $1 ELSE notes || E'\\n' || $1 END`;
        if (has('updated_at')) setPart += `, updated_at = CURRENT_TIMESTAMP`;

        const result = await query(
            `UPDATE job_applications SET ${setPart} WHERE id = $2 RETURNING *`,
            [notes, id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Application not found' });

        res.json(result.rows[0]);

    } catch (error) {
        console.error('❌ Add application notes error:', error);
        res.status(500).json({ error: 'Failed to add notes' });
    }
};

const scheduleInterview = async (req, res) => {
    try {
        const { id } = req.params;
        const { interviewer_id, interview_type, scheduled_at, duration_minutes, location, meeting_link } = req.body;

        const interviewsExist = await tableExists('interviews');
        if (!interviewsExist) return res.status(503).json({ error: 'Interviews table not initialized' });

        const existingCols = await getTableColumns('interviews');
        const has = (col) => existingCols.includes(col);

        const cols    = ['application_id', 'status'];
        const holders = ['$1', "'scheduled'"];
        const params  = [id];
        let idx = 2;

        if (has('interviewer_id'))   { cols.push('interviewer_id');   holders.push(`$${idx}`); params.push(interviewer_id);   idx++; }
        if (has('interview_type'))   { cols.push('interview_type');   holders.push(`$${idx}`); params.push(interview_type);   idx++; }
        if (has('scheduled_at'))     { cols.push('scheduled_at');     holders.push(`$${idx}`); params.push(scheduled_at);     idx++; }
        if (has('duration_minutes')) { cols.push('duration_minutes'); holders.push(`$${idx}`); params.push(duration_minutes); idx++; }
        if (has('location'))         { cols.push('location');         holders.push(`$${idx}`); params.push(location);         idx++; }
        if (has('meeting_link'))     { cols.push('meeting_link');     holders.push(`$${idx}`); params.push(meeting_link);     idx++; }
        if (has('created_at'))       { cols.push('created_at'); holders.push('CURRENT_TIMESTAMP'); }
        if (has('updated_at'))       { cols.push('updated_at'); holders.push('CURRENT_TIMESTAMP'); }

        const result = await query(
            `INSERT INTO interviews (${cols.join(', ')}) VALUES (${holders.join(', ')}) RETURNING *`,
            params
        );

        const appCols = await getTableColumns('job_applications');
        if (appCols.includes('status')) {
            const appSetPart = appCols.includes('updated_at')
                ? `status = 'interviewed', updated_at = CURRENT_TIMESTAMP`
                : `status = 'interviewed'`;
            await query(`UPDATE job_applications SET ${appSetPart} WHERE id = $1`, [id]);
        }

        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error('❌ Schedule interview error:', error);
        res.status(500).json({ error: 'Failed to schedule interview' });
    }
};

const getUpcomingInterviews = async (req, res) => {
    try {
        const interviewsExist = await tableExists('interviews');
        if (!interviewsExist) return res.json([]);

        const existingCols = await getTableColumns('interviews');
        if (!existingCols.includes('scheduled_at')) return res.json([]);

        const result = await query(
            `SELECT i.*, a.first_name, a.last_name, a.email,
                    j.title as job_title, u.display_name as interviewer_name
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

        Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);
        if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update' });

        const existingCols = await getTableColumns('interviews');
        const has = (col) => existingCols.includes(col);

        const setClause = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (!has(key)) { console.log(`⚠️  Skipping unknown column: ${key}`); continue; }
            setClause.push(`${key} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
        }

        if (setClause.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

        if (has('updated_at')) setClause.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);

        const result = await query(
            `UPDATE interviews SET ${setClause.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Interview not found' });

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

        const existingCols = await getTableColumns('interviews');
        const has = (col) => existingCols.includes(col);

        const setClauses = [`status = 'completed'`];
        const params = [];
        let idx = 1;

        if (has('feedback'))             { setClauses.push(`feedback = $${idx}`);             params.push(feedback);             idx++; }
        if (has('rating'))               { setClauses.push(`rating = $${idx}`);               params.push(rating);               idx++; }
        if (has('recommended_for_next')) { setClauses.push(`recommended_for_next = $${idx}`); params.push(recommended_for_next); idx++; }
        if (has('updated_at'))           { setClauses.push(`updated_at = CURRENT_TIMESTAMP`); }

        params.push(id);

        const result = await query(
            `UPDATE interviews SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
            params
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Interview not found' });

        if (recommended_for_next) {
            await query(
                `UPDATE job_applications SET status = 'shortlisted', updated_at = CURRENT_TIMESTAMP
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
        const { employee_id, issue_type, priority, subject, description } = req.body;

        const relationsExist = await tableExists('employee_relations');
        if (!relationsExist) return res.status(503).json({ error: 'Employee relations table not initialized' });

        const result = await query(
            `INSERT INTO employee_relations (
                employee_id, hr_representative_id, issue_type, priority, subject, description, status
            ) VALUES ($1, $2, $3, $4, $5, $6, 'open') RETURNING *`,
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

        const relationsExist = await tableExists('employee_relations');
        if (!relationsExist) return res.json([]);

        let queryText = `
            SELECT er.*, u.display_name as employee_name, u.email as employee_email,
                   hr.display_name as hr_name
            FROM employee_relations er
            JOIN users u ON er.employee_id = u.id
            LEFT JOIN users hr ON er.hr_representative_id = hr.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (status)   { queryText += ` AND er.status = $${paramIndex}`;   params.push(status);   paramIndex++; }
        if (priority) { queryText += ` AND er.priority = $${paramIndex}`; params.push(priority); paramIndex++; }

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
            `SELECT er.*, u.display_name as employee_name, u.email as employee_email,
                    u.phone_number as employee_phone, hr.display_name as hr_name
             FROM employee_relations er
             JOIN users u ON er.employee_id = u.id
             LEFT JOIN users hr ON er.hr_representative_id = hr.id
             WHERE er.id = $1`,
            [id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Employee relation not found' });

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

        const existingCols = await getTableColumns('employee_relations');
        const has = (col) => existingCols.includes(col);

        const setClauses = [`status = $1`];
        const params = [status];
        let idx = 2;

        if (has('resolution'))  { setClauses.push(`resolution = $${idx}`); params.push(resolution); idx++; }
        if (has('resolved_at')) { setClauses.push(`resolved_at = CASE WHEN $1 = 'resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END`); }
        if (has('updated_at'))  { setClauses.push(`updated_at = CURRENT_TIMESTAMP`); }

        params.push(id);

        const result = await query(
            `UPDATE employee_relations SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
            params
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Employee relation not found' });

        res.json(result.rows[0]);

    } catch (error) {
        console.error('❌ Update employee relation error:', error);
        res.status(500).json({ error: 'Failed to update employee relation' });
    }
};

const uploadEmployeeDocument = async (req, res) => {
    try {
        const { employee_id, document_type, title, description, file_url, is_confidential } = req.body;

        const docsExist = await tableExists('employee_documents');
        if (!docsExist) return res.status(503).json({ error: 'Employee documents table not initialized' });

        const result = await query(
            `INSERT INTO employee_documents (
                employee_id, document_type, title, description, file_url, is_confidential, uploaded_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
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

        const docsExist = await tableExists('employee_documents');
        if (!docsExist) return res.json([]);

        const result = await query(
            `SELECT * FROM employee_documents WHERE employee_id = $1 ORDER BY created_at DESC`,
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

        if (result.rows.length === 0) return res.status(404).json({ error: 'Document not found' });

        res.json({ message: 'Document deleted successfully' });

    } catch (error) {
        console.error('❌ Delete employee document error:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
};

const createPerformanceReview = async (req, res) => {
    try {
        const { employee_id, review_period, review_date, goals } = req.body;

        const reviewsExist = await tableExists('performance_reviews');
        if (!reviewsExist) return res.status(503).json({ error: 'Performance reviews table not initialized' });

        const existingCols = await getTableColumns('performance_reviews');
        const has = (col) => existingCols.includes(col);

        const cols    = ['employee_id', 'reviewer_id', 'status'];
        const holders = ['$1', '$2', "'draft'"];
        const params  = [employee_id, req.user.id];
        let idx = 3;

        if (has('review_period')) { cols.push('review_period'); holders.push(`$${idx}`); params.push(review_period); idx++; }
        if (has('review_date'))   { cols.push('review_date');   holders.push(`$${idx}`); params.push(review_date);   idx++; }
        if (has('goals'))         { cols.push('goals');         holders.push(`$${idx}`); params.push(JSON.stringify(goals || [])); idx++; }
        if (has('created_at'))    { cols.push('created_at'); holders.push('CURRENT_TIMESTAMP'); }
        if (has('updated_at'))    { cols.push('updated_at'); holders.push('CURRENT_TIMESTAMP'); }

        const result = await query(
            `INSERT INTO performance_reviews (${cols.join(', ')}) VALUES (${holders.join(', ')}) RETURNING *`,
            params
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

        const reviewsExist = await tableExists('performance_reviews');
        if (!reviewsExist) return res.json([]);

        let queryText = `
            SELECT pr.*, u.display_name as employee_name, r.display_name as reviewer_name
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
            `SELECT pr.*, u.display_name as employee_name, u.email as employee_email,
                    r.display_name as reviewer_name
             FROM performance_reviews pr
             JOIN users u ON pr.employee_id = u.id
             JOIN users r ON pr.reviewer_id = r.id
             WHERE pr.id = $1`,
            [id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Performance review not found' });

        res.json(result.rows[0]);

    } catch (error) {
        console.error('❌ Get performance review details error:', error);
        res.status(500).json({ error: 'Failed to fetch performance review details' });
    }
};

const updatePerformanceReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { strengths, areas_for_improvement, overall_rating, comments } = req.body;

        const existingCols = await getTableColumns('performance_reviews');
        const has = (col) => existingCols.includes(col);

        const setClauses = [`status = 'submitted'`];
        const params = [];
        let idx = 1;

        if (has('strengths'))             { setClauses.push(`strengths = $${idx}`);             params.push(strengths ? JSON.stringify(strengths) : null);                         idx++; }
        if (has('areas_for_improvement')) { setClauses.push(`areas_for_improvement = $${idx}`); params.push(areas_for_improvement ? JSON.stringify(areas_for_improvement) : null); idx++; }
        if (has('overall_rating'))        { setClauses.push(`overall_rating = $${idx}`);        params.push(overall_rating); idx++; }
        if (has('comments'))              { setClauses.push(`comments = $${idx}`);              params.push(comments);       idx++; }
        if (has('updated_at'))            { setClauses.push(`updated_at = CURRENT_TIMESTAMP`); }

        params.push(id);

        const result = await query(
            `UPDATE performance_reviews SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
            params
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Performance review not found' });

        res.json(result.rows[0]);

    } catch (error) {
        console.error('❌ Update performance review error:', error);
        res.status(500).json({ error: 'Failed to update performance review' });
    }
};

const submitPerformanceReview = async (req, res) => {
    try {
        const { id } = req.params;

        const existingCols = await getTableColumns('performance_reviews');
        const has = (col) => existingCols.includes(col);

        let setPart = `status = 'submitted'`;
        if (has('review_date')) setPart += `, review_date = CURRENT_DATE`;
        if (has('updated_at'))  setPart += `, updated_at = CURRENT_TIMESTAMP`;

        const result = await query(
            `UPDATE performance_reviews SET ${setPart} WHERE id = $1 RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Performance review not found' });

        res.json(result.rows[0]);

    } catch (error) {
        console.error('❌ Submit performance review error:', error);
        res.status(500).json({ error: 'Failed to submit performance review' });
    }
};

const acknowledgePerformanceReview = async (req, res) => {
    try {
        const { id } = req.params;

        const existingCols = await getTableColumns('performance_reviews');
        const has = (col) => existingCols.includes(col);

        const setClauses = [`status = 'acknowledged'`];
        if (has('employee_acknowledged'))    setClauses.push(`employee_acknowledged = true`);
        if (has('employee_acknowledged_at')) setClauses.push(`employee_acknowledged_at = CURRENT_TIMESTAMP`);
        if (has('updated_at'))               setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

        const result = await query(
            `UPDATE performance_reviews SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Performance review not found' });

        res.json(result.rows[0]);

    } catch (error) {
        console.error('❌ Acknowledge performance review error:', error);
        res.status(500).json({ error: 'Failed to acknowledge performance review' });
    }
};

const createDepartment = async (req, res) => {
    try {
        const { name, description, manager_id, parent_department_id } = req.body;

        const deptsExist = await tableExists('departments');
        if (!deptsExist) return res.status(503).json({ error: 'Departments table not initialized' });

        const existingCols = await getTableColumns('departments');
        const has = (col) => existingCols.includes(col);

        const cols    = ['name'];
        const holders = ['$1'];
        const params  = [name];
        let idx = 2;

        if (has('description')          && description          !== undefined) { cols.push('description');          holders.push(`$${idx}`); params.push(description || null);          idx++; }
        if (has('manager_id')           && manager_id           !== undefined) { cols.push('manager_id');           holders.push(`$${idx}`); params.push(manager_id || null);           idx++; }
        if (has('parent_department_id') && parent_department_id !== undefined) { cols.push('parent_department_id'); holders.push(`$${idx}`); params.push(parent_department_id || null); idx++; }
        if (has('created_at')) { cols.push('created_at'); holders.push('CURRENT_TIMESTAMP'); }
        if (has('updated_at')) { cols.push('updated_at'); holders.push('CURRENT_TIMESTAMP'); }

        const result = await query(
            `INSERT INTO departments (${cols.join(', ')}) VALUES (${holders.join(', ')}) RETURNING *`,
            params
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

        const deptsExist = await tableExists('departments');
        if (!deptsExist) return res.status(503).json({ error: 'Departments table not initialized' });

        const existingCols = await getTableColumns('departments');
        const has = (col) => existingCols.includes(col);

        const setClauses = [`name = COALESCE($1, name)`];
        const params = [name];
        let idx = 2;

        if (has('description')) { setClauses.push(`description = COALESCE($${idx}, description)`); params.push(description); idx++; }
        if (has('manager_id'))  { setClauses.push(`manager_id = COALESCE($${idx}, manager_id)`);   params.push(manager_id);  idx++; }
        if (has('updated_at'))  { setClauses.push(`updated_at = CURRENT_TIMESTAMP`); }

        params.push(id);

        const result = await query(
            `UPDATE departments SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
            params
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Department not found' });

        res.json(result.rows[0]);

    } catch (error) {
        console.error('❌ Update department error:', error);
        res.status(500).json({ error: 'Failed to update department' });
    }
};

const getHiringAnalytics = async (req, res) => {
    try {
        const appsExist = await tableExists('job_applications');
        if (!appsExist) return res.json([]);

        const result = await query(
            `SELECT DATE_TRUNC('month', created_at) as month,
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
        const hasDepartment = await columnExists('users', 'department');

        if (hasDepartment) {
            const result = await query(
                `SELECT u.department as department,
                        COUNT(*) as total_employees,
                        COUNT(CASE WHEN u.is_active = true THEN 1 END) as active_employees,
                        COALESCE(AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.created_at))), 0) as avg_tenure_years
                 FROM users u
                 WHERE u.role IN ('employee', 'hr_admin', 'admin', 'super_admin')
                 GROUP BY u.department
                 ORDER BY u.department`
            );
            res.json(result.rows);
        } else {
            const result = await query(
                `SELECT role as department,
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
    getPublicJobPostings,
    getPublicJobDetails,
    submitPublicJobApplication,
    updateJobPosting,
    publishJob,
    closeJob,
    deleteJobPosting,
    getAllApplications,
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
