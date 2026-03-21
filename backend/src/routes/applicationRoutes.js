const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { apiLimiter } = require('../middleware/rateLimiter');
const { uploadToCloudinary, isCloudinaryConfigured } = require('../utils/cloudinary');

const router = express.Router();

const uploadsDir = path.join(__dirname, '../../uploads/applications');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const sanitized = file.originalname.replace(/[^a-z0-9.\-_]/gi, '_');
        const timestamp = Date.now();
        cb(null, `${timestamp}-${sanitized}`);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: Number(process.env.APPLICATION_UPLOAD_MAX_BYTES || 25 * 1024 * 1024)
    }
});

router.post(
    '/upload',
    apiLimiter,
    upload.single('document'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No document uploaded' });
            }

            let relativeUrl = `/uploads/applications/${req.file.filename}`;
            if (isCloudinaryConfigured()) {
                const cloudUrl = await uploadToCloudinary(req.file.path, {
                    folder: 'welp/applications',
                    resourceType: 'raw'
                });
                if (!cloudUrl) {
                    return res.status(500).json({ error: 'Failed to upload document to cloud storage' });
                }
                relativeUrl = cloudUrl;
            }
            res.json({
                success: true,
                url: relativeUrl,
                filename: req.file.originalname
            });
        } catch (error) {
            console.error('Upload application error:', error);
            res.status(500).json({ error: 'Failed to upload document' });
        }
    }
);

module.exports = router;
