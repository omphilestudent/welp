const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validation');
const controller = require('./kodi.controller');

const router = express.Router();

const isUuidOrInt = (value) => {
    if (value === undefined || value === null) return false;
    const str = String(value);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str) || /^\d+$/.test(str);
};

router.use(authenticate);

router.post('/pages', controller.createPageValidators, controller.createPage);
router.get('/pages', controller.listPages);
router.put('/pages/:id/layout', controller.layoutValidators, controller.updateLayout);
router.post('/pages/:id/activate', controller.pageIdValidator, controller.activatePage);
router.post('/pages/:id/link', validate([body('appId').custom((val) => {
    if (val === undefined || val === null) return false;
    const str = String(val);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str) || /^\d+$/.test(str);
})]), controller.linkPageToApp);
router.get('/runtime/:pageId', controller.getRuntimeValidator, controller.runtimeLoader);
router.get('/runtime/:pageId/record', controller.getRuntimeValidator, controller.getRuntimeRecord);
router.put('/runtime/:pageId/record', controller.runtimeRecordValidator, controller.updateRuntimeRecord);

router.get('/apps', controller.listApps);
router.post('/apps', controller.createAppValidators, controller.createApp);
router.put('/apps/:id', controller.updateAppValidators, controller.updateApp);
router.get('/apps/:id/users', controller.appIdValidator, controller.listAppUsers);
router.post('/apps/:id/users', controller.assignAppUserValidators, controller.assignAppUser);
router.delete('/apps/:id/users/:userId', validate([
    param('id').custom(isUuidOrInt),
    param('userId').custom(isUuidOrInt)
]), controller.removeAppUser);
router.get('/pages/:id/users', controller.pageIdValidator, controller.listPageUsers);
router.post('/pages/:id/users', controller.assignPageUserValidators, controller.assignPageUser);
router.delete('/pages/:id/users/:userId', validate([
    param('id').custom(isUuidOrInt),
    param('userId').custom(isUuidOrInt)
]), controller.removePageUser);

router.get('/objects', controller.listObjects);
router.post('/objects', controller.objectValidators, controller.createObject);
router.get('/objects/:id/fields', validate([param('id').custom((val) => {
    if (val === undefined || val === null) return false;
    const str = String(val);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str) || /^\d+$/.test(str);
})]), controller.listObjectFields);
router.post('/objects/:id/fields', controller.fieldValidators, controller.createObjectField);
router.get('/components', controller.listComponentRegistry);
router.post('/components', controller.createComponentValidators, controller.createComponent);
router.put('/components/:id', controller.updateComponentValidators, controller.updateComponent);
router.delete('/components/:id', validate([param('id').custom(isUuidOrInt)]), controller.deleteComponent);

router.get('/leads', controller.listLeads);
router.post('/leads', controller.leadValidators, controller.createLead);
router.post('/leads/:id/convert', controller.convertLeadValidators, controller.convertLead);
router.get('/leads/:id/opportunities', validate([param('id').custom((val) => {
    if (val === undefined || val === null) return false;
    const str = String(val);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str) || /^\d+$/.test(str);
})]), controller.listOpportunities);

router.get('/pages/:id/permissions', controller.pageIdValidator, controller.getPagePermissions);
router.post('/pages/:id/permissions', controller.pagePermissionValidators, controller.updatePagePermissions);

module.exports = router;
