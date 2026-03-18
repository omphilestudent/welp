const { query } = require('../../utils/database');

const DEFAULT_LAYOUT = {
    type: '1-column',
    orientation: 'horizontal',
    columns: [
        {
            width: 12,
            components: []
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
        `SELECT p.*, a.name AS app_name
         FROM kodi_pages p
         LEFT JOIN kodi_apps a ON a.id = p.linked_app_id
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
        `SELECT *
         FROM kodi_apps
         WHERE is_active = true
         ORDER BY name`
    );
    return result.rows;
};

const createObject = async ({ name, label, description }) => {
    const result = await query(
        `INSERT INTO kodi_objects (name, label, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO NOTHING
         RETURNING *`,
        [name, label, description || null]
    );
    return result.rows[0] || null;
};

const createField = async ({ objectId, fieldName, fieldType, isRequired, isReadonly }) => {
    const result = await query(
        `INSERT INTO kodi_fields (object_id, field_name, field_type, is_required, is_readonly)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (object_id, field_name) DO NOTHING
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
    createObject,
    createField,
    insertPermission,
    DEFAULT_LAYOUT
};
