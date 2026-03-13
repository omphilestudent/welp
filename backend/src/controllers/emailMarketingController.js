const path = require('path');
const emailMarketingService = require('../services/emailMarketingService');

const BASE_BACKEND_URL = (process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:5000').replace(/\/$/, '');

const respondWithError = (res, error, status = 500) => {
    const code = error.status || status;
    return res.status(code).json({
        error: error.message || 'Email marketing operation failed'
    });
};

const listCampaigns = async (req, res) => {
    try {
        const campaigns = await emailMarketingService.listCampaigns();
        res.json({ campaigns });
    } catch (error) {
        respondWithError(res, error);
    }
};

const getCampaign = async (req, res) => {
    try {
        const campaign = await emailMarketingService.getCampaignById(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        res.json({ campaign });
    } catch (error) {
        respondWithError(res, error);
    }
};

const getCampaignLogs = async (req, res) => {
    try {
        const logs = await emailMarketingService.getCampaignLogs(req.params.id, Number(req.query.limit) || 200);
        res.json({ logs });
    } catch (error) {
        respondWithError(res, error);
    }
};

const createCampaign = async (req, res) => {
    try {
        const campaign = await emailMarketingService.createCampaign(req.body, req.user?.id);
        res.status(201).json({ campaign });
    } catch (error) {
        respondWithError(res, error, 400);
    }
};

const updateCampaign = async (req, res) => {
    try {
        const campaign = await emailMarketingService.updateCampaign(req.params.id, req.body, req.user?.id);
        res.json({ campaign });
    } catch (error) {
        respondWithError(res, error, error.message === 'Campaign not found' ? 404 : 400);
    }
};

const deleteCampaign = async (req, res) => {
    try {
        await emailMarketingService.deleteCampaign(req.params.id);
        res.json({ message: 'Campaign deleted' });
    } catch (error) {
        respondWithError(res, error);
    }
};

const previewCampaign = async (req, res) => {
    try {
        const preview = await emailMarketingService.previewCampaignById(req.params.id);
        res.json(preview);
    } catch (error) {
        respondWithError(res, error, error.message === 'Campaign not found' ? 404 : 400);
    }
};

const previewDraft = async (req, res) => {
    try {
        const preview = await emailMarketingService.previewDraftCampaign(req.body);
        res.json(preview);
    } catch (error) {
        respondWithError(res, error, 400);
    }
};

const sendNow = async (req, res) => {
    try {
        const result = await emailMarketingService.sendCampaignNow(req.params.id);
        if (!result) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        res.json({ message: 'Campaign dispatched', result });
    } catch (error) {
        respondWithError(res, error, 400);
    }
};

const uploadAssets = async (req, res) => {
    const files = req.files || [];
    if (!files.length) {
        return res.status(400).json({ error: 'No files uploaded' });
    }
    const assets = files.map((file) => {
        const relativePath = `/uploads/email-marketing/${path.basename(file.filename)}`;
        return {
            url: relativePath,
            absoluteUrl: `${BASE_BACKEND_URL}${relativePath}`,
            size: file.size,
            originalName: file.originalname,
            mimetype: file.mimetype
        };
    });
    res.status(201).json({ assets });
};

module.exports = {
    listCampaigns,
    getCampaign,
    getCampaignLogs,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    previewCampaign,
    previewDraft,
    sendNow,
    uploadAssets
};
