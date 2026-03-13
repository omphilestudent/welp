const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const adsController = require('../controllers/adsController');

router.get('/', adsController.listCampaigns);
router.get('/me', authenticate, authorize('business'), adsController.listMyCampaigns);
router.get('/placement', adsController.getPlacementAds);
router.post('/', authenticate, authorize('business'), upload.single('media'), adsController.createCampaign);
router.put('/:id', authenticate, authorize('business'), upload.single('media'), adsController.updateCampaign);
router.delete('/:id', authenticate, authorize('business'), adsController.deleteCampaign);
router.post('/:id/impression', adsController.recordImpression);
router.post('/:id/click', adsController.recordClick);

module.exports = router;
