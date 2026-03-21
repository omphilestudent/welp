const cloudinary = require('cloudinary').v2;

const isCloudinaryConfigured = () => Boolean(process.env.CLOUDINARY_URL);

if (isCloudinaryConfigured()) {
    cloudinary.config({
        cloudinary_url: process.env.CLOUDINARY_URL
    });
}

const resolveResourceType = (file) => {
    const mime = file?.mimetype || '';
    if (mime.startsWith('video/') || mime.startsWith('audio/')) return 'video';
    if (mime.startsWith('application/')) return 'raw';
    return 'image';
};

const uploadToCloudinary = async (filePath, options = {}) => {
    if (!isCloudinaryConfigured()) return null;
    const {
        folder = 'welp',
        resourceType = 'image'
    } = options;
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder,
            resource_type: resourceType,
            use_filename: true,
            unique_filename: true
        });
        return result?.secure_url || result?.url || null;
    } catch (error) {
        console.warn('Cloudinary upload failed:', error?.message || error);
        return null;
    }
};

module.exports = {
    isCloudinaryConfigured,
    resolveResourceType,
    uploadToCloudinary
};
