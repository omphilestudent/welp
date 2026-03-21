const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ADS_UPLOAD_PATH = path.join(__dirname, '../../uploads/ads');
fs.mkdirSync(ADS_UPLOAD_PATH, { recursive: true });

const ALLOWED_EXTENSIONS = {
    image: ['.jpg', '.jpeg', '.png', '.webp'],
    video: ['.mp4', '.webm', '.mov'],
    gif: ['.gif']
};

const getExtension = (filename) => path.extname(filename).toLowerCase();

const fileFilter = (req, file, cb) => {
    const ext = getExtension(file.originalname);
    const allowed = Object.values(ALLOWED_EXTENSIONS).some((list) => list.includes(ext));
    const mime = String(file.mimetype || '').toLowerCase();
    const allowedMime = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'video/mp4',
        'video/webm',
        'video/quicktime'
    ].includes(mime);
    if (!allowed || !allowedMime) {
        return cb(new Error('Unsupported media format'));
    }
    cb(null, true);
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, ADS_UPLOAD_PATH);
    },
    filename: (req, file, cb) => {
        const ext = getExtension(file.originalname);
        const safeName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
        cb(null, safeName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: Number(process.env.AD_MEDIA_MAX_BYTES || 50 * 1024 * 1024)
    },
    fileFilter
});

module.exports = upload;
