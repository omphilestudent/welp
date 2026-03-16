const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { apiLimiter } = require('../middleware/rateLimiter');

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
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});

router.post(
    '/upload',
    apiLimiter,
    upload.single('document'),
    (req, res) => {
        if (!req.file) {
            return res.status(400).json({ error: 'No document uploaded' });
        }

        const relativeUrl = `/uploads/applications/${req.file.filename}`;
        res.json({
            success: true,
            url: relativeUrl,
            filename: req.file.originalname
        });
    }
);

module.exports = router;
