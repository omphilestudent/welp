const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { authorizeAdmin } = require('../middleware/adminAuth');
const { validate } = require('../middleware/validation');
const kodiController = require('../controllers/kodiController');
const kodiPages = require('../modules/kodi/kodiPages.controller');
const kodiPlatform = require('../modules/kodi/kodi.controller');
const { authenticateKodiPageSession } = require('../modules/kodi/kodiPageSession.middleware');

const router = express.Router();

// ── Public Kodi Page access (no platform JWT) ──────────────────────────────────
router.post('/access/login', kodiPages.loginLimiter, kodiPages.kodiPageLoginValidators, kodiPages.accessLogin);
router.get('/access/:pageSlug', authenticateKodiPageSession, kodiPages.getPublicPageBundle);

// ── Authenticated Kodi admin/internal routes ──────────────────────────────────
router.use(authenticate);

// Kodi Record Pages (admin only)
router.get('/pages', kodiPages.authorizeAdminOnly, kodiPages.listPages);
router.post('/pages', kodiPages.authorizeAdminOnly, kodiPages.createPageValidators, kodiPages.createPage);
router.get('/pages/:id', kodiPages.authorizeAdminOnly, kodiPages.getPage);
router.put('/pages/:id', kodiPages.authorizeAdminOnly, kodiPages.updatePageValidators, kodiPages.updatePage);
router.delete('/pages/:id', kodiPages.authorizeAdminOnly, kodiPages.pageIdValidators, kodiPages.deletePage);

// Page access (admin only)
router.post('/pages/:id/access', kodiPages.authorizeAdminOnly, kodiPages.createAccessValidators, kodiPages.createAccess);
router.get('/pages/:id/access', kodiPages.authorizeAdminOnly, kodiPages.listAccess);
router.put('/access/:accessId', kodiPages.authorizeAdminOnly, kodiPages.updateAccessValidators, kodiPages.updateAccess);
router.delete('/access/:accessId', kodiPages.authorizeAdminOnly, kodiPages.updateAccessValidators, kodiPages.deleteAccess);

// Page components mapping (admin only)
router.post('/pages/:id/components', kodiPages.authorizeAdminOnly, kodiPages.attachComponentValidators, kodiPages.attachComponent);
router.get('/pages/:id/components', kodiPages.authorizeAdminOnly, kodiPages.pageIdValidators, kodiPages.listPageComponents);
router.delete('/pages/components/:mappingId', kodiPages.authorizeAdminOnly, kodiPages.mappingIdValidators, kodiPages.deletePageComponent);

// KC Kodi Components v2 (admin only)
router.get('/kc-components', kodiPages.authorizeAdminOnly, kodiPages.listComponents);
router.post('/kc-components', kodiPages.authorizeAdminOnly, kodiPages.componentCreateValidators, kodiPages.createComponent);
router.get('/kc-components/:id', kodiPages.authorizeAdminOnly, kodiPages.getComponent);
router.put('/kc-components/:id', kodiPages.authorizeAdminOnly, kodiPages.componentUpdateValidators, kodiPages.updateComponent);
router.delete('/kc-components/:id', kodiPages.authorizeAdminOnly, kodiPages.deleteComponent);

// Employees
router.get('/employees/:id', kodiController.getEmployee);
router.post('/employees',
    validate([
        body('email').isEmail(),
        body('role').isIn(['sales','customer_service','hr','admin','super_admin']),
        body('displayName').optional().trim().isLength({ min: 2 })
    ]),
    kodiController.createEmployee
);
router.put('/employees/:id',
    validate([
        body('role').optional().isIn(['sales','customer_service','hr','admin','super_admin']),
        body('isActive').optional().isBoolean()
    ]),
    kodiController.updateEmployee
);
router.delete('/employees/:id', kodiController.deactivateEmployee);

// Applications
router.get('/applications', kodiController.listApplications);
router.get('/applications/:id', kodiController.getApplication);
router.post('/applications',
    validate([
        body('clientName').trim().isLength({ min: 2 }),
        body('documents').optional(),
        body('contactEmail').optional().isEmail().normalizeEmail()
    ]),
    kodiController.createApplication
);
router.put('/applications/:id/approve', kodiController.approveApplication);
router.put('/applications/:id/reject', kodiController.rejectApplication);
router.delete('/applications/:id', kodiController.deleteApplication);

// Cases
router.get('/cases', kodiController.listCases);
router.post('/cases',
    validate([
        body('clientApplicationId').isUUID(),
        body('priority').optional().isIn(['low','medium','high']),
        body('notes').optional()
    ]),
    kodiController.createCase
);
router.put('/cases/:id',
    validate([
        body('status').optional().isIn(['open','escalated','resolved']),
        body('priority').optional().isIn(['low','medium','high']),
        body('notes').optional()
    ]),
    kodiController.updateCase
);
router.delete('/cases/:id', kodiController.deleteCase);

// Ads
router.get('/ads', kodiController.listAds);
router.post('/ads',
    validate([
        body('content').optional()
    ]),
    kodiController.createAd
);
router.put('/ads/:id',
    validate([
        body('status').isIn(['pending','reviewed','approved','rejected'])
    ]),
    kodiController.updateAdStatus
);
router.delete('/ads/:id', kodiController.deleteAd);

// Components
router.get('/components', kodiController.listComponents);
router.post('/components',
    validate([
        body('componentName').trim().isLength({ min: 2 }),
        body('componentType').isIn(['custom_page','custom_widget','custom_email']),
        body('code').isLength({ min: 1 })
    ]),
    kodiController.createComponent
);
router.put('/components/:id',
    validate([
        body('code').isLength({ min: 1 })
    ]),
    kodiController.updateComponent
);
router.delete('/components/:id', kodiController.deleteComponent);

// Audit logs
router.get('/audit', kodiController.listAuditLogs);

// New builder / runtime platform
router.post(
    '/platform/pages',
    authenticate,
    authorizeAdmin(),
    kodiPlatform.createPageValidators,
    kodiPlatform.createPage
);
router.get('/platform/pages', authenticate, authorizeAdmin(), kodiPlatform.listPages);
router.put(
    '/platform/pages/:id/layout',
    authenticate,
    authorizeAdmin(),
    kodiPlatform.layoutValidators,
    kodiPlatform.updateLayout
);
router.post(
    '/platform/pages/:id/activate',
    authenticate,
    authorizeAdmin(),
    kodiPlatform.pageIdValidator,
    kodiPlatform.activatePage
);
router.post(
    '/platform/pages/:id/link',
    authenticate,
    authorizeAdmin(),
    validate([body('appId').custom((val) => {
        if (val === undefined || val === null) return false;
        const str = String(val);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str) || /^\d+$/.test(str);
    })]),
    kodiPlatform.linkPageToApp
);
router.get('/platform/apps/:id/users', authenticate, authorizeAdmin(), kodiPlatform.appIdValidator, kodiPlatform.listAppUsers);
router.post('/platform/apps/:id/users', authenticate, authorizeAdmin(), kodiPlatform.assignAppUserValidators, kodiPlatform.assignAppUser);
router.get('/platform/apps/:id/pages', authenticate, authorizeAdmin(), kodiPlatform.appIdValidator, kodiPlatform.listAppPages);
router.patch('/platform/apps/:id/pages/:mappingId', authenticate, authorizeAdmin(), validate([
    param('id').custom((val) => {
        if (val === undefined || val === null) return false;
        const str = String(val);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str) || /^\d+$/.test(str);
    }),
    param('mappingId').custom((val) => {
        if (val === undefined || val === null) return false;
        const str = String(val);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str) || /^\d+$/.test(str);
    })
]), kodiPlatform.updateAppPage);
router.delete('/platform/apps/:id/pages/:mappingId', authenticate, authorizeAdmin(), validate([
    param('id').custom((val) => {
        if (val === undefined || val === null) return false;
        const str = String(val);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str) || /^\d+$/.test(str);
    }),
    param('mappingId').custom((val) => {
        if (val === undefined || val === null) return false;
        const str = String(val);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
        return uuidRegex.test(str) || /^\d+$/.test(str);
    })
]), kodiPlatform.deleteAppPage);
router.get('/platform/pages/:id/users', authenticate, authorizeAdmin(), kodiPlatform.pageIdValidator, kodiPlatform.listPageUsers);
router.post('/platform/pages/:id/users', authenticate, authorizeAdmin(), kodiPlatform.assignPageUserValidators, kodiPlatform.assignPageUser);
router.post('/platform/apps', authenticate, authorizeAdmin(), kodiPlatform.createAppValidators, kodiPlatform.createApp);
router.put('/platform/apps/:id', authenticate, authorizeAdmin(), kodiPlatform.updateAppValidators, kodiPlatform.updateApp);
router.get('/platform/runtime/:pageId', authenticate, kodiPlatform.getRuntimeValidator, kodiPlatform.runtimeLoader);
router.get('/platform/apps/:id/navigation', authenticate, kodiPlatform.appIdValidator, kodiPlatform.getAppNavigation);
router.get('/platform/apps', authenticate, authorizeAdmin(), kodiPlatform.listApps);
router.get('/platform/objects', authenticate, authorizeAdmin(), kodiPlatform.listObjects);
router.get('/platform/components', authenticate, authorizeAdmin(), kodiPlatform.listComponentRegistry);
router.post('/platform/objects', authenticate, authorizeAdmin(), kodiPlatform.objectValidators, kodiPlatform.createObject);
router.get('/platform/objects/:id/fields', authenticate, authorizeAdmin(), validate([param('id').custom((val) => {
    if (val === undefined || val === null) return false;
    const str = String(val);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str) || /^\d+$/.test(str);
})]), kodiPlatform.listObjectFields);
router.post('/platform/objects/:id/fields', authenticate, authorizeAdmin(), kodiPlatform.fieldValidators, kodiPlatform.createObjectField);
router.get('/platform/leads', authenticate, authorizeAdmin(), kodiPlatform.listLeads);
router.post('/platform/leads', authenticate, authorizeAdmin(), kodiPlatform.leadValidators, kodiPlatform.createLead);
router.post('/platform/leads/:id/convert', authenticate, authorizeAdmin(), kodiPlatform.convertLeadValidators, kodiPlatform.convertLead);
router.get('/platform/leads/:id/opportunities', authenticate, authorizeAdmin(), validate([param('id').custom((val) => {
    if (val === undefined || val === null) return false;
    const str = String(val);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str) || /^\d+$/.test(str);
})]), kodiPlatform.listOpportunities);
router.get('/platform/pages/:id/permissions', authenticate, authorizeAdmin(), kodiPlatform.pageIdValidator, kodiPlatform.getPagePermissions);
router.post('/platform/pages/:id/permissions', authenticate, authorizeAdmin(), kodiPlatform.pagePermissionValidators, kodiPlatform.updatePagePermissions);

// Kodi Portal aliases (admin console)
router.get('/portal/apps', authenticate, authorizeAdmin(), kodiPlatform.listApps);
router.post('/portal/apps', authenticate, authorizeAdmin(), kodiPlatform.createAppValidators, kodiPlatform.createApp);
router.get('/portal/apps/:id', authenticate, authorizeAdmin(), kodiPlatform.appIdValidator, kodiPlatform.getApp);
router.patch('/portal/apps/:id', authenticate, authorizeAdmin(), kodiPlatform.updateAppValidators, kodiPlatform.updateApp);
router.post('/portal/apps/:id/activate', authenticate, authorizeAdmin(), kodiPlatform.appIdValidator, kodiPlatform.activateApp);
router.post('/portal/apps/:id/deactivate', authenticate, authorizeAdmin(), kodiPlatform.appIdValidator, kodiPlatform.deactivateApp);
router.get('/portal/apps/:id/users', authenticate, authorizeAdmin(), kodiPlatform.appIdValidator, kodiPlatform.listAppUsers);
router.post('/portal/apps/:id/users', authenticate, authorizeAdmin(), kodiPlatform.assignAppUserValidators, kodiPlatform.assignAppUser);
router.delete('/portal/apps/:id/users/:userId', authenticate, authorizeAdmin(), kodiPlatform.removeAppUser);
router.get('/portal/apps/:id/pages', authenticate, authorizeAdmin(), kodiPlatform.appIdValidator, kodiPlatform.listAppPages);
router.post('/portal/apps/:id/pages', authenticate, authorizeAdmin(), validate([body('pageId').custom((val) => {
    if (val === undefined || val === null) return false;
    const str = String(val);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str) || /^\d+$/.test(str);
})]), kodiPlatform.linkAppPage);
router.patch('/portal/apps/:id/pages/:mappingId', authenticate, authorizeAdmin(), validate([
    param('id').custom((val) => {
        if (val === undefined || val === null) return false;
        const str = String(val);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str) || /^\d+$/.test(str);
    }),
    param('mappingId').custom((val) => {
        if (val === undefined || val === null) return false;
        const str = String(val);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
        return uuidRegex.test(str) || /^\d+$/.test(str);
    })
]), kodiPlatform.updateAppPage);
router.delete('/portal/apps/:id/pages/:mappingId', authenticate, authorizeAdmin(), validate([
    param('id').custom((val) => {
        if (val === undefined || val === null) return false;
        const str = String(val);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str) || /^\d+$/.test(str);
    }),
    param('mappingId').custom((val) => {
        if (val === undefined || val === null) return false;
        const str = String(val);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
        return uuidRegex.test(str) || /^\d+$/.test(str);
    })
]), kodiPlatform.deleteAppPage);
router.get('/portal/apps/:id/navigation', authenticate, authorizeAdmin(), kodiPlatform.appIdValidator, kodiPlatform.getAppNavigation);

module.exports = router;
