const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const {
    validate,
    companyUpdateValidation,
    reviewValidation,
    replyValidation
} = require('../middleware/validation');
const companyController = require('../controllers/companyController');
const reviewController = require('../controllers/reviewController');

const router = express.Router();
const ownerRoles = ['business', 'admin', 'super_admin', 'superadmin', 'system_admin', 'hr_admin'];
const UUID_PARAM = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

const logoUploadDir = path.join(__dirname, '../../uploads/company-logos');
if (!fs.existsSync(logoUploadDir)) {
    fs.mkdirSync(logoUploadDir, { recursive: true });
}

const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, logoUploadDir),
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}-${safeName}`);
    }
});

const uploadLogo = multer({
    storage: logoStorage,
    limits: { fileSize: 2 * 1024 * 1024 }
});

router.get('/', apiLimiter, companyController.searchCompanies);
router.get(`/:companyId(${UUID_PARAM})`, apiLimiter, companyController.getBusinessProfile);

router.get(`/:companyId(${UUID_PARAM})/analytics`,
    authenticate,
    authorize(...ownerRoles),
    companyController.getCompanyAnalytics
);

router.get(`/:companyId(${UUID_PARAM})/api-keys`,
    authenticate,
    authorize(...ownerRoles),
    companyController.getCompanyApiKeys
);

router.post(`/:companyId(${UUID_PARAM})/api-keys`,
    authenticate,
    authorize(...ownerRoles),
    companyController.createCompanyApiKey
);

router.delete(`/:companyId(${UUID_PARAM})/api-keys/:keyId(${UUID_PARAM})`,
    authenticate,
    authorize(...ownerRoles),
    companyController.revokeCompanyApiKey
);

router.post(`/:companyId(${UUID_PARAM})/logo`,
    authenticate,
    authorize(...ownerRoles),
    uploadLogo.single('logo'),
    companyController.uploadCompanyLogo
);

router.put(`/:companyId(${UUID_PARAM})`,
    authenticate,
    authorize(...ownerRoles),
    validate(companyUpdateValidation),
    companyController.updateCompany
);

router.get(`/:companyId(${UUID_PARAM})/reviews`,
    authenticate,
    authorize(...ownerRoles),
    companyController.getCompanyReviewsForBusiness
);

router.post(`/:companyId(${UUID_PARAM})/review`,
    authenticate,
    authorize('employee'),
    validate(reviewValidation),
    (req, res, next) => {
        req.body.companyId = req.params.companyId;
        return reviewController.createReview(req, res, next);
    }
);

router.post(`/:companyId(${UUID_PARAM})/review/:reviewId(${UUID_PARAM})/reply`,
    authenticate,
    authorize(...ownerRoles),
    validate(replyValidation),
    reviewController.addReply
);

module.exports = router;
