const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const adsController = require('../controllers/adsController');
const { logAdFailure } = require('../services/adsService');

const MAX_MEDIA_BYTES = Number(process.env.AD_MEDIA_MAX_BYTES || 15 * 1024 * 1024);
const MAX_MEDIA_MB = Math.max(1, Math.round(MAX_MEDIA_BYTES / (1024 * 1024)));

const handleMediaUpload = (req, res, next) => {
    upload.single('media')(req, res, async (err) => {
        if (!err) return next();
        const responseMessage =
            err?.message === 'File too large'
                ? `Media file exceeds the ${MAX_MEDIA_MB}MB limit`
                : err?.message || 'Failed to process media upload';
        if (req.user?.id) {
            try {
                await logAdFailure({
                    userId: req.user.id,
                    businessId: null,
                    errorMessage: responseMessage,
                    details: { stage: 'upload', code: err?.code || null }
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
router.get('/placement', adsController.getPlacementAds);
router.post('/:id/impression', adsController.recordImpression);
router.post('/:id/click', adsController.recordClick);

// ==================== BUSINESS ROUTES ====================
router.use(authenticate);

router.get('/me', authorize('business'), adsController.listMyCampaigns);
router.post('/', authorize('business'), handleMediaUpload, adsController.createCampaign);
router.put('/:id', authorize('business'), handleMediaUpload, adsController.updateCampaign);
router.delete('/:id', authorize('business'), adsController.deleteCampaign);
router.get('/:id', adsController.getCampaign);

// ==================== ADMIN ROUTES ====================
const adminAuth = [authenticate, authorize('admin', 'super_admin')];

router.get('/admin/list', adminAuth, adsController.adminListCampaigns);
router.get('/admin/stats', adminAuth, adsController.adminGetStats);
router.get('/admin/failures', adminAuth, adsController.adminListAdFailures);
router.get('/admin/:id', adminAuth, adsController.adminGetCampaignDetails);
router.get('/admin/:id/analytics', adminAuth, adsController.adminGetCampaignAnalytics);

router.post('/admin/approve', adminAuth, adsController.adminApproveCampaign);
router.post('/admin/reject', adminAuth, adsController.adminRejectCampaign);
router.post('/admin/bulk-approve', adminAuth, adsController.adminBulkApprove);
router.post('/admin/bulk-reject', adminAuth, adsController.adminBulkReject);

router.post('/admin/:id/pause', adminAuth, adsController.adminPauseCampaign);
router.post('/admin/:id/resume', adminAuth, adsController.adminResumeCampaign);
router.post('/admin/:id/feature', adminAuth, adsController.adminFeatureCampaign);
router.delete('/admin/:id', adminAuth, adsController.adminDeleteCampaign);

router.get('/admin/export/csv', adminAuth, adsController.adminExportCampaigns);
router.get('/admin/export/report', adminAuth, adsController.adminGenerateReport);
router.get('/admin/:id/audit', adminAuth, adsController.adminGetAuditLog);

module.exports = router;
