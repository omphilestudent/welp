const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const kodiController = require('../controllers/kodiController');
const kodiPages = require('../modules/kodi/kodiPages.controller');
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
        body('documents').optional()
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

module.exports = router;
