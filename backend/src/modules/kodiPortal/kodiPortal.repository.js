const database = require('../../utils/database');

const query = (text, params) => database.query(text, params);

const getAppById = async (appId) => {
    const result = await query(
        `SELECT *
         FROM kodi_apps
         WHERE id = $1`,
        [appId]
    );
    return result.rows[0] || null;
};

const listApps = async () => {
    const result = await query(
        `SELECT *
         FROM kodi_apps
         ORDER BY name`
    );
    return result.rows;
};

const createApp = async ({ name, label, description, icon, themeConfig, navigationMode, landingBehavior, settings }) => {
    const result = await query(
        `INSERT INTO kodi_apps (name, label, description, icon, theme_config, navigation_mode, landing_behavior, settings, status)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb, 'draft')
         RETURNING *`,
        [
            name,
            label || name,
            description || null,
            icon || null,
            themeConfig || {},
            navigationMode || 'sidebar',
            landingBehavior || 'default_page',
            settings || {}
        ]
    );
    return result.rows[0] || null;
};

const updateApp = async ({ appId, updates }) => {
    const fields = [];
    const values = [];
    let idx = 1;
    const addField = (sql, value) => {
        fields.push(sql.replace('?', `$${idx++}`));
        values.push(value);
    };
    if (updates.name !== undefined) addField('name = ?', updates.name);
    if (updates.label !== undefined) addField('label = ?', updates.label);
    if (updates.description !== undefined) addField('description = ?', updates.description);
    if (updates.icon !== undefined) addField('icon = ?', updates.icon);
    if (updates.theme_config !== undefined) addField('theme_config = ?::jsonb', updates.theme_config);
    if (updates.navigation_mode !== undefined) addField('navigation_mode = ?', updates.navigation_mode);
    if (updates.landing_behavior !== undefined) addField('landing_behavior = ?', updates.landing_behavior);
    if (updates.settings !== undefined) addField('settings = ?::jsonb', updates.settings);
    if (updates.status !== undefined) addField('status = ?', updates.status);
    if (updates.default_page_id !== undefined) addField('default_page_id = ?', updates.default_page_id);
    if (!fields.length) return null;
    values.push(appId);
    const result = await query(
        `UPDATE kodi_apps
         SET ${fields.join(', ')},
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $${idx}
         RETURNING *`,
        values
    );
    return result.rows[0] || null;
};

const listAppUsers = async (appId) => {
    const result = await query(
        `SELECT au.*, u.email, u.display_name, u.role, ws.staff_role_key
         FROM kodi_app_users au
         JOIN users u ON u.id = au.user_id
         LEFT JOIN welp_staff ws ON ws.user_id = u.id AND ws.is_active = true
         WHERE au.app_id = $1
           AND (ws.user_id IS NOT NULL OR u.role IN ('admin', 'super_admin', 'hr_admin', 'welp_employee'))
         ORDER BY au.created_at DESC`,
        [appId]
    );
    return result.rows;
};

const getAppUserMembership = async (appId, userId) => {
    const result = await query(
        `SELECT *
         FROM kodi_app_users
         WHERE app_id = $1 AND user_id = $2`,
        [appId, userId]
    );
    return result.rows[0] || null;
};

const upsertAppUser = async ({ appId, userId, permissions, roleKey, status, inviteToken, invitedAt }) => {
    const result = await query(
        `INSERT INTO kodi_app_users (app_id, user_id, permissions, role_key, status, invite_token, invited_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
         ON CONFLICT (app_id, user_id) DO UPDATE
             SET permissions = EXCLUDED.permissions,
                 role_key = EXCLUDED.role_key,
                 status = EXCLUDED.status,
                 invite_token = EXCLUDED.invite_token,
                 invited_at = EXCLUDED.invited_at,
                 updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [appId, userId, permissions || {}, roleKey || null, status, inviteToken, invitedAt]
    );
    return result.rows[0] || null;
};

const updateAppUser = async ({ appId, userId, updates }) => {
    const fields = [];
    const values = [];
    let idx = 1;
    const addField = (sql, value) => {
        fields.push(sql.replace('?', `$${idx++}`));
        values.push(value);
    };
    if (updates.permissions !== undefined) addField('permissions = ?::jsonb', updates.permissions);
    if (updates.role_key !== undefined) addField('role_key = ?', updates.role_key);
    if (updates.status !== undefined) addField('status = ?', updates.status);
    if (updates.invite_token !== undefined) addField('invite_token = ?', updates.invite_token);
    if (updates.invited_at !== undefined) addField('invited_at = ?', updates.invited_at);
    if (updates.accepted_at !== undefined) addField('accepted_at = ?', updates.accepted_at);
    if (updates.disabled_at !== undefined) addField('disabled_at = ?', updates.disabled_at);
    if (!fields.length) return null;
    values.push(appId, userId);
    const result = await query(
        `UPDATE kodi_app_users
         SET ${fields.join(', ')},
             updated_at = CURRENT_TIMESTAMP
         WHERE app_id = $${idx++} AND user_id = $${idx}
         RETURNING *`,
        values
    );
    return result.rows[0] || null;
};

const deleteAppUser = async (appId, userId) => {
    await query(
        `DELETE FROM kodi_app_users
         WHERE app_id = $1 AND user_id = $2`,
        [appId, userId]
    );
};

const listAppPages = async (appId) => {
    const result = await query(
        `SELECT m.id AS mapping_id,
                m.app_id,
                m.page_id,
                m.nav_label,
                m.nav_order,
                m.is_default,
                m.is_visible,
                m.role_visibility,
                p.label,
                p.page_type,
                p.status,
                p.activated_at
         FROM app_page_mapping m
         JOIN kodi_pages p ON p.id = m.page_id
         WHERE m.app_id = $1
         ORDER BY m.nav_order ASC NULLS LAST, p.label`,
        [appId]
    );
    return result.rows;
};

const getAppPageMappingById = async (mappingId) => {
    const result = await query(
        `SELECT *
         FROM app_page_mapping
         WHERE id = $1`,
        [mappingId]
    );
    return result.rows[0] || null;
};

const addAppPageMapping = async ({ appId, pageId, navLabel, navOrder, isDefault, isVisible, roleVisibility }) => {
    const result = await query(
        `INSERT INTO app_page_mapping (app_id, page_id, nav_label, nav_order, is_default, is_visible, role_visibility)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         ON CONFLICT (app_id, page_id) DO UPDATE
             SET nav_label = EXCLUDED.nav_label,
                 nav_order = EXCLUDED.nav_order,
                 is_default = EXCLUDED.is_default,
                 is_visible = EXCLUDED.is_visible,
                 role_visibility = EXCLUDED.role_visibility
         RETURNING *`,
        [appId, pageId, navLabel, navOrder, isDefault, isVisible, roleVisibility || null]
    );
    return result.rows[0] || null;
};

const updateAppPageMapping = async ({ mappingId, updates }) => {
    const fields = [];
    const values = [];
    let idx = 1;
    const addField = (sql, value) => {
        fields.push(sql.replace('?', `$${idx++}`));
        values.push(value);
    };
    if (updates.nav_label !== undefined) addField('nav_label = ?', updates.nav_label);
    if (updates.nav_order !== undefined) addField('nav_order = ?', updates.nav_order);
    if (updates.is_default !== undefined) addField('is_default = ?', updates.is_default);
    if (updates.is_visible !== undefined) addField('is_visible = ?', updates.is_visible);
    if (updates.role_visibility !== undefined) addField('role_visibility = ?::jsonb', updates.role_visibility);
    if (!fields.length) return null;
    values.push(mappingId);
    const result = await query(
        `UPDATE app_page_mapping
         SET ${fields.join(', ')}
         WHERE id = $${idx}
         RETURNING *`,
        values
    );
    return result.rows[0] || null;
};

const deleteAppPageMapping = async (mappingId) => {
    await query(
        `DELETE FROM app_page_mapping
         WHERE id = $1`,
        [mappingId]
    );
};

const reorderAppPages = async (appId, orderedIds) => {
    const updates = orderedIds.map((mappingId, index) =>
        query(
            `UPDATE app_page_mapping
             SET nav_order = $1
             WHERE id = $2 AND app_id = $3`,
            [index + 1, mappingId, appId]
        )
    );
    await Promise.all(updates);
};

const listActivatedPages = async () => {
    const result = await query(
        `SELECT id, label, page_type, status
         FROM kodi_pages
         WHERE status = 'activated'
         ORDER BY created_at DESC`
    );
    return result.rows;
};

const getActivatedPageByIndex = async (index) => {
    if (!Number.isFinite(Number(index)) || Number(index) <= 0) return null;
    const result = await query(
        `SELECT id, label, page_type, status
         FROM kodi_pages
         WHERE status = 'activated'
         ORDER BY created_at DESC
         OFFSET $1 LIMIT 1`,
        [Number(index) - 1]
    );
    return result.rows[0] || null;
};

const getPageById = async (pageId) => {
    const result = await query(
        `SELECT *
         FROM kodi_pages
         WHERE id = $1`,
        [pageId]
    );
    return result.rows[0] || null;
};

const listAppMembershipsForUser = async (userId) => {
    const result = await query(
        `SELECT au.*, a.name, a.label, a.status, a.icon, a.theme_config
         FROM kodi_app_users au
         JOIN kodi_apps a ON a.id = au.app_id
         WHERE au.user_id = $1 AND au.status = 'active' AND a.status = 'active'
         ORDER BY a.name`,
        [userId]
    );
    return result.rows;
};

const getIdentityByUsername = async (username) => {
    const result = await query(
        `SELECT *
         FROM kodi_portal_identities
         WHERE LOWER(username) = $1`,
        [String(username || '').toLowerCase()]
    );
    return result.rows[0] || null;
};

const getIdentityByUserId = async (userId) => {
    const result = await query(
        `SELECT *
         FROM kodi_portal_identities
         WHERE user_id = $1`,
        [userId]
    );
    return result.rows[0] || null;
};

const createIdentity = async ({ userId, username, passwordHash, otpHash, otpExpiresAt, firstLoginRequired, firstLoginToken, firstLoginExpiresAt }) => {
    const result = await query(
        `INSERT INTO kodi_portal_identities (user_id, username, password_hash, otp_hash, otp_expires_at, first_login_required, first_login_token, first_login_expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [userId, username, passwordHash || null, otpHash || null, otpExpiresAt || null, Boolean(firstLoginRequired), firstLoginToken || null, firstLoginExpiresAt || null]
    );
    return result.rows[0] || null;
};

const updateIdentity = async ({ userId, updates }) => {
    const fields = [];
    const values = [];
    let idx = 1;
    const addField = (sql, value) => {
        fields.push(sql.replace('?', `$${idx++}`));
        values.push(value);
    };
    if (updates.password_hash !== undefined) addField('password_hash = ?', updates.password_hash);
    if (updates.otp_hash !== undefined) addField('otp_hash = ?', updates.otp_hash);
    if (updates.otp_expires_at !== undefined) addField('otp_expires_at = ?', updates.otp_expires_at);
    if (updates.first_login_required !== undefined) addField('first_login_required = ?', updates.first_login_required);
    if (updates.first_login_token !== undefined) addField('first_login_token = ?', updates.first_login_token);
    if (updates.first_login_expires_at !== undefined) addField('first_login_expires_at = ?', updates.first_login_expires_at);
    if (!fields.length) return null;
    values.push(userId);
    const result = await query(
        `UPDATE kodi_portal_identities
         SET ${fields.join(', ')},
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $${idx}
         RETURNING *`,
        values
    );
    return result.rows[0] || null;
};

module.exports = {
    query,
    getAppById,
    listApps,
    createApp,
    updateApp,
    listAppUsers,
    getAppUserMembership,
    upsertAppUser,
    updateAppUser,
    deleteAppUser,
    listAppPages,
    getAppPageMappingById,
    addAppPageMapping,
    updateAppPageMapping,
    deleteAppPageMapping,
    reorderAppPages,
    listActivatedPages,
    getPageById,
    getActivatedPageByIndex,
    listAppMembershipsForUser
    ,getIdentityByUsername
    ,getIdentityByUserId
    ,createIdentity
    ,updateIdentity
};
