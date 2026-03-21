
const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { restrictUnverifiedPsychologist } = require('../middleware/restrictUnverifiedPsychologist');
const { apiLimiter, accountSecurityLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validation');
const userController = require('../controllers/userController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadToCloudinary, isCloudinaryConfigured } = require('../utils/cloudinary');

const router = express.Router();


const uploadDir = './uploads/avatars';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `avatar-${req.user.id}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: Number(process.env.AVATAR_MAX_BYTES || 10 * 1024 * 1024) },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed (jpeg, jpg, png, gif)'));
        }
    }
});


router.get('/profile', authenticate, apiLimiter, userController.getProfile);
router.patch('/profile', authenticate, apiLimiter, restrictUnverifiedPsychologist, userController.updateProfile);

router.get('/public/:id', authenticate, apiLimiter, userController.getPublicProfile);


router.post('/upload-avatar',
    authenticate,
    upload.single('avatar'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }


            let avatarUrl = `/uploads/avatars/${req.file.filename}`;
            if (isCloudinaryConfigured()) {
                const cloudUrl = await uploadToCloudinary(req.file.path, { folder: 'welp/avatars' });
                if (cloudUrl) {
                    avatarUrl = cloudUrl;
                }
            }


            const { query } = require('../utils/database');
            await query(
                'UPDATE users SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [avatarUrl, req.user.id]
            );

            res.json({
                message: 'Avatar uploaded successfully',
                avatarUrl
            });
        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({ error: 'Failed to upload avatar' });
        }
    }
);


router.post('/change-password',
    authenticate,
    accountSecurityLimiter,
    validate([
        body('currentPassword').notEmpty().withMessage('Current password is required'),
        body('newPassword')
            .isLength({ min: 10 }).withMessage('New password must be at least 10 characters long')
            .matches(/[A-Z]/).withMessage('New password must contain at least one uppercase letter')
            .matches(/[a-z]/).withMessage('New password must contain at least one lowercase letter')
            .matches(/[0-9]/).withMessage('New password must contain at least one number')
            .matches(/[^A-Za-z0-9]/).withMessage('New password must contain at least one special character')
            .custom((value, { req }) => value !== req.body.currentPassword)
            .withMessage('New password must be different from the current password')
    ]),
    userController.changePassword
);


router.get('/settings', authenticate, apiLimiter, userController.getSettings);
router.patch('/settings', authenticate, apiLimiter, userController.updateSettings);


router.post('/add-psychologist-profile',
    authenticate,
    apiLimiter,
    restrictUnverifiedPsychologist,
    validate([
        body('licenseNumber').notEmpty().withMessage('License number is required'),
        body('licenseIssuingBody').notEmpty().withMessage('License issuing body is required'),
        body('yearsOfExperience').isInt({ min: 0 }).withMessage('Valid years of experience required')
    ]),
    userController.addPsychologistProfile
);


router.delete('/delete-account',
    authenticate,
    accountSecurityLimiter,
    validate([
        body('password').notEmpty().withMessage('Password is required')
    ]),
    userController.deleteAccount
);

module.exports = router;
