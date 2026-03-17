const jwt = require('jsonwebtoken');

const getKodiPageToken = (req) => {
    const header = req.headers.authorization;
    if (header) {
        const [scheme, token] = header.split(' ');
        if (scheme === 'Bearer' && token) return token;
    }
    return req.cookies?.kodi_page_token || null;
};

const authenticateKodiPageSession = (req, res, next) => {
    const token = getKodiPageToken(req);
    if (!token) {
        return res.status(401).json({ success: false, error: 'Kodi page session required' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded || decoded.kind !== 'kodi_page') {
            return res.status(401).json({ success: false, error: 'Invalid Kodi session token' });
        }
        req.kodiSession = decoded;
        return next();
    } catch (error) {
        return res.status(401).json({ success: false, error: 'Invalid or expired Kodi session' });
    }
};

module.exports = { authenticateKodiPageSession };

