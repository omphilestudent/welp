const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../utils/database');

const normalizeSlug = (value) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 160);

const auditKodi = async ({ entityType, entityId, action, performedByUserId, notes }) => {
    try {
        await query(
            `INSERT INTO kodi_audit_logs (entity_type, entity_id, action, performed_by_user_id, notes)
             VALUES ($1, $2, $3, $4, $5)`,
            [entityType, entityId || null, action, performedByUserId || null, notes || null]
        );
    } catch (error) {
        console.warn('Kodi audit log failed:', error.message);
    }
};

const createPage = async ({ name, slug, description, layout, createdByUserId }) => {
    const pageSlug = normalizeSlug(slug || name);
    const result = await query(
        `INSERT INTO kodi_record_pages (name, slug, description, layout, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [name, pageSlug, description || null, layout || {}, createdByUserId || null]
    );
    await auditKodi({
        entityType: 'kodi_record_page',
        entityId: result.rows[0]?.id,
        action: 'created',
        performedByUserId: createdByUserId,
        notes: `slug=${pageSlug}`
    });
    return result.rows[0];
};

const listPages = async ({ includeInactive = false } = {}) => {
    const result = await query(
        `SELECT *
         FROM kodi_record_pages
         WHERE ($1::boolean = true OR is_active = true)
         ORDER BY created_at DESC`,
        [Boolean(includeInactive)]
    );
    return result.rows;
};

const getPageById = async (id) => {
    const result = await query('SELECT * FROM kodi_record_pages WHERE id = $1', [id]);
    return result.rows[0] || null;
};

const getPageBySlug = async (slug) => {
    const result = await query('SELECT * FROM kodi_record_pages WHERE slug = $1', [slug]);
    return result.rows[0] || null;
};

const updatePage = async ({ id, patch, updatedByUserId }) => {
    const existing = await getPageById(id);
    if (!existing) return null;

    const nextSlug = patch.slug != null ? normalizeSlug(patch.slug) : existing.slug;
    const nextLayout = patch.layout != null ? patch.layout : existing.layout;
    const nextName = patch.name != null ? patch.name : existing.name;
    const nextDescription = patch.description != null ? patch.description : existing.description;
    const nextIsActive = patch.isActive != null ? Boolean(patch.isActive) : existing.is_active;

    const result = await query(
        `UPDATE kodi_record_pages
         SET name = $2,
             slug = $3,
             description = $4,
             layout = $5,
             is_active = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id, nextName, nextSlug, nextDescription, nextLayout, nextIsActive]
    );
    await auditKodi({
        entityType: 'kodi_record_page',
        entityId: id,
        action: 'updated',
        performedByUserId: updatedByUserId
    });
    return result.rows[0];
};

const deactivatePage = async ({ id, updatedByUserId }) => {
    const result = await query(
        `UPDATE kodi_record_pages
         SET is_active = false, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id]
    );
    const page = result.rows[0] || null;
    if (page) {
        await auditKodi({
            entityType: 'kodi_record_page',
            entityId: id,
            action: 'deactivated',
            performedByUserId: updatedByUserId
        });
    }
    return page;
};

const createPageAccess = async ({ pageId, username, password, role, createdByUserId }) => {
    const passwordHash = await bcrypt.hash(String(password), 10);
    const result = await query(
        `INSERT INTO kodi_page_access (kodi_page_id, username, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id, kodi_page_id, username, role, is_active, created_at`,
        [pageId, String(username).trim(), passwordHash, role]
    );
    await auditKodi({
        entityType: 'kodi_page_access',
        entityId: result.rows[0]?.id,
        action: 'created',
        performedByUserId: createdByUserId,
        notes: `pageId=${pageId} username=${username} role=${role}`
    });
    return result.rows[0];
};

const listPageAccess = async (pageId) => {
    const result = await query(
        `SELECT id, kodi_page_id, username, role, is_active, created_at
         FROM kodi_page_access
         WHERE kodi_page_id = $1
         ORDER BY created_at DESC`,
        [pageId]
    );
    return result.rows;
};

const updatePageAccess = async ({ accessId, patch, updatedByUserId }) => {
    const existing = await query('SELECT * FROM kodi_page_access WHERE id = $1', [accessId]);
    const row = existing.rows[0];
    if (!row) return null;

    const nextRole = patch.role != null ? patch.role : row.role;
    const nextIsActive = patch.isActive != null ? Boolean(patch.isActive) : row.is_active;
    const nextPasswordHash =
        patch.password != null ? await bcrypt.hash(String(patch.password), 10) : row.password_hash;

    const result = await query(
        `UPDATE kodi_page_access
         SET role = $2,
             is_active = $3,
             password_hash = $4
         WHERE id = $1
         RETURNING id, kodi_page_id, username, role, is_active, created_at`,
        [accessId, nextRole, nextIsActive, nextPasswordHash]
    );
    await auditKodi({
        entityType: 'kodi_page_access',
        entityId: accessId,
        action: 'updated',
        performedByUserId: updatedByUserId
    });
    return result.rows[0];
};

const revokePageAccess = async ({ accessId, updatedByUserId }) => {
    const result = await query(
        `UPDATE kodi_page_access
         SET is_active = false
         WHERE id = $1
         RETURNING id, kodi_page_id, username, role, is_active, created_at`,
        [accessId]
    );
    const access = result.rows[0] || null;
    if (access) {
        await auditKodi({
            entityType: 'kodi_page_access',
            entityId: accessId,
            action: 'revoked',
            performedByUserId: updatedByUserId
        });
    }
    return access;
};

const signKodiPageSessionToken = ({ accessId, pageId, pageSlug, role }) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        const err = new Error('JWT_SECRET not configured');
        err.statusCode = 500;
        throw err;
    }
    return jwt.sign(
        { kind: 'kodi_page', accessId, pageId, pageSlug, role },
        secret,
        { expiresIn: process.env.KODI_PAGE_SESSION_EXPIRE || '8h' }
    );
};

const authenticatePageAccess = async ({ pageSlug, username, password, ipAddress, userAgent }) => {
    const page = await getPageBySlug(pageSlug);
    if (!page || page.is_active === false) {
        return { ok: false, error: 'Page not found' };
    }

    const accessRes = await query(
        `SELECT *
         FROM kodi_page_access
         WHERE kodi_page_id = $1 AND username = $2 AND is_active = true
         LIMIT 1`,
        [page.id, String(username).trim()]
    );
    const access = accessRes.rows[0];
    if (!access) {
        await auditKodi({
            entityType: 'kodi_page_access_login',
            entityId: page.id,
            action: 'failed',
            notes: `username=${username} ip=${ipAddress || ''} ua=${userAgent || ''}`
        });
        return { ok: false, error: 'Invalid credentials' };
    }

    const valid = await bcrypt.compare(String(password), String(access.password_hash));
    if (!valid) {
        await auditKodi({
            entityType: 'kodi_page_access_login',
            entityId: access.id,
            action: 'failed',
            notes: `pageSlug=${pageSlug} ip=${ipAddress || ''}`
        });
        return { ok: false, error: 'Invalid credentials' };
    }

    const token = signKodiPageSessionToken({
        accessId: access.id,
        pageId: page.id,
        pageSlug: page.slug,
        role: access.role
    });
    await auditKodi({
        entityType: 'kodi_page_access_login',
        entityId: access.id,
        action: 'success',
        notes: `pageSlug=${pageSlug} ip=${ipAddress || ''}`
    });
    return { ok: true, token, page: { id: page.id, slug: page.slug, name: page.name } };
};

const listComponents = async () => {
    const result = await query(
        `SELECT id, component_name, component_type, config, version, created_at, updated_at
         FROM kc_kodi_components
         ORDER BY updated_at DESC`,
        []
    );
    return result.rows;
};

const getComponent = async (id) => {
    const result = await query('SELECT * FROM kc_kodi_components WHERE id = $1', [id]);
    return result.rows[0] || null;
};

const createComponent = async ({ componentName, componentType, code, config, createdByUserId }) => {
    const result = await query(
        `INSERT INTO kc_kodi_components (component_name, component_type, code, config, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [componentName, componentType, code, config || {}, createdByUserId || null]
    );
    await auditKodi({
        entityType: 'kc_kodi_component',
        entityId: result.rows[0]?.id,
        action: 'created',
        performedByUserId: createdByUserId
    });
    return result.rows[0];
};

const updateComponent = async ({ id, patch, updatedByUserId }) => {
    const existing = await getComponent(id);
    if (!existing) return null;

    const nextName = patch.componentName != null ? patch.componentName : existing.component_name;
    const nextType = patch.componentType != null ? patch.componentType : existing.component_type;
    const nextCode = patch.code != null ? patch.code : existing.code;
    const nextConfig = patch.config != null ? patch.config : existing.config;
    const nextVersion = patch.bumpVersion ? Number(existing.version || 1) + 1 : Number(existing.version || 1);

    const result = await query(
        `UPDATE kc_kodi_components
         SET component_name = $2,
             component_type = $3,
             code = $4,
             config = $5,
             version = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id, nextName, nextType, nextCode, nextConfig, nextVersion]
    );
    await auditKodi({
        entityType: 'kc_kodi_component',
        entityId: id,
        action: 'updated',
        performedByUserId: updatedByUserId
    });
    return result.rows[0];
};

const deleteComponent = async ({ id, deletedByUserId }) => {
    const result = await query('DELETE FROM kc_kodi_components WHERE id = $1 RETURNING *', [id]);
    const deleted = result.rows[0] || null;
    if (deleted) {
        await auditKodi({
            entityType: 'kc_kodi_component',
            entityId: id,
            action: 'deleted',
            performedByUserId: deletedByUserId
        });
    }
    return deleted;
};

const getPageBundleBySlug = async (slug) => {
    const page = await getPageBySlug(slug);
    if (!page || page.is_active === false) return null;

    const mappingRes = await query(
        `SELECT
             m.id as mapping_id,
             m.position,
             m.props,
             c.id as component_id,
             c.component_name,
             c.component_type,
             c.code,
             c.config,
             c.version
         FROM kodi_page_component_mapping m
         JOIN kc_kodi_components c ON c.id = m.component_id
         WHERE m.kodi_page_id = $1
         ORDER BY m.created_at ASC`,
        [page.id]
    );

    return {
        page: {
            id: page.id,
            name: page.name,
            slug: page.slug,
            description: page.description,
            layout: page.layout,
            isActive: page.is_active,
            createdAt: page.created_at,
            updatedAt: page.updated_at
        },
        components: mappingRes.rows.map((row) => ({
            mappingId: row.mapping_id,
            component: {
                id: row.component_id,
                name: row.component_name,
                type: row.component_type,
                code: row.code,
                config: row.config,
                version: row.version
            },
            position: row.position || {},
            props: row.props || {}
        }))
    };
};

const attachComponentToPage = async ({ pageId, componentId, position, props, createdByUserId }) => {
    const result = await query(
        `INSERT INTO kodi_page_component_mapping (kodi_page_id, component_id, position, props)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [pageId, componentId, position || {}, props || {}]
    );
    await auditKodi({
        entityType: 'kodi_page_component_mapping',
        entityId: result.rows[0]?.id,
        action: 'created',
        performedByUserId: createdByUserId,
        notes: `pageId=${pageId} componentId=${componentId}`
    });
    return result.rows[0];
};

const listPageComponentMappings = async (pageId) => {
    const result = await query(
        `SELECT
             m.*,
             c.component_name,
             c.component_type,
             c.version
         FROM kodi_page_component_mapping m
         JOIN kc_kodi_components c ON c.id = m.component_id
         WHERE m.kodi_page_id = $1
         ORDER BY m.created_at ASC`,
        [pageId]
    );
    return result.rows;
};

const deletePageComponentMapping = async ({ mappingId, deletedByUserId }) => {
    const result = await query(
        'DELETE FROM kodi_page_component_mapping WHERE id = $1 RETURNING *',
        [mappingId]
    );
    const deleted = result.rows[0] || null;
    if (deleted) {
        await auditKodi({
            entityType: 'kodi_page_component_mapping',
            entityId: mappingId,
            action: 'deleted',
            performedByUserId: deletedByUserId
        });
    }
    return deleted;
};

module.exports = {
    createPage,
    listPages,
    getPageById,
    getPageBySlug,
    updatePage,
    deactivatePage,
    createPageAccess,
    listPageAccess,
    updatePageAccess,
    revokePageAccess,
    authenticatePageAccess,
    listComponents,
    getComponent,
    createComponent,
    updateComponent,
    deleteComponent,
    getPageBundleBySlug,
    attachComponentToPage,
    listPageComponentMappings,
    deletePageComponentMapping,
    normalizeSlug
};
