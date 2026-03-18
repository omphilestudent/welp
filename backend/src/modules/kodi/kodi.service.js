const database = require('../../utils/database');
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

const COMPONENT_REGISTRY = [
    // Layout / utility
    { id: 'grid-layout', name: 'GridLayout', label: 'Grid Layout', category: 'Layout', description: 'Grid container for sections.' },
    { id: 'section-card', name: 'SectionCard', label: 'Section Card', category: 'Layout', description: 'Card wrapper for grouped content.' },
    { id: 'tabs', name: 'Tabs', label: 'Tabs', category: 'Layout', description: 'Tabbed content.' },
    { id: 'accordion', name: 'Accordion', label: 'Accordion', category: 'Layout', description: 'Collapsible sections.' },
    { id: 'empty-state', name: 'EmptyState', label: 'Empty State', category: 'Layout', description: 'Placeholder for empty data.' },
    { id: 'spacer', name: 'Spacer', label: 'Spacer', category: 'Layout', description: 'Vertical spacing block.' },
    { id: 'divider', name: 'Divider', label: 'Divider', category: 'Layout', description: 'Section divider.' },
    // Record / data
    { id: 'record-details', name: 'RecordDetails', label: 'Record Details', category: 'Data', description: 'Primary record fields.' },
    { id: 'related-list', name: 'RelatedList', label: 'Related List', category: 'Data', description: 'Related records table.' },
    { id: 'activity-timeline', name: 'ActivityTimeline', label: 'Activity Timeline', category: 'Data', description: 'Recent activity feed.' },
    { id: 'highlights-panel', name: 'HighlightsPanel', label: 'Highlights Panel', category: 'Data', description: 'Key stats and callouts.' },
    { id: 'data-table', name: 'DataTable', label: 'Data Table', category: 'Data', description: 'Tabular data display.' },
    { id: 'card-list', name: 'CardList', label: 'Card List', category: 'Data', description: 'Card-based list.' },
    { id: 'key-value-fields', name: 'KeyValueFields', label: 'Key Value Fields', category: 'Data', description: 'Key/value summary.' },
    { id: 'contact-profile', name: 'ContactProfile', label: 'Contact Profile', category: 'Data', description: 'Contact summary card.' },
    { id: 'subscription-overview', name: 'SubscriptionOverview', label: 'Subscription Overview', category: 'Data', description: 'Subscription summary.' },
    // Domain
    { id: 'employee-panel', name: 'EmployeePanel', label: 'Employee Panel', category: 'Domain', description: 'Employee snapshot.' },
    { id: 'psychologist-profile', name: 'PsychologistProfile', label: 'Psychologist Profile', category: 'Domain', description: 'Psychologist summary.' },
    { id: 'business-info-panel', name: 'BusinessInfoPanel', label: 'Business Info', category: 'Domain', description: 'Business overview.' },
    { id: 'account-summary', name: 'AccountSummary', label: 'Account Summary', category: 'Domain', description: 'Account health summary.' },
    { id: 'application-status', name: 'ApplicationStatusPanel', label: 'Application Status', category: 'Domain', description: 'Application pipeline status.' },
    { id: 'lead-summary', name: 'LeadSummary', label: 'Lead Summary', category: 'Domain', description: 'Lead qualification summary.' },
    { id: 'opportunity-summary', name: 'OpportunitySummary', label: 'Opportunity Summary', category: 'Domain', description: 'Opportunity pipeline summary.' },
    // Actions
    { id: 'action-button', name: 'ActionButton', label: 'Action Button', category: 'Actions', description: 'Primary action CTA.' },
    { id: 'quick-actions', name: 'QuickActionsBar', label: 'Quick Actions Bar', category: 'Actions', description: 'Row of action buttons.' },
    { id: 'link-list', name: 'LinkList', label: 'Link List', category: 'Actions', description: 'List of navigation links.' },
    { id: 'form-panel', name: 'FormPanel', label: 'Form Panel', category: 'Actions', description: 'Embedded form panel.' },
    { id: 'send-email', name: 'SendEmailButton', label: 'Send Email', category: 'Actions', description: 'Email action button.' },
    { id: 'assign-psychologist', name: 'AssignPsychologistButton', label: 'Assign Psychologist', category: 'Actions', description: 'Assignment action.' },
    { id: 'approve-reject', name: 'ApproveRejectPanel', label: 'Approve / Reject', category: 'Actions', description: 'Decision buttons.' }
];

const createPage = async ({ label, pageType, linkedAppId, createdBy }) => {
    const values = [
        label,
        pageType,
        linkedAppId || null,
        DEFAULT_LAYOUT,
        {},
        createdBy || null
    ];

    const result = await database.query(
        `INSERT INTO kodi_pages (label, page_type, status, linked_app_id, layout, settings, created_by)
         VALUES ($1, $2, 'draft', $3, $4, $5, $6)
         RETURNING *`,
        values
    );
    return result.rows[0];
};

const listPages = async () => {
    const result = await database.query(
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
    const result = await database.query(
        `SELECT *
         FROM kodi_pages
         WHERE id = $1`,
        [id]
    );
    return result.rows[0] || null;
};

const updateLayout = async ({ pageId, layout }) => {
    const result = await database.query(
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

    const result = await database.query(
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
    await database.query(
        `INSERT INTO app_page_mapping (app_id, page_id)
         VALUES ($1, $2)
         ON CONFLICT (app_id, page_id) DO NOTHING`,
        [appId, pageId]
    );
    await database.query(
        `UPDATE kodi_pages
         SET linked_app_id = $2
         WHERE id = $1 AND (linked_app_id IS NULL OR linked_app_id <> $2)`,
        [pageId, appId]
    );
};

const findUserByEmail = async (email) => {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return null;
    const result = await database.query(
        `SELECT id, email, display_name, role
         FROM users
         WHERE LOWER(email) = $1`,
        [normalized]
    );
    return result.rows[0] || null;
};

const getAppById = async (appId) => {
    const result = await database.query(
        `SELECT *
         FROM kodi_apps
         WHERE id = $1`,
        [appId]
    );
    return result.rows[0] || null;
};

const getAppPrimaryPage = async (appId) => {
    const result = await database.query(
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
    const assignment = await database.query(
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
    try {
        await sendAppAccessEmail({
            to: user.email,
            name: user.display_name || user.email,
            appName: app.name,
            loginUrl,
            pageUrl: runtimeUrl,
            pageName: page?.label || null,
            permissions
        });
        console.log(`✅ Kodi access email sent to ${user.email} for app ${app.name}`);
        await database.query(
            `INSERT INTO email_delivery_logs (trigger_key, recipient_email, recipient_user_id, recipient_type, subject, status, metadata, sent_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
                'kodi_app_assignment',
                user.email,
                user.id,
                user.role || 'user',
                `Kodi access granted: ${app.name}`,
                'sent',
                JSON.stringify({ appId, pageId: page?.id || null }),
                new Date()
            ]
        );
    } catch (error) {
        console.warn(`⚠️ Kodi access email failed for ${user.email}: ${error.message}`);
        await database.query(
            `INSERT INTO email_delivery_logs (trigger_key, recipient_email, recipient_user_id, recipient_type, subject, status, error_message, metadata)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
                'kodi_app_assignment',
                user.email,
                user.id,
                user.role || 'user',
                `Kodi access granted: ${app.name}`,
                'failed',
                error.message,
                JSON.stringify({ appId, pageId: page?.id || null })
            ]
        );
    }
    return { assignment: assignment.rows[0], user, page };
};

const listAppUsers = async (appId) => {
    const result = await database.query(
        `SELECT au.*, u.email, u.display_name, u.role
         FROM kodi_app_users au
         JOIN users u ON u.id = au.user_id
         WHERE au.app_id = $1
         ORDER BY au.created_at DESC`,
        [appId]
    );
    return result.rows;
};

const assignUserToPage = async ({ pageId, email, permissions = {}, assignedBy }) => {
    const page = await getPageById(pageId);
    if (!page) {
        throw new Error('Page not found');
    }
    const user = await findUserByEmail(email);
    if (!user) {
        throw new Error('User not found');
    }
    const assignment = await database.query(
        `INSERT INTO kodi_page_users (page_id, user_id, permissions, assigned_by)
         VALUES ($1, $2, $3::jsonb, $4)
         ON CONFLICT (page_id, user_id) DO UPDATE
             SET permissions = EXCLUDED.permissions,
                 updated_at = CURRENT_TIMESTAMP,
                 assigned_by = COALESCE(EXCLUDED.assigned_by, kodi_page_users.assigned_by)
         RETURNING *`,
        [pageId, user.id, permissions, assignedBy || null]
    );
    const baseUrl = process.env.FRONTEND_URL || process.env.SITE_URL || 'https://welphub.onrender.com';
    const loginUrl = `${baseUrl}/login`;
    const runtimeUrl = `${baseUrl}/kodi/runtime/${page.id}`;
    try {
        await sendAppAccessEmail({
            to: user.email,
            name: user.display_name || user.email,
            appName: page.label,
            loginUrl,
            pageUrl: runtimeUrl,
            pageName: page.label,
            permissions
        });
        console.log(`✅ Kodi page access email sent to ${user.email} for page ${page.label}`);
        await database.query(
            `INSERT INTO email_delivery_logs (trigger_key, recipient_email, recipient_user_id, recipient_type, subject, status, metadata, sent_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
                'kodi_page_assignment',
                user.email,
                user.id,
                user.role || 'user',
                `Kodi page access granted: ${page.label}`,
                'sent',
                JSON.stringify({ pageId }),
                new Date()
            ]
        );
    } catch (error) {
        console.warn(`⚠️ Kodi page access email failed for ${user.email}: ${error.message}`);
        await database.query(
            `INSERT INTO email_delivery_logs (trigger_key, recipient_email, recipient_user_id, recipient_type, subject, status, error_message, metadata)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
                'kodi_page_assignment',
                user.email,
                user.id,
                user.role || 'user',
                `Kodi page access granted: ${page.label}`,
                'failed',
                error.message,
                JSON.stringify({ pageId })
            ]
        );
    }
    return { assignment: assignment.rows[0], user, page };
};

const listPageUsers = async (pageId) => {
    const result = await database.query(
        `SELECT pu.*, u.email, u.display_name, u.role
         FROM kodi_page_users pu
         JOIN users u ON u.id = pu.user_id
         WHERE pu.page_id = $1
         ORDER BY pu.created_at DESC`,
        [pageId]
    );
    return result.rows;
};

const listObjects = async () => {
    const result = await database.query(
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
    const result = await database.query(
        `SELECT *
         FROM kodi_fields
         WHERE object_id = $1
         ORDER BY field_name`,
        [objectId]
    );
    return result.rows;
};

const listPermissions = async (pageId) => {
    const result = await database.query(
        `SELECT role, can_view, can_edit, can_use
         FROM kodi_permissions
         WHERE page_id = $1`,
        [pageId]
    );
    return result.rows;
};

const listComponentRegistry = async () => COMPONENT_REGISTRY.map((component) => ({
    ...component,
    defaultLayout: { width: 6, height: 2, minWidth: 2, maxWidth: 12 },
    defaultProps: { title: component.label }
}));

const listApps = async () => {
    const result = await database.query(
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
         ORDER BY a.name`
    );
    return result.rows;
};

const createApp = async ({ name, description }) => {
    const result = await database.query(
        `INSERT INTO kodi_apps (name, description)
         VALUES ($1, $2)
         RETURNING *`,
        [name, description || null]
    );
    return result.rows[0];
};

const updateApp = async ({ appId, name, description, isActive }) => {
    const updates = [];
    const values = [];
    let idx = 1;
    if (name !== undefined) {
        updates.push(`name = $${idx++}`);
        values.push(name);
    }
    if (description !== undefined) {
        updates.push(`description = $${idx++}`);
        values.push(description);
    }
    if (isActive !== undefined) {
        updates.push(`is_active = $${idx++}`);
        values.push(Boolean(isActive));
    }
    if (!updates.length) return null;
    values.push(appId);
    const result = await database.query(
        `UPDATE kodi_apps SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *`,
        values
    );
    return result.rows[0] || null;
};

const createLead = async ({ name, email, status, applicationStatus, source }) => {
    const result = await database.query(
        `INSERT INTO leads (name, email, status, application_status, source)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [name, email || null, status || 'incomplete', applicationStatus || 'incomplete', source || null]
    );
    return result.rows[0] || null;
};

const listLeads = async () => {
    const result = await database.query(
        `SELECT * FROM leads ORDER BY created_at DESC`
    );
    return result.rows;
};

const createOpportunity = async ({ leadId, stage, owner, value }) => {
    const result = await database.query(
        `INSERT INTO opportunities (lead_id, stage, owner, value)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [leadId, stage || 'prospecting', owner || null, value || null]
    );
    return result.rows[0] || null;
};

const convertLead = async ({ leadId, stage, owner, value }) => {
    const opportunity = await createOpportunity({ leadId, stage, owner, value });
    await database.query(
        `UPDATE leads
         SET status = 'converted'
         WHERE id = $1`,
        [leadId]
    );
    return opportunity;
};

const listOpportunities = async (leadId) => {
    const result = await database.query(
        `SELECT * FROM opportunities
         WHERE lead_id = $1
         ORDER BY created_at DESC`,
        [leadId]
    );
    return result.rows;
};

const createObject = async ({ name, label, description, metadata }) => {
    const result = await database.query(
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
    const result = await database.query(
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
    await database.query(
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
    updateApp,
    assignUserToApp,
    listAppUsers,
    assignUserToPage,
    listPageUsers,
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
    listComponentRegistry,
    DEFAULT_LAYOUT,
    getAppById
};
