const { body, param } = require('express-validator');
const { validate } = require('../../middleware/validation');
const { authorize } = require('../../middleware/auth');
const { loginLimiter } = require('../../middleware/rateLimiter');
const service = require('./kodiPages.service');

const isAdminRole = (role) => ['admin', 'super_admin', 'superadmin'].includes(String(role || '').toLowerCase());

const createPageValidators = validate([
    body('name').trim().isLength({ min: 2 }),
    body('slug').optional().trim().isLength({ min: 2 }),
    body('description').optional(),
    body('layout').optional()
]);

const updatePageValidators = validate([
    param('id').isUUID(),
    body('name').optional().trim().isLength({ min: 2 }),
    body('slug').optional().trim().isLength({ min: 2 }),
    body('description').optional(),
    body('layout').optional(),
    body('isActive').optional().isBoolean()
]);

const pageIdValidators = validate([param('id').isUUID()]);

const createAccessValidators = validate([
    param('id').isUUID(),
    body('username').trim().isLength({ min: 2 }),
    body('password').isLength({ min: 6 }),
    body('role').isIn(['sales', 'customer_service', 'hr', 'admin'])
]);

const updateAccessValidators = validate([
    param('accessId').isUUID(),
    body('password').optional().isLength({ min: 6 }),
    body('role').optional().isIn(['sales', 'customer_service', 'hr', 'admin']),
    body('isActive').optional().isBoolean()
]);

const kodiPageLoginValidators = validate([
    body('pageSlug').trim().isLength({ min: 1 }),
    body('username').trim().isLength({ min: 1 }),
    body('password').isLength({ min: 1 })
]);

const componentCreateValidators = validate([
    body('componentName').trim().isLength({ min: 2 }),
    body('componentType').isIn(['widget', 'page_block', 'email', 'logic']),
    body('code').isLength({ min: 1 }),
    body('config').optional()
]);

const componentUpdateValidators = validate([
    param('id').isUUID(),
    body('componentName').optional().trim().isLength({ min: 2 }),
    body('componentType').optional().isIn(['widget', 'page_block', 'email', 'logic']),
    body('code').optional().isLength({ min: 1 }),
    body('config').optional(),
    body('bumpVersion').optional().isBoolean()
]);

const attachComponentValidators = validate([
    param('id').isUUID(),
    body('componentId').isUUID(),
    body('position').optional(),
    body('props').optional()
]);

const mappingIdValidators = validate([param('mappingId').isUUID()]);

const createPage = async (req, res) => {
    try {
        const page = await service.createPage({
            name: req.body.name,
            slug: req.body.slug,
            description: req.body.description,
            layout: req.body.layout,
            createdByUserId: req.user?.id
        });
        return res.status(201).json({ success: true, data: page });
    } catch (error) {
        const message = error?.code === '23505' ? 'Slug already exists' : 'Failed to create page';
        return res.status(400).json({ success: false, error: message });
    }
};

const listPages = async (req, res) => {
    try {
        const includeInactive = isAdminRole(req.user?.role) && String(req.query.includeInactive || '') === 'true';
        const pages = await service.listPages({ includeInactive });
        return res.json({ success: true, data: pages });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to load pages' });
    }
};

const getPage = async (req, res) => {
    try {
        const page = await service.getPageById(req.params.id);
        if (!page) return res.status(404).json({ success: false, error: 'Page not found' });
        return res.json({ success: true, data: page });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to load page' });
    }
};

const updatePage = async (req, res) => {
    try {
        const page = await service.updatePage({
            id: req.params.id,
            patch: req.body || {},
            updatedByUserId: req.user?.id
        });
        if (!page) return res.status(404).json({ success: false, error: 'Page not found' });
        return res.json({ success: true, data: page });
    } catch (error) {
        const message = error?.code === '23505' ? 'Slug already exists' : 'Failed to update page';
        return res.status(400).json({ success: false, error: message });
    }
};

const deletePage = async (req, res) => {
    try {
        const page = await service.deactivatePage({ id: req.params.id, updatedByUserId: req.user?.id });
        if (!page) return res.status(404).json({ success: false, error: 'Page not found' });
        return res.json({ success: true, data: page });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to deactivate page' });
    }
};

const createAccess = async (req, res) => {
    try {
        const access = await service.createPageAccess({
            pageId: req.params.id,
            username: req.body.username,
            password: req.body.password,
            role: req.body.role,
            createdByUserId: req.user?.id
        });
        return res.status(201).json({ success: true, data: access });
    } catch (error) {
        const message = error?.code === '23505' ? 'Username already exists for this page' : 'Failed to create access';
        return res.status(400).json({ success: false, error: message });
    }
};

const listAccess = async (req, res) => {
    try {
        const rows = await service.listPageAccess(req.params.id);
        return res.json({ success: true, data: rows });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to load access list' });
    }
};

const updateAccess = async (req, res) => {
    try {
        const access = await service.updatePageAccess({
            accessId: req.params.accessId,
            patch: req.body || {},
            updatedByUserId: req.user?.id
        });
        if (!access) return res.status(404).json({ success: false, error: 'Access not found' });
        return res.json({ success: true, data: access });
    } catch (error) {
        return res.status(400).json({ success: false, error: 'Failed to update access' });
    }
};

const deleteAccess = async (req, res) => {
    try {
        const access = await service.revokePageAccess({
            accessId: req.params.accessId,
            updatedByUserId: req.user?.id
        });
        if (!access) return res.status(404).json({ success: false, error: 'Access not found' });
        return res.json({ success: true, data: access });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to revoke access' });
    }
};

const accessLogin = async (req, res) => {
    try {
        const result = await service.authenticatePageAccess({
            pageSlug: req.body.pageSlug,
            username: req.body.username,
            password: req.body.password,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        if (!result.ok) return res.status(401).json({ success: false, error: result.error || 'Invalid credentials' });
        return res.json({ success: true, data: result });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Login failed' });
    }
};

const getPublicPageBundle = async (req, res) => {
    try {
        const slug = String(req.params.pageSlug || '').trim();
        if (!slug) return res.status(400).json({ success: false, error: 'Invalid page slug' });
        const bundle = await service.getPageBundleBySlug(slug);
        if (!bundle) return res.status(404).json({ success: false, error: 'Page not found' });
        return res.json({ success: true, data: bundle });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to load page' });
    }
};

const listComponents = async (req, res) => {
    try {
        const items = await service.listComponents();
        return res.json({ success: true, data: items });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to load components' });
    }
};

const getComponent = async (req, res) => {
    try {
        const item = await service.getComponent(req.params.id);
        if (!item) return res.status(404).json({ success: false, error: 'Component not found' });
        return res.json({ success: true, data: item });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to load component' });
    }
};

const createComponent = async (req, res) => {
    try {
        const item = await service.createComponent({
            componentName: req.body.componentName,
            componentType: req.body.componentType,
            code: req.body.code,
            config: req.body.config,
            createdByUserId: req.user?.id
        });
        return res.status(201).json({ success: true, data: item });
    } catch (error) {
        const message = error?.code === '23505' ? 'Component name already exists' : 'Failed to create component';
        return res.status(400).json({ success: false, error: message });
    }
};

const updateComponent = async (req, res) => {
    try {
        const item = await service.updateComponent({
            id: req.params.id,
            patch: req.body || {},
            updatedByUserId: req.user?.id
        });
        if (!item) return res.status(404).json({ success: false, error: 'Component not found' });
        return res.json({ success: true, data: item });
    } catch (error) {
        return res.status(400).json({ success: false, error: 'Failed to update component' });
    }
};

const deleteComponent = async (req, res) => {
    try {
        const item = await service.deleteComponent({ id: req.params.id, deletedByUserId: req.user?.id });
        if (!item) return res.status(404).json({ success: false, error: 'Component not found' });
        return res.json({ success: true, data: { id: item.id } });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to delete component' });
    }
};

const attachComponent = async (req, res) => {
    try {
        const mapping = await service.attachComponentToPage({
            pageId: req.params.id,
            componentId: req.body.componentId,
            position: req.body.position,
            props: req.body.props,
            createdByUserId: req.user?.id
        });
        return res.status(201).json({ success: true, data: mapping });
    } catch (error) {
        return res.status(400).json({ success: false, error: 'Failed to attach component' });
    }
};

const listPageComponents = async (req, res) => {
    try {
        const rows = await service.listPageComponentMappings(req.params.id);
        return res.json({ success: true, data: rows });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to load page components' });
    }
};

const deletePageComponent = async (req, res) => {
    try {
        const deleted = await service.deletePageComponentMapping({
            mappingId: req.params.mappingId,
            deletedByUserId: req.user?.id
        });
        if (!deleted) return res.status(404).json({ success: false, error: 'Mapping not found' });
        return res.json({ success: true, data: { id: deleted.id } });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to delete mapping' });
    }
};

module.exports = {
    // Validators/middleware for routes
    createPageValidators,
    updatePageValidators,
    pageIdValidators,
    createAccessValidators,
    updateAccessValidators,
    kodiPageLoginValidators,
    componentCreateValidators,
    componentUpdateValidators,
    attachComponentValidators,
    mappingIdValidators,
    loginLimiter,
    authorizeAdminOnly: authorize('admin', 'super_admin', 'superadmin'),

    // Handlers
    createPage,
    listPages,
    getPage,
    updatePage,
    deletePage,
    createAccess,
    listAccess,
    updateAccess,
    deleteAccess,
    accessLogin,
    getPublicPageBundle,
    listComponents,
    getComponent,
    createComponent,
    updateComponent,
    deleteComponent
    ,
    attachComponent,
    listPageComponents,
    deletePageComponent
};
