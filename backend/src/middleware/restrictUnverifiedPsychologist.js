const restrictUnverifiedPsychologist = (req, res, next) => {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'psychologist') {
        return next();
    }
    const canUseProfile = req.user?.can_use_profile;
    if (canUseProfile === false || canUseProfile === 0) {
        return res.status(403).json({
            message: 'Profile restricted until KYC documents are approved',
            error: 'Profile restricted until KYC documents are approved'
        });
    }
    return next();
};

module.exports = { restrictUnverifiedPsychologist };
