const { query } = require('../utils/database');
const { sendEmail } = require('../utils/emailService');
const kodiPlatformService = require('../modules/kodi/kodi.service');

const ROLE_ACCESS = {
    customer_service: ['applications', 'cases', 'ads'],
    hr: ['applications'],
    sales: ['applications', 'cases'],
    admin: ['applications', 'cases', 'ads', 'components', 'employees'],
    super_admin: ['applications', 'cases', 'ads', 'components', 'employees']
};

const isAdminRole = (role = '') => ['admin', 'super_admin'].includes(String(role).toLowerCase());

const hasAccess = (role, section) => {
    const normalized = String(role || '').toLowerCase();
    return (ROLE_ACCESS[normalized] || []).includes(section);
};

const audit = async ({ entityType, entityId, action, performedBy, notes }) => {
    try {
        await query(
            `INSERT INTO kodi_audit_logs (entity_type, entity_id, action, performed_by_user_id, notes)
             VALUES ($1, $2, $3, $4, $5)`,
            [entityType, entityId, action, performedBy || null, notes || null]
        );
    } catch (error) {
        console.warn('Kodi audit log failed:', error.message);
    }
};

const notify = async ({ toEmail, subject, html, text }) => {
    if (!toEmail) return;
    await sendEmail({ to: toEmail, subject, html, text });
};

const getEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(
            `SELECT id, email, display_name, role, is_active, created_at
             FROM users
             WHERE id = $1`,
            [id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Employee not found' });
        }
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Get employee error:', error);
        return res.status(500).json({ success: false, error: 'Failed to load employee' });
    }
};

const createEmployee = async (req, res) => {
    try {
        if (!isAdminRole(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        const { email, displayName, role } = req.body || {};
        if (!email || !role) {
            return res.status(400).json({ success: false, error: 'email and role are required' });
        }
        const result = await query(
            `UPDATE users
             SET role = $1, display_name = COALESCE(display_name, $2), is_active = true, updated_at = CURRENT_TIMESTAMP
             WHERE email = $3
             RETURNING id, email, display_name, role, is_active`,
            [role, displayName || email.split('@')[0], email.toLowerCase()]
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        await audit({
            entityType: 'employee',
            entityId: result.rows[0].id,
            action: 'role_update',
            performedBy: req.user.id,
            notes: `Assigned role ${role}`
        });
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Create employee error:', error);
        return res.status(500).json({ success: false, error: 'Failed to create employee' });
    }
};

const updateEmployee = async (req, res) => {
    try {
        if (!isAdminRole(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        const { id } = req.params;
        const { role, isActive } = req.body || {};
        const updates = [];
        const values = [];
        let idx = 1;
        if (role) {
            updates.push(`role = $${idx++}`);
            values.push(role);
        }
        if (isActive !== undefined) {
            updates.push(`is_active = $${idx++}`);
            values.push(Boolean(isActive));
        }
        if (!updates.length) {
            return res.status(400).json({ success: false, error: 'No updates provided' });
        }
        values.push(id);
        const result = await query(
            `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING id, email, display_name, role, is_active`,
            values
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Employee not found' });
        }
        await audit({
            entityType: 'employee',
            entityId: id,
            action: 'role_update',
            performedBy: req.user.id,
            notes: 'Employee updated'
        });
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Update employee error:', error);
        return res.status(500).json({ success: false, error: 'Failed to update employee' });
    }
};

const deactivateEmployee = async (req, res) => {
    try {
        if (!isAdminRole(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        const { id } = req.params;
        await query(
            `UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [id]
        );
        await audit({
            entityType: 'employee',
            entityId: id,
            action: 'deactivated',
            performedBy: req.user.id,
            notes: 'Employee deactivated'
        });
        return res.json({ success: true });
    } catch (error) {
        console.error('Deactivate employee error:', error);
        return res.status(500).json({ success: false, error: 'Failed to deactivate employee' });
    }
};

const listApplications = async (req, res) => {
    try {
        if (!hasAccess(req.user.role, 'applications')) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        const { status } = req.query || {};
        const values = [];
        let whereClause = '';
        if (status) {
            values.push(status);
            whereClause = `WHERE approval_status = $1`;
        }
        if (req.user.role === 'sales') {
            values.push('approved');
            whereClause = values.length
                ? `${whereClause} AND approval_status = $${values.length}`
                : `WHERE approval_status = $${values.length}`;
        }
        const result = await query(
            `SELECT a.*, u.display_name as submitted_by_name
             FROM kodi_client_applications a
             LEFT JOIN users u ON a.submitted_by_user_id = u.id
             ${whereClause}
             ORDER BY a.updated_at DESC`,
            values
        );
        return res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('List applications error:', error);
        return res.status(500).json({ success: false, error: 'Failed to load applications' });
    }
};

const getApplication = async (req, res) => {
    try {
        if (!hasAccess(req.user.role, 'applications')) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        const result = await query(
            `SELECT a.*, u.display_name as submitted_by_name
             FROM kodi_client_applications a
             LEFT JOIN users u ON a.submitted_by_user_id = u.id
             WHERE a.id = $1`,
            [req.params.id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Application not found' });
        }
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Get application error:', error);
        return res.status(500).json({ success: false, error: 'Failed to load application' });
    }
};

const createApplication = async (req, res) => {
    try {
        if (!hasAccess(req.user.role, 'applications')) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        const { clientName, documents, contactEmail } = req.body || {};
        if (!clientName) {
            return res.status(400).json({ success: false, error: 'clientName is required' });
        }
        const result = await query(
            `INSERT INTO kodi_client_applications (client_name, submitted_by_user_id, documents)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [clientName, req.user.id, JSON.stringify(documents || [])]
        );
        if (!Array.isArray(documents) || documents.length === 0) {
            await kodiPlatformService.createLead({
                name: clientName,
                email: contactEmail || null,
                status: 'incomplete',
                applicationStatus: 'incomplete',
                source: 'application_start'
            });
        }
        await audit({
            entityType: 'application',
            entityId: result.rows[0].id,
            action: 'created',
            performedBy: req.user.id,
            notes: `Application created for ${clientName}`
        });
        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Create application error:', error);
        return res.status(500).json({ success: false, error: 'Failed to create application' });
    }
};

const updateApplicationStatus = async (req, res, status) => {
    try {
        if (!hasAccess(req.user.role, 'applications')) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }
        const result = await query(
            `UPDATE kodi_client_applications
             SET approval_status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [status, req.params.id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Application not found' });
        }
        await audit({
            entityType: 'application',
            entityId: result.rows[0].id,
            action: `status_${status}`,
            performedBy: req.user.id,
            notes: `Application ${status}`
        });
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Update application status error:', error);
        return res.status(500).json({ success: false, error: 'Failed to update application' });
    }
};

const deleteApplication = async (req, res) => {
    try {
        if (!isAdminRole(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        await query('DELETE FROM kodi_client_applications WHERE id = $1', [req.params.id]);
        await audit({
            entityType: 'application',
            entityId: req.params.id,
            action: 'deleted',
            performedBy: req.user.id,
            notes: 'Application deleted'
        });
        return res.json({ success: true });
    } catch (error) {
        console.error('Delete application error:', error);
        return res.status(500).json({ success: false, error: 'Failed to delete application' });
    }
};

const listCases = async (req, res) => {
    try {
        if (!hasAccess(req.user.role, 'cases')) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        const { status } = req.query || {};
        const values = [];
        let whereClause = '';
        if (status) {
            values.push(status);
            whereClause = `WHERE c.status = $1`;
        }
        const result = await query(
            `SELECT c.*,
                    a.client_name,
                    u.display_name as created_by_name
             FROM kodi_cases c
             LEFT JOIN kodi_client_applications a ON c.client_application_id = a.id
             LEFT JOIN users u ON c.created_by_user_id = u.id
             ${whereClause}
             ORDER BY c.updated_at DESC`,
            values
        );
        return res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('List cases error:', error);
        return res.status(500).json({ success: false, error: 'Failed to load cases' });
    }
};

const createCase = async (req, res) => {
    try {
        if (!hasAccess(req.user.role, 'cases')) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        const { clientApplicationId, priority, notes } = req.body || {};
        if (!clientApplicationId) {
            return res.status(400).json({ success: false, error: 'clientApplicationId is required' });
        }
        const result = await query(
            `INSERT INTO kodi_cases (created_by_user_id, client_application_id, status, priority, notes)
             VALUES ($1, $2, 'open', $3, $4)
             RETURNING *`,
            [req.user.id, clientApplicationId, priority || 'medium', notes || null]
        );
        await audit({
            entityType: 'case',
            entityId: result.rows[0].id,
            action: 'created',
            performedBy: req.user.id,
            notes: 'Case created'
        });
        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Create case error:', error);
        return res.status(500).json({ success: false, error: 'Failed to create case' });
    }
};

const updateCase = async (req, res) => {
    try {
        if (!hasAccess(req.user.role, 'cases')) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        const { status, priority, notes } = req.body || {};
        const updates = [];
        const values = [];
        let idx = 1;
        if (status) {
            updates.push(`status = $${idx++}`);
            values.push(status);
        }
        if (priority) {
            updates.push(`priority = $${idx++}`);
            values.push(priority);
        }
        if (notes !== undefined) {
            updates.push(`notes = $${idx++}`);
            values.push(notes || null);
        }
        if (!updates.length) {
            return res.status(400).json({ success: false, error: 'No updates provided' });
        }
        values.push(req.params.id);
        const result = await query(
            `UPDATE kodi_cases
             SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${idx}
             RETURNING *`,
            values
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Case not found' });
        }
        await audit({
            entityType: 'case',
            entityId: result.rows[0].id,
            action: `updated`,
            performedBy: req.user.id,
            notes: `Case updated`
        });
        if (status === 'escalated') {
            await audit({
                entityType: 'case',
                entityId: result.rows[0].id,
                action: 'escalated',
                performedBy: req.user.id,
                notes: 'Case escalated'
            });
        }
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Update case error:', error);
        return res.status(500).json({ success: false, error: 'Failed to update case' });
    }
};

const deleteCase = async (req, res) => {
    try {
        if (!isAdminRole(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        await query('DELETE FROM kodi_cases WHERE id = $1', [req.params.id]);
        await audit({
            entityType: 'case',
            entityId: req.params.id,
            action: 'deleted',
            performedBy: req.user.id,
            notes: 'Case deleted'
        });
        return res.json({ success: true });
    } catch (error) {
        console.error('Delete case error:', error);
        return res.status(500).json({ success: false, error: 'Failed to delete case' });
    }
};

const listAds = async (req, res) => {
    try {
        if (!hasAccess(req.user.role, 'ads')) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        const { status } = req.query || {};
        const values = [];
        let whereClause = '';
        if (status) {
            values.push(status);
            whereClause = `WHERE a.status = $1`;
        }
        const result = await query(
            `SELECT a.*, u.display_name as submitted_by_name
             FROM kodi_ads a
             LEFT JOIN users u ON a.submitted_by_user_id = u.id
             ${whereClause}
             ORDER BY a.updated_at DESC`,
            values
        );
        return res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('List ads error:', error);
        return res.status(500).json({ success: false, error: 'Failed to load ads' });
    }
};

const createAd = async (req, res) => {
    try {
        if (!hasAccess(req.user.role, 'ads')) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        const { content } = req.body || {};
        const result = await query(
            `INSERT INTO kodi_ads (submitted_by_user_id, content)
             VALUES ($1, $2)
             RETURNING *`,
            [req.user.id, JSON.stringify(content || {})]
        );
        await audit({
            entityType: 'ad',
            entityId: result.rows[0].id,
            action: 'created',
            performedBy: req.user.id,
            notes: 'Ad created'
        });
        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Create ad error:', error);
        return res.status(500).json({ success: false, error: 'Failed to create ad' });
    }
};

const updateAdStatus = async (req, res) => {
    try {
        if (!hasAccess(req.user.role, 'ads')) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        const { status } = req.body || {};
        if (!['pending', 'reviewed', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }
        const result = await query(
            `UPDATE kodi_ads
             SET status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [status, req.params.id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Ad not found' });
        }
        await audit({
            entityType: 'ad',
            entityId: result.rows[0].id,
            action: `status_${status}`,
            performedBy: req.user.id,
            notes: `Ad status ${status}`
        });
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Update ad error:', error);
        return res.status(500).json({ success: false, error: 'Failed to update ad' });
    }
};

const deleteAd = async (req, res) => {
    try {
        if (!isAdminRole(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        await query('DELETE FROM kodi_ads WHERE id = $1', [req.params.id]);
        await audit({
            entityType: 'ad',
            entityId: req.params.id,
            action: 'deleted',
            performedBy: req.user.id,
            notes: 'Ad deleted'
        });
        return res.json({ success: true });
    } catch (error) {
        console.error('Delete ad error:', error);
        return res.status(500).json({ success: false, error: 'Failed to delete ad' });
    }
};

const listComponents = async (req, res) => {
    try {
        if (!hasAccess(req.user.role, 'components')) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        const result = await query(
            `SELECT c.*, u.display_name as created_by_name
             FROM kodi_components c
             LEFT JOIN users u ON c.created_by_user_id = u.id
             ORDER BY c.updated_at DESC`
        );
        return res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('List components error:', error);
        return res.status(500).json({ success: false, error: 'Failed to load components' });
    }
};

const createComponent = async (req, res) => {
    try {
        if (!hasAccess(req.user.role, 'components')) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        const { componentName, componentType, code } = req.body || {};
        if (!componentName || !componentType || !code) {
            return res.status(400).json({ success: false, error: 'componentName, componentType, and code are required' });
        }
        const result = await query(
            `INSERT INTO kodi_components (component_name, component_type, code, created_by_user_id)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [componentName, componentType, code, req.user.id]
        );
        await audit({
            entityType: 'component',
            entityId: result.rows[0].id,
            action: 'created',
            performedBy: req.user.id,
            notes: `Component ${componentName} created`
        });
        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Create component error:', error);
        return res.status(500).json({ success: false, error: 'Failed to create component' });
    }
};

const updateComponent = async (req, res) => {
    try {
        if (!hasAccess(req.user.role, 'components')) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        const { code } = req.body || {};
        if (!code) {
            return res.status(400).json({ success: false, error: 'code is required' });
        }
        const result = await query(
            `UPDATE kodi_components
             SET code = $1, version = version + 1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [code, req.params.id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Component not found' });
        }
        await audit({
            entityType: 'component',
            entityId: result.rows[0].id,
            action: 'updated',
            performedBy: req.user.id,
            notes: 'Component updated'
        });
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Update component error:', error);
        return res.status(500).json({ success: false, error: 'Failed to update component' });
    }
};

const deleteComponent = async (req, res) => {
    try {
        if (!isAdminRole(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        await query('DELETE FROM kodi_components WHERE id = $1', [req.params.id]);
        await audit({
            entityType: 'component',
            entityId: req.params.id,
            action: 'deleted',
            performedBy: req.user.id,
            notes: 'Component deleted'
        });
        return res.json({ success: true });
    } catch (error) {
        console.error('Delete component error:', error);
        return res.status(500).json({ success: false, error: 'Failed to delete component' });
    }
};

const listAuditLogs = async (req, res) => {
    try {
        if (!isAdminRole(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        const result = await query(
            `SELECT l.*, u.display_name as performed_by_name
             FROM kodi_audit_logs l
             LEFT JOIN users u ON l.performed_by_user_id = u.id
             ORDER BY l.created_at DESC
             LIMIT 200`
        );
        return res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('List audit logs error:', error);
        return res.status(500).json({ success: false, error: 'Failed to load audit logs' });
    }
};

module.exports = {
    getEmployee,
    createEmployee,
    updateEmployee,
    deactivateEmployee,
    listApplications,
    getApplication,
    createApplication,
    approveApplication: (req, res) => updateApplicationStatus(req, res, 'approved'),
    rejectApplication: (req, res) => updateApplicationStatus(req, res, 'rejected'),
    deleteApplication,
    listCases,
    createCase,
    updateCase,
    deleteCase,
    listAds,
    createAd,
    updateAdStatus,
    deleteAd,
    listComponents,
    createComponent,
    updateComponent,
    deleteComponent,
    listAuditLogs
};
