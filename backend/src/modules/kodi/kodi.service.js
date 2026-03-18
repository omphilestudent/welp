const { query } = require('../../utils/database');
const { sendAppAccessEmail } = require('../../utils/emailService');

const DEFAULT_LAYOUT = {
    type: '1-column',
    orientation: 'horizontal',
    rows: [
        {
            id: 'row-default',
            columns: [
                {
                    id: 'col-default',
                    width: 12,
                    components: []
                }
            ]
        }
    ]
};

const createPage = async ({ label, pageType, linkedAppId, createdBy }) => {
    const values = [
        label,
        pageType,
        linkedAppId || null,
        DEFAULT_LAYOUT,
        {},
        createdBy || null
    ];

    const result = await query(
        `INSERT INTO kodi_pages (label, page_type, status, linked_app_id, layout, settings, created_by)
         VALUES ($1, $2, 'draft', $3, $4, $5, $6)
         RETURNING *`,
        values
    );
    return result.rows[0];
};

const listPages = async () => {
    const result = await query(
        `SELECT p.*,
                a.name AS app_name,
                COALESCE(u.display_name, u.email, 'System') AS created_by_name
         FROM kodi_pages p
         LEFT JOIN kodi_apps a ON a.id = p.linked_app_id
         LEFT JOIN users u ON u.id = p.created_by
         ORDER BY p.created_at DESC`
    );
    return result.rows;
};

const getPageById = async (id) => {
    const result = await query(
        `SELECT *
         FROM kodi_pages
         WHERE id = $1`,
        [id]
    );
    return result.rows[0] || null;
};

const updateLayout = async ({ pageId, layout }) => {
    const result = await query(
        `UPDATE kodi_pages
         SET layout = $2,
             status = 'built',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [pageId, layout]
    );
    return result.rows[0] || null;
};

const activatePage = async ({ pageId }) => {
    const page = await getPageById(pageId);
    if (!page) return null;

    const result = await query(
        `UPDATE kodi_pages
         SET status = 'activated',
             activated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [pageId]
    );
    return result.rows[0] || null;
};

const linkPageToApp = async ({ pageId, appId }) => {
    await query(
        `INSERT INTO app_page_mapping (app_id, page_id)
         VALUES ($1, $2)
         ON CONFLICT (app_id, page_id) DO NOTHING`,
        [appId, pageId]
    );
};

const findUserByEmail = async (email) => {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return null;
    const result = await query(
        `SELECT id, email, display_name, role
         FROM users
         WHERE LOWER(email) = $1`,
        [normalized]
    );
    return result.rows[0] || null;
};

const getAppById = async (appId) => {
    const result = await query(
        `SELECT *
         FROM kodi_apps
         WHERE id = $1`,
        [appId]
    );
    return result.rows[0] || null;
};

const getAppPrimaryPage = async (appId) => {
    const result = await query(
        `SELECT p.id, p.label, p.page_type, p.status
         FROM kodi_pages p
         JOIN app_page_mapping m ON p.id = m.page_id
         WHERE m.app_id = $1 AND p.status = 'activated'
         ORDER BY p.activated_at DESC NULLS LAST
         LIMIT 1`,
        [appId]
    );
    return result.rows[0] || null;
};

const assignUserToApp = async ({ appId, email, permissions = {}, assignedBy }) => {
    const app = await getAppById(appId);
    if (!app) {
        throw new Error('App not found');
    }
    const user = await findUserByEmail(email);
    if (!user) {
        throw new Error('User not found');
    }
    const assignment = await query(
        `INSERT INTO kodi_app_users (app_id, user_id, permissions, assigned_by)
         VALUES ($1, $2, $3::jsonb, $4)
         ON CONFLICT (app_id, user_id) DO UPDATE
             SET permissions = EXCLUDED.permissions,
                 updated_at = CURRENT_TIMESTAMP,
                 assigned_by = COALESCE(EXCLUDED.assigned_by, kodi_app_users.assigned_by)
         RETURNING *`,
        [appId, user.id, permissions, assignedBy || null]
    );
    const page = await getAppPrimaryPage(appId);
    const baseUrl = process.env.FRONTEND_URL || process.env.SITE_URL || 'https://welphub.onrender.com';
    const loginUrl = `${baseUrl}/login`;
    const runtimeUrl = page ? `${baseUrl}/kodi/runtime/${page.id}` : null;
    await sendAppAccessEmail({
        to: user.email,
        name: user.display_name || user.email,
        appName: app.name,
        loginUrl,
        pageUrl: runtimeUrl,
        permissions
    });
    return { assignment: assignment.rows[0], user, page };
};

const listAppUsers = async (appId) => {
    const result = await query(
        `SELECT au.*, u.email, u.display_name, u.role
         FROM kodi_app_users au
         JOIN users u ON u.id = au.user_id
         WHERE au.app_id = $1
         ORDER BY au.created_at DESC`,
        [appId]
    );
    return result.rows;
};

const listObjects = async () => {
    const result = await query(
        `SELECT o.*,
                COALESCE(f.fields, '[]') AS fields
         FROM kodi_objects o
         LEFT JOIN (
             SELECT object_id,
                    jsonb_agg(jsonb_build_object(
                        'id', id,
                        'field_name', field_name,
                        'field_type', field_type,
                        'is_required', is_required,
                        'is_readonly', is_readonly
                    ) ORDER BY field_name) AS fields
             FROM kodi_fields
             GROUP BY object_id
         ) f ON f.object_id = o.id
         ORDER BY o.label`
    );
    return result.rows;
};

const listObjectFields = async (objectId) => {
    const result = await query(
        `SELECT *
         FROM kodi_fields
         WHERE object_id = $1
         ORDER BY field_name`,
        [objectId]
    );
    return result.rows;
};

const listPermissions = async (pageId) => {
    const result = await query(
        `SELECT role, can_view, can_edit, can_use
         FROM kodi_permissions
         WHERE page_id = $1`,
        [pageId]
    );
    return result.rows;
};

const listApps = async () => {
    const result = await query(
        `SELECT a.*,
                COALESCE(lp.linked_pages, '[]') AS linked_pages,
                COALESCE(au.assigned_users, '[]') AS assigned_users
         FROM kodi_apps a
         LEFT JOIN (
             SELECT m.app_id,
                    jsonb_agg(jsonb_build_object(
                        'id', p.id,
                        'label', p.label,
                        'page_type', p.page_type,
                        'status', p.status,
                        'activated_at', p.activated_at
                    ) ORDER BY p.created_at DESC) AS linked_pages
             FROM app_page_mapping m
             JOIN kodi_pages p ON p.id = m.page_id
             GROUP BY m.app_id
         ) lp ON lp.app_id = a.id
         LEFT JOIN (
             SELECT au.app_id,
                    jsonb_agg(jsonb_build_object(
                        'id', u.id,
                        'email', u.email,
                        'display_name', u.display_name,
                        'role', u.role,
                        'permissions', au.permissions,
                        'assigned_at', au.created_at
                    ) ORDER BY au.created_at DESC) AS assigned_users
             FROM kodi_app_users au
             JOIN users u ON u.id = au.user_id
             GROUP BY au.app_id
         ) au ON au.app_id = a.id
         WHERE a.is_active = true
         ORDER BY a.name`
    );
    return result.rows;
};

const createApp = async ({ name, description }) => {
    const result = await query(
        `INSERT INTO kodi_apps (name, description)
         VALUES ($1, $2)
         RETURNING *`,
        [name, description || null]
    );
    return result.rows[0];
};

const createLead = async ({ name, email, status }) => {
    const result = await query(
        `INSERT INTO leads (name, email, status)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name, email || null, status || 'incomplete']
    );
    return result.rows[0] || null;
};

const listLeads = async () => {
    const result = await query(
        `SELECT * FROM leads ORDER BY created_at DESC`
    );
    return result.rows;
};

const createOpportunity = async ({ leadId, stage }) => {
    const result = await query(
        `INSERT INTO opportunities (lead_id, stage)
         VALUES ($1, $2)
         RETURNING *`,
        [leadId, stage || 'prospecting']
    );
    return result.rows[0] || null;
};

const convertLead = async ({ leadId, stage }) => {
    const opportunity = await createOpportunity({ leadId, stage });
    await query(
        `UPDATE leads
         SET status = 'converted'
         WHERE id = $1`,
        [leadId]
    );
    return opportunity;
};

const listOpportunities = async (leadId) => {
    const result = await query(
        `SELECT * FROM opportunities
         WHERE lead_id = $1
         ORDER BY created_at DESC`,
        [leadId]
    );
    return result.rows;
};

const createObject = async ({ name, label, description, metadata }) => {
    const result = await query(
        `INSERT INTO kodi_objects (name, label, description, metadata)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (name) DO UPDATE
             SET label = EXCLUDED.label,
                 description = COALESCE(EXCLUDED.description, kodi_objects.description),
                 metadata = COALESCE(EXCLUDED.metadata, kodi_objects.metadata)
         RETURNING *`,
        [name, label, description || null, JSON.stringify(metadata || {})]
    );
    return result.rows[0] || null;
};

const createField = async ({ objectId, fieldName, fieldType, isRequired, isReadonly }) => {
    const result = await query(
        `INSERT INTO kodi_fields (object_id, field_name, field_type, is_required, is_readonly)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (object_id, field_name) DO UPDATE
             SET field_type = EXCLUDED.field_type,
                 is_required = EXCLUDED.is_required,
                 is_readonly = EXCLUDED.is_readonly
         RETURNING *`,
        [objectId, fieldName, fieldType, Boolean(isRequired), Boolean(isReadonly)]
    );
    return result.rows[0] || null;
};

const insertPermission = async ({ role, pageId, canView, canEdit, canUse }) => {
    await query(
        `INSERT INTO kodi_permissions (role, page_id, can_view, can_edit, can_use)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (role, page_id) DO UPDATE
             SET can_view = EXCLUDED.can_view,
                 can_edit = EXCLUDED.can_edit,
                 can_use = EXCLUDED.can_use`,
        [role, pageId, Boolean(canView), Boolean(canEdit), Boolean(canUse)]
    );
};

module.exports = {
    createPage,
    listPages,
    getPageById,
    updateLayout,
    activatePage,
    linkPageToApp,
    listPermissions,
    listApps,
    createApp,
    assignUserToApp,
    listAppUsers,
    createLead,
    listLeads,
    createOpportunity,
    convertLead,
    listOpportunities,
    listObjects,
    listObjectFields,
    createObject,
    createField,
    insertPermission,
    DEFAULT_LAYOUT
};
