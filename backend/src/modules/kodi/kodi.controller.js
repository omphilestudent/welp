const { body, param } = require('express-validator');
const { validate } = require('../../middleware/validation');
const service = require('./kodi.service');
const builder = require('./kodi.builder');
const runtime = require('./kodi.runtime');

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

module.exports = {
    createPageValidators,
    layoutValidators,
    pageIdValidator,
    getRuntimeValidator,
    createPage,
    listPages,
    updateLayout,
    activatePage,
    runtimeLoader,
    linkPageToApp,
    listApps
};
