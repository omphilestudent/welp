const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { authenticate } = require('../../middleware/auth');
const { authorizeAdmin } = require('../../middleware/adminAuth');
const {
    validate,
    emailCampaignValidation,
    emailCampaignUpdateValidation,
    emailCampaignPreviewValidation
} = require('../../middleware/validation');
const emailMarketingController = require('../../controllers/emailMarketingController');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../../uploads/email-marketing');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
        cb(null, safeName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: Number(process.env.EMAIL_ASSET_MAX_BYTES || 5 * 1024 * 1024)
    },
    fileFilter: (req, file, cb) => {
        const allowed = /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(file.originalname);
        if (!allowed) {
            return cb(new Error('Only image assets are supported'));
        }
        cb(null, true);
    }
});

router.use(authenticate);
router.use(authorizeAdmin());

router.get('/', emailMarketingController.listCampaigns);
router.post('/', validate(emailCampaignValidation), emailMarketingController.createCampaign);
router.post('/preview', validate(emailCampaignPreviewValidation), emailMarketingController.previewDraft);
router.post('/assets', upload.array('assets', 5), emailMarketingController.uploadAssets);

router.get('/:id', emailMarketingController.getCampaign);
router.get('/:id/logs', emailMarketingController.getCampaignLogs);
router.get('/:id/preview', emailMarketingController.previewCampaign);
router.put('/:id', validate(emailCampaignUpdateValidation), emailMarketingController.updateCampaign);
router.delete('/:id', emailMarketingController.deleteCampaign);
router.post('/:id/send', emailMarketingController.sendNow);

module.exports = router;
