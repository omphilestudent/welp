const { psychologistHasLeadAccess } = require('../services/psychologistBillingService');

const requirePsychologistLeadAccess = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const allowed = await psychologistHasLeadAccess(req.user.id);
        if (!allowed) {
            return res.status(403).json({ error: 'Lead access is not available on your plan' });
        }
        return next();
    } catch (error) {
        console.error('Lead access check failed:', error.message);
        return res.status(500).json({ error: 'Unable to verify plan entitlements' });
    }
};

module.exports = {
    requirePsychologistLeadAccess
};
