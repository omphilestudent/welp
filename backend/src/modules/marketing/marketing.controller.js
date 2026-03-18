const service = require('./marketing.service');
const { renderTemplate } = require('./marketing.templates');

const listTemplates = async (req, res) => {
    try {
        const rows = await service.listTemplates();
        return res.json({ success: true, data: rows });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to load templates' });
    }
};

const getTemplate = async (req, res) => {
    try {
        const template = await service.getTemplateById(req.params.id);
        if (!template) return res.status(404).json({ success: false, error: 'Template not found' });
        return res.json({ success: true, data: template });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to load template' });
    }
};

const createTemplate = async (req, res) => {
    try {
        const template = await service.createTemplate({
            key: req.body.key,
            name: req.body.name,
            category: req.body.category,
            audience: req.body.audience,
            subject: req.body.subject,
            preheader: req.body.preheader,
            htmlBody: req.body.html_body,
            textBody: req.body.text_body,
            logoAssetPath: req.body.logo_asset_path,
            isActive: req.body.is_active,
            userId: req.user?.id
        });
        return res.status(201).json({ success: true, data: template });
    } catch (error) {
        return res.status(400).json({ success: false, error: 'Failed to create template' });
    }
};

const updateTemplate = async (req, res) => {
    try {
        const template = await service.updateTemplate(req.params.id, req.body || {});
        if (!template) return res.status(404).json({ success: false, error: 'Template not found' });
        return res.json({ success: true, data: template });
    } catch (error) {
        return res.status(400).json({ success: false, error: 'Failed to update template' });
    }
};

const previewTemplate = async (req, res) => {
    try {
        const template = await service.getTemplateById(req.params.id);
        if (!template) return res.status(404).json({ success: false, error: 'Template not found' });
        const rendered = renderTemplate(template, req.body.variables || {});
        return res.json({ success: true, data: rendered });
    } catch (error) {
        return res.status(400).json({ success: false, error: 'Failed to preview template' });
    }
};

const listCampaigns = async (req, res) => {
    try {
        const rows = await service.listCampaigns();
        return res.json({ success: true, data: rows });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to load campaigns' });
    }
};

const createCampaign = async (req, res) => {
    try {
        const campaign = await service.createCampaign(req.body, req.user?.id);
        return res.status(201).json({ success: true, data: campaign });
    } catch (error) {
        return res.status(400).json({ success: false, error: 'Failed to create campaign' });
    }
};

const updateCampaign = async (req, res) => {
    try {
        const campaign = await service.updateCampaign(req.params.id, req.body, req.user?.id);
        if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });
        return res.json({ success: true, data: campaign });
    } catch (error) {
        return res.status(400).json({ success: false, error: 'Failed to update campaign' });
    }
};

const runCampaign = async (req, res) => {
    try {
        const campaigns = await service.listCampaigns();
        const campaign = campaigns.find((c) => String(c.id) === String(req.params.id));
        if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });
        const result = await service.runCampaign(campaign, { force: true });
        return res.json({ success: true, data: result });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to run campaign' });
    }
};

const listTriggers = async (req, res) => {
    try {
        const rows = await service.listTriggers();
        return res.json({ success: true, data: rows });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to load triggers' });
    }
};

const updateTrigger = async (req, res) => {
    try {
        const trigger = await service.updateTrigger(req.params.triggerKey, req.body, req.user?.id);
        if (!trigger) return res.status(404).json({ success: false, error: 'Trigger not found' });
        return res.json({ success: true, data: trigger });
    } catch (error) {
        return res.status(400).json({ success: false, error: 'Failed to update trigger' });
    }
};

const listLogs = async (req, res) => {
    try {
        const rows = await service.listLogs(req.query || {});
        return res.json({ success: true, data: rows });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to load logs' });
    }
};

const getSettings = async (req, res) => {
    try {
        const settings = await service.getSettings();
        return res.json({ success: true, data: settings });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to load settings' });
    }
};

const updateSettings = async (req, res) => {
    try {
        const settings = await service.updateSettings(req.body || {});
        return res.json({ success: true, data: settings });
    } catch (error) {
        return res.status(400).json({ success: false, error: 'Failed to update settings' });
    }
};

module.exports = {
    listTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    previewTemplate,
    listCampaigns,
    createCampaign,
    updateCampaign,
    runCampaign,
    listTriggers,
    updateTrigger,
    listLogs,
    getSettings,
    updateSettings
};
