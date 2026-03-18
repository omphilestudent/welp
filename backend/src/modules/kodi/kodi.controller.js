const { body, param } = require('express-validator');
const { validate } = require('../../middleware/validation');
const service = require('./kodi.service');
const builder = require('./kodi.builder');
const runtime = require('./kodi.runtime');
const perms = require('./kodi.permissions');

const createPageValidators = validate([
    body('label').trim().isLength({ min: 2 }),
    body('pageType').isIn(['record', 'app', 'home']),
    body('linkedAppId').optional().isInt()
]);

const layoutValidators = validate([
    param('id').isInt(),
    body('layout').notEmpty()
]);

const pageIdValidator = validate([param('id').isInt()]);

const getRuntimeValidator = validate([param('pageId').isInt()]);

const createAppValidators = validate([
    body('name').trim().isLength({ min: 2 }),
    body('description').optional().trim()
]);

const pagePermissionValidators = validate([
    param('id').isInt(),
    body('role').isIn(['admin', 'employee', 'business', 'psychologist']),
    body('canView').optional().isBoolean(),
    body('canEdit').optional().isBoolean(),
    body('canUse').optional().isBoolean()
]);

const appIdValidator = validate([param('id').isUUID()]);
const assignAppUserValidators = validate([
    param('id').isUUID(),
    body('email').isEmail().normalizeEmail(),
    body('permissions').optional().isObject(),
    body('permissions.canView').optional().isBoolean(),
    body('permissions.canEdit').optional().isBoolean(),
    body('permissions.canUse').optional().isBoolean()
]);
const objectValidators = validate([
    body('name').trim().isLength({ min: 1 }),
    body('label').trim().isLength({ min: 1 }),
    body('description').optional().trim()
]);
const fieldValidators = validate([
    param('id').isUUID(),
    body('fieldName').trim().isLength({ min: 1 }),
    body('fieldType').trim().isLength({ min: 1 }),
    body('isRequired').optional().isBoolean(),
    body('isReadonly').optional().isBoolean()
]);
const leadValidators = validate([
    body('name').trim().isLength({ min: 2 }),
    body('email').optional().isEmail()
]);
const convertLeadValidators = validate([
    param('id').isUUID(),
    body('stage').optional().trim()
]);

const createPage = async (req, res) => {
    try {
        const page = await service.createPage({
            label: req.body.label,
            pageType: req.body.pageType,
            linkedAppId: req.body.linkedAppId,
            createdBy: req.user?.id
        });
        return res.status(201).json({ success: true, data: page });
    } catch (error) {
        return res.status(400).json({ success: false, error: 'Failed to create page' });
    }
};

const listPages = async (req, res) => {
    try {
        const pages = await service.listPages();
        return res.json({ success: true, data: pages });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to list pages' });
    }
};

const updateLayout = async (req, res) => {
    try {
        const normalized = builder.ensureColumns(req.body.layout);
        const page = await service.updateLayout({ pageId: Number(req.params.id), layout: normalized });
        if (!page) return res.status(404).json({ success: false, error: 'Page not found' });
        return res.json({ success: true, data: page });
    } catch (error) {
        return res.status(400).json({ success: false, error: 'Failed to update layout' });
    }
};

const activatePage = async (req, res) => {
    try {
        const page = await service.getPageById(Number(req.params.id));
        if (!page) return res.status(404).json({ success: false, error: 'Page not found' });

        if (!builder.layoutHasComponent(page.layout)) {
            return res.status(400).json({ success: false, error: 'Layout must contain at least one component' });
        }

        const activated = await service.activatePage({ pageId: page.id });
        if (!activated) return res.status(500).json({ success: false, error: 'Failed to activate page' });

        if (page.linked_app_id) {
            await service.linkPageToApp({ pageId: page.id, appId: page.linked_app_id });
        }

        return res.json({ success: true, data: activated });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || 'Failed to activate page' });
    }
};

const runtimeLoader = async (req, res) => {
    try {
        const payload = await runtime.buildRuntimePayload({
            pageId: Number(req.params.pageId),
            role: req.user?.role
        });
        if (!payload) return res.status(404).json({ success: false, error: 'Page not found' });
        return res.json({ success: true, data: payload });
    } catch (error) {
        const status = error.message === 'Access denied' ? 403 : 500;
        return res.status(status).json({ success: false, error: error.message || 'Failed to load runtime page' });
    }
};

const linkPageToApp = async (req, res) => {
    try {
        const pageId = Number(req.params.id);
        const appId = Number(req.body.appId);
        await service.linkPageToApp({ pageId, appId });
        return res.json({ success: true });
    } catch (error) {
        return res.status(400).json({ success: false, error: 'Failed to link page to app' });
    }
};

const listApps = async (req, res) => {
    try {
        const apps = await service.listApps();
        return res.json({ success: true, data: apps });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to load apps' });
    }
};

const listAppUsers = async (req, res) => {
    try {
        const users = await service.listAppUsers(req.params.id);
        return res.json({ success: true, data: users });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to load app users' });
    }
};

const assignAppUser = async (req, res) => {
    try {
        const payload = await service.assignUserToApp({
            appId: req.params.id,
            email: req.body.email,
            permissions: req.body.permissions || {},
            assignedBy: req.user?.id
        });
        return res.json({ success: true, data: payload });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || 'Failed to assign user to app' });
    }
};

const listObjects = async (req, res) => {
    try {
        const objects = await service.listObjects();
        return res.json({ success: true, data: objects });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to load objects' });
    }
};

const createObject = async (req, res) => {
    try {
        const object = await service.createObject({
            name: req.body.name,
            label: req.body.label,
            description: req.body.description,
            metadata: req.body.metadata
        });
        return res.status(201).json({ success: true, data: object });
    } catch (error) {
        return res.status(400).json({ success: false, error: 'Failed to create object' });
    }
};

const listObjectFields = async (req, res) => {
    try {
        const fields = await service.listObjectFields(req.params.id);
        return res.json({ success: true, data: fields });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to load object fields' });
    }
};

const createObjectField = async (req, res) => {
    try {
        const field = await service.createField({
            objectId: req.params.id,
            fieldName: req.body.fieldName,
            fieldType: req.body.fieldType,
            isRequired: req.body.isRequired,
            isReadonly: req.body.isReadonly
        });
        return res.status(201).json({ success: true, data: field });
    } catch (error) {
        return res.status(400).json({ success: false, error: 'Failed to create field' });
    }
};

const listLeads = async (req, res) => {
    try {
        const leads = await service.listLeads();
        return res.json({ success: true, data: leads });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to load leads' });
    }
};

const createLead = async (req, res) => {
    try {
        const lead = await service.createLead({
            name: req.body.name,
            email: req.body.email,
            status: req.body.status
        });
        return res.status(201).json({ success: true, data: lead });
    } catch (error) {
        return res.status(400).json({ success: false, error: 'Failed to create lead' });
    }
};

const listOpportunities = async (req, res) => {
    try {
        const opportunities = await service.listOpportunities(req.params.id);
        return res.json({ success: true, data: opportunities });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to load opportunities' });
    }
};

const convertLead = async (req, res) => {
    try {
        const opportunity = await service.convertLead({
            leadId: req.params.id,
            stage: req.body.stage
        });
        return res.json({ success: true, data: opportunity });
    } catch (error) {
        return res.status(400).json({ success: false, error: 'Failed to convert lead' });
    }
};

const createApp = async (req, res) => {
    try {
        const app = await service.createApp({
            name: req.body.name,
            description: req.body.description
        });
        return res.status(201).json({ success: true, data: app });
    } catch (error) {
        return res.status(400).json({ success: false, error: 'Failed to create app' });
    }
};

const getPagePermissions = async (req, res) => {
    try {
        const pageId = Number(req.params.id);
        const rows = await service.listPermissions(pageId);
        return res.json({ success: true, data: perms.formatPermissions(rows) });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to load permissions' });
    }
};

const updatePagePermissions = async (req, res) => {
    try {
        const pageId = Number(req.params.id);
        await service.insertPermission({
            role: req.body.role,
            pageId,
            canView: req.body.canView,
            canEdit: req.body.canEdit,
            canUse: req.body.canUse
        });
        const rows = await service.listPermissions(pageId);
        return res.json({ success: true, data: perms.formatPermissions(rows) });
    } catch (error) {
        return res.status(400).json({ success: false, error: 'Failed to update permissions' });
    }
};

module.exports = {
    createPageValidators,
    layoutValidators,
    pageIdValidator,
    getRuntimeValidator,
    createAppValidators,
    appIdValidator,
    assignAppUserValidators,
    createPage,
    listPages,
    updateLayout,
    activatePage,
    runtimeLoader,
    linkPageToApp,
    listApps,
    createApp,
    pagePermissionValidators,
    getPagePermissions,
    updatePagePermissions,
    listAppUsers,
    assignAppUser,
    objectValidators,
    fieldValidators,
    listObjects,
    createObject,
    listObjectFields,
    createObjectField,
    leadValidators,
    convertLeadValidators,
    listLeads,
    createLead,
    listOpportunities,
    convertLead
};
