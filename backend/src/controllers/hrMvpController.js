const { query } = require('../utils/database');

const respond = (res, { status = 200, success = true, data = null, error = null }) => {
    return res.status(status).json({ success, data, error });
};

const normalizeRole = (role) => String(role || '').toLowerCase().trim();

const isAdminRole = (role) => ['admin', 'super_admin', 'superadmin', 'system_admin', 'hr_admin'].includes(normalizeRole(role));

const isEmployeeRole = (role) => normalizeRole(role) === 'employee';

const requireAdmin = (req, res) => {
    if (!isAdminRole(req.user?.role)) {
        respond(res, { status: 403, success: false, error: 'Unauthorized action' });
        return false;
    }
    return true;
};

const getEmployeeForUser = async (userId) => {
    const result = await query(
        'SELECT * FROM employees WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [userId]
    );
    return result.rows[0] || null;
};

const buildEmployeeFilters = (queryParams = {}) => {
    const filters = [];
    const values = [];

    if (queryParams.status) {
        values.push(queryParams.status);
        filters.push(`status = $${values.length}`);
    }
    if (queryParams.department) {
        values.push(queryParams.department);
        filters.push(`department = $${values.length}`);
    }
    if (queryParams.search) {
        values.push(`%${queryParams.search}%`);
        filters.push(`(first_name ILIKE $${values.length} OR last_name ILIKE $${values.length} OR email ILIKE $${values.length})`);
    }

    return { filters, values };
};

const getEmployees = async (req, res) => {
    try {
        if (isEmployeeRole(req.user?.role)) {
            const employee = await getEmployeeForUser(req.user.id);
            if (!employee) {
                return respond(res, { status: 404, success: false, error: 'Employee not found' });
            }
            return respond(res, { data: { employees: [employee] } });
        }

        const { filters, values } = buildEmployeeFilters(req.query);
        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
        const result = await query(
            `SELECT * FROM employees ${whereClause} ORDER BY created_at DESC`,
            values
        );
        return respond(res, { data: { employees: result.rows } });
    } catch (error) {
        console.error('? HR getEmployees error:', error);
        return respond(res, { status: 500, success: false, error: 'Failed to fetch employees' });
    }
};

const getEmployeeById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return respond(res, { status: 400, success: false, error: 'Employee ID is required' });
        }

        if (isEmployeeRole(req.user?.role)) {
            const employee = await getEmployeeForUser(req.user.id);
            if (!employee || employee.id !== id) {
                return respond(res, { status: 403, success: false, error: 'Unauthorized action' });
            }
            return respond(res, { data: { employee } });
        }

        const result = await query('SELECT * FROM employees WHERE id = $1', [id]);
        if (!result.rows[0]) {
            return respond(res, { status: 404, success: false, error: 'Employee not found' });
        }
        return respond(res, { data: { employee: result.rows[0] } });
    } catch (error) {
        console.error('? HR getEmployeeById error:', error);
        return respond(res, { status: 500, success: false, error: 'Failed to fetch employee' });
    }
};

const createEmployee = async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const { user_id, first_name, last_name, email, phone, department, job_title, status } = req.body || {};
        if (!first_name || !last_name || !email) {
            return respond(res, { status: 400, success: false, error: 'first_name, last_name, and email are required' });
        }

        const duplicate = await query('SELECT id FROM employees WHERE email = $1', [email]);
        if (duplicate.rows.length > 0) {
            return respond(res, { status: 400, success: false, error: 'Employee with this email already exists' });
        }

        if (user_id) {
            const user = await query('SELECT id FROM users WHERE id = $1', [user_id]);
            if (user.rows.length === 0) {
                return respond(res, { status: 400, success: false, error: 'User not found for provided user_id' });
            }
        }

        const result = await query(
            `INSERT INTO employees (user_id, first_name, last_name, email, phone, department, job_title, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [user_id || null, first_name, last_name, email, phone || null, department || null, job_title || null, status || 'active']
        );

        return respond(res, { data: { employee: result.rows[0] } });
    } catch (error) {
        console.error('? HR createEmployee error:', error);
        return respond(res, { status: 500, success: false, error: 'Failed to create employee' });
    }
};

const updateEmployee = async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const { id } = req.params;
        if (!id) {
            return respond(res, { status: 400, success: false, error: 'Employee ID is required' });
        }

        const allowed = ['first_name', 'last_name', 'email', 'phone', 'department', 'job_title', 'status'];
        const updates = [];
        const values = [];

        allowed.forEach((field) => {
            if (req.body?.[field] !== undefined) {
                values.push(req.body[field]);
                updates.push(`${field} = $${values.length}`);
            }
        });

        if (!updates.length) {
            return respond(res, { status: 400, success: false, error: 'No valid fields to update' });
        }

        values.push(id);
        const result = await query(
            `UPDATE employees SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
            values
        );

        if (!result.rows[0]) {
            return respond(res, { status: 404, success: false, error: 'Employee not found' });
        }

        return respond(res, { data: { employee: result.rows[0] } });
    } catch (error) {
        console.error('? HR updateEmployee error:', error);
        return respond(res, { status: 500, success: false, error: 'Failed to update employee' });
    }
};

const getLeaves = async (req, res) => {
    try {
        let employeeId = req.query.employeeId;

        if (isEmployeeRole(req.user?.role)) {
            const employee = await getEmployeeForUser(req.user.id);
            if (!employee) {
                return respond(res, { status: 404, success: false, error: 'Employee not found' });
            }
            employeeId = employee.id;
        }

        const filters = [];
        const values = [];
        if (employeeId) {
            values.push(employeeId);
            filters.push(`employee_id = $${values.length}`);
        }
        if (req.query.status) {
            values.push(req.query.status);
            filters.push(`status = $${values.length}`);
        }

        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
        const result = await query(
            `SELECT * FROM leaves ${whereClause} ORDER BY created_at DESC`,
            values
        );
        return respond(res, { data: { leaves: result.rows } });
    } catch (error) {
        console.error('? HR getLeaves error:', error);
        return respond(res, { status: 500, success: false, error: 'Failed to fetch leaves' });
    }
};

const createLeave = async (req, res) => {
    try {
        const { type, start_date, end_date, reason, employee_id } = req.body || {};
        if (!start_date || !end_date) {
            return respond(res, { status: 400, success: false, error: 'start_date and end_date are required' });
        }

        let resolvedEmployeeId = employee_id;
        if (isEmployeeRole(req.user?.role)) {
            const employee = await getEmployeeForUser(req.user.id);
            if (!employee) {
                return respond(res, { status: 404, success: false, error: 'Employee not found' });
            }
            resolvedEmployeeId = employee.id;
        } else if (!isAdminRole(req.user?.role)) {
            return respond(res, { status: 403, success: false, error: 'Unauthorized action' });
        }

        if (!resolvedEmployeeId) {
            return respond(res, { status: 400, success: false, error: 'employee_id is required' });
        }

        const result = await query(
            `INSERT INTO leaves (employee_id, type, start_date, end_date, reason)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [resolvedEmployeeId, type || 'other', start_date, end_date, reason || null]
        );

        return respond(res, { data: { leave: result.rows[0] } });
    } catch (error) {
        console.error('? HR createLeave error:', error);
        return respond(res, { status: 500, success: false, error: 'Failed to submit leave request' });
    }
};

const updateLeaveStatus = async (req, res, status) => {
    if (!requireAdmin(req, res)) return;

    try {
        const { id } = req.params;
        if (!id) {
            return respond(res, { status: 400, success: false, error: 'Leave ID is required' });
        }
        const result = await query(
            'UPDATE leaves SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );
        if (!result.rows[0]) {
            return respond(res, { status: 404, success: false, error: 'Leave request not found' });
        }
        return respond(res, { data: { leave: result.rows[0] } });
    } catch (error) {
        console.error(`? HR updateLeaveStatus(${status}) error:`, error);
        return respond(res, { status: 500, success: false, error: 'Failed to update leave status' });
    }
};

const getDocuments = async (req, res) => {
    try {
        const { employeeId } = req.params;
        if (!employeeId) {
            return respond(res, { status: 400, success: false, error: 'employeeId is required' });
        }

        if (isEmployeeRole(req.user?.role)) {
            const employee = await getEmployeeForUser(req.user.id);
            if (!employee || employee.id !== employeeId) {
                return respond(res, { status: 403, success: false, error: 'Unauthorized action' });
            }
        }

        const result = await query(
            'SELECT * FROM documents WHERE employee_id = $1 ORDER BY uploaded_at DESC',
            [employeeId]
        );
        return respond(res, { data: { documents: result.rows } });
    } catch (error) {
        console.error('? HR getDocuments error:', error);
        return respond(res, { status: 500, success: false, error: 'Failed to fetch documents' });
    }
};

const uploadDocument = async (req, res) => {
    try {
        const { employee_id, name, file_url, type } = req.body || {};
        if (!name || !file_url) {
            return respond(res, { status: 400, success: false, error: 'name and file_url are required' });
        }

        let resolvedEmployeeId = employee_id;
        if (isEmployeeRole(req.user?.role)) {
            const employee = await getEmployeeForUser(req.user.id);
            if (!employee) {
                return respond(res, { status: 404, success: false, error: 'Employee not found' });
            }
            resolvedEmployeeId = employee.id;
        } else if (!isAdminRole(req.user?.role)) {
            return respond(res, { status: 403, success: false, error: 'Unauthorized action' });
        }

        if (!resolvedEmployeeId) {
            return respond(res, { status: 400, success: false, error: 'employee_id is required' });
        }

        const result = await query(
            `INSERT INTO documents (employee_id, name, file_url, type)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [resolvedEmployeeId, name, file_url, type || 'other']
        );

        return respond(res, { data: { document: result.rows[0] } });
    } catch (error) {
        console.error('? HR uploadDocument error:', error);
        return respond(res, { status: 500, success: false, error: 'Failed to upload document' });
    }
};

const deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return respond(res, { status: 400, success: false, error: 'Document ID is required' });
        }

        const result = await query('SELECT * FROM documents WHERE id = $1', [id]);
        const document = result.rows[0];
        if (!document) {
            return respond(res, { status: 404, success: false, error: 'Document not found' });
        }

        if (isEmployeeRole(req.user?.role)) {
            const employee = await getEmployeeForUser(req.user.id);
            if (!employee || employee.id !== document.employee_id) {
                return respond(res, { status: 403, success: false, error: 'Unauthorized action' });
            }
        } else if (!isAdminRole(req.user?.role)) {
            return respond(res, { status: 403, success: false, error: 'Unauthorized action' });
        }

        await query('DELETE FROM documents WHERE id = $1', [id]);
        return respond(res, { data: { id } });
    } catch (error) {
        console.error('? HR deleteDocument error:', error);
        return respond(res, { status: 500, success: false, error: 'Failed to delete document' });
    }
};

const getOnboardingTasks = async (req, res) => {
    try {
        const { employeeId } = req.params;
        if (!employeeId) {
            return respond(res, { status: 400, success: false, error: 'employeeId is required' });
        }

        if (isEmployeeRole(req.user?.role)) {
            const employee = await getEmployeeForUser(req.user.id);
            if (!employee || employee.id !== employeeId) {
                return respond(res, { status: 403, success: false, error: 'Unauthorized action' });
            }
        }

        const result = await query(
            'SELECT * FROM onboarding_tasks WHERE employee_id = $1 ORDER BY due_date NULLS LAST, created_at DESC',
            [employeeId]
        );
        return respond(res, { data: { tasks: result.rows } });
    } catch (error) {
        console.error('? HR getOnboardingTasks error:', error);
        return respond(res, { status: 500, success: false, error: 'Failed to fetch onboarding tasks' });
    }
};

const createOnboardingTask = async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const { employee_id, task_name, due_date, status } = req.body || {};
        if (!employee_id || !task_name) {
            return respond(res, { status: 400, success: false, error: 'employee_id and task_name are required' });
        }

        const result = await query(
            `INSERT INTO onboarding_tasks (employee_id, task_name, status, due_date)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [employee_id, task_name, status || 'pending', due_date || null]
        );

        return respond(res, { data: { task: result.rows[0] } });
    } catch (error) {
        console.error('? HR createOnboardingTask error:', error);
        return respond(res, { status: 500, success: false, error: 'Failed to create onboarding task' });
    }
};

const updateOnboardingTask = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return respond(res, { status: 400, success: false, error: 'Task ID is required' });
        }

        const result = await query('SELECT * FROM onboarding_tasks WHERE id = $1', [id]);
        const task = result.rows[0];
        if (!task) {
            return respond(res, { status: 404, success: false, error: 'Task not found' });
        }

        if (isEmployeeRole(req.user?.role)) {
            const employee = await getEmployeeForUser(req.user.id);
            if (!employee || employee.id !== task.employee_id) {
                return respond(res, { status: 403, success: false, error: 'Unauthorized action' });
            }
            if (req.body?.status && req.body.status !== 'completed') {
                return respond(res, { status: 400, success: false, error: 'Employees can only mark tasks as completed' });
            }
        } else if (!isAdminRole(req.user?.role)) {
            return respond(res, { status: 403, success: false, error: 'Unauthorized action' });
        }

        const allowed = ['task_name', 'status', 'due_date'];
        const updates = [];
        const values = [];
        allowed.forEach((field) => {
            if (req.body?.[field] !== undefined) {
                values.push(req.body[field]);
                updates.push(`${field} = $${values.length}`);
            }
        });

        if (!updates.length) {
            return respond(res, { status: 400, success: false, error: 'No valid fields to update' });
        }

        values.push(id);
        const updateResult = await query(
            `UPDATE onboarding_tasks SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
            values
        );

        return respond(res, { data: { task: updateResult.rows[0] } });
    } catch (error) {
        console.error('? HR updateOnboardingTask error:', error);
        return respond(res, { status: 500, success: false, error: 'Failed to update onboarding task' });
    }
};

const getSettings = async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const result = await query('SELECT * FROM hr_settings ORDER BY updated_at DESC LIMIT 1');
        if (!result.rows[0]) {
            const inserted = await query('INSERT INTO hr_settings DEFAULT VALUES RETURNING *');
            return respond(res, { data: { settings: inserted.rows[0] } });
        }
        return respond(res, { data: { settings: result.rows[0] } });
    } catch (error) {
        console.error('? HR getSettings error:', error);
        return respond(res, { status: 500, success: false, error: 'Failed to fetch HR settings' });
    }
};

const updateSettings = async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const { leave_types, approval_rules } = req.body || {};
        if (leave_types && !Array.isArray(leave_types)) {
            return respond(res, { status: 400, success: false, error: 'leave_types must be an array' });
        }

        const result = await query('SELECT id FROM hr_settings ORDER BY updated_at DESC LIMIT 1');
        if (!result.rows[0]) {
            const inserted = await query(
                'INSERT INTO hr_settings (leave_types, approval_rules) VALUES ($1, $2) RETURNING *',
                [leave_types || ['annual', 'sick', 'other'], approval_rules || {}]
            );
            return respond(res, { data: { settings: inserted.rows[0] } });
        }

        const updated = await query(
            'UPDATE hr_settings SET leave_types = $1, approval_rules = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            [leave_types || result.rows[0].leave_types, approval_rules || result.rows[0].approval_rules, result.rows[0].id]
        );
        return respond(res, { data: { settings: updated.rows[0] } });
    } catch (error) {
        console.error('? HR updateSettings error:', error);
        return respond(res, { status: 500, success: false, error: 'Failed to update HR settings' });
    }
};

module.exports = {
    getEmployees,
    getEmployeeById,
    createEmployee,
    updateEmployee,
    getLeaves,
    createLeave,
    approveLeave: (req, res) => updateLeaveStatus(req, res, 'approved'),
    rejectLeave: (req, res) => updateLeaveStatus(req, res, 'rejected'),
    getDocuments,
    uploadDocument,
    deleteDocument,
    getOnboardingTasks,
    createOnboardingTask,
    updateOnboardingTask,
    getSettings,
    updateSettings
};
