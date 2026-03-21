const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { requireBusinessFeature } = require('../middleware/businessPlan');
const { authorizeAdmin } = require('../middleware/adminAuth');
const { param } = require('express-validator');
const { validate } = require('../middleware/validation');
const upload = require('../middleware/upload');
const adsController = require('../controllers/adsController');
const { logAdFailure } = require('../services/adsService');

const MAX_MEDIA_BYTES = Number(process.env.AD_MEDIA_MAX_BYTES || 15 * 1024 * 1024);
const MAX_MEDIA_MB = Math.max(1, Math.round(MAX_MEDIA_BYTES / (1024 * 1024)));

const handleMediaUpload = (req, res, next) => {
    upload.array('media', 6)(req, res, async (err) => {
        if (!err) return next();

        let responseMessage = 'Failed to process media upload';

        if (err?.message === 'File too large') {
            responseMessage = `Media file exceeds the ${MAX_MEDIA_MB}MB limit`;
        } else if (err?.code === 'LIMIT_UNEXPECTED_FILE') {
            responseMessage = 'Unexpected field name. Expected "media"';
        } else if (err?.message) {
            responseMessage = err.message;
        }

        // Log failure if user is authenticated
        if (req.user?.id) {
            try {
                await logAdFailure({
                    userId: req.user.id,
                    businessId: null,
                    errorMessage: responseMessage,
                    details: {
                        stage: 'upload',
                        code: err?.code || null,
                        field: err?.field || null
                    }
                });
            } catch (logError) {
                console.warn('Unable to log upload failure:', logError.message);
            }
        }

        return res.status(400).json({
            success: false,
            error: responseMessage
        });
    });
};

// ==================== PUBLIC ROUTES ====================
router.get('/', adsController.listCampaigns);
router.get('/pricing', adsController.getAdPricing);
const validateId = validate([param('id').isUUID().withMessage('Invalid id')]);

router.get('/placement', adsController.getPlacementAds);
router.post('/:id/impression', validateId, adsController.recordImpression);
router.post('/:id/click', validateId, adsController.recordClick);

// ==================== BUSINESS ROUTES ====================
router.use(authenticate);

// ==================== ADMIN ROUTES ====================
// IMPORTANT: define these BEFORE any '/:id' routes to avoid route shadowing.
const adminAuth = [authorizeAdmin()];

router.get('/admin/list', adminAuth, adsController.adminListCampaigns);
router.get('/admin/stats', adminAuth, adsController.adminGetStats);
router.get('/admin/failures', adminAuth, adsController.adminListAdFailures);
router.get('/admin/:id', adminAuth, validateId, adsController.adminGetCampaignDetails);
router.get('/admin/:id/analytics', adminAuth, validateId, adsController.adminGetCampaignAnalytics);

router.post('/admin/approve', adminAuth, adsController.adminApproveCampaign);
router.post('/admin/reject', adminAuth, adsController.adminRejectCampaign);
router.post('/admin/bulk-approve', adminAuth, adsController.adminBulkApprove);
router.post('/admin/bulk-reject', adminAuth, adsController.adminBulkReject);

router.post('/admin/:id/pause', adminAuth, validateId, adsController.adminPauseCampaign);
router.post('/admin/:id/resume', adminAuth, validateId, adsController.adminResumeCampaign);
router.post('/admin/:id/remove', adminAuth, validateId, adsController.adminRemoveCampaign);
router.post('/admin/:id/feature', adminAuth, validateId, adsController.adminFeatureCampaign);
router.delete('/admin/:id', adminAuth, validateId, adsController.adminDeleteCampaign);

router.get('/admin/export/csv', adminAuth, adsController.adminExportCampaigns);
router.get('/admin/export/report', adminAuth, adsController.adminGenerateReport);
router.get('/admin/:id/audit', adminAuth, validateId, adsController.adminGetAuditLog);

router.get('/me', authorize('business'), requireBusinessFeature('ads', { businessIdResolver: () => null }), adsController.listMyCampaigns);
router.get('/invoices', authorize('business'), requireBusinessFeature('ads', { businessIdResolver: () => null }), adsController.listMyInvoices);
router.get('/invoices/:id/download', authorize('business'), requireBusinessFeature('ads', { businessIdResolver: () => null }), validateId, adsController.downloadInvoice);
router.post('/', authorize('business'), requireBusinessFeature('ads', { businessIdResolver: () => null }), handleMediaUpload, adsController.createCampaign);
router.put('/:id', authorize('business'), requireBusinessFeature('ads', { businessIdResolver: () => null }), validateId, handleMediaUpload, adsController.updateCampaign);
router.delete('/:id', authorize('business'), requireBusinessFeature('ads', { businessIdResolver: () => null }), validateId, adsController.deleteCampaign);
router.get('/:id', authorize('business'), requireBusinessFeature('ads', { businessIdResolver: () => null }), validateId, adsController.getCampaign);

module.exports = router;
