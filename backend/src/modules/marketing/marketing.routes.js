const express = require('express');
const { body, param } = require('express-validator');
const { validate } = require('../../middleware/validation');
const controller = require('./marketing.controller');

const router = express.Router();

router.get('/templates', controller.listTemplates);
router.get('/templates/:id', validate([param('id').isUUID()]), controller.getTemplate);
router.post('/templates', controller.createTemplate);
router.put('/templates/:id', validate([param('id').isUUID()]), controller.updateTemplate);
router.post('/templates/:id/preview', validate([param('id').isUUID()]), controller.previewTemplate);

router.get('/campaigns', controller.listCampaigns);
router.post('/campaigns', controller.createCampaign);
router.put('/campaigns/:id', validate([param('id').isUUID()]), controller.updateCampaign);
router.post('/campaigns/:id/run', validate([param('id').isUUID()]), controller.runCampaign);

router.get('/triggers', controller.listTriggers);
router.put('/triggers/:triggerKey', controller.updateTrigger);

router.get('/logs', controller.listLogs);
router.get('/settings', controller.getSettings);
router.put('/settings', controller.updateSettings);

module.exports = router;
