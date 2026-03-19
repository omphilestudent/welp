const { body, param } = require('express-validator');
const { validate } = require('../../middleware/validation');
const service = require('./kodi.service');
const builder = require('./kodi.builder');
const runtime = require('./kodi.runtime');
const perms = require('./kodi.permissions');

const logControllerError = (route, error, extra = {}) => {
    const payload = {
        route,
        message: error?.message,
        code: error?.code,
        detail: error?.detail,
        stack: error?.stack,
        ...extra
    };
    console.error('❌ Kodi controller error:', payload);
};

const isUuidOrInt = (value) => {
    if (value === undefined || value === null) return false;
    const str = String(value);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str) || /^\d+$/.test(str);
};

const createPageValidators = validate([
    body('label').trim().isLength({ min: 2 }),
    body('pageType').isIn(['record', 'app', 'home']),
    body('linkedAppId').optional().custom(isUuidOrInt)
]);

const layoutValidators = validate([
    param('id').custom(isUuidOrInt),
    body('layout').notEmpty()
]);

const pageIdValidator = validate([param('id').custom(isUuidOrInt)]);

const getRuntimeValidator = validate([param('pageId').custom(isUuidOrInt)]);

const createAppValidators = validate([
    body('name').trim().isLength({ min: 2 }),
    body('description').optional().trim()
]);

const updateAppValidators = validate([
    param('id').custom(isUuidOrInt),
    body('name').optional().trim().isLength({ min: 2 }),
    body('description').optional().trim(),
    body('isActive').optional().isBoolean()
]);

const pagePermissionValidators = validate([
    param('id').custom(isUuidOrInt),
    body('role').isIn(['admin', 'employee', 'business_user', 'psychologist']),
    body('canView').optional().isBoolean(),
    body('canEdit').optional().isBoolean(),
    body('canUse').optional().isBoolean()
]);

const appIdValidator = validate([param('id').custom(isUuidOrInt)]);
const assignAppUserValidators = validate([
    param('id').custom(isUuidOrInt),
    body('email').isEmail().normalizeEmail(),
    body('permissions').optional().isObject(),
    body('permissions.canView').optional().isBoolean(),
    body('permissions.canEdit').optional().isBoolean(),
    body('permissions.canUse').optional().isBoolean(),
    body('roleKey').optional().isIn(['admin', 'employee', 'business_user', 'psychologist'])
]);
const assignPageUserValidators = validate([
    param('id').custom(isUuidOrInt),
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
    param('id').custom(isUuidOrInt),
    body('fieldName').trim().isLength({ min: 1 }),
    body('fieldType').trim().isLength({ min: 1 }),
    body('isRequired').optional().isBoolean(),
    body('isReadonly').optional().isBoolean()
]);
const createComponentValidators = validate([
    body('name').trim().isLength({ min: 2 }),
    body('type').optional().trim(),
    body('description').optional().trim(),
    body('config').optional().isObject()
]);
const updateComponentValidators = validate([
    param('id').custom(isUuidOrInt),
    body('name').optional().trim(),
    body('type').optional().trim(),
    body('description').optional().trim(),
    body('config').optional().isObject()
]);
const leadValidators = validate([
    body('name').trim().isLength({ min: 2 }),
    body('email').optional().isEmail(),
    body('applicationStatus').optional().trim(),
    body('source').optional().trim()
]);
const convertLeadValidators = validate([
    param('id').custom(isUuidOrInt),
    body('stage').optional().trim(),
    body('owner').optional().trim(),
    body('value').optional().isNumeric()
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
        logControllerError('createPage', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to create page' });
    }
};

const listPages = async (req, res) => {
    try {
        const pages = await service.listPages();
        return res.json({ success: true, data: pages });
    } catch (error) {
        logControllerError('listPages', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to list pages' });
    }
};

const updateLayout = async (req, res) => {
    try {
        const normalized = builder.ensureColumns(req.body.layout);
        const page = await service.updateLayout({ pageId: req.params.id, layout: normalized });
        if (!page) return res.status(404).json({ success: false, error: 'Page not found' });
        return res.json({ success: true, data: page });
    } catch (error) {
        logControllerError('updateLayout', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to update layout' });
    }
};

const activatePage = async (req, res) => {
    try {
        const page = await service.getPageById(req.params.id);
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
        logControllerError('activatePage', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to activate page' });
    }
};

const runtimeLoader = async (req, res) => {
    try {
        const payload = await runtime.buildRuntimePayload({
            pageId: req.params.pageId,
            role: req.user?.role,
            userId: req.user?.id,
            appId: req.query?.appId
        });
        if (!payload) return res.status(404).json({ success: false, error: 'Page not found' });
        return res.json({ success: true, data: payload });
    } catch (error) {
        const status = error.message === 'Access denied' ? 403 : 500;
        logControllerError('runtimeLoader', error);
        return res.status(status).json({ success: false, error: error.message || 'Failed to load runtime page' });
    }
};

const linkPageToApp = async (req, res) => {
    try {
        const pageId = req.params.id;
        const appId = req.body.appId;
        await service.linkPageToApp({ pageId, appId });
        return res.json({ success: true });
    } catch (error) {
        logControllerError('linkPageToApp', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to link page to app' });
    }
};

const linkAppPage = async (req, res) => {
    try {
        const appId = req.params.id;
        const pageId = req.body.pageId;
        await service.linkPageToApp({
            pageId,
            appId,
            navLabel: req.body.navLabel,
            navOrder: req.body.navOrder,
            isDefault: req.body.isDefault,
            isVisible: req.body.isVisible
        });
        return res.json({ success: true });
    } catch (error) {
        logControllerError('linkAppPage', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to link page to app' });
    }
};

const listApps = async (req, res) => {
    try {
        const apps = await service.listApps();
        return res.json({ success: true, data: apps });
    } catch (error) {
        logControllerError('listApps', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to load apps' });
    }
};

const getApp = async (req, res) => {
    try {
        const apps = await service.listApps();
        const app = apps.find((item) => String(item.id) === String(req.params.id));
        if (!app) return res.status(404).json({ success: false, error: 'App not found' });
        return res.json({ success: true, data: app });
    } catch (error) {
        logControllerError('getApp', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to load app' });
    }
};

const listAppUsers = async (req, res) => {
    try {
        const users = await service.listAppUsers(req.params.id);
        return res.json({ success: true, data: users });
    } catch (error) {
        logControllerError('listAppUsers', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to load app users' });
    }
};

const listPageUsers = async (req, res) => {
    try {
        const users = await service.listPageUsers(req.params.id);
        return res.json({ success: true, data: users });
    } catch (error) {
        logControllerError('listPageUsers', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to load page users' });
    }
};

const assignPageUser = async (req, res) => {
    try {
        const payload = await service.assignUserToPage({
            pageId: req.params.id,
            email: req.body.email,
            permissions: req.body.permissions || {},
            assignedBy: req.user?.id
        });
        return res.json({ success: true, data: payload });
    } catch (error) {
        logControllerError('assignPageUser', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to assign user to page' });
    }
};

const assignAppUser = async (req, res) => {
    try {
        const payload = await service.assignUserToApp({
            appId: req.params.id,
            email: req.body.email,
            permissions: req.body.permissions || {},
            roleKey: req.body.roleKey,
            assignedBy: req.user?.id
        });
        return res.json({ success: true, data: payload });
    } catch (error) {
        logControllerError('assignAppUser', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to assign user to app' });
    }
};

const listAppPages = async (req, res) => {
    try {
        const pages = await service.listAppPages(req.params.id);
        return res.json({ success: true, data: pages });
    } catch (error) {
        logControllerError('listAppPages', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to load app pages' });
    }
};

const updateAppPage = async (req, res) => {
    try {
        const mapping = await service.updateAppPageMapping({
            mappingId: req.params.mappingId,
            appId: req.params.id,
            navLabel: req.body.navLabel,
            navOrder: req.body.navOrder,
            isDefault: req.body.isDefault,
            isVisible: req.body.isVisible
        });
        if (!mapping) return res.status(404).json({ success: false, error: 'Mapping not found' });
        return res.json({ success: true, data: mapping });
    } catch (error) {
        logControllerError('updateAppPage', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to update app page' });
    }
};

const deleteAppPage = async (req, res) => {
    try {
        await service.removeAppPageMapping({ mappingId: req.params.mappingId });
        return res.json({ success: true });
    } catch (error) {
        logControllerError('deleteAppPage', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to remove page from app' });
    }
};

const getAppNavigation = async (req, res) => {
    try {
        const payload = await service.listAppNavigation(req.params.id);
        if (!payload) return res.status(404).json({ success: false, error: 'App not found' });
        return res.json({ success: true, data: payload });
    } catch (error) {
        logControllerError('getAppNavigation', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to load app navigation' });
    }
};

const removeAppUser = async (req, res) => {
    try {
        await service.removeAppUser({ appId: req.params.id, userId: req.params.userId });
        return res.json({ success: true });
    } catch (error) {
        logControllerError('removeAppUser', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to remove app user' });
    }
};

const removePageUser = async (req, res) => {
    try {
        await service.removePageUser({ pageId: req.params.id, userId: req.params.userId });
        return res.json({ success: true });
    } catch (error) {
        logControllerError('removePageUser', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to remove page user' });
    }
};

const listObjects = async (req, res) => {
    try {
        const objects = await service.listObjects();
        return res.json({ success: true, data: objects });
    } catch (error) {
        logControllerError('listObjects', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to load objects' });
    }
};

const listComponentRegistry = async (req, res) => {
    try {
        const components = await service.listComponentRegistry();
        return res.json({ success: true, data: components });
    } catch (error) {
        logControllerError('listComponentRegistry', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to load components' });
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
        logControllerError('createObject', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to create object' });
    }
};

const listObjectFields = async (req, res) => {
    try {
        const fields = await service.listObjectFields(req.params.id);
        return res.json({ success: true, data: fields });
    } catch (error) {
        logControllerError('listObjectFields', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to load object fields' });
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
        logControllerError('createObjectField', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to create field' });
    }
};

const createComponent = async (req, res) => {
    try {
        const component = await service.createComponent({
            name: req.body.name,
            type: req.body.type || 'custom',
            description: req.body.description,
            config: req.body.config
        });
        return res.status(201).json({ success: true, data: component });
    } catch (error) {
        logControllerError('createComponent', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to create component' });
    }
};

const updateComponent = async (req, res) => {
    try {
        const component = await service.updateComponent({
            id: req.params.id,
            name: req.body.name,
            type: req.body.type,
            description: req.body.description,
            config: req.body.config
        });
        if (!component) return res.status(404).json({ success: false, error: 'Component not found' });
        return res.json({ success: true, data: component });
    } catch (error) {
        logControllerError('updateComponent', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to update component' });
    }
};

const deleteComponent = async (req, res) => {
    try {
        await service.deleteComponent({ id: req.params.id });
        return res.json({ success: true });
    } catch (error) {
        logControllerError('deleteComponent', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to delete component' });
    }
};

const listLeads = async (req, res) => {
    try {
        const leads = await service.listLeads();
        return res.json({ success: true, data: leads });
    } catch (error) {
        logControllerError('listLeads', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to load leads' });
    }
};

const createLead = async (req, res) => {
    try {
        const lead = await service.createLead({
            name: req.body.name,
            email: req.body.email,
            status: req.body.status,
            applicationStatus: req.body.applicationStatus,
            source: req.body.source
        });
        return res.status(201).json({ success: true, data: lead });
    } catch (error) {
        logControllerError('createLead', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to create lead' });
    }
};

const listOpportunities = async (req, res) => {
    try {
        const opportunities = await service.listOpportunities(req.params.id);
        return res.json({ success: true, data: opportunities });
    } catch (error) {
        logControllerError('listOpportunities', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to load opportunities' });
    }
};

const convertLead = async (req, res) => {
    try {
        const opportunity = await service.convertLead({
            leadId: req.params.id,
            stage: req.body.stage,
            owner: req.body.owner,
            value: req.body.value
        });
        return res.json({ success: true, data: opportunity });
    } catch (error) {
        logControllerError('convertLead', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to convert lead' });
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
        logControllerError('createApp', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to create app' });
    }
};

const updateApp = async (req, res) => {
    try {
        const app = await service.updateApp({
            appId: req.params.id,
            name: req.body.name,
            description: req.body.description,
            isActive: req.body.isActive
        });
        if (!app) return res.status(404).json({ success: false, error: 'App not found' });
        return res.json({ success: true, data: app });
    } catch (error) {
        logControllerError('updateApp', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to update app' });
    }
};

const activateApp = async (req, res) => {
    try {
        const app = await service.updateApp({
            appId: req.params.id,
            isActive: true
        });
        if (!app) return res.status(404).json({ success: false, error: 'App not found' });
        return res.json({ success: true, data: app });
    } catch (error) {
        logControllerError('activateApp', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to activate app' });
    }
};

const deactivateApp = async (req, res) => {
    try {
        const app = await service.updateApp({
            appId: req.params.id,
            isActive: false
        });
        if (!app) return res.status(404).json({ success: false, error: 'App not found' });
        return res.json({ success: true, data: app });
    } catch (error) {
        logControllerError('deactivateApp', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to deactivate app' });
    }
};

const getPagePermissions = async (req, res) => {
    try {
        const pageId = req.params.id;
        const rows = await service.listPermissions(pageId);
        return res.json({ success: true, data: perms.formatPermissions(rows) });
    } catch (error) {
        logControllerError('getPagePermissions', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to load permissions' });
    }
};

const updatePagePermissions = async (req, res) => {
    try {
        const pageId = req.params.id;
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
        logControllerError('updatePagePermissions', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to update permissions' });
    }
};

module.exports = {
    createPageValidators,
    layoutValidators,
    pageIdValidator,
    getRuntimeValidator,
    createAppValidators,
    updateAppValidators,
    appIdValidator,
    assignAppUserValidators,
    assignPageUserValidators,
    createPage,
    listPages,
    updateLayout,
    activatePage,
    runtimeLoader,
    linkPageToApp,
    linkAppPage,
    listApps,
    getApp,
    createApp,
    updateApp,
    activateApp,
    deactivateApp,
    pagePermissionValidators,
    getPagePermissions,
    updatePagePermissions,
    listAppUsers,
    assignAppUser,
    listAppPages,
    updateAppPage,
    deleteAppPage,
    getAppNavigation,
    removeAppUser,
    listPageUsers,
    assignPageUser,
    removePageUser,
    objectValidators,
    fieldValidators,
    createComponentValidators,
    updateComponentValidators,
    listObjects,
    listComponentRegistry,
    createObject,
    listObjectFields,
    createObjectField,
    createComponent,
    updateComponent,
    deleteComponent,
    leadValidators,
    convertLeadValidators,
    listLeads,
    createLead,
    listOpportunities,
    convertLead
};
