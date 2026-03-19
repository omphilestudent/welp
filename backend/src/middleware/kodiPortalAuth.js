const jwt = require('jsonwebtoken');
const { getTokenFromRequest } = require('./auth');

const requireKodiFirstLoginComplete = (req, res, next) => {
    const token = getTokenFromRequest(req);
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.firstLogin) {
            return res.status(403).json({ error: 'Complete first login before accessing Kodi apps.' });
        }
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
    return next();
};

module.exports = {
    requireKodiFirstLoginComplete
};
